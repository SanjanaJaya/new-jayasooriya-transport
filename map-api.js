/**
 * ============================================================================
 * JAYASOORIYA TRANSPORT — UNIFIED SYSTEM MAP API Engine
 * ============================================================================
 * 🗺️ Map Data: OpenStreetMap & Curated Vector/Raster Tile Providers
 * 💻 Map Frontend: Leaflet.js Interactive Renderer
 * 📍 Geocoding: Nominatim OSM Geocoder (Forward, Reverse & Autocomplete)
 * 🧭 Routing: OSRM (Open Source Routing Machine) with GraphHopper/Geodesic Fallbacks
 * 💰 Cost: $0 Public-Tier Compliant with Rate Limiting & Queue Management
 * ============================================================================
 */

(function (global) {
    'use strict';

    // Guard: Prevent double initialization
    if (global.SysMapAPI) return;

    // Default configuration & Sri Lanka Bounding Box / Center
    const DEFAULT_CONFIG = {
        center: [7.8731, 80.7718], // Center of Sri Lanka
        defaultZoom: 8,
        minZoom: 4,
        maxZoom: 19,
        userAgent: 'JayasooriyaTransportMapAPI/1.0 (jayasooriyatransport@gmail.com)',
        contactEmail: 'jayasooriyatransport@gmail.com',
        sriLankaBBox: '79.5,5.9,81.9,9.9', // minLon, minLat, maxLon, maxLat
        osrmServer: 'https://router.project-osrm.org',
        nominatimServer: 'https://nominatim.openstreetmap.org'
    };

    // Cache stores for Reverse & Forward Geocoding
    const reverseGeocodeCache = new Map();
    const geocodeQueryCache = new Map();

    // Rate Limiting Queue for Nominatim (Policy: max 1 request/sec)
    const reverseGeocodeQueue = [];
    let isProcessingGeocodeQueue = false;

    // Tile Layer Definitions
    const TILE_PROVIDERS = {
        osm: {
            name: 'OpenStreetMap Standard',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
            maxZoom: 19
        },
        esri: {
            name: 'Esri World Street Map',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            attribution: '&copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012',
            maxZoom: 19
        },
        carto_light: {
            name: 'CartoDB Positron (Light)',
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20
        },
        carto_dark: {
            name: 'CartoDB Dark Matter (Dark)',
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20
        },
        opentopo: {
            name: 'OpenTopoMap',
            url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
            maxZoom: 17
        }
    };

    /**
     * Main System Map API Object
     */
    const SysMapAPI = {
        version: '1.0.0',
        TILE_PROVIDERS: TILE_PROVIDERS,

        // =========================================================================
        // 1. MAP CREATION & LIFECYCLE MANAGEMENT
        // =========================================================================

        /**
         * Initialize a Leaflet map with standard tiles, zoom controls, and theme integration.
         * @param {string|HTMLElement} containerId - Element ID or HTMLElement
         * @param {Object} options - Custom map options
         * @returns {L.Map|null} Leaflet map instance
         */
        createMap: function (containerId, options = {}) {
            if (typeof L === 'undefined') {
                console.error('[SysMapAPI] Leaflet.js (L) is not loaded. Please include leaflet.js first.');
                return null;
            }

            const el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
            if (!el) {
                console.error('[SysMapAPI] Map container element not found:', containerId);
                return null;
            }

            // Destroy existing Leaflet instance if container is already initialized
            if (el._leaflet_id && L.DomUtil.get(el)) {
                try {
                    const oldMap = el._leaflet_map;
                    if (oldMap && typeof oldMap.remove === 'function') oldMap.remove();
                } catch (e) {
                    console.warn('[SysMapAPI] Could not destroy previous map instance:', e);
                }
            }

            const providerKey = options.tileProvider || (document.body.classList.contains('dark-mode') ? 'carto_dark' : 'osm');
            const provider = TILE_PROVIDERS[providerKey] || TILE_PROVIDERS.osm;

            const center = options.center || DEFAULT_CONFIG.center;
            const zoom = options.zoom || DEFAULT_CONFIG.defaultZoom;

            const map = L.map(el, {
                center: center,
                zoom: zoom,
                minZoom: options.minZoom || DEFAULT_CONFIG.minZoom,
                maxZoom: options.maxZoom || DEFAULT_CONFIG.maxZoom,
                zoomControl: options.zoomControl !== undefined ? options.zoomControl : true,
                attributionControl: options.attributionControl !== undefined ? options.attributionControl : true,
                ...options.leafletOptions
            });

            // Add tile layer
            const tileLayer = L.tileLayer(provider.url, {
                attribution: provider.attribution,
                maxZoom: provider.maxZoom,
                subdomains: 'abcd'
            }).addTo(map);

            // Store active tile layer reference on map instance
            map._sysTileLayer = tileLayer;
            map._sysTileProviderKey = providerKey;
            el._leaflet_map = map;

            // Handle invalidation after initialization
            setTimeout(() => { map.invalidateSize(true); }, 150);
            setTimeout(() => { map.invalidateSize(true); }, 500);

            return map;
        },

        /**
         * Switch active tile layer on an existing map instance.
         * @param {L.Map} map 
         * @param {string} providerKey ('osm'|'esri'|'carto_light'|'carto_dark'|'opentopo')
         */
        switchTileProvider: function (map, providerKey) {
            if (!map || !TILE_PROVIDERS[providerKey]) return;
            if (map._sysTileLayer) {
                map.removeLayer(map._sysTileLayer);
            }
            const provider = TILE_PROVIDERS[providerKey];
            map._sysTileLayer = L.tileLayer(provider.url, {
                attribution: provider.attribution,
                maxZoom: provider.maxZoom,
                subdomains: 'abcd'
            }).addTo(map);
            map._sysTileProviderKey = providerKey;
        },

        /**
         * Safely trigger container resize recalibration.
         * @param {L.Map} map 
         */
        invalidateSize: function (map) {
            if (map && typeof map.invalidateSize === 'function') {
                setTimeout(() => map.invalidateSize(true), 50);
            }
        },

        // =========================================================================
        // 2. CUSTOM MARKER FACTORY
        // =========================================================================

        /**
         * Create a custom Truck Lorry marker icon with speed, name badge & status outline.
         */
        createTruckIcon: function (unit = {}) {
            const speed = Math.round(unit.speed || 0);
            const status = unit.status || (speed > 0 ? 'moving' : 'idle');
            const name = unit.name || 'Lorry';

            let color = '#00B37E'; // Green moving
            let stroke = '#007A54';
            let label = `${speed} km/h`;

            if (status === 'idle') {
                color = '#FFB300'; // Amber idle
                stroke = '#B37E00';
                label = 'Idle';
            } else if (status === 'offline') {
                color = '#64748B'; // Slate offline
                stroke = '#334155';
                label = 'Offline';
            }

            const html = `
                <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
                    <div style="
                        background: ${color};
                        color: ${status === 'offline' ? '#fff' : '#000'};
                        font-family: system-ui, -apple-system, sans-serif;
                        font-size: 10px;
                        font-weight: 800;
                        padding: 2px 7px;
                        border-radius: 10px;
                        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
                        border: 1.5px solid ${stroke};
                        white-space: nowrap;
                        margin-bottom: 3px;
                    ">${name} • ${label}</div>
                    <div style="
                        width: 34px;
                        height: 34px;
                        border-radius: 50%;
                        background: #ffffff;
                        border: 2.5px solid ${color};
                        box-shadow: 0 4px 14px rgba(0,0,0,0.4);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 18px;
                    ">🚛</div>
                </div>`;

            return L.divIcon({
                html: html,
                className: 'sys-map-truck-icon',
                iconSize: [40, 40],
                iconAnchor: [20, 40],
                popupAnchor: [0, -42]
            });
        },

        /**
         * Create a custom Distributor drop pin marker icon.
         */
        createDistributorIcon: function (isHovered = false) {
            const size = isHovered ? 36 : 30;
            const bg = isHovered ? '#D1001F' : '#0048B4';
            const html = `
                <div style="
                    width:${size}px; height:${size}px;
                    border-radius:50% 50% 50% 0;
                    transform:rotate(-45deg);
                    background:${bg};
                    box-shadow: 0 3px 10px rgba(0,0,0,0.35);
                    border: 2px solid #ffffff;
                    display:flex; align-items:center; justify-content:center;
                    transition: transform 0.2s ease, width 0.2s ease, height 0.2s ease;
                ">
                    <span style="transform:rotate(45deg); font-size:${size * 0.45}px;">🏢</span>
                </div>`;

            return L.divIcon({
                html: html,
                className: 'sys-map-distributor-icon',
                iconSize: [size, size],
                iconAnchor: [size / 2, size],
                popupAnchor: [0, -(size + 4)]
            });
        },

        /**
         * Create Start Depot marker pin icon (e.g., Enderamulla).
         */
        createStartIcon: function (options = {}) {
            const size = options.size || 44;
            const title = options.title || 'Start Point';
            const html = `
                <div style="
                    width:${size}px; height:${size}px;
                    border-radius:50% 50% 50% 0;
                    transform:rotate(-45deg);
                    background:#ffffff;
                    box-shadow: 0 4px 16px rgba(0,72,180,0.45);
                    border: 3px solid #0048B4;
                    display:flex; align-items:center; justify-content:center;
                ">
                    <span style="transform:rotate(45deg); font-size:${size * 0.5}px;">🏭</span>
                </div>`;

            return L.divIcon({
                html: html,
                className: 'sys-map-start-icon',
                iconSize: [size, size],
                iconAnchor: [size / 2, size],
                popupAnchor: [0, -(size + 4)]
            });
        },

        /**
         * Create numbered route stop marker icon.
         */
        createStopIcon: function (number) {
            const size = 32;
            const html = `
                <div style="
                    width:${size}px; height:${size}px;
                    border-radius: 50%;
                    background: #D1001F;
                    color: #ffffff;
                    font-family: system-ui, -apple-system, sans-serif;
                    font-weight: 800;
                    font-size: 13px;
                    border: 2px solid #ffffff;
                    box-shadow: 0 3px 10px rgba(209,0,31,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">${number}</div>`;

            return L.divIcon({
                html: html,
                className: 'sys-map-stop-icon',
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
                popupAnchor: [0, -(size / 2 + 4)]
            });
        },

        // =========================================================================
        // 3. GEOCODING ENGINE (NOMINATIM / OPENSTREETMAP)
        // =========================================================================

        /**
         * Queue and throttle reverse geocoding to strictly respect Nominatim's 1 req/sec limit.
         * @param {number} lat 
         * @param {number} lng 
         * @returns {Promise<Object>} Formatted address object
         */
        reverseGeocode: function (lat, lng) {
            return new Promise((resolve) => {
                const roundedLat = parseFloat(lat).toFixed(4);
                const roundedLng = parseFloat(lng).toFixed(4);
                const cacheKey = `${roundedLat},${roundedLng}`;

                if (reverseGeocodeCache.has(cacheKey)) {
                    return resolve(reverseGeocodeCache.get(cacheKey));
                }

                reverseGeocodeQueue.push({ lat, lng, cacheKey, resolve });
                SysMapAPI._processReverseGeocodeQueue();
            });
        },

        /**
         * Internal queue processing function for Nominatim reverse lookup.
         */
        _processReverseGeocodeQueue: function () {
            if (isProcessingGeocodeQueue || reverseGeocodeQueue.length === 0) return;
            isProcessingGeocodeQueue = true;

            const item = reverseGeocodeQueue.shift();
            const url = `${DEFAULT_CONFIG.nominatimServer}/reverse?format=jsonv2&lat=${item.lat}&lon=${item.lng}&email=${DEFAULT_CONFIG.contactEmail}`;

            fetch(url, {
                headers: { 'Accept-Language': 'en-US,en;q=0.9' }
            })
                .then(res => {
                    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    const addr = data.address || {};
                    const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || '';
                    const town = addr.town || addr.city || addr.village || addr.hamlet || addr.county || '';
                    let display = road + (road && town ? ', ' : '') + town;

                    if (!display && data.display_name) {
                        display = data.display_name.split(',').slice(0, 2).join(', ');
                    }
                    if (!display) display = 'Unknown Location';

                    const result = {
                        address: display,
                        fullAddress: data.display_name || display,
                        road: road,
                        town: town,
                        city: addr.city || town,
                        country: addr.country || 'Sri Lanka',
                        lat: parseFloat(data.lat || item.lat),
                        lng: parseFloat(data.lon || item.lng),
                        raw: data
                    };

                    reverseGeocodeCache.set(item.cacheKey, result);
                    item.resolve(result);
                })
                .catch(err => {
                    console.warn('[SysMapAPI] Reverse geocode error:', err);
                    const fallback = {
                        address: `${parseFloat(item.lat).toFixed(4)}, ${parseFloat(item.lng).toFixed(4)}`,
                        fullAddress: `Coordinates: ${item.lat}, ${item.lng}`,
                        lat: item.lat,
                        lng: item.lng,
                        isFallback: true
                    };
                    item.resolve(fallback);
                })
                .finally(() => {
                    // Wait 1.1s before processing next queue item to respect Nominatim policy
                    setTimeout(() => {
                        isProcessingGeocodeQueue = false;
                        SysMapAPI._processReverseGeocodeQueue();
                    }, 1100);
                });
        },

        /**
         * Forward Geocoding: Converts address/place name into coordinates using Nominatim.
         * @param {string} query 
         * @param {Object} options 
         * @returns {Promise<Array>} List of matching locations
         */
        geocode: async function (query, options = {}) {
            if (!query || !query.trim()) return [];
            const cleanQuery = query.trim().toLowerCase();

            if (geocodeQueryCache.has(cleanQuery)) {
                return geocodeQueryCache.get(cleanQuery);
            }

            try {
                let url = `${DEFAULT_CONFIG.nominatimServer}/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=${options.limit || 5}&email=${DEFAULT_CONFIG.contactEmail}`;
                
                // Restrict search bounds to Sri Lanka by default
                if (options.sriLankaOnly !== false) {
                    url += `&viewbox=${DEFAULT_CONFIG.sriLankaBBox}&bounded=1&countrycodes=lk`;
                }

                const res = await fetch(url, {
                    headers: { 'Accept-Language': 'en-US,en;q=0.9' }
                });
                if (!res.ok) throw new Error(`Nominatim search error HTTP ${res.status}`);

                const data = await res.json();
                const results = data.map(item => ({
                    name: item.display_name.split(',')[0],
                    fullName: item.display_name,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    type: item.type,
                    importance: item.importance,
                    raw: item
                }));

                geocodeQueryCache.set(cleanQuery, results);
                return results;
            } catch (err) {
                console.error('[SysMapAPI] Forward geocode error:', err);
                return [];
            }
        },

        /**
         * Attach dynamic address autocomplete search dropdown to any standard HTML input.
         * @param {HTMLInputElement|string} inputElement 
         * @param {Function} onSelectCallback 
         */
        attachAddressAutocomplete: function (inputElement, onSelectCallback) {
            const input = typeof inputElement === 'string' ? document.getElementById(inputElement) : inputElement;
            if (!input) return;

            // Wrap input if needed
            let wrap = input.parentElement;
            if (!wrap.classList.contains('sys-autocomplete-wrap')) {
                const newWrap = document.createElement('div');
                newWrap.className = 'sys-autocomplete-wrap';
                newWrap.style.position = 'relative';
                input.parentNode.insertBefore(newWrap, input);
                newWrap.appendChild(input);
                wrap = newWrap;
            }

            // Results dropdown
            let dropdown = wrap.querySelector('.sys-autocomplete-dropdown');
            if (!dropdown) {
                dropdown = document.createElement('div');
                dropdown.className = 'sys-autocomplete-dropdown';
                dropdown.style.cssText = `
                    position: absolute; top: 100%; left: 0; right: 0; z-index: 9999;
                    background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.15); max-height: 220px; overflow-y: auto;
                    display: none; margin-top: 4px;
                `;
                wrap.appendChild(dropdown);
            }

            let debounceTimer = null;

            input.addEventListener('input', function () {
                const q = this.value.trim();
                clearTimeout(debounceTimer);
                if (q.length < 3) {
                    dropdown.style.display = 'none';
                    return;
                }

                debounceTimer = setTimeout(async () => {
                    dropdown.innerHTML = '<div style="padding:10px; font-size:12px; color:#64748B;">🔍 Searching OpenStreetMap...</div>';
                    dropdown.style.display = 'block';

                    const results = await SysMapAPI.geocode(q);
                    if (results.length === 0) {
                        dropdown.innerHTML = '<div style="padding:10px; font-size:12px; color:#94a3b8;">No matching Sri Lankan places found.</div>';
                        return;
                    }

                    dropdown.innerHTML = '';
                    results.forEach(res => {
                        const item = document.createElement('div');
                        item.className = 'sys-autocomplete-item';
                        item.style.cssText = 'padding: 8px 12px; font-size: 13px; cursor: pointer; border-bottom: 1px solid #f1f5f9; color: #1e293b;';
                        item.innerHTML = `<strong>📍 ${res.name}</strong><br><span style="font-size:11px; color:#64748B;">${res.fullName}</span>`;

                        item.addEventListener('mouseover', () => item.style.background = '#f8fafc');
                        item.addEventListener('mouseout', () => item.style.background = '#ffffff');
                        item.addEventListener('click', () => {
                            input.value = res.fullName;
                            dropdown.style.display = 'none';
                            if (typeof onSelectCallback === 'function') {
                                onSelectCallback(res);
                            }
                        });
                        dropdown.appendChild(item);
                    });
                }, 350);
            });

            document.addEventListener('click', (e) => {
                if (!wrap.contains(e.target)) dropdown.style.display = 'none';
            });
        },

        // =========================================================================
        // 4. ROUTING ENGINE (OSRM & FALLBACKS)
        // =========================================================================

        /**
         * Calculate road route through multiple waypoints using OSRM.
         * @param {Array<Object>} waypoints Array of {lat, lng} objects
         * @param {Object} options Options like profile ('driving'|'cycling'|'walking'), excludeMotorway (boolean)
         * @returns {Promise<Object>} Route response with distance, duration, and coordinates
         */
        calculateRoute: async function (waypoints, options = {}) {
            if (!waypoints || waypoints.length < 2) {
                throw new Error('At least 2 waypoints are required for route calculation.');
            }

            const profile = options.profile || 'driving';
            const coordStr = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
            let excludeStr = options.excludeMotorway ? '&exclude=motorway' : '';

            // Strategy 1: OSRM Primary API Request
            try {
                const url = `${DEFAULT_CONFIG.osrmServer}/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson${excludeStr}`;
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);

                const data = await resp.json();
                if (!data.routes || data.routes.length === 0) throw new Error('No OSRM route found');

                const route = data.routes[0];
                const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

                return {
                    success: true,
                    provider: 'OSRM Engine',
                    distanceKm: (route.distance / 1000).toFixed(1),
                    durationMin: Math.round(route.duration / 60),
                    coordinates: coords,
                    waypoints: waypoints,
                    profile: profile
                };
            } catch (primaryErr) {
                console.warn('[SysMapAPI] Primary OSRM route calculation failed, trying fallback:', primaryErr);
            }

            // Strategy 2: OSRM Cycling profile fallback (naturally avoids expressways/motorways)
            try {
                const url = `${DEFAULT_CONFIG.osrmServer}/route/v1/cycling/${coordStr}?overview=full&geometries=geojson`;
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`OSRM cycling fallback HTTP ${resp.status}`);

                const data = await resp.json();
                if (!data.routes || data.routes.length === 0) throw new Error('No fallback cycling route');

                const route = data.routes[0];
                const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

                return {
                    success: true,
                    provider: 'OSRM Non-Expressway Engine',
                    distanceKm: (route.distance / 1000).toFixed(1),
                    durationMin: Math.round(route.duration / 60),
                    coordinates: coords,
                    waypoints: waypoints,
                    profile: 'cycling_fallback'
                };
            } catch (fallbackErr) {
                console.warn('[SysMapAPI] Secondary OSRM route calculation failed, using geodesic fallback:', fallbackErr);
            }

            // Strategy 3: Geodesic Straight-Line Fallback
            const coords = waypoints.map(w => [w.lat, w.lng]);
            let totalDistKm = 0;
            for (let i = 0; i < waypoints.length - 1; i++) {
                totalDistKm += SysMapAPI.calculateHaversineDistance(
                    waypoints[i].lat, waypoints[i].lng,
                    waypoints[i + 1].lat, waypoints[i + 1].lng
                );
            }

            return {
                success: true,
                provider: 'Geodesic Fallback',
                distanceKm: totalDistKm.toFixed(1),
                durationMin: Math.round((totalDistKm / 40) * 60), // approx 40 km/h avg speed
                coordinates: coords,
                waypoints: waypoints,
                isStraightLine: true
            };
        },

        /**
         * Render a calculated route polyline onto a Leaflet map.
         * @param {L.Map} map 
         * @param {Object} routeResult Object returned from SysMapAPI.calculateRoute
         * @param {Object} options Styling options
         * @returns {Array<L.Polyline>} Placed polyline layers
         */
        drawRouteOnMap: function (map, routeResult, options = {}) {
            if (!map || !routeResult || !routeResult.coordinates) return [];

            const coords = routeResult.coordinates;
            const outlineColor = options.outlineColor || '#ffffff';
            const routeColor = options.isStraightLine ? '#E07B00' : (options.color || '#D1001F');

            const layers = [];

            // Background outline glow
            const outline = L.polyline(coords, {
                color: outlineColor,
                weight: options.weight ? options.weight + 4 : 9,
                opacity: 0.35,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(map);
            layers.push(outline);

            // Core line
            const line = L.polyline(coords, {
                color: routeColor,
                weight: options.weight || 5,
                opacity: options.opacity || 0.88,
                dashArray: routeResult.isStraightLine ? '10, 8' : null,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(map);
            layers.push(line);

            if (options.fitBounds !== false) {
                map.fitBounds(line.getBounds(), { padding: options.padding || [40, 40] });
            }

            return layers;
        },

        // =========================================================================
        // 5. UTILITY FUNCTIONS & MAP LINK GENERATORS
        // =========================================================================

        /**
         * Calculate Haversine distance in KM between two Lat/Lng coordinates.
         */
        calculateHaversineDistance: function (lat1, lon1, lat2, lon2) {
            const R = 6371; // Radius of the Earth in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        },

        /**
         * Format Google Maps single point location link.
         */
        getGoogleMapsLink: function (lat, lng, label = '') {
            return `https://www.google.com/maps?q=${lat},${lng}${label ? `+(${encodeURIComponent(label)})` : ''}`;
        },

        /**
         * Format multi-stop Google Maps driving directions link (with highway avoidance option).
         */
        getMultiStopDirectionsLink: function (startCoord, stopCoords = [], avoidHighways = true) {
            if (!startCoord) return '';
            let url = `https://www.google.com/maps/dir/?api=1&origin=${startCoord.lat},${startCoord.lng}`;

            if (stopCoords.length > 0) {
                const destination = stopCoords[stopCoords.length - 1];
                url += `&destination=${destination.lat},${destination.lng}`;

                if (stopCoords.length > 1) {
                    const waypoints = stopCoords.slice(0, stopCoords.length - 1).map(s => `${s.lat},${s.lng}`).join('|');
                    url += `&waypoints=${waypoints}`;
                }
            }

            url += '&travelmode=driving';
            if (avoidHighways) url += '&avoid=highways';

            return url;
        }
    };

    // Export SysMapAPI to global window space
    global.SysMapAPI = SysMapAPI;

})(typeof window !== 'undefined' ? window : this);
