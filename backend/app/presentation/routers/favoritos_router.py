from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.infrastructure.database import get_db
from app.models.dtos.favoritos_dto import ListaCreate, FavoritoCreate
from app.models.entities.usuarios import Usuario
from app.services import favoritos_service

router = APIRouter(prefix="/api/favoritos", tags=["Favoritos"])


def _get_uid(current_user: Usuario) -> str:
    from firebase_admin import auth as fb_auth
    from app.infrastructure.firebase.firebase_admin import get_firebase_app
    get_firebase_app()
    return fb_auth.get_user_by_email(current_user.email).uid


# ── Listas ───────────────────────────────────────────────────────────────────

@router.get("/listas")
async def get_listas(
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Devuelve todas las listas de favoritos del usuario autenticado."""
    uid = _get_uid(current_user)
    return favoritos_service.get_listas(db, uid)


@router.post("/listas", status_code=201)
async def create_lista(
    data: ListaCreate,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Crea una nueva lista de favoritos."""
    uid = _get_uid(current_user)
    try:
        return favoritos_service.create_lista(db, uid, data.nombre, data.icono)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/listas/{lista_id}", status_code=204)
async def delete_lista(
    lista_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Elimina una lista de favoritos y todos los restaurantes que contenía."""
    uid = _get_uid(current_user)
    success = favoritos_service.delete_lista(db, lista_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail="Lista no encontrada o no autorizada")


@router.patch("/listas/{lista_id}")
async def update_lista(
    lista_id: int,
    data: ListaUpdate,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Actualiza el nombre de una lista de favoritos."""
    uid = _get_uid(current_user)
    try:
        lista = favoritos_service.update_lista(db, lista_id, uid, data.nombre)
        if not lista:
            raise HTTPException(status_code=404, detail="Lista no encontrada o no autorizada")
        return lista
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Favoritos de una lista ───────────────────────────────────────────────────

@router.get("/listas/{lista_id}")
async def get_lista_detalle(
    lista_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Devuelve los restaurantes de una lista, enriquecidos con detalles de Google Places.
    """
    uid = _get_uid(current_user)
    lista = favoritos_service.get_lista_by_id(db, lista_id, uid)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada o no autorizada")

    favoritos = favoritos_service.get_favoritos(db, lista_id)

    import asyncio
    from app.services.recommendation_service import recommendation_service

    tasks = [recommendation_service.get_place_details(f.place_id) for f in favoritos]
    details_list = await asyncio.gather(*tasks)

    results = []
    for fav, details in zip(favoritos, details_list):
        if not details:
            continue
        results.append({
            "id": fav.id,
            "lista_id": fav.lista_id,
            "place_id": fav.place_id,
            "restaurant": details,
        })

    return {"lista": lista, "restaurantes": results}


@router.post("/listas/{lista_id}", status_code=201)
async def add_favorito(
    lista_id: int,
    data: FavoritoCreate,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Añade un restaurante a la lista especificada."""
    uid = _get_uid(current_user)
    lista = favoritos_service.get_lista_by_id(db, lista_id, uid)
    if not lista:
        raise HTTPException(status_code=404, detail="Lista no encontrada o no autorizada")

    try:
        fav = favoritos_service.add_favorito(db, lista_id, data.place_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from app.services.recommendation_service import recommendation_service
    details = await recommendation_service.get_place_details(fav.place_id)

    return {
        "id": fav.id,
        "lista_id": fav.lista_id,
        "place_id": fav.place_id,
        "restaurant": details,
    }


# ── Eliminar favorito ─────────────────────────────────────────────────────────

@router.delete("/{favorito_id}", status_code=204)
async def delete_favorito(
    favorito_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Elimina un restaurante de favoritos verificando que pertenece al usuario."""
    uid = _get_uid(current_user)
    success = favoritos_service.delete_favorito(db, favorito_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail="Favorito no encontrado o no autorizado")
