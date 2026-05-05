import pytest
from fastapi.testclient import TestClient
import numpy as np
from unittest.mock import patch, MagicMock

# Evitar que se cargue el modelo real durante los tests si existe
with patch("tensorflow.keras.models.load_model") as mock_load:
    mock_model = MagicMock()
    mock_model.inputs = [MagicMock(name="input", shape=(None, 10)) for _ in range(7)]
    mock_model.inputs[2].name = "tags"
    mock_model.inputs[2].shape = (None, 5) # Simular 5 tags
    mock_load.return_value = mock_model
    
    from main import app, API_KEY_SECRET

client = TestClient(app)

# Utilizar un token de API válido para las peticiones (si en test es None, enviamos un string vacío o ignoramos si la app no valida en vacío, pero mejor mockearlo o pasar el que tenga la app)
api_headers = {"x-api-key": API_KEY_SECRET if API_KEY_SECRET else "test-api-key"}

@pytest.fixture(autouse=True)
def setup_mocks():
    # Inyectar variables globales simuladas para los tests
    import main
    main.model = mock_model
    main.API_KEY_SECRET = "test-api-key"
    main.user_mapping = {"test_user": 1}
    main.place_mapping = {"test_place": 1}
    main.places_cache = {"fav_place_1": {"types": ["restaurant"], "price_level": 2}}
    main.TAGS_ORDER = ["restaurant", "bar", "cafe", "pizza", "burger"]
    main.NUM_TAGS = 5
    main.tag_to_idx = {tag: i for i, tag in enumerate(main.TAGS_ORDER)}
    
    # Mockear el predict para que devuelva tensores/arrays con la forma esperada (N, 1)
    def mock_predict_fn(inputs, verbose=0):
        N = len(inputs[0])
        return np.array([[0.8] for _ in range(N)])
    
    mock_model.predict.side_effect = mock_predict_fn

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "model_loaded" in data

def test_predict_success():
    payload = {
        "user_id": "test_user",
        "avg_rating": 4.5,
        "num_val": 10,
        "user_favs": ["fav_place_1"],
        "es_finde": 1,
        "franja": 2,
        "candidates": [
            {
                "place_id": "cand_1",
                "price_level": 2,
                "rating": 4.0,
                "types": ["restaurant", "bar"]
            },
            {
                "place_id": "cand_2",
                "price_level": 3,
                "rating": 3.5,
                "types": ["cafe"]
            }
        ]
    }
    
    response = client.post("/predict", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) == 2
    
    # Verificar estructura del resultado
    res1 = data["results"][0]
    assert "place_id" in res1
    assert "keras_score" in res1
    assert "predicted_rating" in res1

def test_predict_unauthorized():
    payload = {
        "user_id": "test_user",
        "avg_rating": 4.5,
        "num_val": 10,
        "user_favs": [],
        "es_finde": 1,
        "franja": 2,
        "candidates": []
    }
    
    # Petición sin API Key
    response = client.post("/predict", json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Clave de API no válida"
    
    # Petición con API Key incorrecta
    response = client.post("/predict", json=payload, headers={"x-api-key": "wrong-key"})
    assert response.status_code == 403

def test_predict_empty_candidates():
    payload = {
        "user_id": "test_user",
        "avg_rating": 4.5,
        "num_val": 10,
        "user_favs": [],
        "es_finde": 1,
        "franja": 2,
        "candidates": []
    }
    
    response = client.post("/predict", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 200
    assert response.json() == {"results": []}

def test_predict_missing_fields():
    # Payload incompleto (falta franja y es_finde)
    payload = {
        "user_id": "test_user",
        "avg_rating": 4.5,
        "num_val": 10,
        "user_favs": [],
        "candidates": []
    }
    
    response = client.post("/predict", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 422 # Unprocessable Entity debido a validación de Pydantic

def test_get_place_info():
    payload = {
        "place_ids": ["fav_place_1", "unknown_place"]
    }
    
    response = client.post("/info", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 200
    data = response.json()
    assert "info" in data
    assert "fav_place_1" in data["info"]
    assert "unknown_place" not in data["info"]
    assert data["info"]["fav_place_1"]["types"] == ["restaurant"]
    assert data["info"]["fav_place_1"]["price_level"] == 2
