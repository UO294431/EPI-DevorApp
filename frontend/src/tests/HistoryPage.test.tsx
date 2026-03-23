import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HistoryPage from '../views/HistoryPage';

// ── Mock historialService ─────────────────────────────────────────────────────
vi.mock('../models/api/historialService', () => ({
    historialService: {
        getHistorial: vi.fn(),
        addToHistorial: vi.fn(),
        deleteFromHistorial: vi.fn(),
    },
}));

import { historialService } from '../models/api/historialService';

// ── Mock favoritosService ─────────────────────────────────────────────────────
vi.mock('../models/api/favoritosService', () => ({
    favoritosService: {
        getListas: vi.fn(),
        addFavorito: vi.fn(),
        crearLista: vi.fn(),
    },
}));

import { favoritosService } from '../models/api/favoritosService';

// Mock de useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Polyfill window.confirm / globalThis.confirm
const mockConfirm = vi.fn();
globalThis.confirm = mockConfirm;

// Polyfill globalThis.alert
const mockAlert = vi.fn();
globalThis.alert = mockAlert;

const mockHistoryData = [
    {
        id: 1,
        user_id: "user1",
        place_id: "place1",
        fecha_acceso: "2026-01-01T12:00:00Z",
        restaurant: {
            id: "place1",
            name: "Pizza Test",
            rating: 4.5,
            user_ratings_total: 100,
            types: ["restaurant"],
            address: "Calle Falsa 123",
            summary: "Buena pizza",
            opening_hours: ["Monday: 12:00 PM - 11:30 PM"],
            google_maps_uri: "http://maps.google.com/?cid=123",
            website_uri: "http://pizzatest.com"
        }
    }
];

const renderHistoryPage = () =>
    render(
        <MemoryRouter initialEntries={['/history']}>
            <HistoryPage />
        </MemoryRouter>
    );

