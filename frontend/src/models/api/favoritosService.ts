const API_URL = 'http://localhost:8000/api';

export interface FavoritosList {
    id: number;
    user_id: string;
    nombre: string;
}

export interface FavoritoItem {
    id: number;
    lista_id: number;
    place_id: string;
    restaurant: any;
}

export const favoritosService = {
    getListas: async (): Promise<FavoritosList[]> => {
        const response = await fetch(`${API_URL}/favoritos/listas`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al obtener las listas de favoritos');
        }
        return await response.json();
    },

    crearLista: async (nombre: string): Promise<FavoritosList> => {
        const response = await fetch(`${API_URL}/favoritos/listas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nombre }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al crear la lista');
        }
        return await response.json();
    },

    deleteLista: async (listaId: number): Promise<void> => {
        const response = await fetch(`${API_URL}/favoritos/listas/${listaId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar la lista de favoritos');
        }
    },

    getListaDetalle: async (listaId: number): Promise<{ lista: FavoritosList; restaurantes: FavoritoItem[] }> => {
        const response = await fetch(`${API_URL}/favoritos/listas/${listaId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al obtener los favoritos de la lista');
        }
        return await response.json();
    },

    addFavorito: async (listaId: number, placeId: string): Promise<FavoritoItem> => {
        const response = await fetch(`${API_URL}/favoritos/listas/${listaId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ place_id: placeId }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al añadir a favoritos');
        }
        return await response.json();
    },

    deleteFavorito: async (favoritoId: number): Promise<void> => {
        const response = await fetch(`${API_URL}/favoritos/${favoritoId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar de favoritos');
        }
    },
};
