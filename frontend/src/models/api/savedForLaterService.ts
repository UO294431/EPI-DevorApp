// src/models/api/savedForLaterService.ts

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface SavedForLaterEntry {
    id: string; // En el frontend se tratará como string aunque venga como int
    place_id: string;
    user_id?: string;
    name: string;
    rating: number;
    user_ratings_total: number;
    types: string[];
    address: string;
    main_photo?: string;
    summary?: string;
    opening_hours?: string[];
    open_now?: boolean;
    google_maps_uri?: string;
    website_uri?: string;
    saved_at?: string; // Mantenemos para posible uso futuro, aunque no venga de backend
}

class SavedForLaterService {
    async getSaved(): Promise<SavedForLaterEntry[]> {
        const response = await fetch(`${API_URL}/mas-tarde`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al obtener los lugares guardados');
        }

        const data = await response.json();

        // Mapear la respuesta del backend (que tiene { id, restaurant: {...} }) 
        // al formato que espera la vista
        return data.map((item: any) => ({
            id: String(item.id),
            name: item.restaurant.name,
            rating: item.restaurant.rating,
            user_ratings_total: item.restaurant.user_ratings_total,
            types: item.restaurant.types,
            address: item.restaurant.address,
            main_photo: item.restaurant.main_photo,
            summary: item.restaurant.summary,
            opening_hours: item.restaurant.opening_hours,
            open_now: item.restaurant.open_now,
            google_maps_uri: item.restaurant.google_maps_uri,
            website_uri: item.restaurant.website_uri,
            place_id: item.place_id,
        }));
    }

    async saveForLater(restaurantData: { place_id: string;[key: string]: any }): Promise<{ entry: SavedForLaterEntry, already_saved: boolean }> {
        const response = await fetch(`${API_URL}/mas-tarde`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ place_id: restaurantData.place_id }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al guardar para más tarde');
        }

        const item = await response.json();

        // Mapeamos lo develto al formato de la vista
        return {
            entry: {
                id: String(item.id),
                name: item.restaurant.name,
                rating: item.restaurant.rating,
                user_ratings_total: item.restaurant.user_ratings_total,
                types: item.restaurant.types,
                address: item.restaurant.address,
                main_photo: item.restaurant.main_photo,
                summary: item.restaurant.summary,
                opening_hours: item.restaurant.opening_hours,
                open_now: item.restaurant.open_now,
                google_maps_uri: item.restaurant.google_maps_uri,
                website_uri: item.restaurant.website_uri,
                place_id: item.place_id,
            },
            already_saved: item.already_saved
        };
    }

    async deleteSaved(entryId: string): Promise<void> {
        const response = await fetch(`${API_URL}/mas-tarde/${entryId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar de guardados');
        }
    }
}

export const savedForLaterService = new SavedForLaterService();
