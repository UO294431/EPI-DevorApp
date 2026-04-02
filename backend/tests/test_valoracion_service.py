import pytest
from unittest.mock import patch, MagicMock
from app.services import valoracion_service
from app.models.dtos.valoracion_dto import ValoracionCreate
from app.models.entities.valoracion import Valoracion


@patch("app.services.valoracion_service.valoracion_repo")
def test_valorar_restaurante_crea_nueva(mock_repo):
    db_mock = MagicMock()
    data = ValoracionCreate(place_id="place1", calidad=5, precio=4, higiene=3, trato=5)
    mock_entity = Valoracion(
        id=1, user_id="uid1", place_id="place1",
        calidad=5, precio=4, higiene=3, trato=5, comentario=None
    )
    mock_repo.crear_o_actualizar_valoracion.return_value = mock_entity

    result = valoracion_service.valorar_restaurante(db_mock, "uid1", data)

    mock_repo.crear_o_actualizar_valoracion.assert_called_once_with(db_mock, "uid1", data)
    assert result.place_id == "place1"
    assert result.calidad == 5


@patch("app.services.valoracion_service.valoracion_repo")
def test_obtener_todas_mis_valoraciones(mock_repo):
    db_mock = MagicMock()
    mock_repo.obtener_todas_las_valoraciones_usuario.return_value = [
        Valoracion(id=1, user_id="uid1", place_id="place1", calidad=4, precio=3, higiene=5, trato=4, comentario="Muy bien"),
        Valoracion(id=2, user_id="uid1", place_id="place2", calidad=2, precio=2, higiene=3, trato=2, comentario=None),
    ]

    result = valoracion_service.obtener_todas_mis_valoraciones(db_mock, "uid1")

    mock_repo.obtener_todas_las_valoraciones_usuario.assert_called_once_with(db_mock, "uid1")
    assert len(result) == 2
    assert result[0].place_id == "place1"
    assert result[1].place_id == "place2"


@patch("app.services.valoracion_service.valoracion_repo")
def test_obtener_mi_valoracion_existente(mock_repo):
    db_mock = MagicMock()
    mock_repo.obtener_valoracion_usuario_por_place_id.return_value = Valoracion(
        id=1, user_id="uid1", place_id="place1", calidad=3, precio=4, higiene=5, trato=3, comentario="Ok"
    )

    result = valoracion_service.obtener_mi_valoracion(db_mock, "uid1", "place1")

    assert result["place_id"] == "place1"
    assert result["calidad"] == 3


@patch("app.services.valoracion_service.valoracion_repo")
def test_obtener_mi_valoracion_no_existente(mock_repo):
    db_mock = MagicMock()
    mock_repo.obtener_valoracion_usuario_por_place_id.return_value = None

    result = valoracion_service.obtener_mi_valoracion(db_mock, "uid1", "place_inexistente")

    assert result == {}


@patch("app.services.valoracion_service.valoracion_repo")
def test_eliminar_valoracion_existente(mock_repo):
    db_mock = MagicMock()
    mock_repo.eliminar_valoracion.return_value = True

    result = valoracion_service.eliminar_valoracion(db_mock, "uid1", "place1")

    assert result is True
    mock_repo.eliminar_valoracion.assert_called_once_with(db_mock, "uid1", "place1")


@patch("app.services.valoracion_service.valoracion_repo")
def test_eliminar_valoracion_no_existente(mock_repo):
    db_mock = MagicMock()
    mock_repo.eliminar_valoracion.return_value = False

    result = valoracion_service.eliminar_valoracion(db_mock, "uid1", "place_inexistente")

    assert result is False
