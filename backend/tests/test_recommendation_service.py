import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.recommendation_service import RecommendationService
from app.models.dtos.recommendation_dto import RecommendationRequest

@pytest.fixture
def service():
    return RecommendationService()

@pytest.fixture
def base_request():
    return RecommendationRequest(
        location="Madrid",
        categories=["mexicano"],
        prices=[],
        include_unconfirmed_price=False,
        max_results=10,
        open_now=False,
        page_token=None
    )

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_search_restaurants_basic(mock_post, service, base_request):
    # Mock response from Google
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "places": [
            {
                "id": "1",
                "displayName": {"text": "Restaurante A"},
                "formattedAddress": "Calle 123",
                "rating": 4.5,
                "userRatingCount": 100,
                "types": ["restaurant"]
            }
        ]
    }
    mock_post.return_value = mock_response

    result = await service.search_restaurants(base_request)

    assert "results" in result
    assert len(result["results"]) == 1
    assert result["results"][0]["name"] == "Restaurante A"
    
    # Verify payload
    _, kwargs = mock_post.call_args
    payload = kwargs["json"]
    assert "mexicano" in payload["textQuery"]
    assert "Madrid" in payload["textQuery"]
    assert payload["maxResultCount"] == 10

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_search_restaurants_filters(mock_post, service, base_request):
    base_request.prices = ["PRICE_LEVEL_INEXPENSIVE"]
    base_request.open_now = True
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"places": []}
    mock_post.return_value = mock_response

    await service.search_restaurants(base_request)

    _, kwargs = mock_post.call_args
    payload = kwargs["json"]
    assert payload["priceLevels"] == ["PRICE_LEVEL_INEXPENSIVE"]
    assert payload["openNow"] is True

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_bayesian_sorting(mock_post, service, base_request):
    # Definimos dos restaurantes:
    # A: 5 estrellas, 1 reseña
    # B: 4.8 estrellas, 1000 reseñas
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "places": [
            {
                "id": "A",
                "displayName": {"text": "Perfecto pero nuevo"},
                "rating": 5.0,
                "userRatingCount": 1,
                "types": ["restaurant"]
            },
            {
                "id": "B",
                "displayName": {"text": "Muy bueno y popular"},
                "rating": 4.8,
                "userRatingCount": 1000,
                "types": ["restaurant"]
            }
        ]
    }
    mock_post.return_value = mock_response

    result = await service.search_restaurants(base_request)
    results = result["results"]

    # Con la media bayesiana (umbral=10, media=3.5), el popular debe salir primero
    assert results[0]["id"] == "B"
    assert results[1]["id"] == "A"

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_google_api_error(mock_post, service, base_request):
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.text = "Forbidden"
    mock_post.return_value = mock_response

    result = await service.search_restaurants(base_request)
    assert result == {"results": [], "next_page_token": None}

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
@patch("app.services.recommendation_service.google_places_client.geocode")
async def test_distance_sorting(mock_geocode, mock_post, service, base_request):
    base_request.sort_by = "distance"
    
    # Mock geocode result (lat, lng of "Madrid" center)
    mock_geocode.return_value = {"lat": 40.4168, "lng": -3.7038}
    
    # Mock restaurant response with locations
    # A is at (40.4168, -3.7038) -> distance = 0
    # B is at (40.4200, -3.7000) -> distance > 0
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "places": [
            {
                "id": "B",
                "displayName": {"text": "Far Restaurant"},
                "location": {"latitude": 40.4200, "longitude": -3.7000},
                "types": ["restaurant"]
            },
            {
                "id": "A",
                "displayName": {"text": "Close Restaurant"},
                "location": {"latitude": 40.4168, "longitude": -3.7038},
                "types": ["restaurant"]
            }
        ]
    }
    mock_post.return_value = mock_response

    result = await service.search_restaurants(base_request)
    results = result["results"]

    # "Close Restaurant" must be sorted first because its distance is 0
    assert len(results) == 2
    assert results[0]["id"] == "A"
    assert results[1]["id"] == "B"
    
    # Ensure Google Places API fieldmask includes "places.location"
    _, kwargs = mock_post.call_args
    headers = kwargs["headers"]
    assert "places.location" in headers["X-Goog-FieldMask"]

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_search_restaurants_filtering(mock_post, service, base_request):
    # Mock response with one restaurant and one fish market
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "places": [
            {
                "id": "R1",
                "displayName": {"text": "Real Restaurant"},
                "types": ["restaurant", "food", "point_of_interest"]
            },
            {
                "id": "M1",
                "displayName": {"text": "Pescadería Paco"},
                "types": ["fish_market", "store", "food", "point_of_interest"]
            },
            {
                "id": "S1",
                "displayName": {"text": "Supermercado"},
                "types": ["supermarket", "grocery_or_supermarket", "store"]
            }
        ]
    }
    mock_post.return_value = mock_response

    result = await service.search_restaurants(base_request)
    results = result["results"]

    # Only "Real Restaurant" should remain
    assert len(results) == 1
    assert results[0]["id"] == "R1"

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_search_restaurants_heuristic(mock_post, service, base_request):
    # Mock response with a specific restaurant type that is NOT in the explicit list but matches heuristic
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "places": [
            {
                "id": "S1",
                "displayName": {"text": "Restaurante Español"},
                "types": ["spanish_restaurant", "food", "point_of_interest"]
            }
        ]
    }
    mock_post.return_value = mock_response

    result = await service.search_restaurants(base_request)
    results = result["results"]

    # Should remain because it ends with _restaurant
    assert len(results) == 1
    assert results[0]["id"] == "S1"

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_search_restaurants_tags_json(mock_post, service, base_request):
    # Mock tags to check against whatever is in tags.json
    # In this mock, we assume 'spanish_restaurant' IS in tags.json (based on user's manual change)
    # but 'alien_restaurant' is NOT.
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "places": [
            {
                "id": "Valid",
                "displayName": {"text": "Restaurante Español"},
                "types": ["spanish_restaurant", "food"]
            },
            {
                "id": "Invalid",
                "displayName": {"text": "Tienda Rara"},
                "types": ["store", "point_of_interest"]
            }
        ]
    }
    mock_post.return_value = mock_response

    result = await service.search_restaurants(base_request)
    results = result["results"]

    # Only 'Valid' should remain
    assert any(r["id"] == "Valid" for r in results)
    assert not any(r["id"] == "Invalid" for r in results)
