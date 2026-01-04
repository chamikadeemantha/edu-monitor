from fastapi import FastAPI
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import performance module routes
from modules.performance.routes import router as performance_router

# Teacher behavior API
try:
    from modules.teacher_behavior.api import router as teacher_behavior_router
except Exception:
    teacher_behavior_router = None

from modules.engagement.run_inference import run_inference, LATEST_STATS, STATS_HISTORY, LATEST_GROUP_STATS, set_group_visualization
from pydantic import BaseModel

# Attendance router
from modules.attendance.routes import router as attendance_router


app = FastAPI()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ok for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(performance_router)

@app.get("/")
def read_root():
    return {"message": "Engagement Detection API is running"}

# Mount teacher behavior routes if available
if teacher_behavior_router is not None:
    app.include_router(teacher_behavior_router, prefix="/teacher_behavior")

# Server-side teacher behavior inference (stream + stats)
try:
    from modules.teacher_behavior.inference import run_teacher_inference, get_latest_stats
except Exception as e:
    print(f"CRITICAL: modules.teacher_behavior.inference failed to import: {e}")
    run_teacher_inference = None
    def get_latest_stats():
        return {"behavior": "Unavailable", "mobility": 0.0, "orientation": 0.0, "hand_speed": 0.0}

from fastapi.responses import JSONResponse


@app.get('/teacher_feed')
def teacher_feed():
    if run_teacher_inference is None:
        return StreamingResponse(iter([b"" ]), media_type="multipart/x-mixed-replace; boundary=frame")
    return StreamingResponse(run_teacher_inference(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get('/api/teacher_stats')
def teacher_stats():
    return JSONResponse(content=get_latest_stats())


@app.get('/api/teacher_stats/report')
def teacher_report():
    report_path = os.path.join(os.path.dirname(__file__), 'modules', 'teacher_behavior', 'reports', 'teacher_behavior_report.csv')
    if os.path.exists(report_path):
        return FileResponse(report_path, media_type='text/csv', filename='teacher_behavior_report.csv')
    return JSONResponse(content={"error": "Report not found"}, status_code=404)
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
    return StreamingResponse(
        run_inference(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

app.include_router(attendance_router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

