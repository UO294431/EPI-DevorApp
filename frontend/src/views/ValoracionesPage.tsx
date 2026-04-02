import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { valoracionesService } from '../models/api/valoracionesService';
import type { ValoracionDetailedResponse } from '../models/api/valoracionesService';

const ValoracionesPage: React.FC = () => {
    const navigate = useNavigate();
    const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
    const [valoraciones, setValoraciones] = useState<ValoracionDetailedResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [selectedEntryForRating, setSelectedEntryForRating] = useState<ValoracionDetailedResponse | null>(null);
    const [ratingVal, setRatingVal] = useState({ calidad: 0, precio: 0, higiene: 0, trato: 0 });
    const [ratingComment, setRatingComment] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        const fetchValoraciones = async () => {
            try {
                setLoading(true);
                const data = await valoracionesService.obtenerTodasMisValoraciones();
                setValoraciones(data);
            } catch (err: any) {
                console.error("Error fetching valoraciones:", err);
                setError(err.message || "No se pudieron cargar tus valoraciones.");
            } finally {
                setLoading(false);
            }
        };

        fetchValoraciones();
    }, []);

    const handleRateClick = (val: ValoracionDetailedResponse) => {
        setSelectedEntryForRating(val);
        setRatingVal({
            calidad: val.calidad,
            precio: val.precio,
            higiene: val.higiene,
            trato: val.trato
        });
        setRatingComment(val.comentario || '');
        setIsRatingModalOpen(true);
    };

    const handleRatingSubmit = async () => {
        if (!selectedEntryForRating) return;
        
        try {
            setModalLoading(true);
            await valoracionesService.valorarRestaurante({
                place_id: selectedEntryForRating.place_id,
                calidad: ratingVal.calidad,
                precio: ratingVal.precio,
                higiene: ratingVal.higiene,
                trato: ratingVal.trato,
                comentario: ratingComment
            });
            
            // Actualizamos la tarjeta de la interfaz en forma optimista para no tener delación visual
            setValoraciones(prev => prev.map(v => 
                v.place_id === selectedEntryForRating.place_id 
                    ? { ...v, calidad: ratingVal.calidad, precio: ratingVal.precio, higiene: ratingVal.higiene, trato: ratingVal.trato, comentario: ratingComment } 
                    : v
            ));

            setIsRatingModalOpen(false);
            setExpandedEntryId(null);
            
            // Desplazar el alert para que React pinte el plegado
            setTimeout(() => {
                alert(`¡Has actualizado la reseña de ${selectedEntryForRating.restaurant?.name || 'este restaurante'}! 🌟`);
            }, 10);
        } catch (error: any) {
            console.error("Error al guardar la valoración:", error);
            alert(error.message || "Hubo un error al guardar la valoración.");
        } finally {
            setModalLoading(false);
        }
    };

    const handleDeleteRating = async (val: ValoracionDetailedResponse, e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (!globalThis.confirm(`¿Estás seguro de que deseas eliminar permanentemente la reseña de ${val.restaurant?.name || 'este restaurante'}?`)) {
            return;
        }

        // Cerramos el panel visualmente al instante
        setExpandedEntryId(null);

        try {
            await valoracionesService.eliminarValoracion(val.place_id);
            
            // Actualizamos la lista descartando la borrada sin tener que hacer otra llamada lenta a Google/Backend
            setValoraciones(prev => prev.filter(v => v.place_id !== val.place_id));
            
            // Desenganchar la alerta para permitir que el frontend se redibuje al vuelo
            setTimeout(() => {
                alert('La reseña ha sido eliminada con éxito.');
            }, 10);
        } catch (error: any) {
            console.error("Error al eliminar la valoración:", error);
            alert(error.message || "Hubo un error al borrar la valoración.");
        }
    };

    const renderStars = (rating: number) => {
        return (
            <div style={{ display: 'flex', gap: '2px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} style={{
                        color: star <= rating ? '#ffb400' : 'var(--muted)',
                        fontSize: '1.2rem',
                        opacity: star <= rating ? 1 : 0.3
                    }}>
                        ★
                    </span>
                ))}
            </div>
        );
    };

    let content;
    if (loading) {
        content = (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                <p>Cargando tus valoraciones...</p>
            </div>
        );
    } else if (error) {
        content = (
            <div className="message error" style={{ margin: '1rem 0' }}>{error}</div>
        );
    } else if (valoraciones.length === 0) {
        content = (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '3rem' }}>⭐</span>
                <p style={{ fontSize: '1rem', margin: 0 }}>Aún no has valorado ningún restaurante.</p>
            </div>
        );
    } else {
        content = (
            <div style={{ marginTop: '1rem', width: '100%', animation: 'fadeSlideIn 0.5s ease', paddingBottom: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Tus Valoraciones</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{valoraciones.length} en total</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {valoraciones.map((val) => {
                        const restaurant = val.restaurant || {};
                        const types = restaurant.types || [];
                        const typeStr = types.length > 0 ? types[0].replaceAll('_', ' ').replaceAll(/\b\w/g, (l: string) => l.toUpperCase()) : 'Restaurante';

                        return (
                            <div key={val.id} style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            setExpandedEntryId(expandedEntryId === val.id ? null : val.id);
                                        }
                                    }}
                                    onClick={() => setExpandedEntryId(expandedEntryId === val.id ? null : val.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', padding: '1.5rem',
                                        gap: '1.5rem', transition: 'background 0.2s ease', cursor: 'pointer',
                                    }}
                                    className="restaurant-card"
                                >
                                    <div style={{
                                        width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden',
                                        background: 'var(--surface2)', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {restaurant.main_photo ? (
                                            <img src={restaurant.main_photo} alt={restaurant.name || 'Restaurante'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '2rem' }}>🍴</span>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>
                                            {restaurant.name || 'Restaurante Desconocido'}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--accent2)', fontWeight: 500 }}>
                                            {typeStr}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{restaurant.address}</div>
                                    </div>
                                    
                                    <div style={{
                                        color: 'var(--muted)', fontSize: '1.2rem', opacity: 0.5,
                                        transform: expandedEntryId === val.id ? 'rotate(90deg)' : 'none',
                                        transition: 'transform 0.3s ease'
                                    }}>›</div>
                                </div>

                                {expandedEntryId === val.id && (
                                    <div style={{
                                        padding: '1.5rem', background: 'var(--surface2)',
                                        borderTop: '1px solid var(--border)',
                                        animation: 'fadeSlideIn 0.3s ease',
                                        display: 'flex', flexDirection: 'column', gap: '1.5rem'
                                    }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase' }}>Calidad</span>
                                                {renderStars(val.calidad)}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase' }}>Precio</span>
                                                {renderStars(val.precio)}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase' }}>Higiene</span>
                                                {renderStars(val.higiene)}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase' }}>Trato</span>
                                                {renderStars(val.trato)}
                                            </div>
                                        </div>
                                        
                                        {val.comentario && (
                                            <div style={{
                                                padding: '1rem', background: 'var(--surface)',
                                                borderLeft: '4px solid var(--accent)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                                                color: 'var(--text)', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: '1.5'
                                            }}>
                                                "{val.comentario}"
                                            </div>
                                        )}
                                        
                                        <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '1rem', borderTop: '1px solid var(--border)', gap: '1rem' }}>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRateClick(val);
                                                }}
                                                className="btn-primary"
                                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                            >
                                                ✏️ Cambiar reseña
                                            </button>
                                            
                                            <button 
                                                onClick={(e) => handleDeleteRating(val, e)}
                                                className="btn-secondary"
                                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#ff3b30', background: 'rgba(255, 59, 48, 0.1)', borderColor: 'transparent' }}
                                            >
                                                🗑️ Eliminar reseña
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="app-container" style={{ alignItems: 'flex-start', paddingTop: '4rem' }}>
            <div className="auth-card" style={{ maxWidth: '600px', width: '100%' }}>
                <div className="auth-header">
                    <div className="auth-logo">⭐</div>
                    <h1>Mis Valoraciones</h1>
                    <p>Opiniones y puntuaciones que has dejado</p>
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

                <style>{`
                    .restaurant-card:hover { background: rgba(0,0,0,0.03) !important; }
                    [data-theme='dark'] .restaurant-card:hover { background: rgba(255,255,255,0.03) !important; }
                `}</style>
            </div>

            {/* Modal para valorar restaurante */}
            {isRatingModalOpen && selectedEntryForRating && (
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
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Valorar {selectedEntryForRating.restaurant?.name || 'Restaurante'}</h3>
                            <button onClick={() => setIsRatingModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {['calidad', 'precio', 'higiene', 'trato'].map((aspect) => (
                                <div key={aspect} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                                        {aspect}
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <span 
                                                key={star}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        setRatingVal({ ...ratingVal, [aspect]: star });
                                                    }
                                                }}
                                                onClick={() => setRatingVal({ ...ratingVal, [aspect]: star })}
                                                style={{
                                                    cursor: 'pointer',
                                                    fontSize: '1.5rem',
                                                    color: star <= (ratingVal as any)[aspect] ? '#ffb400' : 'var(--muted)',
                                                    opacity: star <= (ratingVal as any)[aspect] ? 1 : 0.3,
                                                    transition: 'color 0.2s ease, opacity 0.2s ease'
                                                }}
                                            >
                                                ★
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div style={{ marginTop: '0.5rem' }}>
                                <label htmlFor="rating-comment" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem', display: 'block' }}>Comentario (opcional)</label>
                                <textarea
                                    id="rating-comment"
                                    value={ratingComment}
                                    onChange={(e) => setRatingComment(e.target.value)}
                                    placeholder="¿Qué te ha parecido?"
                                    rows={3}
                                    style={{
                                        width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border)', background: 'var(--surface2)',
                                        color: 'var(--text)', resize: 'none', fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            <button
                                onClick={handleRatingSubmit}
                                disabled={modalLoading || Object.values(ratingVal).includes(0)}
                                className="btn-primary"
                                style={{
                                    marginTop: '0.5rem', padding: '0.8rem', width: '100%',
                                    opacity: Object.values(ratingVal).includes(0) ? 0.5 : 1
                                }}
                            >
                                {modalLoading ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ValoracionesPage;
