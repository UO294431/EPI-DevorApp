import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FavoritesPage from '../views/FavoritesPage';

// ── Mocks ─────────────────────────────────────────────────────
vi.mock('../models/api/favoritosService', () => ({
    favoritosService: {
        getListas: vi.fn(),
        getListaDetalle: vi.fn(),
        crearLista: vi.fn(),
        deleteLista: vi.fn(),
        addFavorito: vi.fn(),
        deleteFavorito: vi.fn(),
    },
}));
import { favoritosService } from '../models/api/favoritosService';

vi.mock('../models/api/historialService', () => ({
    historialService: {
        addToHistorial: vi.fn(),
    },
}));
import { historialService } from '../models/api/historialService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const mockConfirm = vi.fn();
globalThis.confirm = mockConfirm;

const mockAlert = vi.fn();
globalThis.alert = mockAlert;

const mockListas = [
    { id: 1, user_id: 'user1', nombre: 'Favoritos' },
    { id: 2, user_id: 'user1', nombre: 'Pizzas' }
];

const mockRestaurantes = [
    {
        id: 1,
        lista_id: 1,
        place_id: "place1",
        restaurant: {
            id: "place1",
            name: "Pizza Test Fav",
            rating: 4.8,
            user_ratings_total: 200,
            types: ["restaurant"],
            address: "Calle Falsa 456",
            summary: "Mejor pizza",
            opening_hours: ["Monday: 12:00 PM - 11:30 PM"],
            google_maps_uri: "http://maps.google.com/?cid=456",
            website_uri: "http://pizzatestfav.com"
        }
    }
];

const renderFavoritesPage = () =>
    render(
        <MemoryRouter initialEntries={['/favorites']}>
            <FavoritesPage />
        </MemoryRouter>
    );

describe('FavoritesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe mostrar las listas de favoritos del usuario', async () => {
        (favoritosService.getListas as ReturnType<typeof vi.fn>).mockResolvedValue(mockListas);

        renderFavoritesPage();

        expect(screen.getByText('Mis Favoritos')).toBeInTheDocument();
        
        await waitFor(() => {
            expect(screen.getByText('Favoritos')).toBeInTheDocument();
            expect(screen.getByText('Pizzas')).toBeInTheDocument();
        });
    });

    it('debe abrir modal con los restaurantes al hacer click en una lista', async () => {
        (favoritosService.getListas as ReturnType<typeof vi.fn>).mockResolvedValue(mockListas);
        (favoritosService.getListaDetalle as ReturnType<typeof vi.fn>).mockResolvedValue({
            lista: mockListas[0],
            restaurantes: mockRestaurantes
        });

        renderFavoritesPage();

        await waitFor(() => {
            expect(screen.getByText('Favoritos')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Favoritos'));

        await waitFor(() => {
            expect(favoritosService.getListaDetalle).toHaveBeenCalledWith(1);
            expect(screen.getByText('1 restaurantes favoritos')).toBeInTheDocument();
            expect(screen.getByText('Pizza Test Fav')).toBeInTheDocument();
            expect(screen.getByText('Calle Falsa 456')).toBeInTheDocument();
        });
    });

    it('debe eliminar la lista desde el modal', async () => {
        (favoritosService.getListas as ReturnType<typeof vi.fn>).mockResolvedValue(mockListas);
        (favoritosService.getListaDetalle as ReturnType<typeof vi.fn>).mockResolvedValue({
            lista: mockListas[0],
            restaurantes: mockRestaurantes
        });
        (favoritosService.deleteLista as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        mockConfirm.mockReturnValue(true);

        renderFavoritesPage();

        await waitFor(() => {
            expect(screen.getByText('Favoritos')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Favoritos'));

        await waitFor(() => {
            expect(screen.getByText('Pizza Test Fav')).toBeInTheDocument();
        });

        const deleteListBtn = screen.getByTitle('Eliminar lista');
        fireEvent.click(deleteListBtn);

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalled();
            expect(favoritosService.deleteLista).toHaveBeenCalledWith(1);
            expect(screen.queryByText('Favoritos')).not.toBeInTheDocument(); // la lista desaparece de la vista principal
        });
    });

    it('debe re-seleccionar un favorito añadiéndolo al historial', async () => {
        (favoritosService.getListas as ReturnType<typeof vi.fn>).mockResolvedValue(mockListas);
        (favoritosService.getListaDetalle as ReturnType<typeof vi.fn>).mockResolvedValue({
            lista: mockListas[0],
            restaurantes: mockRestaurantes
        });
        (historialService.addToHistorial as ReturnType<typeof vi.fn>).mockResolvedValue({});

        renderFavoritesPage();

        await waitFor(() => {
            expect(screen.getByText('Favoritos')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Favoritos'));

        await waitFor(() => {
            expect(screen.getByText('Pizza Test Fav')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Pizza Test Fav')); // Expandir detalle del restaurante

        const reselectBtn = await screen.findByRole('button', { name: /VOLVER A SELECCIONAR/i });
        fireEvent.click(reselectBtn);

        await waitFor(() => {
            expect(historialService.addToHistorial).toHaveBeenCalledWith('place1');
            expect(mockAlert).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/home');
        });
    });

    it('debe eliminar de favoritos un restaurante', async () => {
        (favoritosService.getListas as ReturnType<typeof vi.fn>).mockResolvedValue(mockListas);
        (favoritosService.getListaDetalle as ReturnType<typeof vi.fn>).mockResolvedValue({
            lista: mockListas[0],
            restaurantes: mockRestaurantes
        });
        (favoritosService.deleteFavorito as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        mockConfirm.mockReturnValue(true);

        renderFavoritesPage();

        await waitFor(() => fireEvent.click(screen.getByText('Favoritos')));
        await waitFor(() => fireEvent.click(screen.getByText('Pizza Test Fav')));

        const deleteFavBtn = await screen.findByRole('button', { name: /Eliminar de favoritos/i });
        fireEvent.click(deleteFavBtn);

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalled();
            expect(favoritosService.deleteFavorito).toHaveBeenCalledWith(1);
            expect(screen.queryByText('Pizza Test Fav')).not.toBeInTheDocument();
        });
    });
});
