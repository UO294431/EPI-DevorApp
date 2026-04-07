export interface ValoracionCreate {
    place_id: string;
    calidad: number;
    precio: number;
    higiene: number;
    trato: number;
    comentario?: string;
}

export interface ValoracionResponse extends ValoracionCreate {
    id: number;
    user_id: string;
    me_gustas: number;
}

export interface ValoracionPublica {
    id: number;
    username: string;
    calidad: number;
    precio: number;
    higiene: number;
    trato: number;
    comentario?: string;
    me_gustas: number;
    ha_dado_me_gusta: boolean;
}

export interface ValoracionDetailedResponse {
    id: number;
    place_id: string;
    calidad: number;
    precio: number;
    higiene: number;
    trato: number;
    comentario?: string;
    restaurant: any; // We can use the same Google Places any type or history any type
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const valoracionesService = {
    valorarRestaurante: async (data: ValoracionCreate): Promise<ValoracionResponse> => {
        const response = await fetch(`${API_URL}/api/valoraciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al guardar la valoración');
        }

        return await response.json();
    },

    obtenerMiValoracion: async (place_id: string): Promise<ValoracionResponse | null> => {
        const response = await fetch(`${API_URL}/api/valoraciones/${place_id}`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Error al obtener la valoración');
        }

        const data = await response.json();
        if (Object.keys(data).length === 0) {
            return null;
        }

        return data;
    },

    obtenerTodasMisValoraciones: async (): Promise<ValoracionDetailedResponse[]> => {
        const response = await fetch(`${API_URL}/api/valoraciones`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Error al obtener el historial de valoraciones');
        }

        return await response.json();
    },

    eliminarValoracion: async (place_id: string): Promise<void> => {
        const response = await fetch(`${API_URL}/api/valoraciones/${place_id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al eliminar la valoración');
        }
    },

    obtenerResenasRestaurante: async (place_id: string): Promise<ValoracionPublica[]> => {
        const response = await fetch(`${API_URL}/api/valoraciones/restaurante/${place_id}`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Error al obtener las reseñas del restaurante');
        }

        return await response.json();
    },

    darMeGusta: async (valoracion_id: number): Promise<ValoracionPublica> => {
        const response = await fetch(`${API_URL}/api/valoraciones/${valoracion_id}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al dar me gusta');
        }

        return await response.json();
    },
};

