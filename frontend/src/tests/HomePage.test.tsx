import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HomePage from '../views/HomePage';

// ── Mock authService ──────────────────────────────────────────────────────────
vi.mock('../models/api/authService', () => ({
    authService: {
        logout: vi.fn(),
    },
}));

import { authService } from '../models/api/authService';

// Mock de useNavigate para poder verificar redirecciones
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const renderHomePage = () =>
    render(
        <MemoryRouter initialEntries={['/home']}>
            <HomePage />
        </MemoryRouter>
    );

describe('HomePage (Cerrar Sesión)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── 1. Renderizado básico ────────────────────────────────────────────────
    it('debe renderizar el mensaje de bienvenida y el botón de cerrar sesión', () => {
        renderHomePage();

        expect(screen.getByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cerrar Sesión' })).toBeInTheDocument();
    });

    // ── 2. Llamada a authService.logout ──────────────────────────────────────
    it('debe llamar a authService.logout al hacer clic en "Cerrar Sesión"', async () => {
        (authService.logout as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        renderHomePage();

        fireEvent.click(screen.getByRole('button', { name: 'Cerrar Sesión' }));

        await waitFor(() => {
            expect(authService.logout).toHaveBeenCalledTimes(1);
        });
    });

    // ── 3. Redirección tras cierre de sesión exitoso ──────────────────────────
    it('debe redirigir a /login tras un logout exitoso', async () => {
        (authService.logout as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        renderHomePage();

        fireEvent.click(screen.getByRole('button', { name: 'Cerrar Sesión' }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/login');
        });
    });

    // ── 4. Error en el logout ────────────────────────────────────────────────
    it('debe mostrar mensaje de error si el logout falla', async () => {
        (authService.logout as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Error al cerrar sesión')
        );

        renderHomePage();

        fireEvent.click(screen.getByRole('button', { name: 'Cerrar Sesión' }));

        await waitFor(() => {
            expect(screen.getByText('Error al cerrar sesión')).toBeInTheDocument();
        });

        // No debe redirigir si hay error
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    // ── 5. El botón se deshabilita mientras carga ────────────────────────────
    it('debe deshabilitar el botón y cambiar su texto mientras se procesa el logout', async () => {
        (authService.logout as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

        renderHomePage();

        const btn = screen.getByRole('button', { name: 'Cerrar Sesión' });
        fireEvent.click(btn);

        await waitFor(() => {
            expect(btn).toBeDisabled();
            expect(btn).toHaveTextContent('Cerrando sesión...');
        });
    });
});
