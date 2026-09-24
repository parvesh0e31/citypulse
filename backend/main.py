import asyncio
import random
import math
import json
import collections
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Rolling memory for the timeline (keeps the last 6 entries)
timeline_log = collections.deque(maxlen=6)

def normalize_event(source, event_type, value, lat, lon):
    return {
        "id": f"{source}_{random.randint(1000, 9999)}",
        "timestamp": datetime.utcnow().isoformat(),
        "source": source,
        "type": event_type,
        "value": value,
        "lat": lat,
        "lon": lon,
        "is_anomaly": False
    }

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

def generate_civic_state():
    rain_mm = random.uniform(2.0, 40.0)
    transit_delay = random.uniform(2.0, 30.0)
    complaints = random.randint(1, 12)

    events = [
        normalize_event("OpenMeteo", "WEATHER", rain_mm, 28.615 + random.uniform(-0.02, 0.02), 77.205 + random.uniform(-0.02, 0.02)),
        normalize_event("CityBus", "TRANSIT", transit_delay, 28.612 + random.uniform(-0.02, 0.02), 77.208 + random.uniform(-0.02, 0.02)),
        normalize_event("311_Portal", "COMPLAINT", complaints, 28.610 + random.uniform(-0.02, 0.02), 77.200 + random.uniform(-0.02, 0.02))
    ]

    for ev in events:
        if ev["type"] == "WEATHER" and ev["value"] > 25.0: ev["is_anomaly"] = True
        if ev["type"] == "TRANSIT" and ev["value"] > 20.0: ev["is_anomaly"] = True
        if ev["type"] == "COMPLAINT" and ev["value"] > 8: ev["is_anomaly"] = True

    anomalies = [e for e in events if e["is_anomaly"]]
    correlation_msg = None
    pulse_score = 100 - (len(anomalies) * 15)

    if len(anomalies) >= 2:
        dist = haversine_km(anomalies[0]["lat"], anomalies[0]["lon"], anomalies[1]["lat"], anomalies[1]["lon"])
        if dist <= 3.5:
            correlation_msg = (
                f"Possible link: Elevated {anomalies[0]['type'].lower()} coincides with "
                f"{anomalies[1]['type'].lower()} disruptions in the same sector. "
                "Observed correlation, not confirmed causation."
            )

    summary = correlation_msg if correlation_msg else "District parameters are operating within nominal thresholds."

    # --- Timeline Generation Logic ---
    current_time = datetime.utcnow().strftime("%H:%M:%S")
    if correlation_msg:
        # Prevent spamming the same critical alert every 5 seconds
        if not timeline_log or timeline_log[0]["type"] != "critical":
            timeline_log.appendleft({"time": current_time, "title": "Multi-Feed Correlation", "desc": "Spatio-temporal link detected in sector.", "type": "critical"})
    elif anomalies:
        if not timeline_log or timeline_log[0]["type"] != "warning":
            a = anomalies[0]
            timeline_log.appendleft({"time": current_time, "title": f"{a['type']} Anomaly", "desc": f"Value {a['value']:.1f} exceeds baseline.", "type": "warning"})
    else:
        if not timeline_log or timeline_log[0]["type"] != "info":
            timeline_log.appendleft({"time": current_time, "title": "System Nominal", "desc": "All sensors stabilized.", "type": "info"})

    return {
        "pulse_score": max(0, pulse_score),
        "summary": summary,
        "events": events,
        "timeline": list(timeline_log)
    }

@app.get("/api/dashboard")
def get_dashboard():
    return generate_civic_state()

@app.get("/api/stream")
async def stream_civic_data():
    async def event_generator():
        while True:
            state = generate_civic_state()
            yield f"data: {json.dumps(state)}\n\n"
            await asyncio.sleep(5)
    return StreamingResponse(event_generator(), media_type="text/event-stream")