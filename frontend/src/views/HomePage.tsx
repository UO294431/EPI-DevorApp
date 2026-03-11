import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogout } from '../controllers/hooks/useLogout';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { submitLogout, loading, error } = useLogout(() => navigate('/login'));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', gap: '1rem' }}>
            <h1>Bienvenido</h1>
            <button onClick={submitLogout} disabled={loading} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                {loading ? 'Cerrando sesión...' : 'Cerrar Sesión'}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
};

export default HomePage;
