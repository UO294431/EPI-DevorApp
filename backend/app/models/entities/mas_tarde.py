"""
Modelo ORM SQLAlchemy para la tabla `mas_tarde`.

Campos:
  - id           : clave primaria autoincremental
  - user_id      : Firebase UID del usuario
  - place_id     : ID de Google Places del restaurante
"""
from sqlalchemy import Column, Integer, String
from app.infrastructure.database import Base

class MasTarde(Base):
    __tablename__ = "mas_tarde"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    place_id = Column(String, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<MasTarde id={self.id} user_id={self.user_id!r} "
            f"place_id={self.place_id!r}>"
        )
