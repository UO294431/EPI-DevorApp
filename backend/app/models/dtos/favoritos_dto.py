from pydantic import BaseModel


class ListaCreate(BaseModel):
    """Body del POST /api/favoritos/listas."""
    nombre: str


class ListaResponse(BaseModel):
    """Respuesta serializada de una lista de favoritos."""
    id: int
    user_id: str
    nombre: str

    model_config = {"from_attributes": True}


class FavoritoCreate(BaseModel):
    """Body del POST /api/favoritos/listas/{lista_id}."""
    place_id: str


class FavoritoResponse(BaseModel):
    """Respuesta serializada de un favorito."""
    id: int
    lista_id: int
    place_id: str

    model_config = {"from_attributes": True}
