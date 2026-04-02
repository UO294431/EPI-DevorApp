import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ValoracionesPage from '../views/ValoracionesPage';

// ── Mock valoracionesService ──────────────────────────────────────────────────
vi.mock('../models/api/valoracionesService', () => ({
    valoracionesService: {
        obtenerTodasMisValoraciones: vi.fn(),
        valorarRestaurante: vi.fn(),
        eliminarValoracion: vi.fn(),
    },
}));

import { valoracionesService } from '../models/api/valoracionesService';

// ── Mock useNavigate ──────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return { ...actual, useNavigate: () => mockNavigate };
});

// ── Polyfills ─────────────────────────────────────────────────────────────────
const mockConfirm = vi.fn();
globalThis.confirm = mockConfirm;
const mockAlert = vi.fn();
globalThis.alert = mockAlert;

// ── Datos de prueba ───────────────────────────────────────────────────────────
const mockValoracionesData = [
    {
        id: 1,
        place_id: 'place1',
        calidad: 5,
        precio: 4,
        higiene: 3,
        trato: 5,
        comentario: 'Muy buena experiencia',
        restaurant: {
            name: 'Restaurante Test',
            address: 'Calle Falsa 123',
            types: ['restaurant'],
            main_photo: null,
        },
    },
];

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/mis-valoraciones']}>
            <ValoracionesPage />
        </MemoryRouter>
    );

describe('ValoracionesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe mostrar cargando inicialmente y luego la lista de valoraciones', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as ReturnType<typeof vi.fn>).mockResolvedValue(mockValoracionesData);

        renderPage();

        expect(screen.getByText('Cargando tus valoraciones...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Restaurante Test')).toBeInTheDocument();
        });
        expect(screen.getByText('Calle Falsa 123')).toBeInTheDocument();
    });

    it('debe mostrar mensaje cuando no hay valoraciones', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Aún no has valorado ningún restaurante.')).toBeInTheDocument();
        });
    });

    it('debe expandir la tarjeta al hacer clic y mostrar estrellas y comentario', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as ReturnType<typeof vi.fn>).mockResolvedValue(mockValoracionesData);

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Restaurante Test')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Restaurante Test'));

        await waitFor(() => {
            expect(screen.getByText('Calidad')).toBeInTheDocument();
            expect(screen.getByText('Precio')).toBeInTheDocument();
            expect(screen.getByText('Higiene')).toBeInTheDocument();
            expect(screen.getByText('Trato')).toBeInTheDocument();
            expect(screen.getByText('"Muy buena experiencia"')).toBeInTheDocument();
        });
    });

    it('debe mostrar los botones de editar y eliminar al expandir la tarjeta', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as ReturnType<typeof vi.fn>).mockResolvedValue(mockValoracionesData);

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Restaurante Test')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Restaurante Test'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Cambiar reseña/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Eliminar reseña/i })).toBeInTheDocument();
        });
    });

    it('debe abrir el modal de edición con datos precargados al pulsar "Cambiar reseña"', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as ReturnType<typeof vi.fn>).mockResolvedValue(mockValoracionesData);

        renderPage();

        await waitFor(() => screen.getByText('Restaurante Test'));
        fireEvent.click(screen.getByText('Restaurante Test'));

        const editBtn = await screen.findByRole('button', { name: /Cambiar reseña/i });
        fireEvent.click(editBtn);

        await waitFor(() => {
            expect(screen.getByText(/Valorar Restaurante Test/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText('¿Qué te ha parecido?')).toHaveValue('Muy buena experiencia');
        });
    });

    it('debe guardar la reseña y actualizar la vista de forma optimista', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as ReturnType<typeof vi.fn>).mockResolvedValue(mockValoracionesData);
        (valoracionesService.valorarRestaurante as ReturnType<typeof vi.fn>).mockResolvedValue({});

        renderPage();

        await waitFor(() => screen.getByText('Restaurante Test'));
        fireEvent.click(screen.getByText('Restaurante Test'));

        const editBtn = await screen.findByRole('button', { name: /Cambiar reseña/i });
        fireEvent.click(editBtn);

        await waitFor(() => screen.getByText(/Valorar Restaurante Test/i));

        const submitBtn = screen.getByRole('button', { name: /Guardar cambios/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(valoracionesService.valorarRestaurante).toHaveBeenCalledWith(
                expect.objectContaining({ place_id: 'place1' })
            );
        });
    });

    it('debe eliminar la reseña y quitarla de la lista tras confirmar', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as ReturnType<typeof vi.fn>).mockResolvedValue(mockValoracionesData);
        (valoracionesService.eliminarValoracion as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        mockConfirm.mockReturnValue(true);

        renderPage();

        await waitFor(() => screen.getByText('Restaurante Test'));
        fireEvent.click(screen.getByText('Restaurante Test'));

        const deleteBtn = await screen.findByRole('button', { name: /Eliminar reseña/i });
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalled();
            expect(valoracionesService.eliminarValoracion).toHaveBeenCalledWith('place1');
        });

        await waitFor(() => {
            expect(screen.queryByText('Restaurante Test')).not.toBeInTheDocument();
        });
    });

    it('no debe eliminar si el usuario cancela la confirmación', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as ReturnType<typeof vi.fn>).mockResolvedValue(mockValoracionesData);
        mockConfirm.mockReturnValue(false);

        renderPage();

        await waitFor(() => screen.getByText('Restaurante Test'));
        fireEvent.click(screen.getByText('Restaurante Test'));

        const deleteBtn = await screen.findByRole('button', { name: /Eliminar reseña/i });
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalled();
        });

        expect(valoracionesService.eliminarValoracion).not.toHaveBeenCalled();
        expect(screen.getByText('Restaurante Test')).toBeInTheDocument();
    });

    it('debe navegar a /home al pulsar Volver', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        renderPage();

        await waitFor(() => screen.getByRole('button', { name: /Volver/i }));

        fireEvent.click(screen.getByRole('button', { name: /Volver/i }));

        expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
});
