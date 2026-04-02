from pydantic import BaseModel, Field
from typing import Optional

class ValoracionBase(BaseModel):
    place_id: str
    calidad: int = Field(ge=1, le=5)
    precio: int = Field(ge=1, le=5)
    higiene: int = Field(ge=1, le=5)
    trato: int = Field(ge=1, le=5)
    comentario: Optional[str] = None

class ValoracionCreate(ValoracionBase):
    pass

class ValoracionResponse(ValoracionBase):
    id: int
    user_id: str

    model_config = {
        "from_attributes": True
    }
