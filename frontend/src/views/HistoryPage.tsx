import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { historialService } from '../models/api/historialService';
import { favoritosService } from '../models/api/favoritosService';
import type { FavoritosList } from '../models/api/favoritosService';

interface HistoryEntry {
    id: string;
    name: string;
    rating: number;
    user_ratings_total: number;
    types: string[];
    address: string;
    main_photo?: string;
    summary?: string;
    opening_hours?: string[];
    google_maps_uri?: string;
    website_uri?: string;
    visited_at?: string;
    place_id: string;
}

const HistoryPage: React.FC = () => {
    const navigate = useNavigate();
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Estados para Añadir a Favoritos
    const [isFavModalOpen, setIsFavModalOpen] = useState(false);
    const [favLists, setFavLists] = useState<FavoritosList[]>([]);
    const [selectedEntryForFav, setSelectedEntryForFav] = useState<HistoryEntry | null>(null);
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [newListName, setNewListName] = useState('Mis Favoritos');
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                const data = await historialService.getHistorial();
                
                // Mapear la respuesta del backend (que tiene { id, restaurant: {...} }) 
                // al formato que espera la vista
                const mappedEntries: HistoryEntry[] = data.map((item: any) => ({
                    id: String(item.id),
                    name: item.restaurant.name,
                    rating: item.restaurant.rating,
                    user_ratings_total: item.restaurant.user_ratings_total,
                    types: item.restaurant.types,
                    address: item.restaurant.address,
                    main_photo: item.restaurant.main_photo,
                    summary: item.restaurant.summary,
                    opening_hours: item.restaurant.opening_hours,
                    google_maps_uri: item.restaurant.google_maps_uri,
                    website_uri: item.restaurant.website_uri,
                    visited_at: item.fecha_acceso,
                    place_id: item.place_id,
                }));

                setHistoryEntries(mappedEntries);
            } catch (err: any) {
                console.error("Error fetching history:", err);
                setError(err.message || "No se pudo cargar el historial.");
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const handleAddToFavoritesClick = async (entry: HistoryEntry) => {
        setSelectedEntryForFav(entry);
        setIsFavModalOpen(true);
        setModalLoading(true);
        try {
            const lists = await favoritosService.getListas();
            setFavLists(lists);
            if (lists.length === 0) {
                setIsCreatingList(true);
            }
        } catch (err) {
            console.error("Error fetching favorite lists:", err);
        } finally {
            setModalLoading(false);
        }
    };

    const confirmAddToFavorite = async (listId: number) => {
        if (!selectedEntryForFav) return;
        try {
            setModalLoading(true);
            await favoritosService.addFavorito(listId, selectedEntryForFav.place_id);
            alert(`¡${selectedEntryForFav.name} añadido a tus favoritos! ⭐`);
            setIsFavModalOpen(false);
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setModalLoading(false);
        }
    };

    const handleCreateAndAddToList = async () => {
        if (!selectedEntryForFav || !newListName.trim()) return;
        try {
            setModalLoading(true);
            const newList = await favoritosService.crearLista(newListName.trim());
            await favoritosService.addFavorito(newList.id, selectedEntryForFav.place_id);
            alert(`¡Lista "${newListName}" creada y ${selectedEntryForFav.name} añadido! ⭐`);
            setIsFavModalOpen(false);
            setIsCreatingList(false);
            setNewListName('Mis Favoritos');
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setModalLoading(false);
        }
    };

    let content;
    if (loading) {
        content = (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                <p>Cargando tu historial...</p>
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
    } else if (historyEntries.length === 0) {
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
                <span style={{ fontSize: '3rem' }}>🍽️</span>
                <p style={{ fontSize: '1rem', margin: 0 }}>
                    No tienes restaurantes en tu historial todavía.
                </p>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    ¡Empieza buscando recomendaciones!
                </p>
            </div>
        );
    } else {
        content = (
            <div style={{ marginTop: '1rem', width: '100%', animation: 'fadeSlideIn 0.5s ease', paddingBottom: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Tus restaurantes</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{historyEntries.length} en total</span>
                </div>

                <div style={{
                    display: 'flex', flexDirection: 'column', gap: '1px',
                    background: 'var(--border)', borderRadius: 'var(--radius-md)',
                    overflow: 'hidden', border: '1px solid var(--border)'
                }}>
                    {historyEntries.map((entry) => (
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
                                    {entry.visited_at && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                                            Visitado el {new Date(entry.visited_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </div>
                                    )}
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
                                                    alert(`¡Has vuelto a elegir ${entry.name}!\n\n¡Que disfrutes repitiendo una deliciosa comida! 🍽️`);
                                                    navigate('/home');
                                                } catch (err: any) {
                                                    console.error("Error saving to history:", err);
                                                    alert("Error al guardar en el historial: " + err.message);
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
                                            VOLVER A SELECCIONAR
                                        </button>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAddToFavoritesClick(entry);
                                                }}
                                                className="btn-secondary"
                                                style={{
                                                    flex: 1,
                                                    padding: '0.8rem',
                                                    borderRadius: 'var(--radius-sm)'
                                                }}
                                            >
                                                ⭐ Añadir a favoritos
                                            </button>
                                            <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="btn-secondary"
                                                style={{
                                                    flex: 1,
                                                    padding: '0.8rem',
                                                    borderRadius: 'var(--radius-sm)'
                                                }}
                                            >
                                                📝 Valorar restaurante
                                            </button>
                                        </div>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!globalThis.confirm(`¿Estás seguro de que quieres eliminar ${entry.name} de tu historial?`)) return;
                                                try {
                                                    await historialService.deleteFromHistorial(entry.id);
                                                    setHistoryEntries(prev => prev.filter(item => item.id !== entry.id));
                                                } catch (err: any) {
                                                    console.error("Error deleting from history:", err);
                                                    alert("Error al eliminar del historial: " + err.message);
                                                }
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
                                            🗑️ Eliminar del historial
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
                    <div className="auth-logo">🕓</div>
                    <h1>Mi Historial</h1>
                    <p>Restaurantes que has visitado o seleccionado</p>
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
                        Buscar más
                    </button>
                </div>

                {content}

                <style>{`
                    .restaurant-card:hover { background: rgba(0,0,0,0.03) !important; }
                    [data-theme='dark'] .restaurant-card:hover { background: rgba(255,255,255,0.03) !important; }
                `}</style>
            </div>

            {/* Modal para añadir a favoritos */}
            {isFavModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem', backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.4)',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <div style={{
                        background: 'var(--surface)', maxWidth: '400px', width: '100%',
                        borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        border: '1px solid var(--border)', overflow: 'hidden', animation: 'scaleUp 0.2s ease'
                    }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Añadir a favoritos</h3>
                            <button onClick={() => setIsFavModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            {modalLoading ? (
                                <div style={{ textAlign: 'center', padding: '1rem' }}>
                                    <div className="loading-spinner" style={{ border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%', width: '20px', height: '20px', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                                </div>
                            ) : isCreatingList ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>Crea una nueva lista:</p>
                                    <input 
                                        type="text" 
                                        value={newListName} 
                                        onChange={(e) => setNewListName(e.target.value)}
                                        placeholder="Nombre de la lista"
                                        style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => setIsCreatingList(false)} className="btn-secondary" style={{ flex: 1, fontSize: '0.8rem' }}>Atrás</button>
                                        <button onClick={handleCreateAndAddToList} className="btn-primary" style={{ flex: 2, fontSize: '0.8rem' }}>Crear y Añadir</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Elige una lista:</p>
                                    {favLists.map(list => (
                                        <button 
                                            key={list.id} 
                                            onClick={() => confirmAddToFavorite(list.id)}
                                            style={{
                                                width: '100%', padding: '1rem', textAlign: 'left',
                                                background: 'var(--surface2)', border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '0.8rem',
                                                transition: 'background 0.2s ease', color: 'var(--text)'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface3)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'var(--surface2)'}
                                        >
                                            <span>📋</span> {list.nombre}
                                        </button>
                                    ))}
                                    <button 
                                        onClick={() => setIsCreatingList(true)}
                                        style={{
                                            width: '100%', padding: '1rem', marginTop: '0.5rem',
                                            background: 'none', border: '1px dashed var(--accent)',
                                            color: 'var(--accent)', borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
                                        }}
                                    >+ Crear nueva lista</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoryPage;
