from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.presentation.routers import auth_router, recommendation_router, historial_router, favoritos_router, mas_tarde_router, valoraciones_router
from app.infrastructure.firebase.firebase_admin import get_firebase_app
import os

# Inicializar Firebase antes de aceptar peticiones
get_firebase_app()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Necesario para que el frontend (React) pueda hacer peticiones al backend
_extra_origin = os.getenv("EXTRA_ORIGIN", "")
_allowed_origins = [
    "http://localhost:5173",
    "https://localhost:5173",
    "https://127.0.0.1:5173",
]
if _extra_origin:
    _allowed_origins.append(_extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar rutas
app.include_router(auth_router.router)
app.include_router(recommendation_router.router)
app.include_router(historial_router.router)
app.include_router(favoritos_router.router)
app.include_router(mas_tarde_router.router)
app.include_router(valoraciones_router.router)

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API del TFG"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

