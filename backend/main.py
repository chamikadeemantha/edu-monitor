from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Engagement
from modules.engagement.run_inference import run_inference

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

@app.get("/")
def read_root():
    return {"message": "Engagement Detection API is running"}

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(
        run_inference(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

app.include_router(attendance_router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
