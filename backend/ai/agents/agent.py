import json
from datetime import datetime
import requests
from dotenv import load_dotenv
import os
from fastapi import FastAPI
load_dotenv()
app = FastAPI()
SYS_PROMPT = """You are the CanopyGuard Legal Verification Agent. 
Your job is to receive deforestation alerts, check their coordinates against Brazilian environmental registries (Sinaflor/IBAMA and SICAR), and determine the legality of the logging before pushing a case to the dashboard.

You operate in a strict Action-Observation loop. You must output ONLY valid JSON. 

AVAILABLE ACTIONS:
1. SEARCH: Query the coordinate for active logging permits and protected area status.
   Format: {"action": "SEARCH", "lat": float, "lon": float}

2. PUSH: Send the final evaluated case to the dashboard. The status MUST be one of: "Illegal Logging (Presumed)", "Needs Permit", or "Unknown".
   Format: {"action": "PUSH", "status": "string", "reasoning": "string"}

RULES:
- You must always SEARCH before you PUSH.
- If the SEARCH observation returns no active permits in a protected area, status is "Illegal Logging (Presumed)".
- If the SEARCH observation shows an unregistered property, status is "Needs Permit".
- If the data is corrupted or inconclusive, status is "Unknown".
- DO NOT output any conversational text. Output ONLY the JSON object."""

#data comes from ML model which spots deforestation, the agent pushes it to dashboard and deems if its legal

Permit_Api = "https://ibama.gov.br"
SINAFLOR_RESOURCE_ID = os.getenv("SINAFLOR_RESOURCE_ID")


def get_permit_status(lat, long, ndvi_event_date): #yippy
    buffer = 0.008
    lat_min, lat_max = lat - buffer, lat + buffer
    long_min, long_max = long - buffer, long + buffer


    sql_query = f"""
    SELECT SITUACAO_AUTORIZACAO, DT_EMISSAO, DT_VALIDADE 
    FROM "{SINAFLOR_RESOURCE_ID}" 
    WHERE LATITUDE BETWEEN {lat_min} AND {lat_max} 
      AND LONGITUDE BETWEEN {long_min} AND {long_max}
    """

    try:
        response = requests.get(Permit_Api, params={'sql': sql_query}, timeout=10)

        if response.status_code != 200:
            return "UNKNOWN_SERVER_ERROR"

        records = response.json().get('result', {}).get('records', [])

    except requests.exceptions.RequestException:
        return "UNKNOWN_CONNECTION_TIMEOUT"

    #no records = illegal
    if not records:
        return "ILLEGAL"

    event_dt = datetime.strptime(ndvi_event_date, "%Y-%m-%d")

    for permit in records:
        status = str(permit.get("SITUACAO_AUTORIZACAO", "")).strip().upper()
        raw_start = str(permit.get("DT_EMISSAO", "")).strip()
        raw_end = str(permit.get("DT_VALIDADE", "")).strip()

        # If it's explicitly valid, verify the dates
        if status in ["EMITIDA", "VALIDA", "HOMOLOGADA"]:
            try:
                start_dt = datetime.strptime(raw_start, "%d/%m/%Y")
                end_dt = datetime.strptime(raw_end, "%d/%m/%Y")

                # If the NDVI change happened while the permit was active, it is legal
                if start_dt <= event_dt <= end_dt:
                    return "LEGAL"
            except ValueError:

                continue
    return "ILLEGAL"

def call_llm():
    pass

def run_agent_loop(ai_results, img_path): #probally gonna need to change to matdch call llm
    print("[System] ML Model finished. Initializing Verification Agent...")

    lat, lon = ai_results["lat"], ai_results["lon"]
    event_date = ai_results.get("date", "2025-07-15")
    results = "Unknown"

    messages = [
        {"role": "system", "content": SYS_PROMPT},
        {"role": "user",
         "content": f"NEW ALERT: Deforestation detected with {ai_results['confidence'] * 100}% confidence at lat: {lat}, lon: {lon}. Event date: {event_date}."}
    ]

    max_turns = 3
    for turn in range(max_turns):
        llm_response = call_llm(messages)
        messages.append({"role": "assistant", "content": llm_response})

        try:
            command = json.loads(llm_response)
        except json.JSONDecodeError:
            print("ai slop didnt return json right")
            break

        action = command.get("action")

        if action == "SEARCH":
            results = get_permit_status(command.get("lat"), command.get("lon"), command.get("date"))
            observation_text = f"OBSERVATION: {json.dumps(results)}"
            messages.append({"role": "user", "content": observation_text})

        elif action == "PUSH":
            push_to_dashboard(results,"filler for ml",img_path)

def push_to_dashboard(permit_status,ai_results,img_path):
    pass

permit_status = get_permit_status(lat=-67.21, long=-41.00, ndvi_event_date="2026-07-09")

print(f"Deforestation Status: {permit_status}")