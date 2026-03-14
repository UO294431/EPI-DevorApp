import httpx
from typing import List, Dict, Any
from app.core.config import settings
from app.models.dtos.recommendation_dto import RecommendationRequest

class RecommendationService:
    def __init__(self):
        self.api_key = settings.GOOGLE_API_KEY
        self.base_url = "https://places.googleapis.com/v1/places:searchText"

    async def search_restaurants(self, request: RecommendationRequest) -> Dict[str, Any]:
        
        query_parts = []
        if request.categories:
            query_parts.append(", ".join(request.categories))
        
        query_parts.append(f"restaurants in {request.location}")
        
        text_query = " ".join(query_parts)
        
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            # Definimos los campos que queremos recibir
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.priceLevel,places.rating,places.userRatingCount,places.types,places.photos,places.googleMapsUri,places.websiteUri,places.regularOpeningHours,places.editorialSummary,nextPageToken"
        }
        
        payload = {
            "textQuery": text_query,
            "maxResultCount": request.max_results,
            "languageCode": "es"
        }
        
        if request.page_token:
            payload["pageToken"] = request.page_token
        
        effective_prices = list(request.prices)
        if request.include_unconfirmed_price:
            effective_prices.append("PRICE_LEVEL_UNSPECIFIED")
            
        if effective_prices:
            payload["priceLevels"] = effective_prices
            
        if request.open_now:
            payload["openNow"] = True
            
        async with httpx.AsyncClient() as client:
            response = await client.post(self.base_url, headers=headers, json=payload, timeout=10.0)
            
            if response.status_code != 200:
                error_detail = response.text
                print(f"Error from Google Places API: {error_detail}")
                return []
            
            data = response.json()
            places = data.get("places", [])
            next_page_token = data.get("nextPageToken")
            
            formatted = self._format_results(places)
            
            # Ordenar por media ponderada (Bayesian Rating)
            umbral_m = 10
            media_base_c = 3.5
            
            def calcular_peso(restaurante):
                v = restaurante.get("user_ratings_total") or 0
                r = restaurante.get("rating") or 0
                return (v / (v + umbral_m)) * r + (umbral_m / (v + umbral_m)) * media_base_c

            formatted.sort(key=calcular_peso, reverse=True)
            
            return {
                "results": formatted,
                "next_page_token": next_page_token
            }

    def _format_results(self, places: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        formatted = []
        for place in places:
            name = place.get("displayName", {}).get("text", "Sin nombre")
            
            formatted.append({
                "id": place.get("id"),
                "name": name,
                "address": place.get("formattedAddress"),
                "price_level": place.get("priceLevel"),
                "rating": place.get("rating"),
                "user_ratings_total": place.get("userRatingCount"),
                "types": place.get("types", []),
                "main_photo": self._get_photo_url(place.get("photos", [])),
                "google_maps_uri": place.get("googleMapsUri"),
                "website_uri": place.get("websiteUri"),
                "opening_hours": place.get("regularOpeningHours", {}).get("weekdayDescriptions", []),
                "summary": place.get("editorialSummary", {}).get("text", "")
            })
        return formatted

    def _get_photo_url(self, photos: List[Dict[str, Any]]) -> str:
        if not photos:
            return ""
        resource_name = photos[0].get("name", "")
        if not resource_name:
            return ""
        
        return f"https://places.googleapis.com/v1/{resource_name}/media?maxHeightPx=400&maxWidthPx=400&key={self.api_key}"

recommendation_service = RecommendationService()
