import httpx
import json
import os
from typing import List, Dict, Any
from app.core.config import settings
from app.models.dtos.recommendation_dto import RecommendationRequest

class RecommendationService:
    def __init__(self):
        self.api_key = settings.GOOGLE_API_KEY
        self.base_url = "https://places.googleapis.com/v1/places:searchText"
        self.geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
        self._valid_tag_ids = self._load_valid_tags()

    def _load_valid_tags(self) -> Dict[str, str]:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        tags_path = os.path.join(current_dir, "..", "data", "tags.json")
        try:
            with open(tags_path, 'r', encoding='utf-8') as f:
                tags = json.load(f)
                return {tag["id"]: tag["label"] for tag in tags}
        except Exception as e:
            print(f"Error loading tags.json: {e}")
            return {"restaurant": "restaurante", "cafe": "café", "bar": "bar", "bakery": "pastelería"}

    async def _geocode_location(self, location: str) -> tuple[float, float]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.geocode_url}?address={location}&key={self.api_key}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("results"):
                    loc = data["results"][0]["geometry"]["location"]
                    return loc.get("lat"), loc.get("lng")
        return None, None

    async def search_restaurants(self, request: RecommendationRequest) -> Dict[str, Any]:
        
        query_parts = []
        if request.categories:
            # Mapear IDs técnicos a etiquetas en lenguaje natural para la búsqueda
            labels = [self._valid_tag_ids.get(cat, cat.replace("_", " ")) for cat in request.categories]
            # Usar lógica "OR" explícita para que Google devuelva resultados de todas las categorías
            query_parts.append(" OR ".join(labels))
        
        query_parts.append(f"restaurantes en {request.location}")
        
        text_query = " ".join(query_parts)
        
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            # Definimos los campos que queremos recibir
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.priceLevel,places.rating,places.userRatingCount,places.types,places.photos,places.googleMapsUri,places.websiteUri,places.regularOpeningHours,places.currentOpeningHours,places.editorialSummary,places.location,nextPageToken"
        }
        
        payload = {
            "textQuery": text_query,
            "maxResultCount": request.max_results,
            "languageCode": "es"
        }
        
        # Geocodificar la ubicación solicitada para proporcionar Bias y evitar que Google use la IP del servidor local
        lat, lng = await self._geocode_location(request.location)
        if lat is not None and lng is not None:
            payload["locationBias"] = {
                "circle": {
                    "center": {
                        "latitude": lat,
                        "longitude": lng
                    },
                    "radius": 30000.0  # 30km
                }
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
            
            if getattr(request, 'sort_by', 'rating') == 'distance':
                # Reutilizamos lat y lng que sacamos al inicio del endpoint
                if lat is not None and lng is not None:
                    import math
                    def haversine(lat1, lon1, lat2, lon2):
                        R = 6371.0 # Radius of earth in km
                        dlat = math.radians(lat2 - lat1)
                        dlon = math.radians(lon2 - lon1)
                        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
                        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                        return R * c
                    
                    def calcular_distancia(restaurante):
                        r_lat = restaurante.get("latitude")
                        r_lng = restaurante.get("longitude")
                        if r_lat is None or r_lng is None:
                            return float('inf')
                        return haversine(lat, lng, r_lat, r_lng)
                    
                    formatted.sort(key=calcular_distancia)
                else:
                    # Fallback to rating
                    umbral_m = 10
                    media_base_c = 3.5
                    def calcular_peso(restaurante):
                        v = restaurante.get("user_ratings_total") or 0
                        r = restaurante.get("rating") or 0
                        return (v / (v + umbral_m)) * r + (umbral_m / (v + umbral_m)) * media_base_c
                    formatted.sort(key=calcular_peso, reverse=True)
            elif getattr(request, 'sort_by', 'rating') == 'reviews':
                # Ordenar por popularidad (número de reseñas)
                formatted.sort(key=lambda r: r.get("user_ratings_total") or 0, reverse=True)
            else:
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
        # Tipos que definitivamente no queremos en una app de restaurantes por defecto
        # (Aun si estuvieran en tags.json, aplicamos filtro estricto si NO tienen un tipo de restaurante claro)
        EXCLUDED_TYPES = {
            "fish_market", "fruit_and_vegetable_store", "meat_market", 
            "pharmacy", "drugstore", "department_store",
            "shopping_mall", "car_repair", "gas_station",
            "supermarket", "grocery_or_supermarket", "convenience_store", "store"
        }
        
        # Tipos que confirman que es un lugar de comida real (usamos tags.json + heurística)
        # Pero para la exclusión rápida, nos apoyamos en los IDs cargados
        
        formatted = []
        for place in places:
            types = place.get("types", [])
            
            # Un lugar es válido si tiene al menos un tipo contemplado en tags.json
            # o si cumple la heurística de restaurante/bar/cafe.
            has_valid_tag = any(t in self._valid_tag_ids for t in types)
            
            # Heurística de seguridad para no perder sitios específicos no listados
            has_restaurant_heuristic = any(
                t.endswith("_restaurant") or t.endswith("_bar") or 
                t.endswith("_cafe") or t.endswith("_pub") 
                for t in types
            )
            
            # Si no tiene etiqueta válida ni cumple la heurística, fuera.
            if not has_valid_tag and not has_restaurant_heuristic:
                continue

            # Filtro de seguridad adicional: si tiene un tipo excluido (como pescadería)
            # y NO es explícitamente un restaurante/bar (según heurística o tags específicos), fuera.
            has_excluded = any(t in EXCLUDED_TYPES for t in types)
            # Consideramos tipos "fuertes" de comida para desempatar excluidos
            strong_food_types = {"restaurant", "cafe", "bar", "pub", "bistro", "gastropub", "pizzeria"}
            has_strong_food = any(t in strong_food_types or t.endswith("_restaurant") for t in types)

            if has_excluded and not has_strong_food:
                continue

            name = place.get("displayName", {}).get("text", "Sin nombre")
            
            formatted.append({
                "id": place.get("id"),
                "name": name,
                "address": place.get("formattedAddress"),
                "price_level": place.get("priceLevel"),
                "rating": place.get("rating"),
                "user_ratings_total": place.get("userRatingCount"),
                "types": types,
                "main_photo": self._get_photo_url(place.get("photos", [])),
                "google_maps_uri": place.get("googleMapsUri"),
                "website_uri": place.get("websiteUri"),
                "opening_hours": place.get("regularOpeningHours", {}).get("weekdayDescriptions", []),
                "open_now": place.get("currentOpeningHours", {}).get("openNow"),
                "summary": place.get("editorialSummary", {}).get("text", ""),
                "latitude": place.get("location", {}).get("latitude"),
                "longitude": place.get("location", {}).get("longitude"),
                "phone_number": place.get("nationalPhoneNumber")
            })
        return formatted

    def _get_photo_url(self, photos: List[Dict[str, Any]]) -> str:
        if not photos:
            return ""
        resource_name = photos[0].get("name", "")
        if not resource_name:
            return ""
        
        return f"https://places.googleapis.com/v1/{resource_name}/media?maxHeightPx=400&maxWidthPx=400&key={self.api_key}"

    async def get_place_details(self, place_id: str) -> Dict[str, Any]:
        """Obtiene detalles completos de un restaurante específico por su ID."""
        url = f"https://places.googleapis.com/v1/places/{place_id}"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,nationalPhoneNumber,priceLevel,rating,userRatingCount,types,photos,googleMapsUri,websiteUri,regularOpeningHours,currentOpeningHours,editorialSummary,location"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=10.0)
            if response.status_code != 200:
                print(f"Error fetching details for {place_id}: {response.text}")
                return {}
            
            place = response.json()
            formatted = self._format_results([place])
            return formatted[0] if formatted else {}

recommendation_service = RecommendationService()
