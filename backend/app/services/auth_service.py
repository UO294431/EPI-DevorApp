import re
from datetime import timedelta
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.security import create_access_token
from app.models.entities.usuarios import Usuario
from firebase_admin import auth as fb_auth
from app.infrastructure.repositories.usuario_repo import (
    verify_password_and_get_uid,
    get_usuario_by_uid,
    get_uid_by_username,
    create_usuario,
    send_verification_email,
    send_password_reset_email,
    get_usuario_by_email,
    update_usuario_profile,
    update_usuario_email,
    update_usuario_password,
    delete_usuario_profile,
    delete_usuario_auth,
)
from app.models.dtos.auth_dto import (
    RegisterRequest, ProfileUpdateRequest, EmailUpdateRequest, 
    PasswordUpdateRequest, LoginRequest
)
from sqlalchemy.orm import Session
from app.models.entities.listas_favoritos import ListaFavoritos
from app.models.entities.historial import Historial
from app.models.entities.mas_tarde import MasTarde
from app.models.entities.valoracion import Valoracion
from app.models.entities.valoracion_like import LikeValoracion

_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PASSWORD_REGEX = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")

def login(identifier: str, password: str) -> tuple[Usuario, str]:
    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Faltan credenciales",
        )

    is_email = bool(_EMAIL_REGEX.match(identifier))

    if is_email:
        email = identifier
    else:
        uid = get_uid_by_username(identifier)
        if uid is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas",
            )

        try:
            user_record = fb_auth.get_user(uid)
            email = user_record.email
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas",
            )

    try:
        user_record = fb_auth.get_user_by_email(email)
        if not user_record.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email no verificado. Por favor, revisa tu bandeja de entrada.",
            )
    except fb_auth.UserNotFoundError:
        pass

    uid = verify_password_and_get_uid(email, password)
    if uid is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    user = get_usuario_by_uid(uid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado en la base de datos",
        )

    access_token = create_access_token(
        data={"sub": uid},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return user, access_token


def register(data: RegisterRequest) -> Usuario:
    if not _EMAIL_REGEX.match(data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email no tiene un formato válido",
        )
    if not _PASSWORD_REGEX.match(data.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 8 caracteres, una letra y un número",
        )
    if not (3 <= len(data.username) <= 30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El username debe tener entre 3 y 30 caracteres",
        )

    user = create_usuario(
        email=data.email,
        password=data.password,
        username=data.username,
        nombre=data.nombre,
        apellidos=data.apellidos,
        ubicacion=data.ubicacion,
    )
    
    send_verification_email(data.email, data.password)
    
    return user

def check_email_verification(email: str) -> bool:
    try:
        user_record = fb_auth.get_user_by_email(email)
        return user_record.email_verified
    except fb_auth.UserNotFoundError:
        return False

def request_password_reset(email: str) -> None:
    # Verificamos si el usuario existe sin revelar al frontend si existe o no
    user = get_usuario_by_email(email)
    if user:
        send_password_reset_email(email)

def update_profile(uid: str, email: str, data: ProfileUpdateRequest) -> Usuario:
    # 1. Verificar contraseña actual
    verified_uid = verify_password_and_get_uid(email, data.password)
    if verified_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta",
        )
    
    # 2. Actualizar en Firestore
    update_usuario_profile(uid, data.nombre, data.apellidos)
    
    # 3. Devolver usuario actualizado
    return get_usuario_by_uid(uid)

def update_email(uid: str, current_email: str, data: EmailUpdateRequest) -> None:
    # 1. Verificar formato del nuevo email
    if not _EMAIL_REGEX.match(data.new_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nuevo email no tiene un formato válido",
        )
    
    # 2. Verificar si el nuevo email ya está registrado
    if get_usuario_by_email(data.new_email) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este correo electrónico ya está en uso por otra cuenta",
        )
    
    # 3. Verificar contraseña actual
    verified_uid = verify_password_and_get_uid(current_email, data.password)
    if verified_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta",
        )
    
    # 3. Actualizar email en Firebase Auth
    try:
        update_usuario_email(uid, data.new_email)
        # 4. Enviar correo de verificación al nuevo email
        # Usamos la contraseña actual para el re-auth necesario en send_verification_email
        send_verification_email(data.new_email, data.password)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

def update_password(uid: str, email: str, data: PasswordUpdateRequest) -> None:
    # 1. Verificar formato de la nueva contraseña
    if not _PASSWORD_REGEX.match(data.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 8 caracteres, una letra y un número",
        )
    
    # 2. Verificar contraseña actual
    verified_uid = verify_password_and_get_uid(email, data.old_password)
    if verified_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta",
        )
    
    # 3. Actualizar contraseña en Firebase Auth
    try:
        update_usuario_password(uid, data.new_password)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


def delete_account(uid: str, email: str, password: str, db: Session) -> None:
    # 1. Verificar contraseña actual
    verified_uid = verify_password_and_get_uid(email, password)
    if verified_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta",
        )
    
    # 2. Eliminar datos de la base de datos relacional (SQL)
    try:
        # Deletions are cascaded where applicable, but we do them explicitly to be safe
        db.query(LikeValoracion).filter(LikeValoracion.user_id == uid).delete()
        db.query(Valoracion).filter(Valoracion.user_id == uid).delete()
        db.query(MasTarde).filter(MasTarde.user_id == uid).delete()
        db.query(Historial).filter(Historial.user_id == uid).delete()
        db.query(ListaFavoritos).filter(ListaFavoritos.user_id == uid).delete() # Cascades to favoritos
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar datos transaccionales: {str(e)}"
        )

    # 3. Eliminar de Firestore
    try:
        delete_usuario_profile(uid)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar perfil de Firestore: {str(e)}"
        )

    # 4. Eliminar de Firebase Auth
    try:
        delete_usuario_auth(uid)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar de Firebase Auth: {str(e)}"
        )

