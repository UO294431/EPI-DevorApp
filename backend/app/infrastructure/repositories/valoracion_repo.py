from sqlalchemy.orm import Session
from typing import List
from app.models.entities.valoracion import Valoracion
from app.models.dtos.valoracion_dto import ValoracionCreate

def crear_o_actualizar_valoracion(db: Session, user_id: str, data: ValoracionCreate) -> Valoracion:
    valoracion = db.query(Valoracion).filter(
        Valoracion.user_id == user_id,
        Valoracion.place_id == data.place_id
    ).first()

    if valoracion:
        valoracion.calidad = data.calidad
        valoracion.precio = data.precio
        valoracion.higiene = data.higiene
        valoracion.trato = data.trato
        valoracion.comentario = data.comentario
    else:
        valoracion = Valoracion(
            user_id=user_id,
            place_id=data.place_id,
            calidad=data.calidad,
            precio=data.precio,
            higiene=data.higiene,
            trato=data.trato,
            comentario=data.comentario
        )
        db.add(valoracion)
    
    db.commit()
    db.refresh(valoracion)
    return valoracion

def obtener_todas_las_valoraciones_usuario(db: Session, user_id: str) -> List[Valoracion]:
    return db.query(Valoracion).filter(
        Valoracion.user_id == user_id
    ).order_by(Valoracion.id.desc()).all()

def obtener_valoracion_usuario_por_place_id(db: Session, user_id: str, place_id: str) -> Valoracion | None:
    return db.query(Valoracion).filter(
        Valoracion.user_id == user_id,
        Valoracion.place_id == place_id
    ).first()

def eliminar_valoracion(db: Session, user_id: str, place_id: str) -> bool:
    valoracion = db.query(Valoracion).filter(
        Valoracion.user_id == user_id,
        Valoracion.place_id == place_id
    ).first()
    
    if valoracion:
        db.delete(valoracion)
        db.commit()
        return True
    return False
