/* ============================================================
   JAYASOORIYA TRANSPORT — MOBILE LORRY TRACKER JS ENGINE
   Handles Wialon live GPS tracking, 90-day fuel efficiency calculations,
   Supabase driver/vehicle metadata, mobile device location, map view,
   and interactive bottom drawer.
   ============================================================ */

(function () {
    'use strict';

    // ── State Variables ──
    let trackerMap = null;
    let trackerMarkers = {};        // { unitId: L.marker }
    let trackerUnits = [];          // Live parsed units
    let userMobileLocation = null;  // { lat, lng }
    let userMobileMarker = null;

    let activeStatusFilter = 'all';
    let activeSearchQuery = '';

    let trackerSessionId = null;
    let trackerAddressCache = {};
    let geocodeQueue = [];
    let geocodeProcessing = false;

    let driverAssignments = [];
    let driverProfiles = [];
    let vehicleVectorArts = {};
    let vehicleModels = {};
    let vehicleLengths = {};
    let vehicleFuelLitresMap = {};
    let vehicleFuelKmMap = {};
    let fuelCalcInProgress = false;
    let lastFuelCalcTime = 0;
    const FUEL_CALC_TTL = 5 * 60 * 1000; // 5 minutes cache

    const TRACKER_CONFIG_KEY = 'jt_tracker_config';
    const TRACKER_ADDR_KEY = 'jt_tracker_addresses';
    const DEFAULT_TOKEN = '2dc41f89a60d68ba8fd0a5e34722386f728895444F6CEE221D45222A43B65B5606DE57A0';

    // Supabase Configuration
    const SUPABASE_URL = 'https://slmqjqkpgdhrdcoempdv.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbXFqcWtwZ2RocmRjb2VtcGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3OTg4NzUsImV4cCI6MjA3NjM3NDg3NX0.mXDMuhn0K5sOKhwykhf9OcomUzSVkCGnN5jr60A-TSw';

    // Initialize Supabase Client
    let supabaseClient = null;
    if (typeof window.supabase !== 'undefined') {
        try {
            var url = window.SUPABASE_URL || SUPABASE_URL;
            var key = window.SUPABASE_KEY || SUPABASE_KEY;
            supabaseClient = window.supabase.createClient(url, key);
        } catch (e) {
            console.warn('Supabase init warning:', e);
        }
    }

    // ── Helper Utilities ──
    function getTrackerConfig() {
        try {
            var raw = localStorage.getItem(TRACKER_CONFIG_KEY);
            if (raw) {
                var p = JSON.parse(raw);
                if (!p.token) p.token = DEFAULT_TOKEN;
                return p;
            }
        } catch (e) { }
        return { server: 'hst-api.wialon.com', token: DEFAULT_TOKEN, interval: 25 };
    }

    function saveTrackerConfig(cfg) {
        try { localStorage.setItem(TRACKER_CONFIG_KEY, JSON.stringify(cfg)); } catch (e) { }
    }

    function cleanVehicleKey(str) {
        if (!str || typeof str !== 'string') return '';
        var clean = str.trim().toUpperCase().replace(/\(.*?\)/g, '').replace(/OTHER/g, '').replace(/HIRE/g, '').trim();
        var match = clean.match(/([A-Z0-9]{2,4}[\s\-]?\d{3,4})/);
        if (match) {
            return match[0].replace(/[\s\-_]/g, '');
        }
        return clean.replace(/[\s\-_]/g, '');
    }

    function timeAgo(unixSec) {
        if (!unixSec) return 'Unknown';
        var now = Math.floor(Date.now() / 1000);
        var diff = now - unixSec;
        if (diff < 30) return 'Just now';
        if (diff < 60) return Math.floor(diff) + 's ago';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    function calcDistanceKm(lat1, lon1, lat2, lon2) {
        var R = 6371;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(1);
    }

    // ── Geocoding Queue ──
    function loadAddressCache() {
        try {
            var raw = localStorage.getItem(TRACKER_ADDR_KEY);
            if (raw) trackerAddressCache = JSON.parse(raw);
        } catch (e) { }
    }

    function saveAddressCache() {
        try { localStorage.setItem(TRACKER_ADDR_KEY, JSON.stringify(trackerAddressCache)); } catch (e) { }
    }

    function queueGeocode(unit) {
        if (geocodeQueue.some(function (item) { return item.id === unit.id; })) return;
        if (geocodeQueue.length >= 30) geocodeQueue.shift();
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
            var res = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + item.lat + '&lon=' + item.lng + '&email=jayasooriyatransport@gmail.com');
            var data = await res.json();
            var addr = data.address || {};
            var road = addr.road || addr.suburb || addr.neighbourhood || '';
            var town = addr.town || addr.city || addr.village || addr.county || '';
            var display = road + (road && town ? ', ' : '') + town;
            if (!display && data.display_name) display = data.display_name.split(',').slice(0, 2).join(', ');
            display = display || 'Location unavailable';

            trackerAddressCache[item.id] = { lat: item.lat, lng: item.lng, address: display };
            saveAddressCache();

            var u = trackerUnits.find(function (x) { return x.id === item.id; });
            if (u) {
                u.address = display;
                updateUnitAddressInDOM(u);
            }
        } catch (e) { }
        setTimeout(processGeocodeQueue, 1200);
    }

    function updateUnitAddressInDOM(unit) {
        var card = document.querySelector('.lorry-card[data-id="' + unit.id + '"]');
        if (card) {
            var addrEl = card.querySelector('.card-address-text');
            if (addrEl) addrEl.textContent = unit.address;
        }
    }

    // ── Wialon API Connection & Data Fetching ──
    function setConnStatus(connected, text) {
        var dot = document.getElementById('connDot');
        var txt = document.getElementById('connText');
        if (dot) dot.className = 'conn-dot' + (connected ? ' connected' : '');
        if (txt) txt.textContent = text || (connected ? 'Connected' : 'Disconnected');
    }

    function connectWialon() {
        return new Promise(function (resolve) {
            var cfg = getTrackerConfig();
            if (!cfg.token) {
                setConnStatus(false, 'No token set');
                resolve(false);
                return;
            }

            setConnStatus(false, 'Connecting...');

            try {
                if (typeof wialon === 'undefined' || !wialon.core || !wialon.core.Session) {
                    setConnStatus(false, 'SDK loading...');
                    resolve(false);
                    return;
                }

                var session = wialon.core.Session.getInstance();
                var srv = cfg.server.startsWith('http') ? cfg.server : 'https://' + cfg.server;
                try { session.initSession(srv); } catch (e) { }

                var login = function () {
                    session.loginToken(cfg.token, '', function (code) {
                        if (code) {
                            setConnStatus(false, 'Login error: ' + code);
                            resolve(false);
                        } else {
                            trackerSessionId = session.getId();
                            setConnStatus(true, 'Live Connected');
                            resolve(true);
                        }
                    });
                };

                if (session.getId()) {
                    session.logout(function () { login(); });
                } else {
                    login();
                }
            } catch (err) {
                setConnStatus(false, 'Connection failed');
                resolve(false);
            }
        });
    }

    function fetchTrackerUnits() {
        return new Promise(function (resolve) {
            try {
                if (typeof wialon === 'undefined' || !wialon.core || !wialon.core.Session) return resolve([]);
                var session = wialon.core.Session.getInstance();
                var remote = wialon.core.Remote.getInstance();

                var params = {
                    spec: { itemsType: 'avl_unit', propName: 'sys_name', propValueMask: '*', sortType: 'sys_name' },
                    force: 0,
                    flags: 9217, // 1 (base) + 1024 (pos) + 8192 (counters/mileage)
                    from: 0,
                    to: 0
                };

                remote.remoteCall('core/search_items', params, function (code, data) {
                    if (code) {
                        if (code === 1) connectWialon().then(function (ok) { if (ok) fetchTrackerUnits().then(resolve); });
                        else resolve([]);
                        return;
                    }

                    var items = (data && data.items) ? data.items : [];
                    var parsed = items.map(function (item) {
                        var pos = item.pos || {};
                        var lat = pos.y || 0;
                        var lng = pos.x || 0;
                        var hasPos = !!(pos.y && pos.x);

                        var cachedAddr = 'No position';
                        if (hasPos) {
                            var cached = trackerAddressCache[item.id];
                            if (cached && Math.abs(cached.lat - lat) + Math.abs(cached.lng - lng) < 0.0005) {
                                cachedAddr = cached.address;
                            } else {
                                cachedAddr = (cached && cached.address) ? cached.address : 'Locating address...';
                                queueGeocode({ id: item.id, lat: lat, lng: lng });
                            }
                        }

                        return {
                            id: item.id,
                            name: item.nm || 'Unknown Lorry',
                            lat: lat,
                            lng: lng,
                            speed: Math.round(pos.s || 0),
                            course: pos.c || 0,
                            satellites: pos.sc || 0,
                            lastTime: pos.t || 0,
                            hasPos: hasPos,
                            cnm: item.cnm || 0,
                            address: cachedAddr
                        };
                    });

                    // Cleanup session memory flags
                    if (data && data.searchSpec) {
                        remote.remoteCall('core/update_data_flags', {
                            spec: [{ type: 'type', data: 'avl_unit', flags: 9217, mode: 2 }]
                        }, function () { });
                    }

                    resolve(parsed);
                });
            } catch (e) { resolve([]); }
        });
    }

    // ── Driver & Vehicle DB Metadata (Session Restore & Stripped Vehicle Keys) ──
    async function loadDatabaseMetadata() {
        if (!supabaseClient) return;
        try {
            try { await supabaseClient.auth.getSession(); } catch (e) { }

            var now = new Date();
            var past30 = new Date(now.getTime() - (30 * 86400 * 1000));
            var startDateStr = past30.toISOString().split('T')[0];
            var endDateStr = now.toISOString().split('T')[0];

            var [resDrivers, resAssigns, resHireVeh, resCommitVeh, resHireRec, resCommitRec, resOtherRec] = await Promise.all([
                supabaseClient.from('drivers').select('*'),
                supabaseClient.from('staff_lorry_assignments').select('*'),
                supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, vector_art_url, vehicle_model, length'),
                supabaseClient.from('commitment_vehicles').select('id, vehicle_number, vector_art_url, vehicle_model, length'),
                supabaseClient.from('hire_to_pay_records').select('vehicle_id, fuel_litres').gte('hire_date', startDateStr).lte('hire_date', endDateStr),
                supabaseClient.from('commitment_records').select('vehicle_id, fuel_litres').gte('hire_date', startDateStr).lte('hire_date', endDateStr),
                supabaseClient.from('other_operation_hires').select('base_lorry_number, fuel_litres').gte('hire_date', startDateStr).lte('hire_date', endDateStr)
            ]);

            driverProfiles = (resDrivers && resDrivers.data) ? resDrivers.data : [];
            driverAssignments = (resAssigns && resAssigns.data) ? resAssigns.data : [];

            var hVehMap = {};
            var cVehMap = {};

            ((resHireVeh && resHireVeh.data) ? resHireVeh.data : []).forEach(function (v) {
                var key = cleanVehicleKey(v.lorry_number);
                hVehMap[v.id] = key;
                if (v.vector_art_url) vehicleVectorArts[key] = v.vector_art_url;
                if (v.vehicle_model) vehicleModels[key] = v.vehicle_model;
                if (v.length) vehicleLengths[key] = v.length;
            });

            ((resCommitVeh && resCommitVeh.data) ? resCommitVeh.data : []).forEach(function (v) {
                var key = cleanVehicleKey(v.vehicle_number);
                cVehMap[v.id] = key;
                if (v.vector_art_url) vehicleVectorArts[key] = v.vector_art_url;
                if (v.vehicle_model && !vehicleModels[key]) vehicleModels[key] = v.vehicle_model;
                if (v.length && !vehicleLengths[key]) vehicleLengths[key] = v.length;
            });

            // Aggregate Fuel Litres for Last 30 Days
            vehicleFuelLitresMap = {};
            var addFuel = function (baseKey, litres) {
                if (!baseKey) return;
                var key = cleanVehicleKey(baseKey);
                vehicleFuelLitresMap[key] = (vehicleFuelLitresMap[key] || 0) + (parseFloat(litres) || 0);
            };

            ((resHireRec && resHireRec.data) ? resHireRec.data : []).forEach(function (r) { addFuel(hVehMap[r.vehicle_id], r.fuel_litres); });
            ((resCommitRec && resCommitRec.data) ? resCommitRec.data : []).forEach(function (r) { addFuel(cVehMap[r.vehicle_id], r.fuel_litres); });
            ((resOtherRec && resOtherRec.data) ? resOtherRec.data : []).forEach(function (r) { addFuel(r.base_lorry_number, r.fuel_litres); });

            console.log('[DB Sync] Drivers:', driverProfiles.length, '| Assignments:', driverAssignments.length, '| Fuel Litres Map:', vehicleFuelLitresMap);
        } catch (e) {
            console.warn('[DB Sync] Error loading metadata:', e);
        }
    }

    // ── CHUNKED 30-DAY WIALON MILEAGE ENGINE (PREVENTS WIALON CODE 5 BUFFER OVERFLOW) ──
    function fetchUnitTripMileageForChunk(unitId, timeFromSec, timeToSec) {
        return new Promise(function (resolve) {
            if (typeof wialon === 'undefined' || !wialon.core || !wialon.core.Remote) {
                return resolve(0);
            }
            var remote = wialon.core.Remote.getInstance();
            var done = false;
            var timeout = setTimeout(function () {
                if (!done) {
                    done = true;
                    console.warn('[Mileage] Chunk timeout for unit:', unitId);
                    resolve(0);
                }
            }, 8000);

            // Step 1: Load max 10,000 position messages for chunk (prevents Wialon error code 5)
            remote.remoteCall('messages/load_interval', {
                itemId: unitId,
                timeFrom: timeFromSec,
                timeTo: timeToSec,
                flags: 0x0001,      // 0x0001 = position data messages only
                flagsMask: 0x0001,
                loadCount: 10000
            }, function (loadCode, loadData) {
                if (loadCode !== 0) {
                    console.warn('[Mileage] load_interval code:', loadCode, 'unit:', unitId);
                    if (!done) {
                        done = true;
                        clearTimeout(timeout);
                        resolve(0);
                    }
                    return;
                }

                var count = (loadData && loadData.count) ? loadData.count : 0;
                if (count === 0) {
                    remote.remoteCall('messages/unload', {}, function () {
                        if (!done) {
                            done = true;
                            clearTimeout(timeout);
                            resolve(0);
                        }
                    });
                    return;
                }

                // Step 2: Get trips for chunk
                remote.remoteCall('unit/get_trips', {
                    itemId: unitId,
                    msgsSource: 1,
                    timeFrom: timeFromSec,
                    timeTo: timeToSec
                }, function (tripsCode, trips) {
                    var totalMeters = 0;
                    if (tripsCode === 0 && Array.isArray(trips)) {
                        trips.forEach(function (t) { totalMeters += (t.m || 0); });
                    }

                    // Step 3: Unload session messages to free buffer
                    remote.remoteCall('messages/unload', {}, function () {
                        if (!done) {
                            done = true;
                            clearTimeout(timeout);
                            resolve(totalMeters);
                        }
                    });
                });
            });
        });
    }

    async function fetchUnitTripMileage30Days(unitId, totalTimeFromSec, totalTimeToSec) {
        // Break 30-day window into 3 x 10-day chunks to strictly prevent Wialon Error Code 5
        var chunkSize = 10 * 86400; // 10 days in seconds
        var totalMeters = 0;

        var curStart = totalTimeFromSec;
        while (curStart < totalTimeToSec) {
            var curEnd = Math.min(curStart + chunkSize, totalTimeToSec);
            var chunkMeters = await fetchUnitTripMileageForChunk(unitId, curStart, curEnd);
            totalMeters += chunkMeters;
            curStart = curEnd;
        }

        return Math.round(totalMeters / 1000);
    }

    async function loadFuelEfficiencyData(forceRefresh) {
        var bannerText = document.getElementById('backdateText');
        var now = new Date();
        var past30 = new Date(now.getTime() - (30 * 86400 * 1000)); // 30 days

        var timeFromSec = Math.floor(past30.getTime() / 1000);
        var timeToSec = Math.floor(now.getTime() / 1000);

        var startDateStr = past30.toISOString().split('T')[0];
        var endDateStr = now.toISOString().split('T')[0];

        if (bannerText) {
            bannerText.textContent = `Captured Last 30 Days: ${startDateStr} to ${endDateStr}`;
        }

        var tbody = document.getElementById('fuelTableBody');
        if (!tbody) return;

        if (trackerUnits.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Fetching GPS units...</td></tr>`;
            return;
        }

        // Return cached results if available and within TTL
        var nowMs = Date.now();
        if (!forceRefresh && (nowMs - lastFuelCalcTime < FUEL_CALC_TTL) && Object.keys(vehicleFuelKmMap).length > 0) {
            renderFuelTable(tbody);
            return;
        }

        // Prevent concurrent calculation loops
        if (fuelCalcInProgress) return;
        fuelCalcInProgress = true;

        try {
            // Fetch mileage for each unit SEQUENTIALLY using 10-day chunks
            for (var i = 0; i < trackerUnits.length; i++) {
                var unit = trackerUnits[i];
                var baseKey = cleanVehicleKey(unit.name);
                var km = await fetchUnitTripMileage30Days(unit.id, timeFromSec, timeToSec);
                vehicleFuelKmMap[baseKey] = km;
            }

            lastFuelCalcTime = Date.now();
            renderFuelTable(tbody);
        } catch (e) {
            console.error('[Fuel Engine] Error:', e);
        } finally {
            fuelCalcInProgress = false;
        }
    }

    function renderFuelTable(tbody) {
        var totalFleetKm = 0;
        var totalFleetFuel = 0;

        var rowsHtml = trackerUnits.map(function (unit) {
            var baseKey = cleanVehicleKey(unit.name);
            var fuelL = vehicleFuelLitresMap[baseKey] || 0;
            var kmVal = Math.round(vehicleFuelKmMap[baseKey] || 0);

            var kmpl = (kmVal > 0 && fuelL > 0) ? (kmVal / fuelL) : 0;

            totalFleetKm += kmVal;
            totalFleetFuel += fuelL;

            var badgeClass = 'kmpl-low';
            if (kmpl >= 4.0) badgeClass = 'kmpl-good';
            else if (kmpl >= 2.8) badgeClass = 'kmpl-avg';

            var kmplText = kmpl > 0 ? kmpl.toFixed(1) + ' km/L' : (fuelL === 0 ? 'No fuel record' : (kmVal === 0 ? 'No GPS trips' : '0.0 km/L'));

            return `
                <tr>
                    <td>
                        <strong style="color:var(--text-main); font-family:var(--font-display);">${unit.name}</strong>
                    </td>
                    <td>${kmVal.toLocaleString()} km</td>
                    <td>${fuelL > 0 ? fuelL.toFixed(0) + ' L' : '-'}</td>
                    <td>
                        <span class="kmpl-badge ${badgeClass}">${kmplText}</span>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml || `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No vehicle fuel analytics available.</td></tr>`;

        // Update KPI summaries
        var elKm = document.getElementById('kpiTotalKm');
        var elFuel = document.getElementById('kpiTotalFuel');
        var elAvg = document.getElementById('kpiFleetAvg');
        if (elKm) elKm.textContent = totalFleetKm.toLocaleString() + ' km';
        if (elFuel) elFuel.textContent = totalFleetFuel.toFixed(0) + ' L';
        if (elAvg) {
            var fleetKmpl = (totalFleetKm > 0 && totalFleetFuel > 0) ? (totalFleetKm / totalFleetFuel).toFixed(1) : '0.0';
            elAvg.textContent = fleetKmpl + ' km/L';
        }
    }
    window.loadFuelEfficiencyData = loadFuelEfficiencyData;

    // ── Leaflet Map Operations & Multi-Style Tile Provider ──
    let trackerTileLayer = null;
    let currentMapTileStyle = 'street'; // 'street' (default) | 'satellite' | 'dark'

    const MAP_TILE_PROVIDERS = {
        street: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            options: { maxZoom: 19, attribution: '&copy; Esri World Street Map' }
        },
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            options: { maxZoom: 19, attribution: '&copy; Esri World Imagery' }
        },
        dark: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            options: { maxZoom: 19, attribution: '&copy; Esri World Dark Gray' }
        }
    };

    function setMapTileStyle(styleName) {
        if (!trackerMap || !MAP_TILE_PROVIDERS[styleName]) return;
        currentMapTileStyle = styleName;
        if (trackerTileLayer) trackerMap.removeLayer(trackerTileLayer);

        var p = MAP_TILE_PROVIDERS[styleName];
        trackerTileLayer = L.tileLayer(p.url, p.options).addTo(trackerMap);
    }

    window.toggleMapTileStyle = function () {
        var styles = ['street', 'satellite', 'dark'];
        var idx = styles.indexOf(currentMapTileStyle);
        var next = styles[(idx + 1) % styles.length];
        setMapTileStyle(next);

        var btn = document.getElementById('mapTileToggleBtn');
        if (btn) {
            var label = next === 'street' ? '🗺️ Street' : (next === 'satellite' ? '🛰️ Sat' : '🌙 Dark');
            btn.innerHTML = label;
        }
    };

    function initTrackerMap() {
        if (trackerMap) {
            trackerMap.invalidateSize();
            return;
        }
        var container = document.getElementById('leafletTrackerMap');
        if (!container) return;

        trackerMap = L.map('leafletTrackerMap', {
            center: [7.8731, 80.7718],
            zoom: 8,
            zoomControl: false,
            attributionControl: true
        });

        setMapTileStyle('street');
    }

    function renderTrackerMap(units) {
        if (!trackerMap) initTrackerMap();
        if (!trackerMap) return;

        var valid = units.filter(function (u) { return u.hasPos; });

        // Remove obsolete markers
        Object.keys(trackerMarkers).forEach(function (id) {
            if (!valid.find(function (u) { return u.id == id; })) {
                trackerMap.removeLayer(trackerMarkers[id]);
                delete trackerMarkers[id];
            }
        });

        valid.forEach(function (unit) {
            var status = getMotionStatus(unit);
            var baseKey = cleanVehicleKey(unit.name);
            var vecArt = vehicleVectorArts[baseKey];
            var arrowAngle = unit.course || 0;

            var iconHtml = `
                <div class="custom-lorry-marker status-${status}">
                    ${status === 'moving' ? `<div class="marker-pulse-ring"></div>` : ''}
                    ${status === 'moving' ? `<div class="marker-heading-pointer" style="transform: rotate(${arrowAngle}deg);"><div class="heading-arrow"></div></div>` : ''}
                    <div class="marker-center-badge">
                        ${vecArt ? `<img src="${vecArt}" class="marker-art-img">` : `<span class="marker-emoji">🚛</span>`}
                    </div>
                    <div class="marker-glass-label">
                        <div class="label-name-row">
                            <span class="label-dot ${status}"></span>
                            <span class="label-name">${unit.name}</span>
                        </div>
                        <span class="label-speed ${status}">${status === 'moving' ? unit.speed + ' km/h' : (status === 'idle' ? 'IDLE' : 'OFFLINE')}</span>
                    </div>
                </div>
            `;

            var icon = L.divIcon({
                html: iconHtml,
                className: 'tracker-marker-wrapper',
                iconSize: [44, 44],
                iconAnchor: [22, 22]
            });

            if (trackerMarkers[unit.id]) {
                trackerMarkers[unit.id].setLatLng([unit.lat, unit.lng]);
                trackerMarkers[unit.id].setIcon(icon);
            } else {
                var m = L.marker([unit.lat, unit.lng], { icon: icon }).addTo(trackerMap);
                m.on('click', function () { openInspectorDrawer(unit.id); });
                trackerMarkers[unit.id] = m;
            }
        });
    }

    function getMotionStatus(unit) {
        var now = Math.floor(Date.now() / 1000);
        var diff = unit.lastTime ? (now - unit.lastTime) : 999999;
        if (diff > 1800) return 'offline';
        if (unit.speed > 0) return 'moving';
        return 'idle';
    }

    // ── User Mobile Geolocation ──
    window.locateUserMobile = function () {
        if (!navigator.geolocation) {
            alert('Geolocation not supported on this device/browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(function (pos) {
            userMobileLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (!trackerMap) initTrackerMap();
            if (trackerMap) {
                if (userMobileMarker) trackerMap.removeLayer(userMobileMarker);
                var icon = L.divIcon({
                    html: '<div class="user-location-pulse"></div>',
                    className: '',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });
                userMobileMarker = L.marker([userMobileLocation.lat, userMobileLocation.lng], { icon: icon }).addTo(trackerMap);
                trackerMap.setView([userMobileLocation.lat, userMobileLocation.lng], 13);
            }
            renderLorryCards();
        }, function (err) {
            alert('Unable to retrieve location: ' + err.message);
        });
    };

    window.fitMapToAllLorries = function () {
        if (!trackerMap) return;
        var valid = trackerUnits.filter(function (u) { return u.hasPos; });
        if (valid.length > 0) {
            var b = L.latLngBounds(valid.map(function (u) { return [u.lat, u.lng]; }));
            trackerMap.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
        }
    };

    // ── Lorry Card List View (FIXED: Driver Pairing) ──
    function renderLorryCards() {
        var container = document.getElementById('lorryGridContainer');
        if (!container) return;

        var filtered = trackerUnits.filter(function (u) {
            var status = getMotionStatus(u);
            if (activeStatusFilter !== 'all' && status !== activeStatusFilter) return false;
            if (activeSearchQuery && !u.name.toLowerCase().includes(activeSearchQuery.toLowerCase())) return false;
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<div class="state-container"><div class="state-icon">🔍</div><div>No lorries found matching search.</div></div>`;
            return;
        }

        var html = filtered.map(function (unit) {
            var status = getMotionStatus(unit);
            var baseKey = cleanVehicleKey(unit.name);
            var vecArt = vehicleVectorArts[baseKey];

            // Match driver assignment robustly
            var assign = driverAssignments.find(function (a) {
                return cleanVehicleKey(a.lorry_number) === baseKey;
            });
            var driver = assign ? driverProfiles.find(function (d) {
                return String(d.id) === String(assign.driver_id);
            }) : null;

            var driverName = driver ? driver.name : 'Unassigned';
            var driverPhoto = driver && driver.photo_url ? driver.photo_url : null;

            var distText = '';
            if (userMobileLocation && unit.hasPos) {
                var d = calcDistanceKm(userMobileLocation.lat, userMobileLocation.lng, unit.lat, unit.lng);
                distText = ` | 📍 ${d} km away`;
            }

            var statusLabel = status === 'moving' ? 'Moving' : (status === 'idle' ? 'Idle' : 'Offline');

            return `
                <div class="lorry-card" data-id="${unit.id}" onclick="openInspectorDrawer('${unit.id}')">
                    <div class="card-top-row">
                        <div class="lorry-title-wrap">
                            ${vecArt ? `<img src="${vecArt}" class="lorry-art-icon">` : `<div class="lorry-art-icon">🚛</div>`}
                            <div>
                                <div class="lorry-name">${unit.name}</div>
                                <div class="lorry-sub-details">⏱️ ${timeAgo(unit.lastTime)}${distText}</div>
                            </div>
                        </div>
                        <span class="status-badge ${status}">${statusLabel}</span>
                    </div>

                    <div class="card-middle-info">
                        <div class="info-item">
                            <span class="info-label">Speed</span>
                            <span class="info-val">${unit.speed} km/h</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Satellites</span>
                            <span class="info-val">📡 ${unit.satellites}</span>
                        </div>
                    </div>

                    <div class="card-address-row">
                        <span>📍</span>
                        <span class="card-address-text">${unit.address}</span>
                    </div>

                    <div class="card-driver-bar">
                        <div class="driver-info-mini">
                            ${driverPhoto ? `<img src="${driverPhoto}" class="driver-photo-mini">` : `<div class="driver-photo-mini" style="display:flex;align-items:center;justify-content:center;font-size:10px;">👤</div>`}
                            <span class="driver-name-text">${driverName}</span>
                        </div>
                        <button class="btn-action btn-secondary" style="height:30px; padding:0 10px; font-size:11px;" onclick="event.stopPropagation(); openInspectorDrawer('${unit.id}')">Details →</button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    // ── Bottom Sheet Drawer Inspector ──
    window.openInspectorDrawer = function (unitId) {
        var unit = trackerUnits.find(function (u) { return u.id == unitId; });
        if (!unit) return;

        var baseKey = cleanVehicleKey(unit.name);
        var assign = driverAssignments.find(function (a) { return cleanVehicleKey(a.lorry_number) === baseKey; });
        var driver = assign ? driverProfiles.find(function (d) { return String(d.id) === String(assign.driver_id); }) : null;

        var driverName = driver ? driver.name : 'Not Assigned';
        var driverPhone = driver && driver.phone ? driver.phone : '';
        var driverPhoto = driver && driver.photo_url ? driver.photo_url : '';

        var status = getMotionStatus(unit);

        var drawerContent = document.getElementById('drawerContent');
        if (drawerContent) {
            drawerContent.innerHTML = `
                <div class="drawer-header-row">
                    <div>
                        <h2 style="font-family:var(--font-display); font-size:18px; font-weight:800;">🚛 ${unit.name}</h2>
                        <div style="font-size:12px; color:var(--text-muted);">Coordinates: ${unit.lat.toFixed(5)}, ${unit.lng.toFixed(5)}</div>
                    </div>
                    <span class="status-badge ${status}">${status.toUpperCase()}</span>
                </div>

                <div class="card-middle-info" style="grid-template-columns:1fr 1fr 1fr; margin-top:6px;">
                    <div class="info-item">
                        <span class="info-label">Speed</span>
                        <span class="info-val" style="font-size:16px; color:var(--primary);">${unit.speed} km/h</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Satellites</span>
                        <span class="info-val">📡 ${unit.satellites}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Last Ping</span>
                        <span class="info-val">${timeAgo(unit.lastTime)}</span>
                    </div>
                </div>

                <div style="background:var(--bg-surface-elevated); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); font-size:12px;">
                    <strong style="color:var(--text-dim); text-transform:uppercase; font-size:10px;">Location Address</strong>
                    <div style="color:var(--text-main); margin-top:4px; font-weight:600;">📍 ${unit.address}</div>
                </div>

                <div style="display:flex; align-items:center; gap:12px; background:var(--bg-surface-elevated); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
                    ${driverPhoto ? `<img src="${driverPhoto}" style="width:44px; height:44px; border-radius:50%; object-fit:cover;">` : `<div style="width:44px; height:44px; border-radius:50%; background:var(--bg-glass); display:flex; align-items:center; justify-content:center; font-size:20px;">👤</div>`}
                    <div style="flex:1;">
                        <div style="font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase;">Assigned Driver</div>
                        <div style="font-size:14px; font-weight:800; color:var(--text-main);">${driverName}</div>
                        ${driverPhone ? `<div style="font-size:12px; color:var(--text-muted);">${driverPhone}</div>` : ''}
                    </div>
                    ${driverPhone ? `<a href="tel:${driverPhone}" class="btn-action btn-primary" style="height:36px; padding:0 12px; text-decoration:none;">📞 Call</a>` : ''}
                </div>

                <div class="drawer-action-grid">
                    <a href="https://www.google.com/maps/search/?api=1&query=${unit.lat},${unit.lng}" target="_blank" class="btn-action btn-primary" style="text-decoration:none;">
                        🗺️ Google Maps Navigation
                    </a>
                    <button class="btn-action btn-secondary" onclick="focusLorryOnMap('${unit.id}')">
                        🎯 Focus on Map
                    </button>
                </div>
            `;
        }

        document.getElementById('drawerBackdrop').classList.add('active');
        document.getElementById('inspectorDrawer').classList.add('active');
    };

    window.closeInspectorDrawer = function () {
        document.getElementById('drawerBackdrop').classList.remove('active');
        document.getElementById('inspectorDrawer').classList.remove('active');
    };

    window.focusLorryOnMap = function (unitId) {
        closeInspectorDrawer();
        switchTrackerTab('mapPage', document.querySelector('.nav-item[data-page="mapPage"]'));
        var unit = trackerUnits.find(function (u) { return u.id == unitId; });
        if (unit && trackerMap && unit.hasPos) {
            trackerMap.setView([unit.lat, unit.lng], 15);
        }
    };

    // ── Tab Navigation & Controls ──
    window.switchTrackerTab = function (pageId, btnEl) {
        document.querySelectorAll('.page-view').forEach(function (p) { p.classList.remove('active'); });
        document.querySelectorAll('.nav-item').forEach(function (b) { b.classList.remove('active'); });

        var target = document.getElementById(pageId);
        if (target) target.classList.add('active');
        if (btnEl) btnEl.classList.add('active');

        if (pageId === 'mapPage') {
            setTimeout(function () { if (trackerMap) trackerMap.invalidateSize(); }, 200);
        } else if (pageId === 'listPage') {
            renderLorryCards();
        } else if (pageId === 'fuelPage') {
            loadFuelEfficiencyData();
        }
    };

    window.filterByStatus = function (status, el) {
        activeStatusFilter = status;
        document.querySelectorAll('.stat-chip').forEach(function (c) { c.classList.remove('active'); });
        if (el) el.classList.add('active');
        renderLorryCards();
    };

    window.handleSearchInput = function (val) {
        activeSearchQuery = val;
        var btn = document.getElementById('clearSearchBtn');
        if (btn) btn.style.display = val ? 'block' : 'none';
        renderLorryCards();
    };

    window.clearSearch = function () {
        var input = document.getElementById('searchInput');
        if (input) input.value = '';
        activeSearchQuery = '';
        var btn = document.getElementById('clearSearchBtn');
        if (btn) btn.style.display = 'none';
        renderLorryCards();
    };

    window.toggleTrackerTheme = function () {
        document.body.classList.toggle('light-mode');
    };

    window.refreshTrackerData = async function () {
        var units = await fetchTrackerUnits();
        trackerUnits = units;

        // Update stats counters
        var moving = units.filter(function (u) { return getMotionStatus(u) === 'moving'; }).length;
        var idle = units.filter(function (u) { return getMotionStatus(u) === 'idle'; }).length;
        var offline = units.filter(function (u) { return getMotionStatus(u) === 'offline'; }).length;

        var elAll = document.getElementById('cntAll');
        var elMv = document.getElementById('cntMoving');
        var elId = document.getElementById('cntIdle');
        var elOf = document.getElementById('cntOffline');
        var elHud = document.getElementById('hudActiveCount');
        if (elAll) elAll.textContent = units.length;
        if (elMv) elMv.textContent = moving;
        if (elId) elId.textContent = idle;
        if (elOf) elOf.textContent = offline;
        if (elHud) elHud.textContent = moving + idle;

        renderTrackerMap(units);
        renderLorryCards();
        loadFuelEfficiencyData();
    };

    // ── Settings Modal ──
    window.showSettingsModal = function () {
        var cfg = getTrackerConfig();
        document.getElementById('cfgServer').value = cfg.server || '';
        document.getElementById('cfgToken').value = cfg.token || '';
        document.getElementById('settingsModal').style.display = 'flex';
    };

    window.closeSettingsModal = function () {
        document.getElementById('settingsModal').style.display = 'none';
    };

    window.saveSettingsForm = function () {
        var cfg = getTrackerConfig();
        cfg.server = document.getElementById('cfgServer').value.trim();
        cfg.token = document.getElementById('cfgToken').value.trim();
        saveTrackerConfig(cfg);
        closeSettingsModal();
        connectWialon().then(function () { refreshTrackerData(); });
    };

    // ── Initialization ──
    async function initApp() {
        loadAddressCache();
        initTrackerMap();
        await loadDatabaseMetadata();
        await connectWialon();
        await refreshTrackerData();

        var cfg = getTrackerConfig();
        var intervalMs = (cfg.interval || 25) * 1000;
        setInterval(refreshTrackerData, intervalMs);
    }

    document.addEventListener('DOMContentLoaded', initApp);
})();
