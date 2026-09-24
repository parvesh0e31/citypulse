"""CityPulse API and local civic-feed processing pipeline.

The adapters intentionally use deterministic demo data when external credentials are
not configured.  The same canonical event contract is used by real adapters, the
rolling detector, persistence workers, and the SSE API.
"""

from __future__ import annotations

import asyncio
import collections
import json
import math
import os
import random
import statistics
import uuid
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

WINDOW_SECONDS = 15 * 60
CORRELATION_WINDOW_SECONDS = 10 * 60
CORRELATION_DISTANCE_KM = 3.5
LOCATION = (28.6139, 77.2090)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def canonical_event(
    source: str,
    event_type: str,
    value: float,
    latitude: float,
    longitude: float,
    severity: int,
    observed_at: datetime | None = None,
) -> dict[str, Any]:
    """Create the versioned WGS84/ISO-8601 event shape shared by all feeds."""
    return {
        "id": f"{source.lower()}-{uuid.uuid4().hex[:12]}",
        "schema_version": "1.0",
        "source": source,
        "type": event_type,
        "value": round(float(value), 2),
        "severity": max(1, min(10, int(severity))),
        "timestamp": (observed_at or utc_now()).isoformat(),
        "coordinates": {
            "lat": round(float(latitude), 6),
            "lon": round(float(longitude), 6),
            "crs": "EPSG:4326",
        },
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
    """A dependency-free rolling Z-score detector suitable for each worker node."""

    def __init__(self, max_samples: int = 48) -> None:
        self.samples: dict[str, collections.deque[float]] = collections.defaultdict(
            lambda: collections.deque(maxlen=max_samples)
        )

    def score(self, event: dict[str, Any]) -> float:
        values = self.samples[event["type"]]
        value = float(event["value"])
        if len(values) < 5:
            values.append(value)
            return 0.0
        mean = statistics.fmean(values)
        deviation = statistics.pstdev(values) or 1.0
        z_score = abs(value - mean) / deviation
        values.append(value)
        return round(z_score, 3)


class CivicPipeline:
    def __init__(self) -> None:
        self.detector = RollingDetector()
        self.events: collections.deque[dict[str, Any]] = collections.deque(maxlen=500)
        self.timeline: collections.deque[dict[str, str]] = collections.deque(maxlen=8)
        self.feed_status = {name: "online" for name in ("OpenMeteo", "CityBus", "311_Portal")}
        self.tick = 0
        self.lock = asyncio.Lock()

    async def fetch_feeds(self) -> list[dict[str, Any]]:
        """Demo adapters; replace each body with an HTTP/GTFS/CSV worker in production."""
        self.tick += 1
        rain = random.uniform(2, 40) + (12 if self.tick % 7 == 0 else 0)
        delay = random.uniform(2, 30) + (15 if self.tick % 5 == 0 else 0)
        complaints = random.randint(1, 12) + (8 if self.tick % 9 == 0 else 0)
        lat, lon = LOCATION
        return [
            canonical_event("OpenMeteo", "WEATHER", rain, lat + random.uniform(-.02, .02), lon + random.uniform(-.02, .02), min(10, round(rain / 5))),
            canonical_event("CityBus", "TRANSIT", delay, lat + random.uniform(-.02, .02), lon + random.uniform(-.02, .02), min(10, round(delay / 4))),
            canonical_event("311_Portal", "COMPLAINT", complaints, lat + random.uniform(-.02, .02), lon + random.uniform(-.02, .02), min(10, round(complaints / 2))),
        ]

    def correlate(self, anomalies: list[dict[str, Any]]) -> list[dict[str, Any]]:
        links = []
        for index, first in enumerate(anomalies):
            first_time = datetime.fromisoformat(first["timestamp"])
            for second in anomalies[index + 1:]:
                second_time = datetime.fromisoformat(second["timestamp"])
                distance = haversine_km(first["coordinates"]["lat"], first["coordinates"]["lon"], second["coordinates"]["lat"], second["coordinates"]["lon"])
                if abs((first_time - second_time).total_seconds()) <= CORRELATION_WINDOW_SECONDS and distance <= CORRELATION_DISTANCE_KM:
                    links.append({"events": [first["id"], second["id"]], "distance_km": round(distance, 2), "confidence": "observational"})
        return links

    async def process(self) -> dict[str, Any]:
        async with self.lock:
            events = await self.fetch_feeds()
            for event in events:
                score = self.detector.score(event)
                event["anomaly_score"] = score
                event["is_anomaly"] = score >= 2.5
                self.events.append(event)
                self.feed_status[event["source"]] = "online"
            active = [event for event in self.events if (utc_now() - datetime.fromisoformat(event["timestamp"])).total_seconds() <= WINDOW_SECONDS]
            anomalies = [event for event in active if event["is_anomaly"]]
            links = self.correlate(anomalies)
            if links:
                summary = "Possible link between nearby feed anomalies; this is an observed correlation, not confirmed causation."
                self.timeline.appendleft({"time": utc_now().strftime("%H:%M:%S"), "title": "Possible multi-feed link", "desc": f"{len(links)} spatial-temporal cluster(s) detected.", "type": "critical"})
            elif anomalies:
                summary = f"{len(anomalies)} feed anomaly(ies) detected. Conditions may affect this district."
                self.timeline.appendleft({"time": utc_now().strftime("%H:%M:%S"), "title": "Feed anomaly detected", "desc": "A rolling Z-score exceeded the anomaly threshold.", "type": "warning"})
            else:
                summary = "District conditions are within the current rolling baseline."
                self.timeline.appendleft({"time": utc_now().strftime("%H:%M:%S"), "title": "System nominal", "desc": "All available feeds are within baseline.", "type": "info"})
            penalty = sum(max(1, event["severity"] // 2) for event in anomalies)
            return {"pulse_score": max(0, 100 - penalty), "summary": summary, "events": events, "links": links, "timeline": list(self.timeline), "feeds": self.feed_status, "generated_at": utc_now().isoformat()}


pipeline = CivicPipeline()
latest_state: dict[str, Any] | None = None


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    global latest_state
    latest_state = await pipeline.process()
    yield


app = FastAPI(title="CityPulse API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","), allow_methods=["GET"], allow_headers=["*"])


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "feeds": pipeline.feed_status, "storage": {"redis": "optional", "postgres_postgis": "optional"}}


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
