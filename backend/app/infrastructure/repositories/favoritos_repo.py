"""
Repositorio para las tablas `listas_favoritos` y `favoritos`.
"""
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.entities.listas_favoritos import ListaFavoritos
from app.models.entities.favoritos import Favorito


# ── Listas ───────────────────────────────────────────────────────────────────

def get_listas_by_user(db: Session, user_id: str) -> List[ListaFavoritos]:
    """Devuelve todas las listas de favoritos de un usuario."""
    return db.query(ListaFavoritos).filter(ListaFavoritos.user_id == user_id).all()


def get_lista_by_id(db: Session, lista_id: int, user_id: str) -> Optional[ListaFavoritos]:
    """Obtiene una lista por ID verificando que pertenece al usuario."""
    return db.query(ListaFavoritos).filter(
        ListaFavoritos.id == lista_id,
        ListaFavoritos.user_id == user_id
    ).first()


def get_lista_by_nombre(db: Session, nombre: str, user_id: str) -> Optional[ListaFavoritos]:
    """Obtiene una lista por nombre verificando que pertenece al usuario."""
    return db.query(ListaFavoritos).filter(
        ListaFavoritos.nombre == nombre,
        ListaFavoritos.user_id == user_id
    ).first()


def delete_lista(db: Session, lista_id: int, user_id: str) -> bool:
    """Elimina una lista y todos sus favoritos asociados verificando el usuario."""
    lista = get_lista_by_id(db, lista_id, user_id)
    if not lista:
        return False
    
    # Eliminar favoritos asociados a la lista
    db.query(Favorito).filter(Favorito.lista_id == lista_id).delete(synchronize_session=False)
    
    # Eliminar la lista
    db.delete(lista)
    db.commit()
    return True


def create_lista(db: Session, user_id: str, nombre: str) -> ListaFavoritos:
    """Crea una nueva lista de favoritos para el usuario."""
    lista = ListaFavoritos(user_id=user_id, nombre=nombre)
    db.add(lista)
    db.commit()
    db.refresh(lista)
    return lista


# ── Favoritos ─────────────────────────────────────────────────────────────────

def get_favoritos_by_lista(db: Session, lista_id: int) -> List[Favorito]:
    """Devuelve los favoritos de una lista, ordenados del más reciente al más antiguo."""
    return (
        db.query(Favorito)
        .filter(Favorito.lista_id == lista_id)
        .order_by(Favorito.id.desc())
        .all()
    )


def get_favorito_by_place(db: Session, lista_id: int, place_id: str) -> Optional[Favorito]:
    """Devuelve un favorito por lista y place_id."""
    return db.query(Favorito).filter(
        Favorito.lista_id == lista_id,
        Favorito.place_id == place_id
    ).first()


def add_favorito(db: Session, lista_id: int, place_id: str) -> Favorito:
    """Añade un restaurante a una lista de favoritos."""
    fav = Favorito(
        lista_id=lista_id,
        place_id=place_id,
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


def delete_favorito(db: Session, favorito_id: int, user_id: str) -> bool:
    """
    Elimina un favorito verificando que la lista pertenece al usuario.
    Devuelve True si se eliminó, False si no existía o no tenía permiso.
    """
    fav = db.query(Favorito).filter(Favorito.id == favorito_id).first()
    if not fav:
        return False
    lista = get_lista_by_id(db, fav.lista_id, user_id)
    if not lista:
        return False
    db.delete(fav)
    db.commit()
    return True
