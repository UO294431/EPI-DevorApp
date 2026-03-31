import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { savedForLaterService } from '../models/api/savedForLaterService';
import type { SavedForLaterEntry } from '../models/api/savedForLaterService';
import { historialService } from '../models/api/historialService';

const SavedForLaterPage: React.FC = () => {
    const navigate = useNavigate();
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
    const [savedEntries, setSavedEntries] = useState<SavedForLaterEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSaved = async () => {
            try {
                setLoading(true);
                const data = await savedForLaterService.getSaved();
                setSavedEntries(data);
            } catch (err: any) {
                console.error("Error fetching saved later:", err);
                setError(err.message || "No se pudieron cargar los restaurantes guardados.");
            } finally {
                setLoading(false);
            }
        };

        fetchSaved();
    }, []);

    const handleRemoveFromSavedForLater = async (id: string, name: string, showNotification: boolean = true) => {
        try {
            await savedForLaterService.deleteSaved(id);
            setSavedEntries(prev => prev.filter(item => item.id !== id));
            if (showNotification) {
                alert(`"${name}" ha sido eliminado de tu lista para más tarde.`);
            }
        } catch (err: any) {
            console.error("Error deleting from saved later:", err);
            alert("Error al eliminar de la lista: " + err.message);
        }
    };

    let content;
    if (loading) {
        content = (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                <p>Cargando tus lugares pendientes...</p>
            </div>
        );
    } else if (error) {
        content = (
            <div className="message error" style={{ margin: '1rem 0' }}>
                {error}
                <button 
                  onClick={() => globalThis.location.reload()} 
                  style={{ marginLeft: '1rem', background: 'none', border: '1px solid currentColor', color: 'inherit', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Reintentar
                </button>
            </div>
        );
    } else if (savedEntries.length === 0) {
        content = (
            <div style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
            }}>
                <span style={{ fontSize: '3rem' }}>⏰</span>
                <p style={{ fontSize: '1rem', margin: 0 }}>
                    No tienes restaurantes guardados para más tarde.
                </p>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    Añade uno desde la búsqueda de recomendaciones.
                </p>
            </div>
        );
    } else {
        content = (
            <div style={{ marginTop: '1rem', width: '100%', animation: 'fadeSlideIn 0.5s ease', paddingBottom: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Lugares pendientes</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{savedEntries.length} en total</span>
                </div>

                <div style={{
                    display: 'flex', flexDirection: 'column', gap: '1px',
                    background: 'var(--border)', borderRadius: 'var(--radius-md)',
                    overflow: 'hidden', border: '1px solid var(--border)'
                }}>
                    {savedEntries.map((entry) => (
                        <div key={entry.id} className="restaurant-card-container" style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                            <div
                                className="restaurant-card"
                                onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                                style={{
                                    display: 'flex', alignItems: 'center',
                                    padding: '1.5rem', background: 'transparent',
                                    gap: '1.5rem', transition: 'all 0.2s ease', cursor: 'pointer'
                                }}
                            >
                                <div style={{
                                    width: '80px', height: '80px', borderRadius: '12px',
                                    overflow: 'hidden', background: 'var(--surface2)',
                                    flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {entry.main_photo ? (
                                        <img src={entry.main_photo} alt={entry.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: '2rem' }}>🍴</span>
                                    )}
                                </div>

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>{entry.name}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <span key={`star-${entry.id}-${i}`} style={{
                                                color: i < Math.floor(entry.rating || 0) ? '#ffb400' : 'var(--muted)',
                                                fontSize: '0.9rem',
                                                opacity: i < Math.floor(entry.rating || 0) ? 1 : 0.3
                                            }}>
                                                ★
                                            </span>
                                        ))}
                                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '0.4rem' }}>
                                            {entry.rating} ({entry.user_ratings_total})
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--accent2)', fontWeight: 500 }}>
                                        {entry.types && entry.types.length > 0
                                            ? entry.types[0].replaceAll('_', ' ').replaceAll(/\b\w/g, (l: string) => l.toUpperCase())
                                            : 'Restaurante'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{entry.address}</div>

                                </div>
                                <div style={{
                                    color: 'var(--muted)', fontSize: '1.2rem', opacity: 0.5,
                                    transform: expandedEntryId === entry.id ? 'rotate(90deg)' : 'none',
                                    transition: 'transform 0.3s ease'
                                }}>›</div>
                            </div>

                            {expandedEntryId === entry.id && (
                                <div style={{
                                    padding: '1.5rem',
                                    animation: 'fadeSlideIn 0.3s ease',
                                    background: 'rgba(var(--accent-rgb), 0.03)',
                                    borderTop: '1px solid var(--border)',
                                    display: 'flex', flexDirection: 'column', gap: '1.5rem'
                                }}>
                                    {entry.summary && (
                                        <div style={{
                                            fontSize: '0.95rem', color: 'var(--text)',
                                            lineHeight: '1.6', padding: '1rem',
                                            borderLeft: '3px solid var(--accent)',
                                            background: 'var(--surface2)',
                                            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                                        }}>
                                            <span style={{ fontSize: '1.2rem', marginRight: '0.5rem', verticalAlign: 'middle' }}>💬</span>
                                            {entry.summary}
                                        </div>
                                    )}

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '1.5rem', marginBottom: '1rem'
                                    }}>
                                        {entry.opening_hours && entry.opening_hours.length > 0 && (
                                            <div style={{
                                                background: 'var(--surface2)', padding: '1rem',
                                                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)'
                                            }}>
                                                <div style={{ fontWeight: 700, marginBottom: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                                    🕒 Horario de apertura
                                                </div>
                                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                    {entry.opening_hours.slice(0, 7).map((day: string, idx: number) => {
                                                        const parts = day.split(': ');
                                                        const dayName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() : '';
                                                        const hoursRaw = parts[1] || '';
                                                        const shifts = hoursRaw.split(', ');
                                                        return (
                                                            <li key={`${entry.id}-day-${idx}`} style={{
                                                                fontSize: '0.8rem', opacity: 0.8, padding: '0.4rem 0',
                                                                borderBottom: idx < entry.opening_hours!.length - 1 ? '1px solid var(--border)' : 'none',
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'
                                                            }}>
                                                                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{dayName} :</span>
                                                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    {shifts.map((s, sIdx) => (
                                                                        <span key={`${entry.id}-day-${idx}-shift-${sIdx}`}>{s}</span>
                                                                    ))}
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>📍 Enlaces de interés</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                {entry.google_maps_uri && (
                                                    <a href={entry.google_maps_uri} target="_blank" rel="noopener noreferrer"
                                                        className="btn-secondary"
                                                        style={{
                                                            fontSize: '0.85rem', display: 'flex', alignItems: 'center',
                                                            gap: '0.6rem', padding: '0.6rem 0.8rem',
                                                            background: 'var(--surface2)', color: 'var(--accent)',
                                                            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                                            textDecoration: 'none', transition: 'all 0.2s ease'
                                                        }}>
                                                        <span>🗺️</span> Google Maps
                                                    </a>
                                                )}
                                                {entry.website_uri && (
                                                    <a href={entry.website_uri} target="_blank" rel="noopener noreferrer"
                                                        className="btn-secondary"
                                                        style={{
                                                            fontSize: '0.85rem', display: 'flex', alignItems: 'center',
                                                            gap: '0.6rem', padding: '0.6rem 0.8rem',
                                                            background: 'var(--surface2)', color: 'var(--accent)',
                                                            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                                            textDecoration: 'none', transition: 'all 0.2s ease'
                                                        }}>
                                                        <span>🌐</span> Sitio Web
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    await historialService.addToHistorial(entry.place_id);
                                                    alert(`¡Hora de comer en ${entry.name}!\n\n¡Que lo disfrutes! 🍽️`);
                                                    await handleRemoveFromSavedForLater(entry.id, entry.name, false);
                                                    navigate('/home');
                                                } catch (err: any) {
                                                    console.error("Error saving to history:", err);
                                                    alert("Error al seleccionar: " + err.message);
                                                }
                                            }}
                                            className="btn-primary"
                                            style={{
                                                width: '100%',
                                                padding: '1rem',
                                                boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)',
                                                fontWeight: 700,
                                                letterSpacing: '1px',
                                                textTransform: 'uppercase'
                                            }}
                                        >
                                            ¡ELEGIR ESTE LUGAR!
                                        </button>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFromSavedForLater(entry.id, entry.name);
                                            }}
                                            className="btn-secondary"
                                            style={{
                                                width: '100%',
                                                padding: '0.8rem',
                                                background: 'rgba(255, 59, 48, 0.1)',
                                                color: '#ff3b30',
                                                border: '1px solid rgba(255, 59, 48, 0.3)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontWeight: 600
                                            }}
                                        >
                                            🗑️ Eliminar de la lista
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="app-container" style={{ alignItems: 'flex-start', paddingTop: '4rem' }}>
            <div className="auth-card" style={{ maxWidth: '600px', width: '100%' }}>
                <div className="auth-header">
                    <div className="auth-logo">⏰</div>
                    <h1>Para más tarde</h1>
                    <p>Restaurantes que has guardado para otra ocasión</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/home')}
                        className="btn-primary"
                        style={{ flex: 1, background: 'var(--surface2)', color: 'var(--text)', boxShadow: 'none' }}
                    >
                        Volver
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/recommend-restaurants')}
                        className="btn-primary"
                        style={{ flex: 1, background: 'var(--accent)', color: 'white' }}
                    >
                        Buscar lugares
                    </button>
                </div>

                {content}

                <style>{`
                    .restaurant-card:hover { background: rgba(0,0,0,0.03) !important; }
                    [data-theme='dark'] .restaurant-card:hover { background: rgba(255,255,255,0.03) !important; }
                `}</style>
            </div>

        </div>
    );
};

export default SavedForLaterPage;
