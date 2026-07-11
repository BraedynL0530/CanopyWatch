import json
from datetime import datetime
import requests
from dotenv import load_dotenv
import os
load_dotenv()

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


def query_sinaflor_records(lat, lon):
    buffer = 0.008
    sql = f"""SELECT SITUACAO_AUTORIZACAO, DT_EMISSAO, DT_VALIDADE 
              FROM "{SINAFLOR_RESOURCE_ID}" 
              WHERE LATITUDE BETWEEN {lat - buffer} AND {lat + buffer} 
              AND LONGITUDE BETWEEN {lon - buffer} AND {lon + buffer}"""
    try:
        resp = requests.get(SINAFLOR_RESOURCE_ID, params={'sql': sql}, timeout=10)
        return resp.json().get('result', {}).get('records', []) if resp.status_code == 200 else []
    except:
        return []


def get_permit_status(records, event_date_str):
    if not records: return "Illegal Logging (Presumed)"

    event_dt = datetime.strptime(event_date_str, "%Y-%m-%d")
    for p in records:
        status = str(p.get("SITUACAO_AUTORIZACAO", "")).upper()
        try:
            start = datetime.strptime(p.get("DT_EMISSAO"), "%d/%m/%Y")
            end = datetime.strptime(p.get("DT_VALIDADE"), "%d/%m/%Y")
            if status in ["EMITIDA", "VALIDA"] and start <= event_dt <= end:
                return "Legal"
        except:
            continue
    return "Illegal Logging (Presumed)"

def call_llm():
    pass


def run_agent_loop(ai_response):
    pass