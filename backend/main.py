"""
dumpTrac FastAPI application.

This module initializes the FastAPI app, configures CORS middleware, 
serves the frontend, sets up the database schema, and registers API routes.

Features:
- Database tables are created on startup via SQLAlchemy.
- API routes are included under the `/api` prefix.
- Frontend files served from /frontend.
- Root endpoint ("/") serves index.html.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from backend.app.database import Base, engine
from backend.app.routes import router as api_router

# Path to frontend folder
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

# Initialize FastAPI app with lifespan
@asynccontextmanager
async def lifespan(_: FastAPI):
    # Startup logic: create tables
    Base.metadata.create_all(bind=engine)
    yield
    # Optional shutdown logic

app = FastAPI(title="dumpTrac", lifespan=lifespan)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount frontend static files
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# Register API routes under /api
app.include_router(api_router, prefix="/api")

# Root route serves index.html
@app.get("/")
def root():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"status": "ok", "message": "dumpTrac API"}

# Optional route for dashboard
@app.get("/dashboard")
def dashboard():
    dashboard_path = FRONTEND_DIR / "dashboard.html"
    if dashboard_path.exists():
        return FileResponse(dashboard_path)
    return {"status": "ok", "message": "Dashboard not found"}
