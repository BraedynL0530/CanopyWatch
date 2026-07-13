from fastapi import FastAPI, Response, status
from dotenv import load_dotenv
from services.tasks import scan_region
import os
import psutil

load_dotenv()

app = FastAPI()



@app.get("/api/scan")
def start_scan(region):
    scan_region.delay(region)
    return {"message": "scan started"}

@app.get("/api/health")
def health():
    RAM = psutil.virtual_memory().percent
    CPU = psutil.cpu_percent()
    return {"RAM": RAM, "CPU": CPU}
@app.get("/api/ping")
def ping():
    return {"message": "pong"}
