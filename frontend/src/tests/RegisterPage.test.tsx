import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RegisterPage from '../views/RegisterPage';

// ── Mock authService ──────────────────────────────────────────────────────────
vi.mock('../models/api/authService', () => ({
    authService: {
        register: vi.fn(),
        checkEmailVerification: vi.fn(),
    },
}));

import { authService } from '../models/api/authService';

// Helper para rellenar todos los campos obligatorios
const fillValidForm = () => {
    fireEvent.change(screen.getByLabelText('Email'), {
        target: { name: 'email', value: 'nuevo@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), {
        target: { name: 'username', value: 'nuevousuario' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { name: 'password', value: 'Segura123' },
    });
    fireEvent.change(screen.getByLabelText('Nombre'), {
        target: { name: 'nombre', value: 'Nuevo' },
    });
    fireEvent.change(screen.getByLabelText('Apellidos'), {
        target: { name: 'apellidos', value: 'Usuario' },
    });
};

const renderRegisterPage = () =>
    render(
        <MemoryRouter initialEntries={['/register']}>
            <RegisterPage />
        </MemoryRouter>
    );

describe('RegisterPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── 1. Renderizado básico ────────────────────────────────────────────────
    it('debe renderizar todos los campos del formulario de registro', () => {
        renderRegisterPage();

        expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument();
        expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
        expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
        expect(screen.getByLabelText('Apellidos')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Inicia sesión' })).toBeInTheDocument();
    });

    // ── 2. Validación: campos vacíos ─────────────────────────────────────────
    it('debe mostrar error si se envía el formulario con campos obligatorios vacíos', async () => {
        renderRegisterPage();

        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(
                screen.getByText('Rellene todos los campos obligatorios')
            ).toBeInTheDocument();
        });

        expect(authService.register).not.toHaveBeenCalled();
    });

    // ── 3. Validación: falta un campo obligatorio ────────────────────────────
    it('debe mostrar error si falta un campo obligatorio (apellidos vacío)', async () => {
        renderRegisterPage();

        fireEvent.change(screen.getByLabelText('Email'), {
            target: { name: 'email', value: 'nuevo@test.com' },
        });
        fireEvent.change(screen.getByLabelText('Nombre de usuario'), {
            target: { name: 'username', value: 'nuevousuario' },
        });
        fireEvent.change(screen.getByLabelText(/Contraseña/i), {
            target: { name: 'password', value: 'Segura123' },
        });
        fireEvent.change(screen.getByLabelText('Nombre'), {
            target: { name: 'nombre', value: 'Nuevo' },
        });
        // Apellidos queda vacío
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(
                screen.getByText('Rellene todos los campos obligatorios')
            ).toBeInTheDocument();
        });
    });

    // ── 4. Registro exitoso → pantalla de verificación ──────────────────────
    it('debe llamar a authService.register y mostrar la pantalla de verificación de email', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockResolvedValue({});
        // Que el polling no resuelva durante el test
        (authService.checkEmailVerification as ReturnType<typeof vi.fn>).mockResolvedValue(false);

        renderRegisterPage();
        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(authService.register).toHaveBeenCalledWith({
                email: 'nuevo@test.com',
                password: 'Segura123',
                username: 'nuevousuario',
                nombre: 'Nuevo',
                apellidos: 'Usuario',
                ubicacion: null,
            });
        });

        await waitFor(() => {
            expect(screen.getByText('Verifica tu correo')).toBeInTheDocument();
        });

        // Muestra el email del usuario en la pantalla de espera
        expect(screen.getByText(/nuevo@test\.com/)).toBeInTheDocument();
    });

    // ── 5. Registro fallido (email ya en uso) ────────────────────────────────
    it('debe mostrar el error del servicio cuando el registro falla', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('El email ya está en uso')
        );

        renderRegisterPage();
        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(screen.getByText('El email ya está en uso')).toBeInTheDocument();
        });
    });

    // ── 6. El botón se deshabilita mientras carga ────────────────────────────
    it('debe deshabilitar el botón mientras se procesa el registro', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

        renderRegisterPage();
        fillValidForm();

        const btn = screen.getByRole('button', { name: 'Crear cuenta' });
        fireEvent.click(btn);

        await waitFor(() => {
            expect(btn).toBeDisabled();
        });
    });

    // ── 7. El campo ubicación es opcional ────────────────────────────────────
    it('debe permitir el registro sin ubicación (campo opcional)', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (authService.checkEmailVerification as ReturnType<typeof vi.fn>).mockResolvedValue(false);

        renderRegisterPage();
        fillValidForm();
        // Ubicación se deja vacía intencionalmente

        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(authService.register).toHaveBeenCalledWith(
                expect.objectContaining({ ubicacion: null })
            );
        });
    });
});
