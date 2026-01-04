from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

# Import the refactored inference generator
from modules.engagement.run_inference import run_inference
# Import performance module routes
from modules.performance.routes import router as performance_router

app = FastAPI()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(performance_router)

@app.get("/")
def read_root():
    return {"message": "Engagement Detection API is running"}

@app.get("/video_feed")
def video_feed():
    # Stream the generator response
    return StreamingResponse(run_inference(), 
                             media_type="multipart/x-mixed-replace; boundary=frame")

if __name__ == "__main__":
    # Run on localhost:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)

