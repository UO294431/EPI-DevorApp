import re
from datetime import timedelta

from fastapi import FastAPI, Depends, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_current_user
from app.db.session import get_db
from app.entitites.usuarios import Usuario

_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Esto es necesario para que el frontend (React) pueda hacer peticiones al backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    identifier: str
    password: str

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API del TFG"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/login")
def login(login_data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Autentica al usuario y devuelve el JWT en una cookie HTTP-only.
    El frontend nunca toca el token — el navegador lo envía automáticamente.
    """
    if not login_data.identifier or not login_data.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Faltan credenciales")

    is_email = bool(_EMAIL_REGEX.match(login_data.identifier))

    user = db.query(Usuario).filter(
        Usuario.email == login_data.identifier if is_email
        else Usuario.user_id == login_data.identifier
    ).first()

    if not user or user.password != login_data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    access_token = create_access_token(
        data={"sub": user.user_id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    # El token va en una cookie HTTP-only
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",   # protección CSRF básica
        secure=False,     # cambiar a True en producción (HTTPS)
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return {
        "message": "Login exitoso",
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "nombre": user.nombre,
            "apellidos": user.apellidos,
        },
    }


@app.post("/api/logout")
def logout(response: Response):
    """Elimina la cookie de sesión."""
    response.delete_cookie(key="access_token")
    return {"message": "Sesión cerrada"}


@app.get("/api/me")
def get_me(current_user: Usuario = Depends(get_current_user)):
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "nombre": current_user.nombre,
        "apellidos": current_user.apellidos,
    }
