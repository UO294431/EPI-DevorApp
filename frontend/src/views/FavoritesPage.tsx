import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { favoritosService } from '../models/api/favoritosService';
import type { FavoritosList, FavoritoItem } from '../models/api/favoritosService';
import { historialService } from '../models/api/historialService';

// --------------- Página ---------------
const FavoritesPage: React.FC = () => {
    const navigate = useNavigate();
    const [lists, setLists] = useState<FavoritosList[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Estado para el Modal
    const [selectedList, setSelectedList] = useState<FavoritosList | null>(null);
    const [favoritos, setFavoritos] = useState<FavoritoItem[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [expandedFavoriteId, setExpandedFavoriteId] = useState<number | null>(null);

    useEffect(() => {
        const fetchLists = async () => {
            try {
                setLoading(true);
                const data = await favoritosService.getListas();
                setLists(data);
            } catch (err: any) {
                setError(err.message || 'No se pudieron cargar tus listas de favoritos.');
            } finally {
                setLoading(false);
            }
        };
        fetchLists();
    }, []);

    const handleListClick = async (list: FavoritosList) => {
        setSelectedList(list);
        setModalLoading(true);
        try {
            const data = await favoritosService.getListaDetalle(list.id);
            setFavoritos(data.restaurantes);
        } catch (err: any) {
            console.error("Error fetching list details:", err);
            alert("No se pudieron cargar los restaurantes de esta lista.");
            setSelectedList(null);
        } finally {
            setModalLoading(false);
        }
    };

    const closeModal = () => {
        setSelectedList(null);
        setFavoritos([]);
        setExpandedFavoriteId(null);
    };

    let content;
    if (loading) {
        content = (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                <p>Cargando tus listas de favoritos...</p>
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
    } else if (lists.length === 0) {
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
                <span style={{ fontSize: '3rem' }}>⭐</span>
                <p style={{ fontSize: '1rem', margin: 0 }}>
                    Todavía no tienes ninguna lista de favoritos.
                </p>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    ¡Añade un restaurante a favoritos para empezar!
                </p>
            </div>
        );
    } else {
        content = (
            <div style={{ marginTop: '1rem', width: '100%', animation: 'fadeSlideIn 0.5s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Mis listas</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{lists.length} en total</span>
                </div>

                <div style={{
                    display: 'flex', flexDirection: 'column', gap: '1px',
                    background: 'var(--border)', borderRadius: 'var(--radius-md)',
                    overflow: 'hidden', border: '1px solid var(--border)'
                }}>
                    {lists.map((list) => (
                        <button
                            key={list.id}
                            onClick={() => handleListClick(list)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '1.25rem 1.5rem', background: 'var(--surface)',
                                border: 'none', borderBottom: '1px solid var(--border)',
                                cursor: 'pointer', width: '100%', textAlign: 'left',
                                color: 'var(--text)', transition: 'background 0.2s ease'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>📋</span>
                                <span style={{ fontWeight: 600, fontSize: '1rem' }}>{list.nombre}</span>
                            </div>
                            <span style={{ color: 'var(--muted)', fontSize: '1.2rem', opacity: 0.5 }}>›</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="app-container" style={{ alignItems: 'flex-start', paddingTop: '4rem' }}>
            <div className="auth-card" style={{ maxWidth: '600px', width: '100%' }}>
                <div className="auth-header">
                    <div className="auth-logo">⭐</div>
                    <h1>Mis Favoritos</h1>
                    <p>Tus listas de restaurantes favoritos</p>
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
                </div>

                {content}
            </div>

            {/* Modal de Detalle de Lista */}
            {selectedList && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem', backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.6)',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        background: 'var(--surface)', maxWidth: '700px', width: '100%',
                        maxHeight: '85vh', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.1)', animation: 'scaleUp 0.3s ease'
                    }}>
                        <div style={{
                            padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--surface2)'
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{selectedList.nombre}</h2>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                                    {modalLoading ? 'Cargando restaurantes...' : `${favoritos.length} restaurantes favoritos`}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <button
                                    onClick={async () => {
                                        if (!globalThis.confirm(`¿Estás seguro de que quieres eliminar la lista "${selectedList.nombre}" y todos sus restaurantes?`)) return;
                                        try {
                                            await favoritosService.deleteLista(selectedList.id);
                                            setLists((prev: FavoritosList[]) => prev.filter((l: FavoritosList) => l.id !== selectedList.id));
                                            closeModal();
                                        } catch (err: any) {
                                            alert("Error al eliminar la lista: " + err.message);
                                        }
                                    }}
                                    className="btn-secondary"
                                    style={{
                                        background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30',
                                        border: '1px solid rgba(255, 59, 48, 0.3)', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600
                                    }}
                                    title="Eliminar lista"
                                >
                                    🗑️ Eliminar lista
                                </button>
                                <button
                                    onClick={closeModal}
                                    style={{
                                        background: 'var(--surface3)', border: 'none', color: 'var(--text)',
                                        width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.2rem', transition: 'all 0.2s ease'
                                    }}
                                >✕</button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                            {modalLoading ? (
                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                    <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                                    <p>Obteniendo detalles...</p>
                                </div>
                            ) : favoritos.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🍽️</span>
                                    <p>Esta lista está vacía.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {favoritos.map((fav) => {
                                        const r = fav.restaurant;
                                        const isExpanded = expandedFavoriteId === fav.id;
                                        return (
                                            <div key={fav.id} style={{
                                                background: 'var(--surface2)', borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border)', overflow: 'hidden',
                                                transition: 'all 0.3s ease', transform: isExpanded ? 'scale(1.02)' : 'none',
                                                boxShadow: isExpanded ? '0 10px 20px rgba(0,0,0,0.2)' : 'none'
                                            }}>
                                                <div
                                                    className="restaurant-card"
                                                    onClick={() => setExpandedFavoriteId(isExpanded ? null : fav.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center',
                                                        padding: '1rem', background: 'transparent',
                                                        gap: '1rem', cursor: 'pointer', transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '60px', height: '60px', borderRadius: '8px',
                                                        overflow: 'hidden', background: 'var(--surface3)',
                                                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        {r.main_photo ? (
                                                            <img src={r.main_photo} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <span style={{ fontSize: '1.5rem' }}>🍴</span>
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{r.name}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                            {Array.from({ length: 5 }).map((_, i) => (
                                                                <span key={`star-${fav.id}-${i}`} style={{
                                                                    color: i < Math.floor(r.rating || 0) ? '#ffb400' : 'var(--muted)',
                                                                    fontSize: '0.85rem',
                                                                    opacity: i < Math.floor(r.rating || 0) ? 1 : 0.3
                                                                }}>
                                                                    ★
                                                                </span>
                                                            ))}
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '0.3rem' }}>
                                                                {r.rating} ({r.user_ratings_total})
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--accent2)', fontWeight: 500 }}>
                                                            {r.types && r.types.length > 0
                                                                ? r.types[0].replaceAll('_', ' ').replaceAll(/\b\w/g, (l: string) => l.toUpperCase())
                                                                : 'Restaurante'}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{r.address}</div>
                                                    </div>
                                                    <div style={{
                                                        color: 'var(--muted)', fontSize: '1.2rem', opacity: 0.5,
                                                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                                                        transition: 'transform 0.3s ease'
                                                    }}>›</div>
                                                </div>

                                                {isExpanded && (
                                                    <div style={{
                                                        padding: '1.2rem',
                                                        animation: 'fadeSlideIn 0.3s ease',
                                                        background: 'rgba(var(--accent-rgb), 0.03)',
                                                        borderTop: '1px solid var(--border)',
                                                        display: 'flex', flexDirection: 'column', gap: '1.2rem'
                                                    }}>
                                                        {r.summary && (
                                                            <div style={{
                                                                fontSize: '0.9rem', color: 'var(--text)',
                                                                lineHeight: '1.5', padding: '0.8rem',
                                                                borderLeft: '3px solid var(--accent)',
                                                                background: 'var(--surface2)',
                                                                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                                                            }}>
                                                                <span style={{ fontSize: '1.2rem', marginRight: '0.5rem', verticalAlign: 'middle' }}>💬</span>
                                                                {r.summary}
                                                            </div>
                                                        )}

                                                        <div style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                            gap: '1.2rem', marginBottom: '0.5rem'
                                                        }}>
                                                            {r.opening_hours && r.opening_hours.length > 0 && (
                                                                <div style={{
                                                                    background: 'var(--surface2)', padding: '1rem',
                                                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)'
                                                                }}>
                                                                    <div style={{ fontWeight: 700, marginBottom: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                                                        🕒 Horario de apertura
                                                                    </div>
                                                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                                        {r.opening_hours.slice(0, 7).map((day: string, idx: number) => {
                                                                            const parts = day.split(': ');
                                                                            const dayName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() : '';
                                                                            const hoursRaw = parts[1] || '';
                                                                            const shifts = hoursRaw.split(', ');
                                                                            return (
                                                                                <li key={`${fav.id}-day-${idx}`} style={{
                                                                                    fontSize: '0.75rem', opacity: 0.8, padding: '0.3rem 0',
                                                                                    borderBottom: idx < r.opening_hours!.length - 1 ? '1px solid var(--border)' : 'none',
                                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'
                                                                                }}>
                                                                                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{dayName} :</span>
                                                                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                        {shifts.map((s: string, sIdx: number) => (
                                                                                            <span key={`${fav.id}-day-${idx}-shift-${sIdx}`}>{s}</span>
                                                                                        ))}
                                                                                    </div>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                                                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.85rem' }}>📍 Enlaces de interés</div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                    {r.google_maps_uri && (
                                                                        <a href={r.google_maps_uri} target="_blank" rel="noopener noreferrer"
                                                                            className="btn-secondary"
                                                                            style={{
                                                                                fontSize: '0.8rem', display: 'flex', alignItems: 'center',
                                                                                gap: '0.5rem', padding: '0.5rem 0.6rem',
                                                                                background: 'var(--surface2)', color: 'var(--accent)',
                                                                                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                                                                textDecoration: 'none', transition: 'all 0.2s ease'
                                                                            }}>
                                                                            <span>🗺️</span> Google Maps
                                                                        </a>
                                                                    )}
                                                                    {r.website_uri && (
                                                                        <a href={r.website_uri} target="_blank" rel="noopener noreferrer"
                                                                            className="btn-secondary"
                                                                            style={{
                                                                                fontSize: '0.8rem', display: 'flex', alignItems: 'center',
                                                                                gap: '0.5rem', padding: '0.5rem 0.6rem',
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

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        await historialService.addToHistorial(fav.place_id);
                                                                        alert(`¡Has vuelto a elegir ${r.name}!\n\n¡Qué disfrutes repitiendo una deliciosa comida! 🍽️`);
                                                                        navigate('/home');
                                                                    } catch (err: any) {
                                                                        console.error("Error saving to history:", err);
                                                                        alert("Error al seleccionar: " + err.message);
                                                                    }
                                                                }}
                                                                className="btn-primary"
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '0.8rem',
                                                                    boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)',
                                                                    fontWeight: 700,
                                                                    letterSpacing: '1px',
                                                                    textTransform: 'uppercase',
                                                                    fontSize: '0.8rem'
                                                                }}
                                                            >VOLVER A SELECCIONAR</button>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (!globalThis.confirm(`¿Quitar ${r.name} de favoritos?`)) return;
                                                                    try {
                                                                        await favoritosService.deleteFavorito(fav.id);
                                                                        setFavoritos(prev => prev.filter(item => item.id !== fav.id));
                                                                    } catch (err: any) {
                                                                        alert("Error: " + err.message);
                                                                    }
                                                                }}
                                                                className="btn-secondary"
                                                                style={{
                                                                    width: '100%', padding: '0.8rem', background: 'rgba(255, 59, 48, 0.1)',
                                                                    color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)',
                                                                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
                                                                }}
                                                            >🗑️ Eliminar de favoritos</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FavoritesPage;
