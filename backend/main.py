from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

# Import the refactored inference generator
from modules.engagement.run_inference import run_inference, LATEST_STATS, STATS_HISTORY, LATEST_GROUP_STATS, set_group_visualization
from pydantic import BaseModel

app = FastAPI()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Explicit origin for Next.js to avoid CORS credential issues
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Engagement Detection API is running"}

@app.get("/stats")
def get_stats():
    return LATEST_STATS

@app.get("/stats/history")
def get_stats_history():
    return STATS_HISTORY

@app.get("/stats/groups")
def get_stats_groups():
    return LATEST_GROUP_STATS

class VisualizeRequest(BaseModel):
    enabled: bool

@app.post("/settings/visualize-groups")
def set_visualize_groups(req: VisualizeRequest):
    set_group_visualization(req.enabled)
    return {"status": "ok", "enabled": req.enabled}

class VisualStyleRequest(BaseModel):
    style: str

@app.post("/settings/visual-style")
def set_visual_style_endpoint(req: VisualStyleRequest):
    from modules.engagement.run_inference import set_visual_style
    set_visual_style(req.style)
    return {"status": "ok", "style": req.style}

class ZoneSettingsRequest(BaseModel):
    back_split: float
    front_split: float

@app.post("/settings/zones")
def set_zone_settings(req: ZoneSettingsRequest):
    from modules.engagement.run_inference import set_zone_boundaries
    set_zone_boundaries(req.back_split, req.front_split)
    return {"status": "ok", "zones": {"back": req.back_split, "front": req.front_split}}


@app.get("/video_feed")
def video_feed():
    # Stream the generator response
    return StreamingResponse(run_inference(), 
                             media_type="multipart/x-mixed-replace; boundary=frame")

if __name__ == "__main__":
    # Run on localhost:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
