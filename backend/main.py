import json

from fastapi import FastAPI, Response, status
from dotenv import load_dotenv
from services.tasks import scan_region
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import glob
import psutil

load_dotenv()
app = FastAPI()
app.mount("/static", StaticFiles(directory="artifacts"), name="artifacts")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update this to your frontend URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/api/scan")
def start_scan(region):
    scan_region.delay(region)
    return {"message": "scan started"}

@app.get("/api/get-latest-scans")
def get_latest_scans():
    files = glob.glob("artifacts/*.json")
    if not files:
        return {"error": "No scans found"}
    latest_file = max(files, key=os.path.getctime)
    scan_id = os.path.basename(latest_file).replace("before_", "").replace(".png", "")
    results = []

    for f in files:
        with open(f, "r") as file:
            data = json.load(file)
            scan_id = data.get("id")
            data["before_url"] = f"/static/before_{scan_id}.png"
            data["after_url"] = f"/static/after_{scan_id}.png"

            results.append(data)

    results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"scans": results}
@app.get("/api/health")
def health():
    RAM = psutil.virtual_memory().percent
    CPU = psutil.cpu_percent()
    return {"RAM": RAM, "CPU": CPU}
@app.get("/api/ping")
def ping():
    return {"message": "pong"}
