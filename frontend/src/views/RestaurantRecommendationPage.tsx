import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Autocomplete from "react-google-autocomplete";
import { authService } from '../models/api/authService';
import { recommendationService } from '../models/api/recommendationService';
import { historialService } from '../models/api/historialService';
import { savedForLaterService } from '../models/api/savedForLaterService';
import { valoracionesService } from '../models/api/valoracionesService';
import type { ValoracionPublica } from '../models/api/valoracionesService';
import tagsData from '../data/tags.json';

interface Tag {
    id: string;
    label: string;
    category: string;
}

const PRICE_LEVELS = [
    { id: 'PRICE_LEVEL_INEXPENSIVE', level: 1, label: 'Económico' },
    { id: 'PRICE_LEVEL_MODERATE', level: 2, label: 'Moderado' },
    { id: 'PRICE_LEVEL_EXPENSIVE', level: 3, label: 'Caro' },
    { id: 'PRICE_LEVEL_VERY_EXPENSIVE', level: 4, label: 'Exclusivo' }
];

const getCurrencyForCountry = (countryCode: string): string => {
    const currencyMap: Record<string, string> = {
        'ES': '€', 'FR': '€', 'DE': '€', 'IT': '€', 'PT': '€',
        'US': '$', 'MX': '$', 'AR': '$', 'CO': '$', 'CL': '$',
        'GB': '£',
        'JP': '¥',
        'BR': 'R$',
    };
    return currencyMap[countryCode] || '€';
};


