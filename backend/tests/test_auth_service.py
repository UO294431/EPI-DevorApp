import pytest
from fastapi import HTTPException
from unittest.mock import patch, MagicMock

from app.services.auth_service import login, register, check_email_verification, request_password_reset
from app.models.dtos.auth_dto import RegisterRequest
from app.models.entities.usuarios import Usuario

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

@pytest.fixture
def dummy_register_data():
    return RegisterRequest(
        email="test@test.com",
        password="Password1",
        username="testuser",
        nombre="Test",
        apellidos="User",
        ubicacion="Madrid",
    )

# --- TESTS DEL SERVICIO DE REGISTRO ---

def test_register_invalid_email(dummy_register_data):
    dummy_register_data.email = "invalid-email"
    with pytest.raises(HTTPException) as exc_info:
        register(dummy_register_data)
    assert exc_info.value.status_code == 400
    assert "formato válido" in exc_info.value.detail

def test_register_weak_password(dummy_register_data):
    dummy_register_data.password = "weak"
    with pytest.raises(HTTPException) as exc_info:
        register(dummy_register_data)
    assert exc_info.value.status_code == 400
    assert "al menos 8 caracteres" in exc_info.value.detail

def test_register_invalid_username_length(dummy_register_data):
    dummy_register_data.username = "ab" # Corto
    with pytest.raises(HTTPException) as exc_info:
        register(dummy_register_data)
    assert exc_info.value.status_code == 400
    assert "entre 3 y 30 caracteres" in exc_info.value.detail

@patch("app.services.auth_service.create_usuario")
@patch("app.services.auth_service.send_verification_email")
def test_register_success(mock_send_email, mock_create_usuario, dummy_register_data, dummy_usuario):
    mock_create_usuario.return_value = dummy_usuario
    
    result = register(dummy_register_data)
    
    assert result == dummy_usuario
    mock_create_usuario.assert_called_once()
    mock_send_email.assert_called_once_with("test@test.com", "Password1")

# --- TESTS DEL SERVICIO DE LOGIN ---

def test_login_missing_credentials():
    with pytest.raises(HTTPException) as exc_info:
        login("", "password")
    assert exc_info.value.status_code == 400
    assert "Faltan credenciales" in exc_info.value.detail

@patch("app.services.auth_service.get_uid_by_username")
def test_login_username_not_found(mock_get_uid):
    mock_get_uid.return_value = None
    with pytest.raises(HTTPException) as exc_info:
        login("not_an_email_or_user", "password")
    assert exc_info.value.status_code == 401
    assert "Credenciales incorrectas" in exc_info.value.detail

@patch("app.services.auth_service.fb_auth.get_user_by_email")
def test_login_email_not_verified(mock_fb_user):
    mock_user_record = MagicMock()
    mock_user_record.email_verified = False
    mock_fb_user.return_value = mock_user_record
    
    with pytest.raises(HTTPException) as exc_info:
        login("test@test.com", "password")
    assert exc_info.value.status_code == 403
    assert "Email no verificado" in exc_info.value.detail

@patch("app.services.auth_service.fb_auth.get_user_by_email")
@patch("app.services.auth_service.verify_password_and_get_uid")
def test_login_wrong_password(mock_verify, mock_fb_user):
    # Simular email verificado pero contraseña mala
    mock_user_record = MagicMock()
    mock_user_record.email_verified = True
    mock_fb_user.return_value = mock_user_record
    mock_verify.return_value = None
    
    with pytest.raises(HTTPException) as exc_info:
        login("test@test.com", "wrongpass")
    assert exc_info.value.status_code == 401
    assert "Credenciales incorrectas" in exc_info.value.detail

@patch("app.services.auth_service.fb_auth.get_user_by_email")
@patch("app.services.auth_service.verify_password_and_get_uid")
@patch("app.services.auth_service.get_usuario_by_uid")
@patch("app.services.auth_service.create_access_token")
def test_login_success(mock_create_token, mock_get_usuario, mock_verify, mock_fb_user, dummy_usuario):
    # Mocks setup
    mock_user_record = MagicMock()
    mock_user_record.email_verified = True
    mock_fb_user.return_value = mock_user_record
    mock_verify.return_value = "dummy_id"
    mock_get_usuario.return_value = dummy_usuario
    mock_create_token.return_value = "fake_jwt"
    
    user, token = login("test@test.com", "Password1")
    
    assert user == dummy_usuario
    assert token == "fake_jwt"

# --- OTROS SERVICIOS ---

@patch("app.services.auth_service.fb_auth.get_user_by_email")
def test_check_email_verification_true(mock_fb_user):
    mock_user_record = MagicMock()
    mock_user_record.email_verified = True
    mock_fb_user.return_value = mock_user_record
    
    assert check_email_verification("test@test.com") is True

@patch("app.services.auth_service.get_usuario_by_email")
@patch("app.services.auth_service.send_password_reset_email")
def test_request_password_reset_success(mock_send_email, mock_get_user, dummy_usuario):
    mock_get_user.return_value = dummy_usuario
    
    request_password_reset("test@test.com")
    
    mock_send_email.assert_called_once_with("test@test.com")

@patch("app.services.auth_service.get_usuario_by_email")
@patch("app.services.auth_service.send_password_reset_email")
def test_request_password_reset_user_not_found(mock_send_email, mock_get_user):
    mock_get_user.return_value = None
    
    request_password_reset("notfound@test.com")
    
    # El email de reseteo NO debe ser enviado
    mock_send_email.assert_not_called()
