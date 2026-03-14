import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Autocomplete from "react-google-autocomplete";
import { authService } from '../models/api/authService';
import { recommendationService } from '../models/api/recommendationService';
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

const UNSPECIFIED_PRICE_ID = 'PRICE_LEVEL_UNSPECIFIED';

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

    // Results logic
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [expandedRestaurantId, setExpandedRestaurantId] = useState<string | null>(null);


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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        setNextPageToken(null);
        setExpandedRestaurantId(null);

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
                location: currentSearchLocation
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

    const handleLoadMore = async () => {
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
                page_token: nextPageToken
            });

            setResults(prev => [...prev, ...data.results]);
            setNextPageToken(data.next_page_token || null);
        } catch (err: any) {
            console.error("Error al cargar más resultados:", err);
            setError('No se pudieron cargar más resultados.');
        } finally {
            setLoadingMore(false);
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
                    setPreferredLocation(ubicacion);
                } else {
                    setCurrencySymbol('€');
                    setPreferredLocation(ubicacion);
                }
            } else {
                setCurrencySymbol('€');
                setPreferredLocation('');
            }
        } catch (error) {
            console.error("Error al conectar con FastAPI para obtener el perfil:", error);
            setCurrencySymbol('€');
        }
    };

    return (
        <div className="app-container" style={{ alignItems: 'flex-start', paddingTop: '4rem' }}>
            <div className="auth-card" style={{ maxWidth: '600px', width: '100%' }}>
                <div className="auth-header">
                    <div className="auth-logo">🔍</div>
                    <h1>Recomendar Restaurantes</h1>
                    <p>Encuentra tu próximo lugar favorito</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form" noValidate>
                    {results.length > 0 && (
                        <div
                            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                            style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '1rem 1.25rem', background: 'var(--surface2)',
                                borderRadius: 'var(--radius-sm)', cursor: 'pointer', marginBottom: '2rem',
                                border: '1px solid var(--border)', transition: 'all 0.2s ease',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                            }}
                        >
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent)' }}>
                                {isPanelCollapsed ? '🔍 Volver a buscar / Modificar filtros' : '🔼 Plegar opciones'}
                            </span>
                            <span>{isPanelCollapsed ? '▼' : '▲'}</span>
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
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)', marginTop: '0.5rem' }}>
                                        <input
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
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
                                        <input
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

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
                                        <input
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sugerencias para ti</h2>
                            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{results.length} resultados encontrados</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            {results.map((place: any) => (
                                <div key={place.id} className="restaurant-card-container" style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                                    <div className="restaurant-card"
                                        onClick={() => setExpandedRestaurantId(expandedRestaurantId === place.id ? null : place.id)}
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

                                            <div style={{ width: '100%' }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        alert(`Has seleccionado: ${place.name}`);
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
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {nextPageToken && (
                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                                <button
                                    type="button"
                                    onClick={handleLoadMore}
                                    disabled={loadingMore}
                                    className={`btn-primary${loadingMore ? ' loading' : ''}`}
                                    style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', width: 'auto', padding: '0.6rem 2rem' }}
                                >
                                    {loadingMore ? '' : 'Ver más restaurantes'}
                                </button>
                            </div>
                        )}

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