const RestaurantRecommendationPage: React.FC = () => {
    const navigate = useNavigate();

    // Tags Autocomplete
    const [tagInput, setTagInput] = useState('');
    const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
    const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
    const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);

    // Prices
    const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
    const [includeUnconfirmedPrice, setIncludeUnconfirmedPrice] = useState(false);
    const [openNow, setOpenNow] = useState(false);
    const [currencySymbol, setCurrencySymbol] = useState('€');

    // Location
    const [locationMode, setLocationMode] = useState<'preferred' | 'custom'>('preferred');
    const [preferredLocation, setPreferredLocation] = useState('');
    const [customLocation, setCustomLocation] = useState('');

    // Sort
    const [sortBy, setSortBy] = useState<'rating' | 'distance'>('rating');

    // Results logic
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [expandedRestaurantId, setExpandedRestaurantId] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Reseñas por restaurante: { [place_id]: ValoracionPublica[] }
    const [resenasPorRestaurante, setResenasPorRestaurante] = useState<Record<string, ValoracionPublica[]>>({});
    const [loadingResenas, setLoadingResenas] = useState<Record<string, boolean>>({});


    useEffect(() => {
        if (!tagInput.trim()) {
            setFilteredTags([]);
            setIsTagsDropdownOpen(false);
            return;
        }

        const lowerInput = tagInput.toLowerCase();
        const availableTags = (tagsData as Tag[]).filter(tag =>
            !selectedTags.some(selected => selected.id === tag.id) &&
            tag.label.toLowerCase().includes(lowerInput)
        );

        setFilteredTags(availableTags);
        setIsTagsDropdownOpen(true);
    }, [tagInput, selectedTags]);

    useEffect(() => {
        if (locationMode === 'preferred') {
            handlePreferredLocationCurrency();
        }
    }, [locationMode]);

    const handleAddTag = (tag: Tag) => {
        setSelectedTags([...selectedTags, tag]);
        setTagInput('');
        setIsTagsDropdownOpen(false);
    };

    const handleRemoveTag = (tagId: string) => {
        setSelectedTags(selectedTags.filter(t => t.id !== tagId));
    };

    const handlePriceToggle = (priceId: string) => {
        if (selectedPrices.includes(priceId)) {
            setSelectedPrices(selectedPrices.filter(p => p !== priceId));
        } else {
            setSelectedPrices([...selectedPrices, priceId]);
        }
    };

    const triggerSearch = async (currentSortBy: string) => {
        setError(null);
        setLoading(true);
        setCurrentPage(1);
        setNextPageToken(null);
        setExpandedRestaurantId(null);
        setResenasPorRestaurante({});

        const currentSearchLocation = locationMode === 'preferred' ? preferredLocation : customLocation;

        if (!currentSearchLocation) {
            setError('Por favor, selecciona o introduce una ubicación.');
            setLoading(false);
            return;
        }

        try {
            const data = await recommendationService.search({
                categories: selectedTags.map(t => t.id),
                prices: selectedPrices,
                include_unconfirmed_price: includeUnconfirmedPrice,
                open_now: openNow,
                location: currentSearchLocation,
                sort_by: currentSortBy
            });

            setResults(data.results);
            setNextPageToken(data.next_page_token || null);
            setIsPanelCollapsed(true);
        } catch (err: any) {
            setError(err.message || 'Error al buscar recomendaciones');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await triggerSearch(sortBy);
    };

    const handleNextPage = async () => {
        const maxCurrentPages = Math.ceil(results.length / ITEMS_PER_PAGE);
        if (currentPage < maxCurrentPages) {
            setCurrentPage(prev => prev + 1);
            return;
        }

        if (!nextPageToken || loadingMore) return;

        setLoadingMore(true);
        const currentSearchLocation = locationMode === 'preferred' ? preferredLocation : customLocation;

        try {
            const data = await recommendationService.search({
                categories: selectedTags.map(t => t.id),
                prices: selectedPrices,
                include_unconfirmed_price: includeUnconfirmedPrice,
                open_now: openNow,
                location: currentSearchLocation,
                sort_by: sortBy,
                page_token: nextPageToken
            });

            setResults(prev => [...prev, ...data.results]);
            setNextPageToken(data.next_page_token || null);
            setCurrentPage(prev => prev + 1);
        } catch (err: any) {
            console.error("Error al cargar más resultados:", err);
            setError('No se pudieron cargar más resultados.');
        } finally {
            setLoadingMore(false);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    };

    const handleExpandRestaurant = async (placeId: string) => {
        const newId = expandedRestaurantId === placeId ? null : placeId;
        setExpandedRestaurantId(newId);

        if (newId && !resenasPorRestaurante[newId]) {
            setLoadingResenas(prev => ({ ...prev, [newId]: true }));
            try {
                const resenas = await valoracionesService.obtenerResenasRestaurante(newId);
                setResenasPorRestaurante(prev => ({ ...prev, [newId]: resenas }));
            } catch (err) {
                setResenasPorRestaurante(prev => ({ ...prev, [newId]: [] }));
            } finally {
                setLoadingResenas(prev => ({ ...prev, [newId]: false }));
            }
        }
    };

    const handleMeGusta = async (placeId: string, valoracionId: number) => {
        // Encontrar la reseña actual para saber su estado previo
        const resenaActual = (resenasPorRestaurante[placeId] || []).find(r => r.id === valoracionId);
        if (!resenaActual) return;

        const yaDabaLike = resenaActual.ha_dado_me_gusta;

        // Actualización optimista de la UI
        setResenasPorRestaurante(prev => ({
            ...prev,
            [placeId]: (prev[placeId] || []).map(r =>
                r.id === valoracionId 
                    ? { 
                        ...r, 
                        ha_dado_me_gusta: !yaDabaLike,
                        me_gustas: !yaDabaLike ? r.me_gustas + 1 : Math.max(0, r.me_gustas - 1)
                      } 
                    : r
            )
        }));

        try {
            const updated = await valoracionesService.darMeGusta(valoracionId);
            setResenasPorRestaurante(prev => ({
                ...prev,
                [placeId]: (prev[placeId] || []).map(r =>
                    r.id === updated.id ? updated : r
                )
            }));
        } catch {
            // Revertir en caso de error
            setResenasPorRestaurante(prev => ({
                ...prev,
                [placeId]: (prev[placeId] || []).map(r =>
                    r.id === valoracionId 
                        ? { 
                            ...r, 
                            ha_dado_me_gusta: yaDabaLike,
                            me_gustas: yaDabaLike ? r.me_gustas + 1 : Math.max(0, r.me_gustas - 1)
                          } 
                        : r
                )
            }));
        }
    };

    const handlePreferredLocationCurrency = async () => {
        try {
            const userData = await authService.getMe();
            const ubicacion = userData.ubicacion;

            if (ubicacion) {
                const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
                const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(ubicacion)}&key=${apiKey}`;

                const response = await fetch(url);
                const data = await response.json();

                let countryCode = null;
                if (data.results && data.results.length > 0) {
                    const addressComponents = data.results[0].address_components;
                    const countryComponent = addressComponents.find((c: any) => c.types.includes('country'));
                    if (countryComponent) {
                        countryCode = countryComponent.short_name;
                    }
                }

                if (countryCode) {
                    const symbol = getCurrencyForCountry(countryCode);
                    setCurrencySymbol(symbol);
                } else {
                    setCurrencySymbol('€');
                }
                setPreferredLocation(ubicacion);
            } else {
                setCurrencySymbol('€');
                setPreferredLocation('');
            }
        } catch (error) {
            console.error("Error al conectar con FastAPI para obtener el perfil:", error);
            setCurrencySymbol('€');
            // Intentar recuperar la ubicación aunque falle la geocodificación
            try {
                const userData = await authService.getMe();
                if (userData.ubicacion) setPreferredLocation(userData.ubicacion);
            } catch (e) {
                console.error("Error definitivo al obtener ubicación:", e);
            }
        }
    };

    return (
        <div className="app-container" style={{ alignItems: 'flex-start', paddingTop: '4rem' }}>
            <div className="auth-card" style={{ maxWidth: '600px', width: '100%' }}>
                <div className="auth-header">
                    <div className="auth-logo">🔍</div>
                    <h1>Recomendador de Restaurantes</h1>
                    <p>Encuentra tu próximo lugar favorito</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form" noValidate>
                    {results.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '2rem' }}>
                            <div
                                onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                                style={{
                                    flex: 1,
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '1rem 1.25rem', background: 'var(--surface2)',
                                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                    border: '1px solid var(--border)', transition: 'all 0.2s ease',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                                }}
                            >
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent)' }}>
                                    {isPanelCollapsed ? '🔍 Volver a buscar / Modificar filtros' : '🔼 Plegar opciones'}
                                </span>
                                <span>{isPanelCollapsed ? '▼' : '▲'}</span>
                            </div>
                            {isPanelCollapsed && (
                                <button
                                    type="button"
                                    onClick={() => navigate('/home')}
                                    className="btn-secondary"
                                    style={{
                                        padding: '0 1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        borderRadius: 'var(--radius-sm)'
                                    }}
                                >
                                    🏠 Volver al inicio
                                </button>
                            )}
                        </div>
                    )}

                    {!isPanelCollapsed && (
                        <div style={{ animation: 'fadeSlideIn 0.3s ease' }}>
                            <div className="form-group" style={{ position: 'relative', marginBottom: '1.8rem' }}>
                                <label style={{ marginBottom: '0.8rem', display: 'block' }}>Categorías</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    {selectedTags.map(tag => (
                                        <span key={tag.id} style={{
                                            background: 'var(--accent)', color: 'white',
                                            padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                                        }}>
                                            {tag.label}
                                            <button type="button" onClick={() => handleRemoveTag(tag.id)}
                                                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem', lineHeight: '1' }}>
                                                &times;
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    placeholder="Ej. Mexicana, Pizza, Sushi..."
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onFocus={() => { if (tagInput) setIsTagsDropdownOpen(true) }}
                                />
                                {isTagsDropdownOpen && filteredTags.length > 0 && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0,
                                        background: 'var(--surface2)', border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)', zIndex: 10, maxHeight: '200px',
                                        overflowY: 'auto', marginTop: '0.3rem', boxShadow: 'var(--shadow)'
                                    }}>
                                        {filteredTags.map(tag => (
                                            <div key={tag.id}
                                                onClick={() => handleAddTag(tag)}
                                                style={{ padding: '0.6rem 0.8rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ fontWeight: 500 }}>{tag.label}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{tag.category}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.8rem' }}>
                                <label style={{ marginBottom: '0.8rem', display: 'block' }}>Rango de precios</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                    {PRICE_LEVELS.map(price => (
                                        <label key={price.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedPrices.includes(price.id)}
                                                onChange={() => handlePriceToggle(price.id)}
                                                style={{ width: 'auto', accentColor: 'var(--accent)' }}
                                            />
                                            <span style={{ minWidth: '40px', fontWeight: 'bold' }}>
                                                {currencySymbol.repeat(price.level)}
                                            </span>
                                            <span>- {price.label}</span>
                                        </label>
                                    ))}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)', marginTop: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={includeUnconfirmedPrice}
                                            onChange={() => setIncludeUnconfirmedPrice(!includeUnconfirmedPrice)}
                                            style={{ width: 'auto', accentColor: 'var(--accent)' }}
                                        />
                                        Incluir sitios sin precio confirmado
                                    </label>
                                    <label htmlFor="open-now-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)', marginTop: '0.5rem' }}>
                                        <input
                                            id="open-now-checkbox"
                                            type="checkbox"
                                            checked={openNow}
                                            onChange={() => setOpenNow(!openNow)}
                                            style={{ width: 'auto', accentColor: 'var(--accent)' }}
                                        />
                                        Solo lugares abiertos ahora
                                    </label>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.8rem' }}>
                                <label style={{ marginBottom: '0.8rem', display: 'block' }}>Ubicación</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem' }}>
                                    <label htmlFor="preferred-location-radio" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
                                        <input
                                            id="preferred-location-radio"
                                            type="radio"
                                            name="locationMode"
                                            checked={locationMode === 'preferred'}
                                            onChange={() => {
                                                setLocationMode('preferred');
                                                setCustomLocation('');
                                            }}
                                            style={{ width: 'auto', accentColor: 'var(--accent)' }}
                                        />
                                        Usar ubicación preferida
                                    </label>

                                    <label htmlFor="custom-location-radio" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
                                        <input
                                            id="custom-location-radio"
                                            type="radio"
                                            name="locationMode"
                                            checked={locationMode === 'custom'}
                                            onChange={() => setLocationMode('custom')}
                                            style={{ width: 'auto', accentColor: 'var(--accent)' }}
                                        />
                                        Escoger ubicación
                                    </label>

                                    {locationMode === 'custom' && (
                                        <div style={{ marginTop: '0.3rem', marginLeft: '1.5rem' }}>
                                            <Autocomplete
                                                apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                                                onChange={() => setCustomLocation('')}
                                                onPlaceSelected={(place) => {
                                                    if (place?.formatted_address) {
                                                        setCustomLocation(place.formatted_address);
                                                    }
                                                    if (place?.address_components) {
                                                        const countryComponent = place.address_components.find(
                                                            (c: any) => c.types.includes('country')
                                                        );
                                                        if (countryComponent) {
                                                            const symbol = getCurrencyForCountry(countryComponent.short_name);
                                                            setCurrencySymbol(symbol);
                                                        }
                                                    }
                                                }}
                                                options={{ types: [] }}
                                                className="form-control"
                                                style={{
                                                    background: 'var(--surface2)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    color: 'var(--text)',
                                                    fontSize: '0.9375rem',
                                                    padding: '0.7rem 0.9rem',
                                                    width: '100%'
                                                }}
                                                placeholder="Escribe una ciudad o calle"
                                                defaultValue={customLocation}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" onClick={() => navigate('/home')} className="btn-primary" style={{ flex: 1, background: 'var(--surface2)', color: 'var(--text)', boxShadow: 'none' }}>
                                    Volver
                                </button>
                                <button type="submit" className={`btn-primary${loading ? ' loading' : ''}`} style={{ flex: 2 }} disabled={loading}>
                                    {loading ? '' : 'Buscar Sugerencias'}
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="message error" style={{ marginTop: '1rem' }}>
                            {error}
                        </div>
                    )}
                </form>

                {results.length > 0 && (
                    <div style={{ marginTop: '3.5rem', width: '100%', animation: 'fadeSlideIn 0.5s ease', paddingBottom: '3rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sugerencias para ti</h2>
                            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{results.length} resultados encontrados</span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>Ordenar por:</span>
                            <select
                                aria-label="Ordenar resultados"
                                value={sortBy}
                                onChange={(e) => {
                                    const newSort = e.target.value as 'rating' | 'distance';
                                    setSortBy(newSort);
                                    if (results.length > 0) triggerSearch(newSort);
                                }}
                                style={{
                                    background: `var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 0.75rem center`,
                                    backgroundSize: '16px',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text)',
                                    padding: '0.5rem 2.5rem 0.5rem 1rem',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    appearance: 'none',
                                    minWidth: '220px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                }}
                            >
                                <option value="rating">⭐ Mejor valoración</option>
                                <option value="distance">📍 Cercanía a la ubicación</option>
                                <option value="reviews">🔥 Más populares</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            {results.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((place: any) => (
                                <div key={place.id} className="restaurant-card-container" style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                                    <div className="restaurant-card"
                                        onClick={() => handleExpandRestaurant(place.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '1.5rem',
                                            background: 'transparent',
                                            gap: '1.5rem',
                                            transition: 'all 0.2s ease',
                                            cursor: 'pointer'
                                        }}>
                                        <div style={{
                                            width: '80px', height: '80px',
                                            borderRadius: '12px', overflow: 'hidden',
                                            background: 'var(--surface2)',
                                            flexShrink: 0,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {place.main_photo ? (
                                                <img src={place.main_photo} alt={place.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <span style={{ fontSize: '2rem' }}>🍴</span>
                                            )}
                                        </div>

                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>{place.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <span key={`star-${place.id}-${i}`} style={{
                                                        color: i < Math.floor(place.rating || 0) ? '#ffb400' : 'var(--muted)',
                                                        fontSize: '0.9rem',
                                                        opacity: i < Math.floor(place.rating || 0) ? 1 : 0.3
                                                    }}>
                                                        ★
                                                    </span>
                                                ))}
                                                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '0.4rem' }}>
                                                    {place.rating} ({place.user_ratings_total})
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--accent2)', fontWeight: 500 }}>
                                                {place.types && place.types.length > 0
                                                    ? place.types[0].replaceAll('_', ' ').replaceAll(/\b\w/g, (l: any) => l.toUpperCase())
                                                    : 'Restaurante'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{place.address}</div>
                                        </div>
                                        <div style={{
                                            color: 'var(--muted)',
                                            fontSize: '1.2rem',
                                            opacity: 0.5,
                                            transform: expandedRestaurantId === place.id ? 'rotate(90deg)' : 'none',
                                            transition: 'transform 0.3s ease'
                                        }}>›</div>
                                    </div>

                                    {expandedRestaurantId === place.id && (
                                        <div style={{
                                            padding: '1.5rem',
                                            animation: 'fadeSlideIn 0.3s ease',
                                            background: 'rgba(var(--accent-rgb), 0.03)',
                                            borderTop: '1px solid var(--border)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '1.5rem'
                                        }}>
                                            {place.summary && (
                                                <div style={{
                                                    fontSize: '0.95rem',
                                                    color: 'var(--text)',
                                                    lineHeight: '1.6',
                                                    padding: '1rem',
                                                    borderLeft: '3px solid var(--accent)',
                                                    background: 'var(--surface2)',
                                                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                                                }}>
                                                    <span style={{ fontSize: '1.2rem', marginRight: '0.5rem', verticalAlign: 'middle' }}>💬</span>
                                                    {place.summary}
                                                </div>
                                            )}

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                gap: '1.5rem',
                                                marginBottom: '1rem'
                                            }}>
                                                {place.opening_hours && place.opening_hours.length > 0 && (
                                                    <div style={{
                                                        background: 'var(--surface2)',
                                                        padding: '1rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--border)'
                                                    }}>
                                                        <div style={{ fontWeight: 700, marginBottom: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                                            🕒 Horario de apertura
                                                        </div>
                                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                            {place.opening_hours.slice(0, 7).map((day: string, idx: number) => {
                                                                const parts = day.split(': ');
                                                                const dayName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() : '';
                                                                const hoursRaw = parts[1] || '';
                                                                const shifts = hoursRaw.split(', ');

                                                                return (
                                                                    <li key={idx} style={{
                                                                        fontSize: '0.8rem',
                                                                        opacity: 0.8,
                                                                        padding: '0.4rem 0',
                                                                        borderBottom: idx < place.opening_hours.length - 1 ? '1px solid var(--border)' : 'none',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'baseline'
                                                                    }}>
                                                                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{dayName} :</span>
                                                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                            {shifts.map((s, sIdx) => (
                                                                                <span key={sIdx}>{s}</span>
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
                                                        {place.google_maps_uri && (
                                                            <a href={place.google_maps_uri} target="_blank" rel="noopener noreferrer"
                                                                className="btn-secondary"
                                                                style={{
                                                                    fontSize: '0.85rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.6rem',
                                                                    padding: '0.6rem 0.8rem',
                                                                    background: 'var(--surface2)',
                                                                    color: 'var(--accent)',
                                                                    border: '1px solid var(--border)',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    textDecoration: 'none',
                                                                    transition: 'all 0.2s ease'
                                                                }}>
                                                                <span>🗺️</span> Google Maps
                                                            </a>
                                                        )}

                                                        {place.website_uri && (
                                                            <a href={place.website_uri} target="_blank" rel="noopener noreferrer"
                                                                className="btn-secondary"
                                                                style={{
                                                                    fontSize: '0.85rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.6rem',
                                                                    padding: '0.6rem 0.8rem',
                                                                    background: 'var(--surface2)',
                                                                    color: 'var(--accent)',
                                                                    border: '1px solid var(--border)',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    textDecoration: 'none',
                                                                    transition: 'all 0.2s ease'
                                                                }}>
                                                                <span>🌐</span> Sitio Web
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            await historialService.addToHistorial(place.id);
                                                            alert(`¡Has seleccionado ${place.name}!\n\n¡Que disfrutes de una deliciosa comida! 🍽️`);
                                                            navigate('/home');
                                                        } catch (err: any) {
                                                            console.error("Error saving to history:", err);
                                                            alert("Error al guardar en el historial: " + err.message);
                                                        }
                                                    }}
                                                    className="btn-primary"
                                                    style={{
                                                        width: '100%',
                                                        padding: '1.2rem',
                                                        boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)',
                                                        fontWeight: 700,
                                                        letterSpacing: '1px',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                    SELECCIONAR ESTE RESTAURANTE
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            await savedForLaterService.saveForLater({
                                                                place_id: place.id,
                                                                name: place.name,
                                                                rating: place.rating || 0,
                                                                user_ratings_total: place.user_ratings_total || 0,
                                                                types: place.types || [],
                                                                address: place.address || '',
                                                                main_photo: place.main_photo,
                                                                summary: place.summary,
                                                                opening_hours: place.opening_hours,
                                                                google_maps_uri: place.google_maps_uri,
                                                                website_uri: place.website_uri,
                                                            });
                                                            alert(`¡Has guardado ${place.name} para más tarde! ⏰`);
                                                        } catch (err: any) {
                                                            console.error("Error saving for later:", err);
                                                            alert(err.message || "Error al guardar para más tarde.");
                                                        }
                                                    }}
                                                    type="button"
                                                    className="btn-secondary"
                                                    style={{
                                                        width: '100%',
                                                        padding: '1rem',
                                                        fontWeight: 600,
                                                        border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-sm)'
                                                    }}>
                                                    ⏰ Guardar para más tarde
                                                </button>
                                            </div>

                                            {/* ── Sección de reseñas ── */}
                                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                    <span style={{ fontSize: '1rem' }}>💬</span>
                                                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>Reseñas de la comunidad</span>
                                                    {resenasPorRestaurante[place.id] && (
                                                        <span style={{
                                                            background: 'rgba(124,109,250,0.15)',
                                                            color: 'var(--accent)',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            padding: '0.15rem 0.5rem',
                                                            borderRadius: '99px'
                                                        }}>
                                                            {resenasPorRestaurante[place.id].length}
                                                        </span>
                                                    )}
                                                </div>

                                                {loadingResenas[place.id] ? (
                                                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                                                        Cargando reseñas...
                                                    </div>
                                                ) : !resenasPorRestaurante[place.id] || resenasPorRestaurante[place.id].length === 0 ? (
                                                    <div style={{
                                                        textAlign: 'center', padding: '1.5rem',
                                                        color: 'var(--muted)', fontSize: '0.875rem',
                                                        background: 'var(--surface2)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        border: '1px dashed var(--border)'
                                                    }}>
                                                        😶 Aún no hay reseñas para este restaurante.
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                        {resenasPorRestaurante[place.id].map(resena => (
                                                            <div key={resena.id} style={{
                                                                background: 'var(--surface2)',
                                                                border: '1px solid var(--border)',
                                                                borderRadius: 'var(--radius-md)',
                                                                padding: '1rem 1.1rem',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '0.7rem',
                                                                transition: 'border-color 0.2s'
                                                            }}>
                                                                {/* Cabecera: avatar + username */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                    <div style={{
                                                                        width: '32px', height: '32px',
                                                                        borderRadius: '50%',
                                                                        background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        fontSize: '0.8rem', fontWeight: 700, color: '#fff',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        {resena.username.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>
                                                                        {resena.username}
                                                                    </span>
                                                                </div>

                                                                {/* Puntuaciones */}
                                                                <div style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                                                    gap: '0.4rem 1rem'
                                                                }}>
                                                                    {[
                                                                        { label: 'Calidad', val: resena.calidad },
                                                                        { label: 'Precio', val: resena.precio },
                                                                        { label: 'Higiene', val: resena.higiene },
                                                                        { label: 'Trato', val: resena.trato },
                                                                    ].map(({ label, val }) => (
                                                                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', minWidth: '46px' }}>{label}</span>
                                                                            <div style={{ display: 'flex', gap: '1px' }}>
                                                                                {Array.from({ length: 5 }).map((_, i) => (
                                                                                    <span key={i} style={{
                                                                                        fontSize: '0.7rem',
                                                                                        color: i < val ? '#ffb400' : 'var(--muted)',
                                                                                        opacity: i < val ? 1 : 0.3
                                                                                    }}>★</span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Comentario */}
                                                                {resena.comentario && (
                                                                    <p style={{
                                                                        fontSize: '0.85rem',
                                                                        color: 'var(--text)',
                                                                        lineHeight: '1.5',
                                                                        margin: 0,
                                                                        fontStyle: 'italic',
                                                                        opacity: 0.85
                                                                    }}>
                                                                        "{resena.comentario}"
                                                                    </p>
                                                                )}

                                                                {/* Me gusta */}
                                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleMeGusta(place.id, resena.id); }}
                                                                        title={resena.ha_dado_me_gusta ? "Quitar me gusta" : "Me gusta"}
                                                                        style={{
                                                                            background: 'none',
                                                                            border: resena.ha_dado_me_gusta ? '1px solid #f472b6' : '1px solid var(--border)',
                                                                            borderRadius: '99px',
                                                                            padding: '0.3rem 0.75rem',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '0.4rem',
                                                                            fontSize: '0.8rem',
                                                                            color: resena.ha_dado_me_gusta ? '#f472b6' : 'var(--muted)',
                                                                            transition: 'all 0.2s',
                                                                        }}
                                                                        onMouseEnter={e => {
                                                                            (e.currentTarget as HTMLButtonElement).style.borderColor = '#f472b6';
                                                                            (e.currentTarget as HTMLButtonElement).style.color = '#f472b6';
                                                                        }}
                                                                        onMouseLeave={e => {
                                                                            if (!resena.ha_dado_me_gusta) {
                                                                                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                                                                                (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
                                                                            }
                                                                        }}
                                                                    >
                                                                        <span style={{ fontSize: '1rem', color: resena.ha_dado_me_gusta ? '#f472b6' : 'inherit' }}>
                                                                            {resena.ha_dado_me_gusta ? '❤️' : '🤍'}
                                                                        </span>
                                                                        <span>{resena.me_gustas}</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
                            <button
                                type="button"
                                onClick={handlePrevPage}
                                disabled={currentPage === 1 || loadingMore}
                                className="btn-secondary"
                                style={{
                                    visibility: currentPage === 1 ? 'hidden' : 'visible',
                                    padding: '0.6rem 1.5rem',
                                    minWidth: '100px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                Anterior
                            </button>
                            
                            <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem' }}>
                                {currentPage}
                            </span>

                            <button
                                type="button"
                                onClick={handleNextPage}
                                disabled={loadingMore || (currentPage >= Math.ceil(results.length / ITEMS_PER_PAGE) && !nextPageToken)}
                                className={`btn-secondary${loadingMore ? ' loading' : ''}`}
                                style={{
                                    visibility: (currentPage >= Math.ceil(results.length / ITEMS_PER_PAGE) && !nextPageToken) ? 'hidden' : 'visible',
                                    padding: '0.6rem 1.5rem',
                                    minWidth: '100px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                {loadingMore ? '' : 'Siguiente'}
                            </button>
                        </div>

                        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                            <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" style={{ opacity: 0.7, filter: 'invert(1) grayscale(1)' }} />
                        </div>

                        <style>{`
                            .restaurant-card:hover { background: rgba(0,0,0,0.03) !important; }
                            [data-theme='dark'] .restaurant-card:hover { background: rgba(255,255,255,0.03) !important; }
                        `}</style>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RestaurantRecommendationPage;
