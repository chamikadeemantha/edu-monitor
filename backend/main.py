from fastapi import FastAPI
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

# Import the refactored inference generator
from modules.engagement.run_inference import run_inference
# Teacher behavior API
try:
    from modules.teacher_behavior.api import router as teacher_behavior_router
except Exception:
    teacher_behavior_router = None

app = FastAPI()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/video_feed")
def video_feed():
    # Stream the generator response
    return StreamingResponse(run_inference(), 
                             media_type="multipart/x-mixed-replace; boundary=frame")

if __name__ == "__main__":
    # Run on localhost:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
