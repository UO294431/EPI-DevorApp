from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.infrastructure.database import Base


class Favorito(Base):
    __tablename__ = "favoritos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lista_id = Column(Integer, ForeignKey("listas_favoritos.id", ondelete="CASCADE"), nullable=False, index=True)
    place_id = Column(String, nullable=False)

    def __repr__(self) -> str:
        return f"<Favorito id={self.id} lista_id={self.lista_id} place_id={self.place_id!r}>"
