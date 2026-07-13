from fastapi import FastAPI, Response, status
from dotenv import load_dotenv
from services.tasks import scan_region
import os

load_dotenv()

app = FastAPI()



@app.get("/api/scan")
def start_scan(region):
    scan_region.delay(region)
    return {"message": "scan started"}

@app.get("/api/ping")
def ping():
    return {"message": "pong"} # for testing and auto cron(no cold starts) mewhehehehe