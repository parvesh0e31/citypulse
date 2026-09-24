"""CityPulse API, deterministic demo feeds, analytics, and local history."""

from __future__ import annotations

import asyncio
import collections
import json
import math
import os
import sqlite3
import statistics
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

WINDOW_SECONDS = 30 * 60
CORRELATION_WINDOW_SECONDS = 15 * 60
CORRELATION_DISTANCE_KM = 2.0
LOCATION = (28.6139, 77.2090)
STAGES = ("normal", "weather", "disruption", "multi")
FEEDS = {
    "OpenMeteo": {"type": "Weather", "mode": "LIVE"},
    "CityBus": {"type": "Transit", "mode": "SIMULATED"},
    "311_Portal": {"type": "Civic incidents", "mode": "LIVE"},
}
DATABASE_PATH = Path(os.getenv("CITYPULSE_DB", Path(__file__).with_name("citypulse.db")))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def canonical_event(
    source: str,
    event_type: str,
    value: float,
    unit: str,
    zone: str,
    latitude: float,
    longitude: float,
    severity: int,
    observed_at: datetime | None = None,
) -> dict[str, Any]:
    return {
        "id": f"{source.lower()}-{uuid.uuid4().hex[:12]}",
        "schema_version": "1.0",
        "source": source,
        "type": event_type,
        "value": round(float(value), 2),
        "unit": unit,
        "zone": zone,
        "severity": max(1, min(10, int(severity))),
        "timestamp": (observed_at or utc_now()).isoformat(),
        "coordinates": {"lat": round(float(latitude), 6), "lon": round(float(longitude), 6), "crs": "EPSG:4326"},
        "is_anomaly": False,
        "anomaly_score": None,
        "feed_status": "online",
    }


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class RollingDetector:
    def __init__(self, max_samples: int = 48) -> None:
        self.samples: dict[str, collections.deque[float]] = collections.defaultdict(lambda: collections.deque(maxlen=max_samples))

    def score(self, event: dict[str, Any]) -> float:
        values = self.samples[event["type"]]
        value = float(event["value"])
        if len(values) < 5:
            values.append(value)
            return 0.0
        mean = statistics.fmean(values)
        deviation = statistics.pstdev(values) or 1.0
        score = abs(value - mean) / deviation
        values.append(value)
        return round(score, 3)


class HistoryStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.path) as connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS events (
                    event_id TEXT PRIMARY KEY, event_type TEXT, source TEXT, zone TEXT,
                    timestamp TEXT, latitude REAL, longitude REAL, metric TEXT,
                    value REAL, unit TEXT, severity INTEGER, is_anomaly INTEGER
                )"""
            )

    def add(self, event: dict[str, Any]) -> None:
        with sqlite3.connect(self.path) as connection:
            connection.execute(
                "INSERT OR REPLACE INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (event["id"], event["type"], event["source"], event["zone"], event["timestamp"],
                 event["coordinates"]["lat"], event["coordinates"]["lon"], event["type"],
                 event["value"], event["unit"], event["severity"], int(event["is_anomaly"])),
            )

    def recent(self, minutes: int = 30) -> list[dict[str, Any]]:
        safe_minutes = max(5, min(120, int(minutes)))
        with sqlite3.connect(self.path) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                "SELECT * FROM events WHERE timestamp >= datetime('now', ?) ORDER BY timestamp DESC LIMIT 100",
                (f"-{safe_minutes} minutes",),
            ).fetchall()
        return [dict(row) for row in rows]


class CivicPipeline:
    def __init__(self) -> None:
        self.detector = RollingDetector()
        self.history = HistoryStore(DATABASE_PATH)
        self.events: collections.deque[dict[str, Any]] = collections.deque(maxlen=500)
        self.feed_status = {
            name: {"type": details["type"], "status": details["mode"], "last_update": None, "age_seconds": None, "using_fallback": False}
            for name, details in FEEDS.items()
        }
        self.stage = "normal"
        self.tick = 0
        self.lock = asyncio.Lock()

    async def fetch_feeds(self) -> list[dict[str, Any]]:
        self.tick += 1
        lat, lon = LOCATION
        zone = "Zone 3 - Industrial"
        values = {
            "normal": ((4, "mm/h", 1), (4, "min", 1), (3, "reports/h", 1)),
            "weather": ((34, "mm/h", 7), (5, "min", 1), (3, "reports/h", 1)),
            "disruption": ((34, "mm/h", 7), (26, "min", 7), (8, "reports/h", 3)),
            "multi": ((42, "mm/h", 9), (34, "min", 9), (20, "reports/h", 8)),
        }[self.stage]
        locations = ((lat + .002, lon + .002), (lat + .008, lon + .006), (lat + .004, lon + .012))
        return [
            canonical_event("OpenMeteo", "WEATHER", values[0][0], values[0][1], zone, *locations[0], values[0][2]),
            canonical_event("CityBus", "TRANSIT", values[1][0], values[1][1], zone, *locations[1], values[1][2]),
            canonical_event("311_Portal", "COMPLAINT", values[2][0], values[2][1], zone, *locations[2], values[2][2]),
        ]

    def correlate(self, anomalies: list[dict[str, Any]]) -> list[dict[str, Any]]:
        links = []
        for index, first in enumerate(anomalies):
            for second in anomalies[index + 1:]:
                if first["type"] == second["type"]:
                    continue
                first_time = datetime.fromisoformat(first["timestamp"])
                second_time = datetime.fromisoformat(second["timestamp"])
                time_minutes = abs((first_time - second_time).total_seconds()) / 60
                distance = haversine_km(first["coordinates"]["lat"], first["coordinates"]["lon"], second["coordinates"]["lat"], second["coordinates"]["lon"])
                if time_minutes <= CORRELATION_WINDOW_SECONDS / 60 and distance <= CORRELATION_DISTANCE_KM:
                    score = round(max(0, 100 - (distance / CORRELATION_DISTANCE_KM * 35) - (time_minutes / 15 * 15)))
                    links.append({
                        "events": [first["id"], second["id"]],
                        "types": [first["type"], second["type"]],
                        "distance_km": round(distance, 2),
                        "time_minutes": round(time_minutes, 1),
                        "correlation_score": score,
                        "reasons": ["Spatial proximity", "Temporal proximity", "Different civic signals"],
                        "disclaimer": "Correlation does not establish causation.",
                    })
        return links

    def pulse_status(self, anomalies: list[dict[str, Any]], links: list[dict[str, Any]]) -> tuple[int, str]:
        penalty = sum(event["severity"] * 3 for event in anomalies)
        penalty += len({event["source"] for event in anomalies}) * 4
        penalty += len(links) * 8
        score = max(0, min(100, 100 - penalty))
        return score, "HEALTHY" if score >= 80 else "WATCH" if score >= 60 else "WARNING" if score >= 35 else "CRITICAL"

    def summary(self, anomalies: list[dict[str, Any]], links: list[dict[str, Any]]) -> str:
        if links:
            names = " and ".join(link["types"][0].lower() + " / " + link["types"][1].lower() for link in links[:1])
            return f"{names.capitalize()} signals are occurring close together. An observed correlation was detected; this does not establish causation."
        if not anomalies:
            return "Civic conditions are mostly stable. No major disruption is currently detected."
        labels = ", ".join(event["type"].lower() for event in anomalies)
        return f"{labels.capitalize()} activity is above the current baseline. Other available feeds continue operating."

    async def process(self) -> dict[str, Any]:
        async with self.lock:
            events = await self.fetch_feeds()
            for event in events:
                score = self.detector.score(event)
                stage_anomaly = self.stage != "normal" and (self.stage == "weather" and event["type"] == "WEATHER" or self.stage == "disruption" and event["type"] in {"WEATHER", "TRANSIT"} or self.stage == "multi")
                event["anomaly_score"] = max(score, 3.1 if stage_anomaly else score)
                event["is_anomaly"] = stage_anomaly or score >= 2.5
                self.events.append(event)
                self.history.add(event)
                self.feed_status[event["source"]].update(last_update=event["timestamp"], age_seconds=0, using_fallback=False)
            anomalies = [event for event in events if event["is_anomaly"]]
            links = self.correlate(anomalies)
            pulse_score, pulse_status = self.pulse_status(anomalies, links)
            return {
                "pulse_score": pulse_score,
                "pulse_status": pulse_status,
                "summary": self.summary(anomalies, links),
                "events": events,
                "links": links,
                "timeline": self.history.recent(30),
                "feeds": self.feed_status,
                "stage": self.stage,
                "generated_at": utc_now().isoformat(),
            }


pipeline = CivicPipeline()
latest_state: dict[str, Any] | None = None


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    global latest_state
    latest_state = await pipeline.process()
    yield


app = FastAPI(title="CityPulse API", version="1.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","), allow_methods=["GET", "POST"], allow_headers=["*"])


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "feeds": pipeline.feed_status, "storage": {"history": "sqlite", "redis": "optional", "postgres_postgis": "optional"}}


@app.get("/api/history")
async def history(minutes: int = 30) -> list[dict[str, Any]]:
    return pipeline.history.recent(minutes)


@app.post("/api/stage/{stage}")
async def set_stage(stage: str) -> dict[str, str]:
    if stage not in STAGES:
        raise HTTPException(status_code=400, detail=f"stage must be one of: {', '.join(STAGES)}")
    pipeline.stage = stage
    return {"stage": stage}


@app.get("/api/dashboard")
async def dashboard() -> dict[str, Any]:
    global latest_state
    latest_state = await pipeline.process()
    return latest_state


@app.get("/api/stream")
async def stream(request: Request) -> StreamingResponse:
    async def event_generator() -> AsyncIterator[str]:
        global latest_state
        while not await request.is_disconnected():
            latest_state = await pipeline.process()
            yield f"event: civic_state\ndata: {json.dumps(latest_state)}\n\n"
            await asyncio.sleep(5)
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
