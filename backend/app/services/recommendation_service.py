import httpx
import json
import math
import os
import asyncio
from typing import List, Dict, Any, Optional, Set
from app.core.config import settings
from app.models.dtos.recommendation_dto import RecommendationRequest
from app.infrastructure.database import SessionLocal
from sqlalchemy import text
from datetime import datetime

# Tipos demasiado genéricos para usarlos como señal de preferencia
GENERIC_TYPES = {
    'restaurant', 'food', 'establishment',
    'point_of_interest', 'meal_takeaway', 'meal_delivery',
    'store', 'lodging'
}

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

    # ── Helpers ───────────────────────────────────────────────────────────────
    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Distancia en km entre dos coordenadas."""
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @staticmethod
    def _dist_to_score(dist_km: float) -> float:
        """Convierte km a score 1-5 (0km→5, ≥30km→1)."""
        return max(1.0, 5.0 - (dist_km / 30.0) * 4.0)

    @staticmethod
    def _bayesian_rating(v: int, r: float, m: int = 10, c: float = 3.5) -> float:
        return (v / (v + m)) * r + (m / (v + m)) * c

    async def _geocode_location(self, location: str):
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.geocode_url}?address={location}&key={self.api_key}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("results"):
                    loc = data["results"][0]["geometry"]["location"]
                    return loc.get("lat"), loc.get("lng")
        return None, None

    # ── Main search endpoint ───────────────────────────────────────────────────
    async def search_restaurants(self, request: RecommendationRequest, user_id: str = None) -> Dict[str, Any]:
        query_parts = []
        if request.categories:
            labels = [self._valid_tag_ids.get(cat, cat.replace("_", " ")) for cat in request.categories]
            query_parts.append(" OR ".join(labels))
        query_parts.append(f"restaurantes en {request.location}")
        text_query = " ".join(query_parts)

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.priceLevel,places.rating,places.userRatingCount,places.types,places.photos,places.googleMapsUri,places.websiteUri,places.regularOpeningHours,places.currentOpeningHours,places.editorialSummary,places.location,nextPageToken"
        }

        payload = {
            "textQuery": text_query,
            "maxResultCount": request.max_results,
            "languageCode": "es"
        }

        lat, lng = await self._geocode_location(request.location)
        if lat is not None and lng is not None:
            payload["locationBias"] = {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": 30000.0
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
                print(f"Error from Google Places API: {response.text}")
                return {"results": [], "next_page_token": None}

            data = response.json()
            places = data.get("places", [])
            next_page_token = data.get("nextPageToken")
            formatted = self._format_results(places)

        sort_type = getattr(request, 'sort_by', 'recommended')

        if sort_type == 'distance':
            if lat is not None and lng is not None:
                formatted.sort(key=lambda r: self._haversine(
                    lat, lng,
                    r.get("latitude") or lat,
                    r.get("longitude") or lng
                ))
            else:
                formatted.sort(key=lambda r: self._bayesian_rating(
                    r.get("user_ratings_total") or 0, r.get("rating") or 0
                ), reverse=True)

        elif sort_type == 'reviews':
            formatted.sort(key=lambda r: r.get("user_ratings_total") or 0, reverse=True)

        elif sort_type == 'recommended':
            if user_id is not None:
                try:
                    await self._sort_recommended(
                        formatted, user_id,
                        search_lat=lat, search_lng=lng
                    )
                except Exception as e:
                    import traceback
                    print(f"⚠️  Error en scoring recomendado: {e}")
                    traceback.print_exc()
                    formatted.sort(key=lambda r: self._bayesian_rating(
                        r.get("user_ratings_total") or 0, r.get("rating") or 0
                    ), reverse=True)
            else:
                formatted.sort(key=lambda r: self._bayesian_rating(
                    r.get("user_ratings_total") or 0, r.get("rating") or 0
                ), reverse=True)

        else:  # 'rating' o por defecto
            formatted.sort(key=lambda r: self._bayesian_rating(
                r.get("user_ratings_total") or 0, r.get("rating") or 0
            ), reverse=True)

        return {
            "results": formatted,
            "next_page_token": next_page_token
        }

    # ── Recomendación personalizada ───────────────────────────────────────────
    async def _sort_recommended(
        self,
        formatted: list,
        user_id: str,
        search_lat=None, search_lng=None
    ):
        keras_headers = {"x-api-key": "devorapp_6f8e2b9a1c4d5e0f7a3b8c9d0e1f2a3b4c5d6e7f8"}
        keras_base = settings.KERAS_API_URL.rsplit("/predict", 1)[0]

        # ── PASO 1: Cargar datos del usuario desde PostgreSQL ─────────────────
        db = SessionLocal()
        try:
            # Valoraciones propias: {place_id: avg_score}
            res = db.execute(text("""
                SELECT r.place_id,
                       AVG((v.calidad + v.precio + v.higiene + v.trato) / 4.0) as score,
                       AVG(v.precio) as price_rating
                FROM valoraciones v
                JOIN restaurantes r ON v.restaurante_id = r.id
                WHERE v.user_id = :uid
                GROUP BY r.place_id
            """), {"uid": user_id}).fetchall()
            user_direct_scores: Dict[str, float] = {row[0]: float(row[1]) for row in res}
            user_direct_price: Dict[str, float] = {row[0]: float(row[2]) for row in res}
            
            num_val = len(user_direct_scores)
            avg_rating = sum(user_direct_scores.values()) / num_val if num_val > 0 else 3.5

            # Favoritos: set de place_ids
            res = db.execute(text("""
                SELECT r.place_id
                FROM favoritos f
                JOIN listas_favoritos l ON f.lista_id = l.id
                JOIN restaurantes r ON f.restaurante_id = r.id
                WHERE l.user_id = :uid
            """), {"uid": user_id}).fetchall()
            user_favs: Set[str] = {row[0] for row in res}

            # Historial visitado: set de place_ids
            res = db.execute(text("""
                SELECT r.place_id
                FROM historial h
                JOIN restaurantes r ON h.restaurante_id = r.id
                WHERE h.user_id = :uid
            """), {"uid": user_id}).fetchall()
            user_visited: Set[str] = {row[0] for row in res}

            # Todos los demás usuarios: {other_uid: {place_id: score}}
            res = db.execute(text("""
                SELECT v.user_id, r.place_id,
                       AVG((v.calidad + v.precio + v.higiene + v.trato) / 4.0) as score
                FROM valoraciones v
                JOIN restaurantes r ON v.restaurante_id = r.id
                WHERE v.user_id != :uid
                GROUP BY v.user_id, r.place_id
            """), {"uid": user_id}).fetchall()
            other_users: Dict[str, Dict[str, float]] = {}
            for row in res:
                oid, pid, score = row[0], row[1], float(row[2])
                if oid not in other_users:
                    other_users[oid] = {}
                other_users[oid][pid] = score
        finally:
            db.close()

        # ── PASO 2: Obtener Info (tipos + precio) de los lugares valorados ────
        all_info: Dict[str, Dict[str, Any]] = {}
        if user_direct_scores:
            rated_ids = list(user_direct_scores.keys())
            # 2a. Consultar caché de Keras
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        f"{keras_base}/info",
                        headers=keras_headers,
                        json={"place_ids": rated_ids},
                        timeout=5.0
                    )
                    if resp.status_code == 200:
                        all_info = resp.json().get("info", {})
            except Exception as e:
                print(f"⚠️  /info (cache) no disponible: {e}")

            # 2b. Fallback Google Places para los que faltan
            missing_ids = [pid for pid in rated_ids if pid not in all_info]
            if missing_ids:
                async def _fetch_info(client: httpx.AsyncClient, place_id: str):
                    try:
                        resp = await client.get(
                            f"https://places.googleapis.com/v1/places/{place_id}",
                            headers={"X-Goog-Api-Key": self.api_key, "X-Goog-FieldMask": "types,priceLevel"},
                            timeout=5.0
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            p_map_int = {"PRICE_LEVEL_FREE":0, "PRICE_LEVEL_INEXPENSIVE":1, "PRICE_LEVEL_MODERATE":2, "PRICE_LEVEL_EXPENSIVE":3, "PRICE_LEVEL_VERY_EXPENSIVE":4}
                            raw_p = data.get("priceLevel")
                            return place_id, {
                                "types": data.get("types", []),
                                "price_level": p_map_int.get(raw_p, 2) if isinstance(raw_p, str) else (raw_p or 2)
                            }
                    except Exception: pass
                    return place_id, {"types": [], "price_level": 2}

                async with httpx.AsyncClient() as client:
                    results = await asyncio.gather(*[_fetch_info(client, pid) for pid in missing_ids], return_exceptions=True)
                for result in results:
                    if isinstance(result, tuple):
                        pid, info = result
                        all_info[pid] = info

        # ── PASO 3: Construir perfiles de tipos y precio ──────────────────────
        type_scores_accum: Dict[str, List[float]] = {}
        high_price_ratings: List[float] = [] # Notas en sitios caros (€€€ o €€€€)
        
        for pid, score in user_direct_scores.items():
            info = all_info.get(pid, {})
            # Tipos
            for t in info.get("types", []):
                if t not in GENERIC_TYPES:
                    type_scores_accum.setdefault(t, []).append(score)
            # Precio
            if info.get("price_level", 2) >= 3:
                high_price_ratings.append(user_direct_price.get(pid, 3.0))

        user_type_profile: Dict[str, float] = {
            t: sum(scores) / len(scores)
            for t, scores in type_scores_accum.items()
        }
        
        # Sensibilidad al precio: ¿Qué nota pone el usuario al PRECIO en sitios caros?
        avg_price_at_expensive = sum(high_price_ratings) / len(high_price_ratings) if high_price_ratings else 3.5
        is_price_sensitive = avg_price_at_expensive < 3.0

        # ── PASO 4: Collaborative Filtering ──────────────────────────────────
        user_similarities: Dict[str, float] = {}
        if user_direct_scores:
            for other_uid, other_ratings in other_users.items():
                shared = set(user_direct_scores.keys()) & set(other_ratings.keys())
                if not shared: continue
                curr  = [user_direct_scores[p]   for p in shared]
                other = [other_ratings[p] for p in shared]
                if len(shared) >= 2:
                    mean_c, mean_o = sum(curr)/len(curr), sum(other)/len(other)
                    num = sum((c-mean_c)*(o-mean_o) for c, o in zip(curr, other))
                    den = (sum((c-mean_c)**2 for c in curr) * sum((o-mean_o)**2 for o in other)) ** 0.5
                    sim = num / den if den > 0 else 0.0
                else:
                    sim = 0.4 if abs(curr[0] - other[0]) < 0.5 else 0.0
                if sim > 0.15: user_similarities[other_uid] = sim

        # ── PASO 5: Obtener scores de Keras ──────────────────────────────────
        ahora = datetime.now(); es_finde = 1 if ahora.weekday() >= 5 else 0
        hora = ahora.hour; franja = 0 if 5<=hora<12 else (1 if 12<=hora<19 else 2)

        p_map_k = {"PRICE_LEVEL_FREE":0, "PRICE_LEVEL_INEXPENSIVE":0, "PRICE_LEVEL_MODERATE":1, "PRICE_LEVEL_EXPENSIVE":2, "PRICE_LEVEL_VERY_EXPENSIVE":3}
        keras_candidates = [{"place_id":r["id"], "price_level":p_map_k.get(r.get("price_level"),1) if isinstance(r.get("price_level"),str) else (r.get("price_level") or 1), "rating":r.get("rating",3.5), "types":r.get("types",[])} for r in formatted]

        keras_norm: Dict[str, float] = {}
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(settings.KERAS_API_URL, headers=keras_headers, json={"user_id":user_id, "avg_rating":avg_rating, "num_val":num_val, "user_favs":list(user_favs), "es_finde":es_finde, "franja":franja, "candidates":keras_candidates}, timeout=15.0)
                if resp.status_code == 200:
                    raw_scores = {item["place_id"]: item["predicted_rating"] for item in resp.json().get("results", [])}
                    if raw_scores:
                        mi, ma = min(raw_scores.values()), max(raw_scores.values())
                        rng = ma - mi
                        # Rango conservador para mayor estabilidad
                        keras_norm = {pid: 2.5 + 2.5 * (sc-mi)/rng if rng > 0.01 else 3.5 for pid, sc in raw_scores.items()}
        except Exception as e: print(f"⚠️ Keras error: {e}")

        # ── PASO 6: Calcular score final para cada candidato ──────────────────
        for r in formatted:
            pid      = r["id"]
            r_types  = set(r.get("types") or []) - GENERIC_TYPES
            google_r = r.get("rating") or 3.5
            keras_s  = keras_norm.get(pid, 3.5)

            if pid in user_direct_scores:
                direct = user_direct_scores[pid]
                # Mayor peso al historial directo (80%)
                final, source = 0.80*direct + 0.20*google_r, f"direct({direct:.1f})"
            else:
                # Pesos: Tipos(35%), Google(25%), CF(25%), Keras(10%), Dist(5%)
                signals, weights = [keras_s, google_r], [0.10, 0.25]
                type_matches = [user_type_profile[t] for t in r_types if t in user_type_profile]
                if type_matches:
                    t_avg = sum(type_matches)/len(type_matches)
                    if t_avg < 2.5: t_avg *= 0.8
                    signals.append(t_avg); weights.append(0.35)
                
                cf_p = [(sim, other_users[ouid][pid]) for ouid, sim in user_similarities.items() if pid in other_users.get(ouid, {})]
                if cf_p: signals.append(sum(s*sc for s,sc in cf_p)/sum(s for s,_ in cf_p)); weights.append(0.25)
                
                if search_lat and r.get("latitude"):
                    signals.append(self._dist_to_score(self._haversine(search_lat, search_lng, r["latitude"], r["longitude"]))); weights.append(0.05)

                final = sum(s*(w/sum(weights)) for s,w in zip(signals, weights))

                # Ajuste de Precio
                p_raw = r.get("price_level")
                p_map_i = {"PRICE_LEVEL_FREE":0, "PRICE_LEVEL_INEXPENSIVE":1, "PRICE_LEVEL_MODERATE":2, "PRICE_LEVEL_EXPENSIVE":3, "PRICE_LEVEL_VERY_EXPENSIVE":4}
                p_int = p_map_i.get(p_raw, 2) if isinstance(p_raw, str) else (p_raw or 2)
                
                if is_price_sensitive and p_int >= 3: final *= 0.85
                if pid in user_favs: final = min(5.0, final + 0.25)
                source = f"hybrid({len(type_matches)}types)"

            r["hybrid_score"], r["score_source"] = round(final, 4), source

        formatted.sort(key=lambda x: x.get("hybrid_score", 0.0), reverse=True)
        if formatted:
            top, bot = formatted[0], formatted[-1]
            print(f"📊 Restaurado — top: {top['name']} ({formatted[0]['hybrid_score']})")

    def _format_results(self, places: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        EXCLUDED_TYPES = {"fish_market", "fruit_and_vegetable_store", "meat_market", "pharmacy", "drugstore", "department_store", "shopping_mall", "car_repair", "gas_station", "supermarket", "grocery_or_supermarket", "convenience_store", "store"}
        formatted = []
        for place in places:
            types = place.get("types", [])
            if not any(t in self._valid_tag_ids for t in types) and not any(t.endswith(("_restaurant", "_bar", "_cafe", "_pub")) for t in types): continue
            if any(t in EXCLUDED_TYPES for t in types) and not any(t in {"restaurant", "cafe", "bar", "pub", "bistro", "pizzeria"} or t.endswith("_restaurant") for t in types): continue
            formatted.append({
                "id": place.get("id"),
                "name": place.get("displayName", {}).get("text", "Sin nombre"),
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
        if not photos or not photos[0].get("name"): return ""
        return f"https://places.googleapis.com/v1/{photos[0]['name']}/media?maxHeightPx=400&maxWidthPx=400&key={self.api_key}"

    async def get_place_details(self, place_id: str) -> Dict[str, Any]:
        """Obtiene detalles completos de un restaurante específico por su ID."""
        url = f"https://places.googleapis.com/v1/places/{place_id}"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,nationalPhoneNumber,priceLevel,rating,userRatingCount,types,photos,googleMapsUri,websiteUri,regularOpeningHours,currentOpeningHours,editorialSummary,location"
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=10.0)
            if resp.status_code != 200:
                print(f"Error fetching details for {place_id}: {resp.text}")
                return {}
            place = resp.json()
            formatted = self._format_results([place])
            return formatted[0] if formatted else {}

recommendation_service = RecommendationService()
