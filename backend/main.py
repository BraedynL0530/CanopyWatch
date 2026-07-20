import json

from fastapi import FastAPI, Response, status
from dotenv import load_dotenv
from backend.services.tasks import scan_region,seed_historical_data
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import glob
import psutil

load_dotenv()
app = FastAPI()
app.mount("/api/static", StaticFiles(directory="/app/artifacts"), name="artifacts")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/scan") # no longer used for now since i changed how but it was allways a testing endpoint
def start_scan(region):
    scan_region.delay(region)
    return {"message": "scan started"}


@app.get("/api/get-latest-scans")
def get_latest_scans():
    files = glob.glob("artifacts/*.json")
    if not files:
        return {"error": "No scans found"}

    results = []

    for f in files:
        with open(f, "r") as file:
            data = json.load(file)
            scan_id = data.get("id")

            data["before_url"] = f"/api/static/before_{scan_id}.png"
            data["after_url"] = f"/api/static/after_{scan_id}.png"

            results.append(data)

    results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    return {"scans": results}

@app.get("/api/historic-scans") # one of on prod then api is removed./
def historic_scans():
    seed_historical_data.delay()
    return {"message": "scan started"}
@app.get("/api/health")
def health():
    RAM = psutil.virtual_memory().percent
    CPU = psutil.cpu_percent()
    return {"RAM": RAM, "CPU": CPU}
@app.get("/api/ping")
def ping():
    return {"message": "pong"}
