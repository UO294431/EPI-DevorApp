import React from 'react';
import Autocomplete from "react-google-autocomplete";
import { useNavigate, Link } from 'react-router-dom';
import { useRegister } from '../controllers/hooks/useRegister';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();

    const handleSwitchToLogin = () => {
        navigate('/login');
    };

    const {
        form, handleInputChange, setFieldValue,
        message, loading, isWaitingVerification, submitRegister
    } = useRegister(handleSwitchToLogin);

    if (isWaitingVerification) {
        return (
            <div className="auth-card">
                <div className="auth-header" style={{ marginBottom: '1rem' }}>
                    <div className="auth-logo">✉️</div>
                    <h1>Verifica tu correo</h1>
                </div>

                <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
                    Hemos enviado un enlace de confirmación a <strong>{form.email}</strong>.
                    <br /><br />
                    Por favor, revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace para continuar.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div className="loading-spinner" style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid #f3f3f3',
                        borderTop: '3px solid var(--primary-color)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <p style={{ fontSize: '0.9rem', color: '#888' }}>Esperando confirmación...</p>
                </div>

                {message && (
                    <div className={`message ${message.type}`} style={{ marginTop: '2rem' }}>{message.text}</div>
                )}
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="auth-card">
            <div className="auth-header">
                <div className="auth-logo">🍴</div>
                <h1>Crear cuenta</h1>
            </div>

            <form onSubmit={submitRegister} className="auth-form" noValidate>
                <div className="form-group">
                    <label htmlFor="reg-email">Email</label>
                    <input
                        id="reg-email" name="email" type="email"
                        placeholder="tu@email.com"
                        value={form.email} onChange={handleInputChange}
                        required disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="reg-username">Nombre de usuario</label>
                    <input
                        id="reg-username" name="username" type="text"
                        value={form.username} onChange={handleInputChange}
                        required disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="reg-password">Contraseña</label>
                    <input
                        id="reg-password" name="password" type="password"
                        placeholder="Mínimo 8 caracteres, letras y números"
                        value={form.password} onChange={handleInputChange}
                        required disabled={loading}
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="reg-nombre">Nombre</label>
                        <input
                            id="reg-nombre" name="nombre" type="text"
                            value={form.nombre} onChange={handleInputChange}
                            required disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reg-apellidos">Apellidos</label>
                        <input
                            id="reg-apellidos" name="apellidos" type="text"
                            value={form.apellidos} onChange={handleInputChange}
                            required disabled={loading}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="reg-ubicacion">Ubicación preferida</label>
                    <Autocomplete
                        id="reg-ubicacion"
                        apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                        onChange={() => {
                            // Si el usuario escribe algo, invalidamos la selección anterior
                            setFieldValue('ubicacion', '');
                        }}
                        onPlaceSelected={(place) => {
                            if (place?.formatted_address) {
                                setFieldValue("ubicacion", place.formatted_address);
                            }
                        }}
                        options={{
                            types: [],
                        }}
                        className="form-control"
                        placeholder="Busca tu ubicación"
                        disabled={loading}
                        defaultValue={form.ubicacion}
                    />
                </div>

                <button type="submit" className={`btn-primary${loading ? ' loading' : ''}`} disabled={loading}>
                    {loading ? '' : 'Crear cuenta'}
                </button>
            </form>

            {message && (
                <div className={`message ${message.type}`}>{message.text}</div>
            )}

            <div className="auth-footer">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login">Inicia sesión</Link>
            </div>
        </div>
    );
};

export default RegisterPage;
