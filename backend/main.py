from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from backend.routes.sensor import router as sensor_router
from backend.routes.accidents import router as accidents_router

from backend.services.database import initialize_database
from backend.routes.contacts import router as contacts_router
from backend.routes.notifications import router as notifications_router
from backend.routes.hospitals import router as hospitals_router
from backend.routes.admin import router as admin_router


app = FastAPI(
    title="AcciSafe API",
    description="Motorcycle Accident Detection and Emergency Response System",
    version="1.0.0"
)


# Allow the React frontend to communicate with the FastAPI backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


initialize_database()

app.include_router(sensor_router)
app.include_router(accidents_router)
app.include_router(contacts_router)
app.include_router(notifications_router)
app.include_router(hospitals_router)
app.include_router(admin_router)

@app.get("/")
def root():
    return {
        "system": "AcciSafe",
        "status": "online",
        "message": "AcciSafe backend is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }