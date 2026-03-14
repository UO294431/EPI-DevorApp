from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.presentation.routers import auth_router, recommendation_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Necesario para que el frontend (React) pueda hacer peticiones al backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar rutas
app.include_router(auth_router.router)
app.include_router(recommendation_router.router)

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API del TFG"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

