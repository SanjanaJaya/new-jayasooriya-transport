// ============================================================
//  VEHICLE TRACKER — Wialon GPS Live Tracking Module
//  Connects to Wialon Remote API via REST to fetch vehicle
//  positions, speed, and status data. Renders on Leaflet map
//  with auto-refresh capability.
// ============================================================

(function () {
    'use strict';

    // ── State ──
    let trackerMap = null;
    let trackerMarkers = {};  // {unitId: L.marker}
    let trackerUnits = [];    // Array of parsed unit data
    let trackerRefreshTimer = null;
    let trackerConnected = false;
    let trackerSessionId = null;
    let trackerInitialized = false;
    let trackerMapFirstFit = true;
    let trackerDrivers = [];       // Drivers fetched from staff list section
    let trackerAssignments = [];   // Staff lorry assignments
    let trackerShowDistributors = false; // Toggle state for distributor markers on map
    let trackerDistributorMarkers = [];  // Distributor map markers
    let trackerDistributors = [];        // Cache of distributors

    async function fetchDistributors() {
        try {
            if (typeof supabaseClient === 'undefined') return;
            var userId = typeof getQueryUserId === 'function' ? getQueryUserId() : null;
            if (!userId) return;

            var { data } = await supabaseClient.from('kd_distributors').select('*').eq('user_id', userId);
            trackerDistributors = data || [];
        } catch (e) {
            console.error('Error fetching distributors for tracker map:', e);
        }
    }

    function createDistributorMarkerIcon() {
        var size = 38;
        var html = '<div style="' +
            'width:' + size + 'px; height:' + size + 'px;' +
            'border-radius:50% 50% 50% 0;' +
            'transform:rotate(-45deg);' +
            'background:#fff;' +
            'box-shadow: 0 3px 10px rgba(0,0,0,0.35);' +
            'border: 2.5px solid #D1001F;' +
            'display:flex; align-items:center; justify-content:center;' +
            'transition: all 0.2s;' +
            '">' +
            '<img src="https://i.postimg.cc/pTbqBcdz/idm2DKn-i-I.png" style="' +
            'width:' + (size * 0.62) + 'px; height:' + (size * 0.62) + 'px;' +
            'transform:rotate(45deg); object-fit:contain;' +
            'border-radius:50%;" />' +
            '</div>';
        return L.divIcon({
            html: html,
            className: '',
            iconSize:   [size, size],
            iconAnchor: [size / 2, size],
            popupAnchor: [0, -(size + 4)],
        });
    }

    function updateDistributorMarkersOnMap() {
        if (!trackerMap) return;

        // Clear existing distributor markers
        trackerDistributorMarkers.forEach(function (m) {
            trackerMap.removeLayer(m);
        });
        trackerDistributorMarkers = [];

        // If toggled off, we are done
        if (!trackerShowDistributors) return;

        // Otherwise, add them
        trackerDistributors.forEach(function (d) {
            if (!d.lat || !d.lng) return;

            var markerIcon = createDistributorMarkerIcon();
            var popupContent = '<div class="tracker-map-popup" style="font-family:\'DM Sans\', sans-serif; min-width:180px;">' +
                '<div class="popup-name" style="font-family:\'Barlow Condensed\', sans-serif; font-size:16px; font-weight:700; color:#1A1D24; margin-bottom:6px; display:flex; align-items:center; gap:6px;">👤 ' + d.distributor_name + '</div>' +
                '<div class="popup-detail" style="font-size:12px; color:#6B7280; line-height:1.6;">' +
                '📍 <strong>' + d.town_name + '</strong><br>' +
                '🌐 Coordinates: ' + d.lat.toFixed(5) + ', ' + d.lng.toFixed(5) +
                '</div>' +
                '</div>';

            var m = L.marker([d.lat, d.lng], { icon: markerIcon })
                .bindPopup(popupContent);
            
            m.addTo(trackerMap);
            trackerDistributorMarkers.push(m);
        });
    }

    async function fetchDriversAndAssignments() {
        try {
            if (typeof supabaseClient === 'undefined') return;
            var userId = typeof getQueryUserId === 'function' ? getQueryUserId() : null;
            if (!userId) return;

            var pDrivers = supabaseClient.from('drivers').select('*').eq('user_id', userId).neq('terminated', true);
            var pAssignments = supabaseClient.from('staff_lorry_assignments').select('*').eq('user_id', userId);

            var results = await Promise.all([pDrivers, pAssignments]);
            trackerDrivers = results[0].data || [];
            trackerAssignments = results[1].data || [];
        } catch (e) {
            console.error('Error fetching drivers/assignments for tracker:', e);
        }
    }

    function buildPopupHtml(unit) {
        var speedColor;
        if (unit.speed <= 0) {
            speedColor = '#6B7280';
        } else if (unit.speed < 60) {
            speedColor = '#00B878';
        } else if (unit.speed <= 90) {
            speedColor = '#FFA000';
        } else {
            speedColor = '#e74c3c';
        }
        
        var baseName = typeof extractBaseVehicleName === 'function' ? extractBaseVehicleName(unit.name) : unit.name.trim().toUpperCase();
        var assignment = trackerAssignments.find(function(a) { 
            var aLorry = typeof extractBaseVehicleName === 'function' ? extractBaseVehicleName(a.lorry_number) : a.lorry_number.trim().toUpperCase();
            return aLorry === baseName; 
        });
        var driver = assignment ? trackerDrivers.find(function(d) { return d.id === assignment.driver_id; }) : null;
        
        var nickname = driver ? (typeof getNickname === 'function' ? getNickname(driver.name) : '') : '';
        var driverName = driver 
            ? (typeof cleanDriverName === 'function' ? cleanDriverName(driver.name) : driver.name) + (nickname ? ' (' + nickname + ')' : '')
            : 'Not Assigned';
        var driverPhotoHtml = driver && driver.photo_url 
            ? '<img src="' + driver.photo_url + '" style="width:30px; height:30px; border-radius:50%; object-fit:cover; border:1px solid #eee; flex-shrink:0;">'
            : '<div style="width:30px; height:30px; border-radius:50%; background:#f0f2f5; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; color:#95a5a6; border: 1.5px dashed #ccc;">👤</div>';

        return '<div class="tracker-map-popup" style="font-family:\'DM Sans\', sans-serif; min-width:180px;">' +
            '<div class="popup-name" style="font-family:\'Barlow Condensed\', sans-serif; font-size:16px; font-weight:700; color:#1A1D24; margin-bottom:6px; display:flex; align-items:center; gap:6px;">🚛 ' + unit.name + '</div>' +
            '<div class="popup-speed" style="font-size:22px; font-weight:800; margin-bottom:4px; color:' + speedColor + '">' + Math.round(unit.speed) + ' km/h</div>' +
            '<div class="popup-detail" style="font-size:12px; color:#6B7280; line-height:1.6;">' +
            '📍 <strong>' + (unit.address || 'Loading location...') + '</strong><br>' +
            '<div class="popup-driver-row" style="display:flex; align-items:center; gap:8px; margin: 8px 0; padding: 6px 0; border-top: 1px solid var(--surface-border, #eee); border-bottom: 1px solid var(--surface-border, #eee);">' +
            driverPhotoHtml +
            '<div style="display:flex; flex-direction:column;">' +
            '<span style="font-size:9px; text-transform:uppercase; color:#95a5a6; font-weight:bold; letter-spacing:0.5px;">Assigned Driver</span>' +
            '<span style="font-size:11px; font-weight:bold; color:#2c3e50;">' + driverName + '</span>' +
            '</div>' +
            '</div>' +
            '📡 ' + unit.satellites + ' satellites<br>' +
            '⏱️ ' + timeAgo(unit.lastTime) +
            '</div>' +
            '<div class="popup-coords" style="font-size:11px; color:#9CA3AF; margin-top:4px; font-family:monospace;">' + unit.lat.toFixed(5) + ', ' + unit.lng.toFixed(5) + '</div>' +
            '</div>';
    }

    // Reverse Geocoding Cache & Queue
    const TRACKER_ADDRESS_CACHE_KEY = 'jt_tracker_addresses';
    let trackerAddressCache = {};
    let geocodeQueue = [];
    let geocodeProcessing = false;

    function loadAddressCache() {
        try {
            var raw = localStorage.getItem(TRACKER_ADDRESS_CACHE_KEY);
            if (raw) trackerAddressCache = JSON.parse(raw);
        } catch (e) {}
    }

    function saveAddressCache() {
        try {
            localStorage.setItem(TRACKER_ADDRESS_CACHE_KEY, JSON.stringify(trackerAddressCache));
        } catch (e) {}
    }

    function queueGeocode(unit) {
        if (geocodeQueue.some(function(item) { return item.id === unit.id; })) return;
        geocodeQueue.push({ id: unit.id, lat: unit.lat, lng: unit.lng });
        
        if (!geocodeProcessing) {
            geocodeProcessing = true;
            setTimeout(processGeocodeQueue, 100);
        }
    }

    async function processGeocodeQueue() {
        if (geocodeQueue.length === 0) {
            geocodeProcessing = false;
            return;
        }

        var item = geocodeQueue.shift();
        
        try {
            var response = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + item.lat + '&lon=' + item.lng + '&email=jayasooriyatransport@gmail.com');
            var data = await response.json();
            
            var addr = data.address || {};
            var road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || "";
            var town = addr.town || addr.city || addr.village || addr.hamlet || addr.county || "";
            var displayAddr = road + (road && town ? ", " : "") + town;
            
            if (!displayAddr && data.display_name) {
                displayAddr = data.display_name.split(',').slice(0, 2).join(', ');
            }
            if (!displayAddr) {
                displayAddr = "Unknown Location";
            }

            trackerAddressCache[item.id] = {
                lat: item.lat,
                lng: item.lng,
                address: displayAddr
            };
            saveAddressCache();

            // Update in-memory unit
            var unit = trackerUnits.find(function(u) { return u.id === item.id; });
            if (unit) {
                unit.address = displayAddr;
                
                // Update marker popup dynamically
                if (trackerMarkers[unit.id]) {
                    var popupContent = buildPopupHtml(unit);
                    trackerMarkers[unit.id].setPopupContent(popupContent);
                }

                // Update specific card's address directly in DOM to avoid full list refresh
                var grid = document.getElementById('trackerVehicleGrid');
                if (grid) {
                    var card = grid.querySelector('.tracker-vehicle-card[data-unit-id="' + unit.id + '"]');
                    if (card) {
                        var addrVal = card.querySelector('.tracker-card-address-value');
                        if (addrVal) {
                            addrVal.textContent = displayAddr;
                            addrVal.setAttribute('title', displayAddr);
                        }
                    }
                }
            }
            
        } catch (e) {
            console.error('Error geocoding unit:', item.id, e);
            geocodeQueue.push(item);
        }

        setTimeout(processGeocodeQueue, 1200);
    }

    const TRACKER_STORAGE_KEY = 'jt_tracker_config';
    const OFFLINE_THRESHOLD = 30 * 60; // 30 minutes in seconds

    // ── Settings Load/Save ──
    function getTrackerConfig() {
        try {
            const raw = localStorage.getItem(TRACKER_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (!parsed.token) {
                    parsed.token = '2dc41f89a60d68ba8fd0a5e34722386f728895444F6CEE221D45222A43B65B5606DE57A0';
                }
                return parsed;
            }
        } catch (e) { }
        return { 
            server: 'hst-api.wialon.com', 
            token: '2dc41f89a60d68ba8fd0a5e34722386f728895444F6CEE221D45222A43B65B5606DE57A0', 
            interval: 30 
        };
    }

    function saveTrackerConfig(config) {
        try { localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(config)); } catch (e) { }
    }

    // ── Auto Import Token from URL ──
    function checkUrlForToken() {
        try {
            var urlParams = new URLSearchParams(window.location.search);
            var token = urlParams.get('access_token');
            if (token) {
                var config = getTrackerConfig();
                config.token = token.trim();
                saveTrackerConfig(config);

                // Clean up URL parameters (remove access_token, user_name, etc.)
                var cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);

                if (typeof showToast === 'function') {
                    showToast('🛰️ Wialon token automatically imported!', 'success');
                }
            }
        } catch (e) {
            console.error('Error auto-importing token:', e);
        }
    }

    // ── UI Helpers ──
    function setConnStatus(connected, text) {
        trackerConnected = connected;
        const dot = document.getElementById('trackerConnDot');
        const txt = document.getElementById('trackerConnText');
        if (dot) dot.className = 'tracker-conn-dot' + (connected ? ' connected' : '');
        if (txt) txt.textContent = text || (connected ? 'Connected' : 'Disconnected');
    }

    function setLastUpdate() {
        const el = document.getElementById('trackerLastUpdate');
        if (el) {
            const now = new Date();
            el.textContent = 'Last update: ' + now.toLocaleTimeString();
        }
    }

    function timeAgo(unixTimestamp) {
        if (!unixTimestamp) return 'Unknown';
        const now = Math.floor(Date.now() / 1000);
        const diff = now - unixTimestamp;
        if (diff < 0) return 'Just now';
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    function getSpeedClass(speed) {
        if (speed <= 0) return 'speed-zero';
        if (speed < 60) return 'speed-normal';
        if (speed <= 90) return 'speed-fast';
        return 'speed-danger';
    }

    function getMotionStatus(unit) {
        const now = Math.floor(Date.now() / 1000);
        const timeSince = unit.lastTime ? (now - unit.lastTime) : Infinity;

        if (timeSince > OFFLINE_THRESHOLD) return 'offline';
        if (unit.speed > 0) return 'moving';
        return 'idle';
    }

    // ── Initialize Map ──
    function initTrackerMap() {
        if (trackerMap) {
            trackerMap.invalidateSize();
            return;
        }

        const mapEl = document.getElementById('trackerMap');
        if (!mapEl) return;

        // Default center: Sri Lanka
        trackerMap = L.map('trackerMap', {
            center: [7.8731, 80.7718],
            zoom: 8,
            zoomControl: true,
            attributionControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(trackerMap);

        // Fix map rendering after page switch
        setTimeout(function () { if (trackerMap) trackerMap.invalidateSize(); }, 300);
    }

    // ── Connect to Wialon via SDK ──
    function connectWialon() {
        return new Promise((resolve) => {
            const config = getTrackerConfig();
            if (!config.token) {
                setConnStatus(false, 'No API token configured');
                showTrackerSettings();
                resolve(false);
                return;
            }

            setConnStatus(false, 'Connecting...');

            try {
                // Ensure wialon SDK is loaded
                if (typeof wialon === 'undefined' || !wialon.core || !wialon.core.Session) {
                    setConnStatus(false, '❌ Wialon SDK not loaded');
                    if (typeof showToast === 'function') showToast('Wialon SDK failed to load. Check internet connection.', 'error');
                    resolve(false);
                    return;
                }

                var session = wialon.core.Session.getInstance();
                var protocol = 'https://';
                var serverUrl = config.server;
                // If serverUrl doesn't have protocol, add it
                if (serverUrl.indexOf('http://') !== 0 && serverUrl.indexOf('https://') !== 0) {
                    serverUrl = protocol + serverUrl;
                }
                try {
                    session.initSession(serverUrl);
                } catch (initErr) {
                    console.log('Session already initialized, skipping initSession:', initErr.message);
                }

                session.loginToken(config.token, "", function (code) {
                    if (code) {
                        const errorMessages = {
                            1: 'Invalid session',
                            2: 'Invalid service name',
                            3: 'Invalid result',
                            4: 'Invalid input',
                            7: 'Access denied — check token permissions',
                            8: 'Invalid token — please regenerate',
                            1003: 'Token has expired — regenerate a new one'
                        };
                        var errorText = wialon.core.Errors.getErrorText(code) || ('Wialon error code: ' + code);
                        var msg = errorMessages[code] || errorText;
                        setConnStatus(false, '❌ ' + msg);
                        if (typeof showToast === 'function') showToast(msg, 'error');
                        resolve(false);
                    } else {
                        trackerSessionId = session.getId();
                        var user = session.getCurrUser();
                        var userName = user ? user.getName() : 'Wialon';
                        setConnStatus(true, 'Connected as ' + userName);
                        if (typeof showToast === 'function') showToast('🛰️ Connected to Wialon!', 'success');
                        resolve(true);
                    }
                });
            } catch (err) {
                console.error('Wialon connection error:', err);
                setConnStatus(false, '❌ Connection failed');
                if (typeof showToast === 'function') showToast('Failed to connect to Wialon: ' + err.message, 'error');
                resolve(false);
            }
        });
    }

    // ── Fetch Units with Positions via SDK ──
    function fetchTrackerUnits() {
        return new Promise((resolve) => {
            try {
                if (typeof wialon === 'undefined' || !wialon.core || !wialon.core.Session) {
                    resolve([]);
                    return;
                }

                var session = wialon.core.Session.getInstance();
                var params = {
                    spec: {
                        itemsType: 'avl_unit',
                        propName: 'sys_name',
                        propValueMask: '*',
                        sortType: 'sys_name'
                    },
                    force: 1,
                    flags: 1025, // 1 (base) + 1024 (last position)
                    from: 0,
                    to: 0
                };

                var remote = wialon.core.Remote.getInstance();
                var callback = function (code, data) {
                    if (code) {
                        console.error('Error fetching units:', code);
                        if (code === 1) {
                            // Session expired — try to reconnect
                            setConnStatus(false, 'Session expired, reconnecting...');
                            connectWialon().then(function (reconnected) {
                                if (reconnected) {
                                    fetchTrackerUnits().then(resolve);
                                } else {
                                    resolve([]);
                                }
                            });
                        } else {
                            resolve([]);
                        }
                        return;
                    }

                    var items = (data && data.items) ? data.items : [];
                    var parsedUnits = items.map(function (item) {
                        var pos = item.pos || {};
                        var unitId = item.id;
                        var lat = pos.y || 0;
                        var lng = pos.x || 0;
                        var hasPos = !!(pos.y && pos.x);

                        // Load address from cache if matching position
                        var cachedAddr = "No location data";
                        if (hasPos) {
                            var cached = trackerAddressCache[unitId];
                            if (cached && Math.abs(cached.lat - lat) + Math.abs(cached.lng - lng) < 0.0005) {
                                cachedAddr = cached.address;
                            } else {
                                cachedAddr = (cached && cached.address) ? cached.address : "Loading location...";
                                // Queue geocoding request
                                queueGeocode({ id: unitId, lat: lat, lng: lng });
                            }
                        }

                        return {
                            id: unitId,
                            name: item.nm || 'Unknown',
                            lat: lat,
                            lng: lng,
                            speed: pos.s || 0,
                            course: pos.c || 0,
                            satellites: pos.sc || 0,
                            lastTime: pos.t || 0,
                            hasPosition: hasPos,
                            address: cachedAddr
                        };
                    });
                    resolve(parsedUnits);
                };

                remote.remoteCall("core/search_items", params, callback);
            } catch (err) {
                console.error('Error in fetchTrackerUnits:', err);
                resolve([]);
            }
        });
    }

    // Slide transition animation for Leaflet markers
    function slideMarkerTo(marker, toLatLng, duration) {
        if (marker._animFrameId) {
            cancelAnimationFrame(marker._animFrameId);
        }
        
        var start = performance.now();
        var fromLatLng = marker.getLatLng();
        var fromLat = fromLatLng.lat;
        var fromLng = fromLatLng.lng;
        var toLat = Array.isArray(toLatLng) ? toLatLng[0] : toLatLng.lat;
        var toLng = Array.isArray(toLatLng) ? toLatLng[1] : toLatLng.lng;
        
        if (fromLat === toLat && fromLng === toLng) return;
        
        var distance = Math.sqrt(Math.pow(toLat - fromLat, 2) + Math.pow(toLng - fromLng, 2));
        if (distance > 0.5) {
            marker.setLatLng([toLat, toLng]);
            return;
        }
        
        function step(timestamp) {
            var elapsed = timestamp - start;
            var progress = Math.min(elapsed / duration, 1);
            var easeProgress = progress * (2 - progress);
            
            var currentLat = fromLat + (toLat - fromLat) * easeProgress;
            var currentLng = fromLng + (toLng - fromLng) * easeProgress;
            marker.setLatLng([currentLat, currentLng]);
            
            if (progress < 1) {
                marker._animFrameId = requestAnimationFrame(step);
            } else {
                marker._animFrameId = null;
            }
        }
        
        marker._animFrameId = requestAnimationFrame(step);
    }

    // ── Render Map Markers ──
    function renderTrackerMap(units) {
        if (!trackerMap) initTrackerMap();
        if (!trackerMap) return;

        var validUnits = units.filter(function (u) { return u.hasPosition; });

        // Remove old markers that no longer exist
        Object.keys(trackerMarkers).forEach(function (id) {
            if (!validUnits.find(function (u) { return u.id == id; })) {
                trackerMap.removeLayer(trackerMarkers[id]);
                delete trackerMarkers[id];
            }
        });

        validUnits.forEach(function (unit) {
            var status = getMotionStatus(unit);
            var markerClass = 'marker-' + status;

            var arrowHtml = '';
            if (status === 'moving') {
                arrowHtml = '<div class="tracker-marker-arrow-wrap" style="transform: rotate(' + (unit.course || 0) + 'deg);">' +
                    '<svg class="tracker-marker-arrow" viewBox="0 0 24 24">' +
                    '<path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" />' +
                    '</svg>' +
                    '</div>';
            }

            // Simplified marker with vehicle number label & direction arrow
            var iconHtml = '<div class="tracker-marker-icon ' + markerClass + '">' +
                arrowHtml +
                '<span class="tracker-marker-lorry">🚛</span>' +
                '<div class="tracker-marker-label">' + unit.name + '</div>' +
                '</div>';
            var customIcon = L.divIcon({
                html: iconHtml,
                className: 'tracker-marker-wrapper',
                iconSize: [38, 38],
                iconAnchor: [19, 19],
                popupAnchor: [0, -22]
            });

            var popupContent = buildPopupHtml(unit);

            if (trackerMarkers[unit.id]) {
                // Update existing marker position smoothly
                slideMarkerTo(trackerMarkers[unit.id], [unit.lat, unit.lng], 1500);
                trackerMarkers[unit.id].setIcon(customIcon);
                trackerMarkers[unit.id].setPopupContent(popupContent);
            } else {
                // Create new marker
                var marker = L.marker([unit.lat, unit.lng], { icon: customIcon })
                    .bindPopup(popupContent)
                    .addTo(trackerMap);
                trackerMarkers[unit.id] = marker;
            }
        });

        // Fit map to show all markers (only on first load)
        if (validUnits.length > 0 && trackerMapFirstFit) {
            var bounds = L.latLngBounds(validUnits.map(function (u) { return [u.lat, u.lng]; }));
            trackerMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
            trackerMapFirstFit = false;
        }

        // Make sure Kevilton distributor markers match the toggle state
        updateDistributorMarkersOnMap();
    }

    // Helper to create a new card element
    function createCardElement(unit, i) {
        var card = document.createElement('div');
        card.dataset.unitId = unit.id;
        
        // Build card skeleton with placeholders to be updated by patchCard
        card.innerHTML = '<div class="tracker-card-header">' +
            '<span class="tracker-card-name">🚛 ' + unit.name + '</span>' +
            '<span class="tracker-status-badge"></span>' +
            '</div>' +
            '<div class="tracker-card-speed-wrapper" style="display:flex; align-items:center; gap:12px; margin-bottom:10px; width:100%;">' +
            '<div class="tracker-driver-face-container" style="width:38px; height:38px;"></div>' +
            '<div class="tracker-card-speed" style="display:flex; flex-direction:column; flex:1; min-width:0;">' +
            '<div style="display:flex; align-items:center; justify-content:space-between; width:100%;">' +
            '<div style="display:flex; align-items:baseline; gap:6px;">' +
            '<span class="tracker-speed-value" style="font-family:\'Barlow Condensed\', sans-serif; font-size:32px; font-weight:900; line-height:1;"></span>' +
            '<span class="tracker-speed-unit" style="font-size:12px; font-weight:600; color:var(--text-muted);">km/h</span>' +
            '</div>' +
            '<span class="tracker-engine-status"></span>' +
            '</div>' +
            '<div class="tracker-speed-meter-bar" style="background:var(--surface-border); height:6px; border-radius:3px; overflow:hidden; margin-top:6px; width:100%;">' +
            '<div style="height:100%; transition:width 0.5s ease;"></div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="tracker-card-address">' +
            '<span class="tracker-card-address-icon">📍</span>' +
            '<span class="tracker-card-address-value"></span>' +
            '</div>' +
            '<div class="tracker-card-details">' +
            // Driver Detail Row
            '<div class="tracker-detail-row">' +
            '<span class="detail-icon">👤</span>' +
            '<span class="detail-text">Driver</span>' +
            '<span class="detail-value" style="font-weight:700; color:var(--text-primary);"></span>' +
            '</div>' +
            '<div class="tracker-detail-row">' +
            '<span class="detail-icon">\uD83D\uDCCD</span>' +
            '<span class="detail-text">Position</span>' +
            '<span class="detail-value"></span>' +
            '</div>' +
            '<div class="tracker-detail-row">' +
            '<span class="detail-icon">\uD83E\uDDED</span>' +
            '<span class="detail-text">Course</span>' +
            '<span class="detail-value"></span>' +
            '</div>' +
            '<div class="tracker-detail-row">' +
            '<span class="detail-icon">\uD83D\uDCE1</span>' +
            '<span class="detail-text">Satellites</span>' +
            '<span class="detail-value"></span>' +
            '</div>' +
            '</div>' +
            '<div class="tracker-time-ago">' +
            '<span class="live-dot"></span>' +
            '<span class="time-ago-text"></span>' +
            '</div>';

        // Add event listener to fly to map
        card.addEventListener('click', function () {
            var latestUnit = trackerUnits.find(function (u) { return String(u.id) === String(card.dataset.unitId); });
            if (latestUnit && latestUnit.hasPosition && trackerMap) {
                trackerMap.flyTo([latestUnit.lat, latestUnit.lng], 15, { duration: 1.2 });
                if (trackerMarkers[latestUnit.id]) {
                    trackerMarkers[latestUnit.id].openPopup();
                }
                var mapEl = document.getElementById('trackerMap');
                if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        // Prevent CSS keyframe animations from re-triggering when card is moved in the DOM
        card.addEventListener('animationend', function () {
            card.style.animation = 'none';
        }, { once: true });

        // Patch initial data
        patchCard(card, unit, i);
        return card;
    }

    // Helper to update card content in-place without rebuilding DOM
    function patchCard(card, unit, i) {
        var status = getMotionStatus(unit);
        
        var targetClassName = 'tracker-vehicle-card status-' + status;
        if (card.className !== targetClassName) {
            card.className = targetClassName;
        }
        
        // 1. Update status badge
        var badge = card.querySelector('.tracker-status-badge');
        if (badge) {
            var badgeClass = status === 'moving' ? 'badge-moving' : status === 'idle' ? 'badge-idle' : 'badge-offline';
            var badgeText = status === 'moving' ? '\u25CF Moving' : status === 'idle' ? '\u25CF Idle' : '\u25CF Offline';
            
            if (badge.dataset.status !== status) {
                badge.className = 'tracker-status-badge ' + badgeClass;
                badge.textContent = badgeText;
                badge.dataset.status = status;
            }
        }
        
        // 2. Update speed value & class
        var speedVal = card.querySelector('.tracker-speed-value');
        if (speedVal) {
            var speedClass = 'speed-zero';
            if (unit.speed > 0) {
                if (unit.speed < 60) speedClass = 'speed-normal';
                else if (unit.speed <= 90) speedClass = 'speed-fast';
                else speedClass = 'speed-danger';
            }
            
            if (speedVal.dataset.speedClass !== speedClass) {
                speedVal.className = 'tracker-speed-value ' + speedClass;
                speedVal.dataset.speedClass = speedClass;
            }
            
            var roundedSpeed = String(Math.round(unit.speed));
            if (speedVal.textContent !== roundedSpeed) {
                speedVal.textContent = roundedSpeed;
            }
        }
        
        // 3. Update engine status
        var engineStatus = card.querySelector('.tracker-engine-status');
        if (engineStatus) {
            var engineStatusText = '';
            var engineStatusColor = '';
            var engineStatusBg = '';
            if (status === 'offline') {
                engineStatusText = 'Engine Stopped';
                engineStatusColor = '#e74c3c';
                engineStatusBg = 'rgba(231, 76, 60, 0.1)';
            } else if (status === 'idle') {
                engineStatusText = 'Start Idle';
                engineStatusColor = '#FFA000';
                engineStatusBg = 'rgba(255, 160, 0, 0.1)';
            } else {
                engineStatusText = 'Engine Running';
                engineStatusColor = '#00B878';
                engineStatusBg = 'rgba(0, 184, 120, 0.1)';
            }
            
            if (engineStatus.dataset.statusText !== engineStatusText) {
                engineStatus.textContent = engineStatusText;
                engineStatus.style.color = engineStatusColor;
                engineStatus.style.background = engineStatusBg;
                engineStatus.dataset.statusText = engineStatusText;
            }
        }
        
        // 4. Update speed meter bar
        var speedBar = card.querySelector('.tracker-speed-meter-bar div');
        if (speedBar) {
            var speedPct = Math.min((unit.speed / 120) * 100, 100) + '%';
            var meterColor;
            if (unit.speed <= 0 || status === 'idle' || status === 'offline') {
                meterColor = '#6B7280';
            } else if (unit.speed < 60) {
                meterColor = '#00B878';
            } else if (unit.speed <= 90) {
                meterColor = '#FFA000';
            } else {
                meterColor = '#e74c3c';
            }
            
            if (speedBar.dataset.widthPct !== speedPct) {
                speedBar.style.width = speedPct;
                speedBar.dataset.widthPct = speedPct;
            }
            
            if (speedBar.dataset.color !== meterColor) {
                speedBar.style.backgroundColor = meterColor;
                speedBar.dataset.color = meterColor;
            }
        }
        
        // 5. Update Address
        var addrVal = card.querySelector('.tracker-card-address-value');
        if (addrVal) {
            var displayAddr = unit.address || 'Loading location...';
            if (addrVal.textContent !== displayAddr) {
                addrVal.textContent = displayAddr;
                addrVal.setAttribute('title', displayAddr);
            }
        }
        
        // 6. Update Driver assigned
        var baseName = typeof extractBaseVehicleName === 'function' ? extractBaseVehicleName(unit.name) : unit.name.trim().toUpperCase();
        var assignment = trackerAssignments.find(function(a) { 
            var aLorry = typeof extractBaseVehicleName === 'function' ? extractBaseVehicleName(a.lorry_number) : a.lorry_number.trim().toUpperCase();
            return aLorry === baseName; 
        });
        var driver = assignment ? trackerDrivers.find(function(d) { return d.id === assignment.driver_id; }) : null;
        
        var targetDriverId = driver ? String(driver.id) : '';
        if (card.dataset.driverId !== targetDriverId) {
            card.dataset.driverId = targetDriverId;
            
            var nickname = driver ? (typeof getNickname === 'function' ? getNickname(driver.name) : '') : '';
            var driverName = driver 
                ? (typeof cleanDriverName === 'function' ? cleanDriverName(driver.name) : driver.name) + (nickname ? ' (' + nickname + ')' : '')
                : 'Not Assigned';
                
            var detailRows = card.querySelectorAll('.tracker-detail-row');
            if (detailRows && detailRows.length >= 4) {
                var driverVal = detailRows[0].querySelector('.detail-value');
                if (driverVal) driverVal.textContent = driverName;
            }
            
            // Driver photo
            var imgContainer = card.querySelector('.tracker-driver-face-container');
            if (imgContainer) {
                if (driver && driver.photo_url) {
                    var currentImg = imgContainer.querySelector('img');
                    if (!currentImg) {
                        currentImg = document.createElement('img');
                        currentImg.className = 'tracker-driver-photo';
                        currentImg.onerror = function() { this.style.display = 'none'; };
                        imgContainer.innerHTML = '';
                        imgContainer.appendChild(currentImg);
                    }
                    currentImg.src = driver.photo_url;
                    currentImg.style.display = '';
                    
                    imgContainer.style.border = '1.5px solid var(--surface-border, #eee)';
                    imgContainer.style.background = '#f0f2f5';
                } else {
                    imgContainer.innerHTML = '👤';
                    imgContainer.style.border = 'none';
                    imgContainer.style.background = 'transparent';
                }
            }
        }
        
        var detailRows = card.querySelectorAll('.tracker-detail-row');
        if (detailRows && detailRows.length >= 4) {
            // Position
            var posVal = detailRows[1].querySelector('.detail-value');
            var posText = unit.hasPosition ? unit.lat.toFixed(4) + ', ' + unit.lng.toFixed(4) : 'No data';
            if (posVal && posVal.textContent !== posText) posVal.textContent = posText;
            
            // Course
            var courseVal = detailRows[2].querySelector('.detail-value');
            var courseText = unit.course + '\u00B0';
            if (courseVal && courseVal.textContent !== courseText) courseVal.textContent = courseText;
            
            // Satellites
            var satVal = detailRows[3].querySelector('.detail-value');
            var satText = String(unit.satellites);
            if (satVal && satVal.textContent !== satText) satVal.textContent = satText;
        }
        
        // 7. Update time-ago dot & text
        var liveDot = card.querySelector('.tracker-time-ago .live-dot');
        if (liveDot) {
            var isOnline = status !== 'offline';
            if (isOnline) {
                if (liveDot.classList.contains('offline')) liveDot.classList.remove('offline');
            } else {
                if (!liveDot.classList.contains('offline')) liveDot.classList.add('offline');
            }
        }
        
        var timeText = card.querySelector('.time-ago-text');
        if (timeText) {
            var targetTime = timeAgo(unit.lastTime);
            if (timeText.textContent !== targetTime) timeText.textContent = targetTime;
        }
    }

    // ── Render Vehicle Cards ──
    function renderTrackerCards(units) {
        var grid = document.getElementById('trackerVehicleGrid');
        var emptyState = document.getElementById('trackerEmptyState');
        var searchInput = document.getElementById('trackerSearchInput');
        var statusFilter = document.getElementById('trackerStatusFilter');

        if (!grid) return;

        var searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
        var statusVal = statusFilter ? statusFilter.value : 'all';

        var filtered = units.map(function (unit) {
            return Object.assign({}, unit, { status: getMotionStatus(unit) });
        });

        if (searchTerm) {
            filtered = filtered.filter(function (u) {
                return u.name.toLowerCase().indexOf(searchTerm) !== -1;
            });
        }
        if (statusVal !== 'all') {
            filtered = filtered.filter(function (u) { return u.status === statusVal; });
        }

        // Sort alphabetically/numerically by vehicle name so displaying order is completely static
        filtered.sort(function (a, b) {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Hide emptyState initially
        if (emptyState) emptyState.style.display = 'none';

        if (units.length === 0) {
            grid.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = '';
                grid.appendChild(emptyState);
            }
            return;
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">No vehicles match your filter</div>';
            return;
        }

        // Remove any full-grid messages or loading blocks if they exist
        var matchFilterEl = grid.querySelector('div[style*="grid-column"]');
        var loadingEl = grid.querySelector('.tracker-loading');
        if (matchFilterEl || loadingEl) {
            grid.innerHTML = '';
        }

        // In-place DOM updates & sorting
        filtered.forEach(function (unit, i) {
            var card = grid.querySelector('.tracker-vehicle-card[data-unit-id="' + unit.id + '"]');
            if (card) {
                patchCard(card, unit, i);
            } else {
                card = createCardElement(unit, i);
            }
            
            // Only move/insert element in the DOM if it's not already in the correct position.
            // This prevents re-triggering of animations or layout recalculations.
            if (grid.children[i] !== card) {
                grid.insertBefore(card, grid.children[i] || null);
            }
        });

        // Remove cards that are no longer filtered/matching
        var activeIds = filtered.map(function (u) { return String(u.id); });
        Array.from(grid.querySelectorAll('.tracker-vehicle-card')).forEach(function (card) {
            if (activeIds.indexOf(card.dataset.unitId) === -1) {
                card.remove();
            }
        });
    }

    // ── Render Stats Strip ──
    function renderTrackerStats(units) {
        var total = units.length;
        var online = 0, moving = 0, idle = 0, offline = 0;

        units.forEach(function (unit) {
            var status = getMotionStatus(unit);
            if (status === 'moving') { moving++; online++; }
            else if (status === 'idle') { idle++; online++; }
            else { offline++; }
        });

        var setText = function (id, val) {
            var el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setText('trackerTotalCount', total);
        setText('trackerOnlineCount', online);
        setText('trackerMovingCount', moving);
        setText('trackerIdleCount', idle);
        setText('trackerOfflineCount', offline);
    }

    // ── Refresh Data ──
    async function refreshTrackerData() {
        if (!trackerSessionId) {
            console.log('Skipping refresh: No active trackerSessionId.');
            return;
        }

        try {
            console.log('Fetching live vehicle positions from Wialon...');
            await fetchDriversAndAssignments();
            var units = await fetchTrackerUnits();
            trackerUnits = units;

            renderTrackerStats(units);
            renderTrackerMap(units);
            renderTrackerCards(units);
            setLastUpdate();
            console.log('Vehicle data successfully updated. Total units:', units.length);
        } catch (err) {
            console.error('Error during vehicle data refresh:', err);
        }
    }

    // ── Start/Stop Auto-Refresh ──
    function startTrackerRefresh() {
        stopTrackerRefresh();
        var config = getTrackerConfig();
        var interval = (config.interval || 30) * 1000;

        console.log('Starting auto-refresh timer. Interval:', interval, 'ms');
        trackerRefreshTimer = setInterval(function () {
            refreshTrackerData();
        }, interval);
    }

    function stopTrackerRefresh() {
        if (trackerRefreshTimer) {
            console.log('Stopping auto-refresh timer.');
            clearInterval(trackerRefreshTimer);
            trackerRefreshTimer = null;
        }
    }

    // ── Show/Hide Settings Panel ──
    function showTrackerSettings() {
        var panel = document.getElementById('trackerSettingsPanel');
        if (panel) panel.style.display = 'block';
    }

    function hideTrackerSettings() {
        var panel = document.getElementById('trackerSettingsPanel');
        if (panel) panel.style.display = 'none';
    }

    // ── Native Browser Fullscreen Toggle ──
    function toggleBrowserFullscreen() {
        var el = document.getElementById('vehicle-tracker');
        if (!el) return;

        if (!document.fullscreenElement) {
            el.requestFullscreen().then(function() {
                setTimeout(function() {
                    if (trackerMap) trackerMap.invalidateSize();
                }, 300);
            }).catch(function(err) {
                console.error("Error enabling fullscreen:", err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // Monitor native fullscreen state changes
    document.addEventListener('fullscreenchange', function() {
        var el = document.getElementById('vehicle-tracker');
        var btn = document.getElementById('trackerFullscreenBtn');
        var exitFSBtn = document.getElementById('trackerExitFSBtn');
        
        if (document.fullscreenElement) {
            if (el) el.classList.add('fullscreen-active');
            if (btn) {
                btn.innerHTML = '✖ Exit Fullscreen';
                btn.style.background = 'var(--brand-red)';
            }
            if (exitFSBtn) exitFSBtn.style.display = 'block';
        } else {
            if (el) el.classList.remove('fullscreen-active');
            if (btn) {
                btn.innerHTML = '🖥️ Fullscreen';
                btn.style.background = 'var(--blue)';
            }
            if (exitFSBtn) exitFSBtn.style.display = 'none';
        }
        
        setTimeout(function() {
            if (trackerMap) trackerMap.invalidateSize();
        }, 300);
    });

    // ── Wire Up Events ──
    function wireTrackerEvents() {
        // Settings toggle
        var settingsToggle = document.getElementById('trackerSettingsToggle');
        if (settingsToggle) {
            settingsToggle.addEventListener('click', function () {
                var panel = document.getElementById('trackerSettingsPanel');
                if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            });
        }

        // Kevilton distributors toggle
        var kdToggleBtn = document.getElementById('trackerKDToggleBtn');
        if (kdToggleBtn) {
            kdToggleBtn.addEventListener('click', async function () {
                trackerShowDistributors = !trackerShowDistributors;
                if (trackerShowDistributors) {
                    kdToggleBtn.textContent = '🗺️ Hide Distributors';
                    kdToggleBtn.style.background = 'var(--brand-red, #e74c3c)';
                    if (trackerDistributors.length === 0) {
                        kdToggleBtn.disabled = true;
                        kdToggleBtn.textContent = '⌛ Loading...';
                        await fetchDistributors();
                        kdToggleBtn.disabled = false;
                        kdToggleBtn.textContent = '🗺️ Hide Distributors';
                    }
                } else {
                    kdToggleBtn.textContent = '🗺️ Show Distributors';
                    kdToggleBtn.style.background = 'var(--purple, #9B59B6)';
                }
                updateDistributorMarkersOnMap();
            });
        }

        // Setup button (empty state)
        var setupBtn = document.getElementById('trackerSetupBtn');
        if (setupBtn) setupBtn.addEventListener('click', showTrackerSettings);

        // Save settings & connect
        var saveBtn = document.getElementById('trackerSaveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async function () {
                var serverEl = document.getElementById('trackerServerUrl');
                var tokenEl = document.getElementById('trackerApiToken');
                var intervalEl = document.getElementById('trackerRefreshInterval');

                var server = (serverEl ? serverEl.value.trim() : '') || 'hst-api.wialon.com';
                var token = tokenEl ? tokenEl.value.trim() : '';
                var interval = parseInt(intervalEl ? intervalEl.value : '30') || 30;

                if (!token) {
                    if (typeof showToast === 'function') showToast('Please enter your API token', 'warning');
                    return;
                }

                saveTrackerConfig({ server: server, token: token, interval: interval });

                // Show loading
                var grid = document.getElementById('trackerVehicleGrid');
                var emptyState = document.getElementById('trackerEmptyState');
                if (emptyState) emptyState.style.display = 'none';
                if (grid) grid.innerHTML = '<div class="tracker-loading"><div class="tracker-spinner"></div> Connecting to Wialon...</div>';

                trackerSessionId = null;
                var success = await connectWialon();
                if (success) {
                    hideTrackerSettings();
                    trackerMapFirstFit = true;
                    await refreshTrackerData();
                    startTrackerRefresh();
                }
            });
        }

        // Clear token
        var clearBtn = document.getElementById('trackerClearTokenBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                saveTrackerConfig({ server: 'hst-api.wialon.com', token: '', interval: 30 });
                var tokenEl = document.getElementById('trackerApiToken');
                if (tokenEl) tokenEl.value = '';
                stopTrackerRefresh();
                trackerSessionId = null;
                setConnStatus(false, 'Disconnected');
                if (typeof showToast === 'function') showToast('Token cleared', 'info');

                // Clear map markers
                Object.values(trackerMarkers).forEach(function (m) { if (trackerMap) trackerMap.removeLayer(m); });
                trackerMarkers = {};

                // Reset UI
                var grid = document.getElementById('trackerVehicleGrid');
                var emptyState = document.getElementById('trackerEmptyState');
                if (emptyState) emptyState.style.display = '';
                if (grid) grid.innerHTML = '';
                if (emptyState && grid) grid.appendChild(emptyState);
                trackerMapFirstFit = true;
                renderTrackerStats([]);
            });
        }

        // Reconnect button
        var reconnectBtn = document.getElementById('trackerReconnectBtn');
        if (reconnectBtn) {
            reconnectBtn.addEventListener('click', async function () {
                trackerSessionId = null;
                var success = await connectWialon();
                if (success) {
                    trackerMapFirstFit = true;
                    await refreshTrackerData();
                    startTrackerRefresh();
                }
            });
        }

        // Copy token link
        var copyLinkBtn = document.getElementById('trackerCopyLinkBtn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', function () {
                var linkEl = document.getElementById('trackerTokenLink');
                if (linkEl) {
                    navigator.clipboard.writeText(linkEl.textContent).then(function () {
                        if (typeof showToast === 'function') showToast('Link copied!', 'success');
                    }).catch(function () {
                        // Fallback for older browsers
                        var range = document.createRange();
                        range.selectNode(linkEl);
                        window.getSelection().removeAllRanges();
                        window.getSelection().addRange(range);
                        document.execCommand('copy');
                        if (typeof showToast === 'function') showToast('Link copied!', 'success');
                    });
                }
            });
        }

        // Search & filter — live filtering
        var searchInput = document.getElementById('trackerSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                renderTrackerCards(trackerUnits);
            });
        }

        var statusFilter = document.getElementById('trackerStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', function () {
                renderTrackerCards(trackerUnits);
            });
        }

        // Fullscreen Toggle Event Listener
        var fullscreenBtn = document.getElementById('trackerFullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', toggleBrowserFullscreen);
        }

        var exitFSBtn = document.getElementById('trackerExitFSBtn');
        if (exitFSBtn) {
            exitFSBtn.addEventListener('click', toggleBrowserFullscreen);
        }

        // Zoom to Sri Lanka Map Button
        var zoomSLBtn = document.getElementById('trackerZoomSriLankaBtn');
        if (zoomSLBtn) {
            zoomSLBtn.addEventListener('click', function () {
                if (trackerMap) {
                    trackerMap.setView([7.8731, 80.7718], 7);
                }
            });
        }
    }

    // ── Main Init Function (called from switchPage) ──
    window.initVehicleTracker = async function () {
        // Load geocoded addresses from cache
        loadAddressCache();

        // Fetch drivers and assignments from Supabase
        await fetchDriversAndAssignments();

        // Initialize map
        initTrackerMap();
        setTimeout(function () { if (trackerMap) trackerMap.invalidateSize(); }, 500);

        // Wire events only once
        if (!trackerInitialized) {
            wireTrackerEvents();
            trackerInitialized = true;
        }

        // Load saved config into UI
        var config = getTrackerConfig();
        var serverInput = document.getElementById('trackerServerUrl');
        var tokenInput = document.getElementById('trackerApiToken');
        var intervalSelect = document.getElementById('trackerRefreshInterval');

        if (serverInput && config.server) serverInput.value = config.server;
        if (tokenInput && config.token) tokenInput.value = config.token;
        if (intervalSelect && config.interval) intervalSelect.value = String(config.interval);

        // Dynamically configure Wialon token link
        var tokenLinkEl = document.getElementById('trackerTokenLink');
        var tokenLinkAnchor = document.getElementById('trackerTokenLinkAnchor');
        if (tokenLinkEl) {
            var currentOrigin = window.location.protocol + "//" + window.location.host + window.location.pathname;
            var finalUrl = 'https://hst-api.wialon.com/login.html?client_id=JayasooriyaTransport&access_type=0x100&duration=0&redirect_uri=' + encodeURIComponent(currentOrigin) + '&flags=0x1';
            tokenLinkEl.textContent = finalUrl;
            if (tokenLinkAnchor) {
                tokenLinkAnchor.href = finalUrl;
            }
        }

        // Auto-connect if token exists
        if (config.token && !trackerSessionId) {
            var grid = document.getElementById('trackerVehicleGrid');
            var emptyState = document.getElementById('trackerEmptyState');
            if (emptyState) emptyState.style.display = 'none';
            if (grid) grid.innerHTML = '<div class="tracker-loading"><div class="tracker-spinner"></div> Connecting to Wialon...</div>';

            var success = await connectWialon();
            if (success) {
                await refreshTrackerData();
                startTrackerRefresh();
            } else {
                if (grid) grid.innerHTML = '';
                if (emptyState) {
                    emptyState.style.display = '';
                    if (grid) grid.appendChild(emptyState);
                }
            }
        } else if (trackerSessionId) {
            // Already connected, just refresh
            await refreshTrackerData();
        } else {
            // No token — show empty state and settings
            showTrackerSettings();
        }
    };

    // Auto-check URL for token on page load
    checkUrlForToken();
})();
