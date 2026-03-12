import pytest
from unittest.mock import patch, MagicMock
from app.models.entities.usuarios import Usuario

# --- TESTS DEL ENRUTADOR (Mockeando el Servicio) ---

@pytest.fixture
def mock_auth_service():
    with patch("app.presentation.routers.auth_router.auth_service") as mock_service:
        yield mock_service

@pytest.fixture
def dummy_usuario():
    return Usuario(
        id="dummy_id",
        email="test@test.com",
        username="testuser",
        nombre="Test",
        apellidos="User",
        ubicacion="Madrid",
    )

@pytest.mark.asyncio
async def test_login_success(async_client, mock_auth_service, dummy_usuario):
    # Setup mock
    mock_auth_service.login.return_value = (dummy_usuario, "fake_token")

    # Ejecutar request
    response = await async_client.post(
        "/api/login",
        json={"identifier": "test@test.com", "password": "Password1"}
    )

    # Validaciones
    assert response.status_code == 200
    assert response.json() == {
        "message": "Login exitoso",
        "user": {
            "username": "testuser",
            "email": "test@test.com",
            "nombre": "Test",
            "apellidos": "User",
        }
    }
    # Verifica que se setea la cookie
    assert "access_token" in response.cookies
    assert response.cookies["access_token"] == "fake_token"


@pytest.mark.asyncio
async def test_register_success(async_client, mock_auth_service, dummy_usuario):
    mock_auth_service.register.return_value = dummy_usuario

    response = await async_client.post(
        "/api/register",
        json={
            "email": "test@test.com",
            "password": "Password1",
            "username": "testuser",
            "nombre": "Test",
            "apellidos": "User",
            "ubicacion": "Madrid",
        }
    )

    assert response.status_code == 201
    assert response.json() == {
        "message": "Cuenta creada correctamente",
        "user": {
            "username": "testuser",
            "email": "test@test.com",
            "nombre": "Test",
            "apellidos": "User",
        }
    }
    mock_auth_service.register.assert_called_once()


@pytest.mark.asyncio
async def test_logout(async_client):
    # Inyectar cookie falsa para simular sesión activa
    async_client.cookies.set("access_token", "fake_token")

    response = await async_client.post("/api/logout")

    assert response.status_code == 200
    assert response.json() == {"message": "Sesión cerrada"}
    
    # httpx no borra automáticamente la cookie del jar local si el Max-Age=0
    # Por lo tanto, verificamos que el servidor envia la cabecera Set-Cookie borrándola
    set_cookie_header = response.headers.get("set-cookie")
    assert set_cookie_header is not None
    assert "access_token=\"\"" in set_cookie_header or "access_token=;" in set_cookie_header
    assert "Max-Age=0" in set_cookie_header or "expires=" in set_cookie_header.lower()


@pytest.mark.asyncio
async def test_get_me(async_client, dummy_usuario):
    from app.main import app
    from app.core.security import get_current_user
    
    # Sobrescribimos la dependencia get_current_user en la app de FastAPI
    app.dependency_overrides[get_current_user] = lambda: dummy_usuario

    response = await async_client.get("/api/me")

    # Limpiamos las dependencias
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    assert response.json() == {
        "username": "testuser",
        "email": "test@test.com",
        "nombre": "Test",
        "apellidos": "User",
    }


@pytest.mark.asyncio
async def test_check_verification(async_client, mock_auth_service):
    mock_auth_service.check_email_verification.return_value = True

    response = await async_client.get("/api/check-verification/test@test.com")

    assert response.status_code == 200
    assert response.json() == {"verified": True}
    mock_auth_service.check_email_verification.assert_called_once_with("test@test.com")


@pytest.mark.asyncio
async def test_password_reset(async_client, mock_auth_service):
    mock_auth_service.request_password_reset.return_value = None

    response = await async_client.post(
        "/api/password-reset",
        json={"email": "test@test.com"}
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Si el correo está registrado, se enviará un enlace de recuperación."}
    mock_auth_service.request_password_reset.assert_called_once_with("test@test.com")
