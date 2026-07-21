import json
from datetime import datetime
import requests
from dotenv import load_dotenv
import os
from groq import Groq
import time
import sqlite3

load_dotenv()

SYSTEM_PROMPT = """You are the CanopyWatch Legal Verification Agent.
Your role is to synthesize technical alerts with legal records to issue a final verdict.

OPERATE IN THIS LOOP (max 3 total steps):
1. REASON: State the facts and apply the DECISION RULES below, in order, exactly as written.
   Format: {"action": "REASON", "reasoning": "string"}
2. PUSH: Issue the final verdict. You MUST PUSH by your 3rd step, even if reasoning feels incomplete.
   Format: {"action": "PUSH", "status": "string", "reasoning": "string"}

FACTS PROVIDED: damage_percentage (0-100), location, date, cloudy_img, area_status, permit_status.

DECISION RULES — apply in this exact order, stop at the first rule that matches:
1. If damage_percentage == 0.0 → status = "Clear". (No damage = no crime, regardless of area_status or permit_status.)
2. If damage_percentage > 0.0 AND area_status == "PROTECTED" → status = "Illegal Logging".
3. If damage_percentage > 0.0 AND permit_status != "Valid Permit" → status = "Illegal Logging".
4. If damage_percentage > 0.0 AND permit_status == "Valid Permit" AND area_status != "PROTECTED" → status = "Clear".
5. If none of the above match (e.g. area_status is missing/unknown and permit_status is missing/unknown) → status = "Unknown".

HARD CONSTRAINTS — violating any of these is an error:
- The magnitude of damage_percentage (how large or small the number is) NEVER changes which rule applies. A damage_percentage of 0.1 and a damage_percentage of 99.0 are treated identically once damage_percentage > 0.0 — both are "damage occurred," nothing more.
- Never use words like "minor," "small," "low," or "relatively" to justify downgrading a status. These words may only describe the scale of damage, never the legal verdict.
- "Needs Review" may ONLY be used when required inputs (area_status or permit_status) are literally missing/null — never as a softer alternative to "Illegal Logging" when permit_status is "No records found" or similarly unauthorized.
- status must be exactly one of: "Illegal Logging", "Needs Review", "Clear", "Unknown".
- DO NOT output conversational text. ONLY JSON.
"""

Permit_Api = "https://ibama.gov.br"
SINAFLOR_RESOURCE_ID = os.getenv("SINAFLOR_RESOURCE_ID")
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

model = "llama-3.1-8b-instant"

DB_PATH = "/app/artifacts/sinaflor.db"


def query_sinaflor_records(lat, lon):
    buffer = 0.02
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM asv_permits
            WHERE CAST(REPLACE(LATITUDE_PONTO_CENTR_EMPREEND, ',', '.') AS FLOAT) BETWEEN ? AND ?
            AND CAST(REPLACE(LONGITUDE_PONTO_CENTR_EMPREEND, ',', '.') AS FLOAT) BETWEEN ? AND ?
        """, (lat - buffer, lat + buffer, lon - buffer, lon + buffer))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        print(f"SINAFLOR local query failed: {e}")
        return []



def get_permit_status(records, event_date_str):
    if not records:
        return "No records found"

    event_dt = datetime.strptime(event_date_str, "%Y-%m-%d")
    VALID_STATUSES = {"EMITIDA", "VALIDA", "DEFERIDO", "AUTORIZADA", "ATIVA"}  # confirm real values below

    for p in records:
        situacao = str(p.get("SITUACAO", "")).upper().strip()

        try:
            start = datetime.strptime(p.get("DATA_DE_EMISSAO", ""), "%d/%m/%Y")
            end = datetime.strptime(p.get("DATA_DE_VALIDADE", ""), "%d/%m/%Y")
        except (ValueError, TypeError) as e:
            print(f"SINAFLOR date parse failed for {p.get('NRO_AUTORIZACAO')}: {e}")
            continue

        if situacao in VALID_STATUSES and start <= event_dt <= end:
            return "Valid Permit"

    return "Expired or No Matching Permit"

def call_llm(messages):
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.0,
        response_format={"type": "json_object"},
    )

    text = response.choices[0].message.content

    try:
        parsed = json.loads(text)
    except Exception:
        parsed = None

    return {
        "raw": text,
        "json": parsed,
    }


def run_agent_loop(ai_response):
    lat = ai_response.get("lat")
    lon = ai_response.get("lon")
    event_date = ai_response.get("date")

    records = query_sinaflor_records(lat, lon)
    permit_status = get_permit_status(records, event_date)
    ai_response["permit_status"] = permit_status
    history = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": json.dumps(ai_response),
        },
    ]

    reasoning_steps = []
    max_steps = 3
    current_step = 0

    while current_step < max_steps:
        result = call_llm(history)

        if result["json"] is None:
            raise RuntimeError("LLM returned invalid JSON")

        msg = result["json"]
        action = msg.get("action")

        history.append(
            {
                "role": "assistant",
                "content": json.dumps(msg),
            }
        )

        if action == "REASON":
            reasoning_steps.append(msg.get("reasoning", "Analyzing data..."))

            history.append(
                {
                    "role": "user",
                    "content": "Continue reasoning or PUSH if ready.",
                }
            )

            current_step += 1

            if current_step < max_steps: # back off becaue it was spamming groqs api
                time.sleep(15)

            continue

        if action == "PUSH":
            return {
                "status": msg["status"],
                "reasoning": reasoning_steps,
                "final_reasoning": msg["reasoning"],
            }

        raise RuntimeError(f"Unknown action: {action}")