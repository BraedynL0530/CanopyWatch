from fastapi import APIRouter
from ai.agents.agent import run_agent_loop

router = APIRouter(
    prefix="/api/legality",
    tags=["Legal Verification"]
)


@router.get("/verify-patch")
def get_legality(lat: float, lon: float, date: str):

    # Create the mock ML payload from the incoming query parameters
    ai_results = {
        "lat": lat,
        "lon": lon,
        "confidence": 0.96,
        "date": date
    }

    mock_image = "/artifacts/canopyguard_patch_142.tif"

    run_agent_loop(ai_results, mock_image)

    return {"status": "Agent pipeline started", "coordinates": [lat, lon]}