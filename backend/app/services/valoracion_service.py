from sqlalchemy.orm import Session
from typing import List
from app.models.dtos.valoracion_dto import ValoracionCreate, ValoracionResponse
from app.infrastructure.repositories import valoracion_repo

def valorar_restaurante(db: Session, user_id: str, data: ValoracionCreate) -> ValoracionResponse:
    valoracion = valoracion_repo.crear_o_actualizar_valoracion(db, user_id, data)
    return ValoracionResponse.model_validate(valoracion)

def obtener_todas_mis_valoraciones(db: Session, user_id: str) -> List[ValoracionResponse]:
    valoraciones = valoracion_repo.obtener_todas_las_valoraciones_usuario(db, user_id)
    return [ValoracionResponse.model_validate(v) for v in valoraciones]

def obtener_mi_valoracion(db: Session, user_id: str, place_id: str) -> dict:
    valoracion = valoracion_repo.obtener_valoracion_usuario_por_place_id(db, user_id, place_id)
    if valoracion:
        return ValoracionResponse.model_validate(valoracion).model_dump()
    return {}

def eliminar_valoracion(db: Session, user_id: str, place_id: str) -> bool:
    return valoracion_repo.eliminar_valoracion(db, user_id, place_id)
