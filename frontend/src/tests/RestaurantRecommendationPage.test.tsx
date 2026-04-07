import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RestaurantRecommendationPage from '../views/RestaurantRecommendationPage';

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('../models/api/recommendationService', () => ({
    recommendationService: {
        search: vi.fn(),
    },
}));

vi.mock('../models/api/authService', () => ({
    authService: {
        getMe: vi.fn(),
    },
}));

vi.mock('../models/api/savedForLaterService', () => ({
    savedForLaterService: {
        saveForLater: vi.fn(),
    },
}));

vi.mock('../models/api/valoracionesService', () => ({
    valoracionesService: {
        obtenerResenasRestaurante: vi.fn(),
        darMeGusta: vi.fn(),
    },
}));

vi.mock('../core/auth', () => ({
    useAuth: () => ({
        user: { ubicacion: 'Valencia' },
    }),
}));

import { recommendationService } from '../models/api/recommendationService';
import { authService } from '../models/api/authService';
import { valoracionesService } from '../models/api/valoracionesService';

const renderPage = () =>
    render(
        <MemoryRouter>
            <RestaurantRecommendationPage />
        </MemoryRouter>
    );

describe('RestaurantRecommendationPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock default for authService.getMe
        (authService.getMe as any).mockResolvedValue({
            ubicacion: 'Valencia'
        });

        // Mock global fetch for Google Maps Geocoding API
        (globalThis as any).fetch = vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                results: [
                    {
                        address_components: [
                            { short_name: 'ES', types: ['country'] }
                        ]
                    }
                ]
            })
        });
    });

    it('debe renderizar el título y el selector de ubicación', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText(/Recomendador de Restaurantes/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        expect(screen.getByText(/Escoger ubicación/i)).toBeInTheDocument();
    });

    it('debe cambiar entre modos de ubicación', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByLabelText(/Escoger ubicación/i)).toBeInTheDocument();
        });
        const customRadio = screen.getByLabelText(/Escoger ubicación/i);
        fireEvent.click(customRadio);

        // El input de autocomplete debe ser visible (mockeado en setupTests)
        expect(screen.getByTestId('mock-autocomplete')).toBeInTheDocument();
    });

    it('debe llamar al servicio de recomendación al enviar el formulario', async () => {
        (recommendationService.search as any).mockResolvedValue({
            results: [
                {
                    id: '1',
                    name: 'Pizza Place',
                    rating: 4.5,
                    user_ratings_total: 100,
                    address: 'Calle Falsa 123',
                    main_photo: '',
                }
            ],
            next_page_token: null
        });

        renderPage();

        // Esperar a que se cargue la ubicación preferida
        await waitFor(() => {
            expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        });

        // Simular click en buscar
        const searchBtn = screen.getByRole('button', { name: /Buscar Sugerencias/i });
        fireEvent.click(searchBtn);

        await waitFor(() => {
            expect(recommendationService.search).toHaveBeenCalled();
        });

        expect(screen.getByText(/Pizza Place/i)).toBeInTheDocument();
        expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    });

    it('debe reenviar la búsqueda con sort_by: "distance" cuando se cambia el filtro a "Cercanía"', async () => {
        // Primera llamada devuelve resultados
        (recommendationService.search as any).mockResolvedValueOnce({
            results: [{ id: '1', name: 'Sushi Bar', rating: 4.5, user_ratings_total: 100 }],
            next_page_token: null
        });
        
        // Segunda llamada al cambiar el filtro
        (recommendationService.search as any).mockResolvedValueOnce({
            results: [{ id: '2', name: 'Taco Stand', rating: 4.8, user_ratings_total: 200 }],
            next_page_token: null
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        });

        // Ejecutar primera búsqueda para mostrar los resultados y el bloque de "Ordenar por"
        const searchBtn = screen.getByRole('button', { name: /Buscar Sugerencias/i });
        fireEvent.click(searchBtn);

        await waitFor(() => {
            expect(screen.getByText(/Ordenar por:/i)).toBeInTheDocument();
        });

        // Cambiar dropdown a Cercanía
        const select = screen.getByRole('combobox', { name: /Ordenar resultados/i });
        fireEvent.change(select, { target: { value: 'distance' } });

        // Verificar que se llamó a search automáticamente con distance
        await waitFor(() => {
            expect(recommendationService.search).toHaveBeenCalledWith(expect.objectContaining({
                sort_by: 'distance',
                location: 'Valencia'
            }));
        });
    });

    it('debe expandir los detalles del restaurante al hacer click', async () => {
        (recommendationService.search as any).mockResolvedValue({
            results: [
                {
                    id: '1',
                    name: 'Pizza Place',
                    summary: 'La mejor pizza de la ciudad',
                    opening_hours: ['Lunes: 9:00-21:00'],
                    google_maps_uri: 'http://maps.google.com',
                }
            ],
            next_page_token: null
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Buscar Sugerencias/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Buscar Sugerencias/i }));

        await waitFor(() => {
            expect(screen.getByText(/Pizza Place/i)).toBeInTheDocument();
        });

        // Click en la tarjeta para expandir
        fireEvent.click(screen.getByText(/Pizza Place/i));

        expect(screen.getByText(/La mejor pizza de la ciudad/i)).toBeInTheDocument();
        expect(screen.getByText(/Horario de apertura/i)).toBeInTheDocument();
        expect(screen.getByText(/SELECCIONAR ESTE RESTAURANTE/i)).toBeInTheDocument();
    });

    it('debe cargar y mostrar las reseñas de la comunidad al expandir un restaurante', async () => {
        (recommendationService.search as any).mockResolvedValue({
            results: [{ id: '1', name: 'Pizza Place', rating: 4.5, user_ratings_total: 100 }],
            next_page_token: null
        });

        (valoracionesService.obtenerResenasRestaurante as any).mockResolvedValue([
            { id: 101, username: 'user1', calidad: 5, precio: 4, higiene: 5, trato: 5, comentario: 'Excelente!', me_gustas: 10 }
        ]);

        renderPage();

        // Esperar a que se cargue la ubicación preferida (evita que la búsqueda falle por falta de ubicación)
        await waitFor(() => {
            expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Buscar Sugerencias/i }));

        await waitFor(() => {
            // Usamos un matcher más flexible por si el texto estuviera fragmentado o hubiera múltiples ocurrencias
            expect(screen.getByText((content, element) => {
                return element?.tagName.toLowerCase() === 'div' && content.includes('Pizza Place');
            })).toBeInTheDocument();
        });

        // Click to expand
        fireEvent.click(screen.getByText(/Pizza Place/i));

        // It should load reviews
        await waitFor(() => {
            expect(valoracionesService.obtenerResenasRestaurante).toHaveBeenCalledWith('1');
        });

        // It should display community reviews header and the review itself
        expect(screen.getByText(/Reseñas de la comunidad/i)).toBeInTheDocument();
        expect(screen.getByText(/user1/i)).toBeInTheDocument();
        expect(screen.getByText(/Excelente!/i)).toBeInTheDocument();
        
        // Match exacto para el número de likes para no confundirse con el "100" de reseñas totales
        expect(screen.getByText(/^10$/)).toBeInTheDocument();
    });

    it('debe mostrar la paginación con el botón "Siguiente" si hay token de paginación', async () => {
        (recommendationService.search as any).mockResolvedValueOnce({
            results: [{ id: '1', name: 'Rest 1' }],
            next_page_token: 'token_valido'
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Buscar Sugerencias/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Buscar Sugerencias/i }));

        await waitFor(() => {
            // El componente renderiza la nueva paginación con "Siguiente" activo
            expect(screen.getByRole('button', { name: /Siguiente/i })).toBeInTheDocument();
        });
    });
});
