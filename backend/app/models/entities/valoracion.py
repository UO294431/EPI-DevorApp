from sqlalchemy import Column, Integer, String
from app.infrastructure.database import Base

class Valoracion(Base):
    __tablename__ = "valoraciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    place_id = Column(String, nullable=False, index=True)
    calidad = Column(Integer, nullable=False, default=0)
    precio = Column(Integer, nullable=False, default=0)
    higiene = Column(Integer, nullable=False, default=0)
    trato = Column(Integer, nullable=False, default=0)
    comentario = Column(String, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<Valoracion id={self.id} user_id={self.user_id!r} "
            f"place_id={self.place_id!r} calidad={self.calidad}>"
        )
