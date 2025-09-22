from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routes import router as api_router

app = FastAPI(title="dumpTrac")

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create tables on startup (simple MVP; replace with Alembic later)

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "message": "dumpTrac API"}