describe('HistoryPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe mostrar cargando inicialmente y luego la lista de restaurantes', async () => {
        (historialService.getHistorial as ReturnType<typeof vi.fn>).mockResolvedValue(mockHistoryData);
        
        renderHistoryPage();

        expect(screen.getByText('Cargando tu historial...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Pizza Test')).toBeInTheDocument();
        });
        expect(screen.getByText('Calle Falsa 123')).toBeInTheDocument();
    });

    it('debe mostrar un mensaje cuando el historial está vacío', async () => {
        (historialService.getHistorial as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        
        renderHistoryPage();

        await waitFor(() => {
            expect(screen.getByText('No tienes restaurantes en tu historial todavía.')).toBeInTheDocument();
        });
    });

    it('debe expandir la tarjeta al hacer clic en ella', async () => {
        (historialService.getHistorial as ReturnType<typeof vi.fn>).mockResolvedValue(mockHistoryData);
        
        renderHistoryPage();

        await waitFor(() => {
            expect(screen.getByText('Pizza Test')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Pizza Test'));

        await waitFor(() => {
            expect(screen.getByText('💬')).toBeInTheDocument();
            expect(screen.getByText('Buena pizza')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /VOLVER A SELECCIONAR/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Eliminar del historial/i })).toBeInTheDocument();
        });
    });

    it('debe re-seleccionar un restaurante correctamente y navegar a /home', async () => {
        (historialService.getHistorial as ReturnType<typeof vi.fn>).mockResolvedValue(mockHistoryData);
        (historialService.addToHistorial as ReturnType<typeof vi.fn>).mockResolvedValue({});

        renderHistoryPage();

        await waitFor(() => {
            expect(screen.getByText('Pizza Test')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Pizza Test')); // Expandir

        const reselectBtn = await screen.findByRole('button', { name: /VOLVER A SELECCIONAR/i });
        fireEvent.click(reselectBtn);

        await waitFor(() => {
            expect(historialService.addToHistorial).toHaveBeenCalledWith('place1');
            expect(mockAlert).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/home');
        });
    });

    it('debe eliminar un restaurante correctamente tras confirmar', async () => {
        (historialService.getHistorial as ReturnType<typeof vi.fn>).mockResolvedValue(mockHistoryData);
        (historialService.deleteFromHistorial as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        mockConfirm.mockReturnValue(true);

        renderHistoryPage();

        await waitFor(() => {
            expect(screen.getByText('Pizza Test')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Pizza Test')); // Expandir

        const deleteBtn = await screen.findByRole('button', { name: /Eliminar del historial/i });
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalled();
            expect(historialService.deleteFromHistorial).toHaveBeenCalledWith('1');
        });

        // Verificar que desaparece del DOM
        await waitFor(() => {
            expect(screen.queryByText('Pizza Test')).not.toBeInTheDocument();
        });
    });

    it('no debe eliminar si el usuario cancela la confirmación', async () => {
        (historialService.getHistorial as ReturnType<typeof vi.fn>).mockResolvedValue(mockHistoryData);
        mockConfirm.mockReturnValue(false);

        renderHistoryPage();

        await waitFor(() => {
            expect(screen.getByText('Pizza Test')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Pizza Test')); // Expandir

        const deleteBtn = await screen.findByRole('button', { name: /Eliminar del historial/i });
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalled();
        });

        expect(historialService.deleteFromHistorial).not.toHaveBeenCalled();
        expect(screen.getByText('Pizza Test')).toBeInTheDocument();
    });

    it('debe abrir el modal de favoritos y permitir añadir a una lista', async () => {
        (historialService.getHistorial as ReturnType<typeof vi.fn>).mockResolvedValue(mockHistoryData);
        (favoritosService.getListas as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1, user_id: 'user1', nombre: 'Favoritos' }]);
        (favoritosService.addFavorito as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 10, lista_id: 1, place_id: 'place1' });

        renderHistoryPage();

        await waitFor(() => {
            expect(screen.getByText('Pizza Test')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Pizza Test')); // Expandir

        const addFavBtn = await screen.findByRole('button', { name: /Añadir a favoritos/i });
        fireEvent.click(addFavBtn);

        await waitFor(() => {
            expect(screen.getByText('Elige una lista:')).toBeInTheDocument();
        });

        const selectListBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('📋 Favoritos'));
        if (selectListBtn) fireEvent.click(selectListBtn);

        await waitFor(() => {
            expect(favoritosService.addFavorito).toHaveBeenCalledWith(1, 'place1');
            expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('¡Pizza Test añadido a tus favoritos! ⭐'));
        });
    });

    it('debe permitir crear una lista nueva desde el modal y añadir el restaurante', async () => {
        (historialService.getHistorial as ReturnType<typeof vi.fn>).mockResolvedValue(mockHistoryData);
        (favoritosService.getListas as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1, user_id: 'user1', nombre: 'Favoritos' }]);
        (favoritosService.crearLista as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 2, user_id: 'user1', nombre: 'Pizzas' });
        (favoritosService.addFavorito as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 11, lista_id: 2, place_id: 'place1' });

        renderHistoryPage();

        await waitFor(() => {
            expect(screen.getByText('Pizza Test')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Pizza Test')); // Expandir la card

        const addFavBtn = await screen.findByRole('button', { name: /Añadir a favoritos/i });
        fireEvent.click(addFavBtn);

        await waitFor(() => {
            expect(screen.getByText('Elige una lista:')).toBeInTheDocument();
        });

        const createNewListBtn = screen.getByRole('button', { name: /\+ Crear nueva lista/i });
        fireEvent.click(createNewListBtn);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Nombre de la lista')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByPlaceholderText('Nombre de la lista'), { target: { value: 'Pizzas' } });
        
        const createAndAddBtn = screen.getByRole('button', { name: /Crear y Añadir/i });
        fireEvent.click(createAndAddBtn);

        await waitFor(() => {
            expect(favoritosService.crearLista).toHaveBeenCalledWith('Pizzas');
            expect(favoritosService.addFavorito).toHaveBeenCalledWith(2, 'place1');
            expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('¡Lista "Pizzas" creada y Pizza Test añadido! ⭐'));
        });
    });
});
