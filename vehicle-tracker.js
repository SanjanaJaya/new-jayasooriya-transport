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
    let trackerFocusedUnitId = null;     // Current inspected vehicle ID
    let trackerTVMode = localStorage.getItem('tracker_tv_mode') === 'true'; // 4K TV Grid Layout mode toggle state

    // Fuel consumption calculation cache & state
    let trackerVehicleFuelConsumption = {}; // { baseVehicleName: { kmpl: X, km: Y, L: Z } }
    let trackerVehicleVectorArts = {};      // { baseVehicleName: vectorArtUrl }
    let trackerVehicleModels = {};          // { baseVehicleName: 'Isuzu ELF 300' }
    let lastFuelConsumptionCalcTime = 0;
    const FUEL_CALC_INTERVAL = 10 * 60 * 1000; // 10 minutes

    // Memory management constants
    const MAX_GEOCODE_QUEUE_SIZE = 30;     // Cap geocode queue to prevent unbounded growth
    const MAX_ADDRESS_CACHE_SIZE = 200;    // Cap address cache entries
    const WIALON_MSG_LOAD_COUNT = 0xffffffff;   // Load all messages (memory is freed by messages/unload after each vehicle)


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

    // ── Map Focus and Bounds Auto-Fit Management ──
    function fitMapToAllVehicles() {
        if (!trackerMap) return;
        var validUnits = trackerUnits.filter(function (u) { return u.hasPosition; });
        if (validUnits.length > 0) {
            var bounds = L.latLngBounds(validUnits.map(function (u) { return [u.lat, u.lng]; }));
            trackerMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
    }

    function setTrackerVehicleFocus(unitId) {
        trackerFocusedUnitId = unitId;
    }

    function clearTrackerVehicleFocus() {
        trackerFocusedUnitId = null;

        // Close any open popups on the map when clearing focus
        if (trackerMap) {
            trackerMap.closePopup();
        }

        fitMapToAllVehicles();
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
            iconSize: [size, size],
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
            var pHire = supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, vector_art_url, vehicle_model').eq('user_id', userId).neq('terminated', true);
            var pCommit = supabaseClient.from('commitment_vehicles').select('id, vehicle_number, vector_art_url, vehicle_model').eq('user_id', userId).neq('terminated', true);

            var results = await Promise.all([pDrivers, pAssignments, pHire, pCommit]);
            trackerDrivers = results[0].data || [];
            trackerAssignments = results[1].data || [];

            trackerVehicleVectorArts = {};
            trackerVehicleModels = {};
            (results[2].data || []).forEach(function (v) {
                var base = typeof extractBaseVehicleName === 'function'
                    ? extractBaseVehicleName(v.lorry_number) : (v.lorry_number || '').trim().toUpperCase();
                if (v.vector_art_url) {
                    trackerVehicleVectorArts[base] = v.vector_art_url;
                }
                if (v.vehicle_model) {
                    trackerVehicleModels[base] = v.vehicle_model;
                }
            });
            (results[3].data || []).forEach(function (v) {
                var base = typeof extractBaseVehicleName === 'function'
                    ? extractBaseVehicleName(v.vehicle_number) : (v.vehicle_number || '').trim().toUpperCase();
                if (v.vector_art_url) {
                    trackerVehicleVectorArts[base] = v.vector_art_url;
                }
                if (v.vehicle_model) {
                    trackerVehicleModels[base] = v.vehicle_model;
                }
            });
        } catch (e) {
            console.error('Error fetching drivers/assignments/vehicles for tracker:', e);
        }
    }

    // ── Fetch ONLY fuel litres per vehicle from DB (this month) ──
    async function fetchCurrentMonthFuelLitresPerVehicle() {
        try {
            if (typeof supabaseClient === 'undefined') return {};
            var userId = typeof getQueryUserId === 'function' ? getQueryUserId() : null;
            if (!userId) return {};

            var now = new Date();
            var year = now.getFullYear();
            var month = String(now.getMonth() + 1).padStart(2, '0');
            var startDate = year + '-' + month + '-01';
            var lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
            var endDate = year + '-' + month + '-' + String(lastDay).padStart(2, '0');

            var results = await Promise.all([
                supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number').eq('user_id', userId),
                supabaseClient.from('commitment_vehicles').select('id, vehicle_number').eq('user_id', userId),
                supabaseClient.from('hire_to_pay_records').select('vehicle_id, fuel_litres').eq('user_id', userId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('vehicle_id, fuel_litres').eq('user_id', userId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('base_lorry_number, fuel_litres').eq('user_id', userId).gte('hire_date', startDate).lte('hire_date', endDate)
            ]);

            var hireVehiclesMap = {};
            (results[0].data || []).forEach(function (v) {
                hireVehiclesMap[v.id] = typeof extractBaseVehicleName === 'function'
                    ? extractBaseVehicleName(v.lorry_number) : (v.lorry_number || '').trim().toUpperCase();
            });
            var commitmentVehiclesMap = {};
            (results[1].data || []).forEach(function (v) {
                commitmentVehiclesMap[v.id] = typeof extractBaseVehicleName === 'function'
                    ? extractBaseVehicleName(v.vehicle_number) : (v.vehicle_number || '').trim().toUpperCase();
            });

            var litresMap = {}; // { 'LP - 8810': 532.83, ... }
            var add = function (name, litres) {
                if (!name) return;
                var key = name.trim().toUpperCase();
                litresMap[key] = (litresMap[key] || 0) + (litres || 0);
            };

            (results[2].data || []).forEach(function (r) { add(hireVehiclesMap[r.vehicle_id], r.fuel_litres); });
            (results[3].data || []).forEach(function (r) { add(commitmentVehiclesMap[r.vehicle_id], r.fuel_litres); });
            (results[4].data || []).forEach(function (r) {
                if (r.base_lorry_number) {
                    var n = typeof extractBaseVehicleName === 'function'
                        ? extractBaseVehicleName(r.base_lorry_number) : r.base_lorry_number;
                    add(n, r.fuel_litres);
                }
            });

            console.log('[Fuel] Litres map loaded. Vehicle count:', Object.keys(litresMap).length);
            return litresMap;
        } catch (e) {
            console.error('[Fuel] Error fetching fuel litres from DB:', e);
            return {};
        }
    }

    // ── Update fuel value element on every rendered card ──
    function updateFuelConsumptionOnCards() {
        var grid = document.getElementById('trackerVehicleGrid');
        if (!grid) return;

        trackerUnits.forEach(function (unit) {
            var card = grid.querySelector('.tracker-vehicle-card[data-unit-id="' + unit.id + '"]');
            if (!card) return;
            var valEl = card.querySelector('.fuel-consumption-val');
            if (!valEl) return;

            var baseName = typeof extractBaseVehicleName === 'function'
                ? extractBaseVehicleName(unit.name) : unit.name.trim().toUpperCase();
            var data = trackerVehicleFuelConsumption[baseName];

            if (data !== undefined) {
                if (data.L === 0) {
                    valEl.textContent = 'No fuel record';
                    valEl.style.color = 'var(--text-muted, #9CA3AF)';
                } else if (data.km === 0) {
                    valEl.textContent = data.L.toFixed(0) + ' L (no GPS trips)';
                    valEl.style.color = 'var(--text-muted, #9CA3AF)';
                } else {
                    valEl.textContent = data.kmpl.toFixed(1) + ' km/L';
                    valEl.style.color = '#00B878';
                }
                valEl.title = 'GPS km: ' + Math.round(data.km) + ' km | Fuel: ' + data.L.toFixed(1) + ' L';
            }
        });
    }

    // ── Calculate fuel consumption: Wialon GPS km ÷ DB fuel litres ──
    async function calculateAndPopulateFuelConsumption() {
        try {
            console.log('[Fuel] Starting fuel consumption calculation...');

            // Step 1: Get fuel litres from DB
            var litresMap = await fetchCurrentMonthFuelLitresPerVehicle();

            // Immediately populate cards with litres (so something shows right away)
            trackerUnits.forEach(function (unit) {
                var baseName = typeof extractBaseVehicleName === 'function'
                    ? extractBaseVehicleName(unit.name) : unit.name.trim().toUpperCase();
                if (!(baseName in trackerVehicleFuelConsumption)) {
                    trackerVehicleFuelConsumption[baseName] = { kmpl: 0, km: 0, L: litresMap[baseName] || 0 };
                }
            });
            updateFuelConsumptionOnCards();

            // Step 2: Get monthly mileage from Wialon
            if (typeof wialon === 'undefined' || !wialon.core || !wialon.core.Remote) {
                console.warn('[Fuel] Wialon SDK not available, skipping GPS mileage.');
                return;
            }

            var now = new Date();
            var timeFrom = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
            var timeTo = Math.floor(now.getTime() / 1000);
            var remote = wialon.core.Remote.getInstance();

            for (var i = 0; i < trackerUnits.length; i++) {
                var unit = trackerUnits[i];
                var baseName = typeof extractBaseVehicleName === 'function'
                    ? extractBaseVehicleName(unit.name) : unit.name.trim().toUpperCase();
                var litres = litresMap[baseName] || 0;

                var km = await new Promise(function (resolve) {
                    var capturedUnit = unit;
                    var done = false;
                    var guard = setTimeout(function () {
                        if (!done) { done = true; console.warn('[Mileage] Timeout for', capturedUnit.name); resolve({ km: 0 }); }
                    }, 90000);

                    // Step 2a: Load messages into the session
                    remote.remoteCall('messages/load_interval', {
                        itemId: capturedUnit.id,
                        timeFrom: timeFrom,
                        timeTo: timeTo,
                        flags: 0x0001,      // 0x0001 = position data messages only
                        flagsMask: 0x0001,
                        loadCount: WIALON_MSG_LOAD_COUNT
                    }, function (loadCode, loadData) {
                        if (loadCode !== 0) {
                            if (!done) { done = true; clearTimeout(guard); resolve({ km: 0 }); }
                            return;
                        }

                        var msgCount = (loadData && loadData.count) ? loadData.count : 0;
                        console.log('[Mileage] Loaded', msgCount, 'position messages for', capturedUnit.name);

                        // Step 2b: Get trips (for mileage)
                        remote.remoteCall('unit/get_trips', {
                            itemId: capturedUnit.id,
                            msgsSource: 1,
                            timeFrom: timeFrom,
                            timeTo: timeTo
                        }, function (tripsCode, trips) {
                            if (done) return;

                            var totalKm = 0;
                            if (tripsCode === 0 && Array.isArray(trips)) {
                                trips.forEach(function (t) { totalKm += (t.m || 0); });
                            }

                            done = true;
                            clearTimeout(guard);
                            remote.remoteCall('messages/unload', {}, function () {
                                resolve({ km: totalKm / 1000 });
                            });
                        });
                    });
                });

                var tripKm = km.km !== undefined ? km.km : km;
                var kmpl = (tripKm > 0 && litres > 0) ? (tripKm / litres) : 0;
                trackerVehicleFuelConsumption[baseName] = { kmpl: kmpl, km: tripKm, L: litres };
                updateFuelConsumptionOnCards();
            }

            console.log('[Fuel] Complete for', trackerUnits.length, 'units.');
        } catch (e) {
            console.error('[Fuel] Error:', e);
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
        var assignment = trackerAssignments.find(function (a) {
            var aLorry = typeof extractBaseVehicleName === 'function' ? extractBaseVehicleName(a.lorry_number) : a.lorry_number.trim().toUpperCase();
            return aLorry === baseName;
        });
        var driver = assignment ? trackerDrivers.find(function (d) { return d.id === assignment.driver_id; }) : null;

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
            if (raw) {
                var parsed = JSON.parse(raw);
                // Evict oldest entries if cache is too large
                var keys = Object.keys(parsed);
                if (keys.length > MAX_ADDRESS_CACHE_SIZE) {
                    var toRemove = keys.slice(0, keys.length - MAX_ADDRESS_CACHE_SIZE);
                    toRemove.forEach(function (k) { delete parsed[k]; });
                }
                trackerAddressCache = parsed;
            }
        } catch (e) {
            trackerAddressCache = {};
        }
    }

    function saveAddressCache() {
        try {
            // Evict oldest entries before saving
            var keys = Object.keys(trackerAddressCache);
            if (keys.length > MAX_ADDRESS_CACHE_SIZE) {
                var toRemove = keys.slice(0, keys.length - MAX_ADDRESS_CACHE_SIZE);
                toRemove.forEach(function (k) { delete trackerAddressCache[k]; });
            }
            localStorage.setItem(TRACKER_ADDRESS_CACHE_KEY, JSON.stringify(trackerAddressCache));
        } catch (e) { }
    }

    function queueGeocode(unit) {
        if (geocodeQueue.some(function (item) { return item.id === unit.id; })) return;
        // Cap queue size to prevent unbounded memory growth
        if (geocodeQueue.length >= MAX_GEOCODE_QUEUE_SIZE) {
            geocodeQueue.shift(); // Drop oldest pending request
        }
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
            var unit = trackerUnits.find(function (u) { return u.id === item.id; });
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
            item.retries = (item.retries || 0) + 1;
            if (item.retries < 3) {
                geocodeQueue.push(item);
            } else {
                console.warn('Geocoding failed 3 times for unit:', item.id, 'dropping request.');
            }
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
    function connectWialon(isBackground) {
        return new Promise((resolve) => {
            const config = getTrackerConfig();
            if (!config.token) {
                if (!isBackground) {
                    setConnStatus(false, 'No API token configured');
                    showTrackerSettings();
                }
                resolve(false);
                return;
            }

            setConnStatus(false, isBackground ? 'Session expired, reconnecting...' : 'Connecting...');

            try {
                // Ensure wialon SDK is loaded
                if (typeof wialon === 'undefined' || !wialon.core || !wialon.core.Session) {
                    setConnStatus(false, '❌ Wialon SDK not loaded');
                    if (!isBackground && typeof showToast === 'function') {
                        showToast('Wialon SDK failed to load. Check internet connection.', 'error');
                    }
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

                var doLogin = function () {
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
                            trackerSessionId = null; // Clear session ID on failure
                            setConnStatus(false, '❌ ' + msg);
                            if (!isBackground && typeof showToast === 'function') {
                                showToast(msg, 'error');
                            }
                            resolve(false);
                        } else {
                            trackerSessionId = session.getId();
                            var user = session.getCurrUser();
                            var userName = user ? user.getName() : 'Wialon';
                            setConnStatus(true, 'Connected as ' + userName);
                            if (!isBackground && typeof showToast === 'function') {
                                showToast('🛰️ Connected to Wialon!', 'success');
                            }
                            resolve(true);
                        }
                    });
                };

                // If session is already initialized with an ID, log out first to clean up internal state
                if (session.getId()) {
                    console.log('Logging out from existing session:', session.getId());
                    session.logout(function (logoutCode) {
                        console.log('Logout completed. Code:', logoutCode);
                        doLogin();
                    });
                } else {
                    doLogin();
                }
            } catch (err) {
                console.error('Wialon connection error:', err);
                trackerSessionId = null;
                setConnStatus(false, '❌ Connection failed');
                if (!isBackground && typeof showToast === 'function') {
                    showToast('Failed to connect to Wialon: ' + err.message, 'error');
                }
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
                    force: 0,  // FIXED: Don't force-reload items into SDK cache every refresh (prevents OOM)
                    flags: 1025, // 1 (base) + 1024 (last position)
                    from: 0,
                    to: 0
                };

                var remote = wialon.core.Remote.getInstance();
                var callback = function (code, data) {
                    if (code) {
                        console.error('Error fetching units, code:', code);
                        if (code === 1) {
                            // Session expired — try to reconnect
                            setConnStatus(false, 'Session expired, reconnecting...');
                            connectWialon(true).then(function (reconnected) {
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

                remote.remoteCall("core/search_items", params, function (code, data) {
                    callback(code, data);

                    // CRITICAL: Cleanup — tell Wialon to release the search result from session memory
                    // This prevents the SDK from accumulating items across repeated searches
                    if (!code && data && data.searchSpec) {
                        remote.remoteCall("core/update_data_flags", {
                            spec: [{
                                type: 'type',
                                data: 'avl_unit',
                                flags: 1025,
                                mode: 2  // mode 2 = remove flags (unsubscribe)
                            }]
                        }, function () { });
                    }
                });
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

                // Add click listener on marker to set focus
                marker.on('click', function () {
                    setTrackerVehicleFocus(unit.id);
                    trackerMap.flyTo(marker.getLatLng(), 15, { duration: 1.2 });
                });

                trackerMarkers[unit.id] = marker;
            }
        });

        // Fit map bounds: follow focused vehicle or auto-fit all active vehicles
        if (trackerFocusedUnitId) {
            var focusedUnit = validUnits.find(function (u) { return String(u.id) === String(trackerFocusedUnitId); });
            if (focusedUnit && focusedUnit.hasPosition) {
                // Smoothly pan to follow the focused moving unit
                trackerMap.panTo([focusedUnit.lat, focusedUnit.lng]);
            }
        } else {
            // Automatically fit bounds to display all vehicles
            fitMapToAllVehicles();
        }

        // Make sure Kevilton distributor markers match the toggle state
        updateDistributorMarkersOnMap();
    }

    // Helper to create a new card element
    function createCardElement(unit, i) {
        var card = document.createElement('div');
        card.dataset.unitId = unit.id;

        // Build card skeleton with placeholders to be updated by patchCard
        card.innerHTML = '<div class="tracker-card-header" style="z-index: 1; position: relative;">' +
            '<span class="tracker-card-name">🚛 ' + unit.name + '</span>' +
            '<span class="tracker-status-badge"></span>' +
            '</div>' +
            '<div class="tracker-card-speed-wrapper" style="display:flex; align-items:center; gap:12px; margin-bottom:10px; width:100%; z-index: 1; position: relative;">' +
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
            '<div class="tracker-card-address" style="z-index: 1; position: relative;">' +
            '<span class="tracker-card-address-icon">📍</span>' +
            '<span class="tracker-card-address-value"></span>' +
            '</div>' +
            '<div class="tracker-card-details" style="z-index: 1; position: relative;">' +
            // Driver Detail Row
            '<div class="tracker-detail-row tracker-driver-row">' +
            '<span class="detail-icon">👤</span>' +
            '<span class="detail-text">Driver</span>' +
            '<span class="detail-value" style="font-weight:700; color:var(--text-primary);"></span>' +
            '</div>' +
            // Driver Phone Row
            '<div class="tracker-detail-row tracker-phone-row">' +
            '<span class="detail-icon">📞</span>' +
            '<span class="detail-text">Phone</span>' +
            '<a class="detail-value tracker-phone-val" href="#" style="font-weight:600; color:var(--blue, #3498DB); text-decoration:none;">—</a>' +
            '</div>' +
            // Vehicle Model Row
            '<div class="tracker-detail-row tracker-model-row">' +
            '<span class="detail-icon">🚛</span>' +
            '<span class="detail-text">Model</span>' +
            '<span class="detail-value tracker-model-val" style="font-weight:600; color:var(--text-secondary);">—</span>' +
            '</div>' +
            // Fuel Consumption Row
            '<div class="tracker-detail-row tracker-fuel-row">' +
            '<span class="detail-icon">⛽</span>' +
            '<span class="detail-text">Fuel Efficiency</span>' +
            '<span class="detail-value fuel-consumption-val" style="font-weight:700; color:var(--text-primary);">Calculating...</span>' +
            '</div>' +
            '</div>' +
            '<div class="tracker-time-ago" style="z-index: 1; position: relative;">' +
            '<span class="live-dot"></span>' +
            '<span class="time-ago-text"></span>' +
            '</div>' +
            '<div class="tracker-card-vector-bg"></div>';

        // Add event listener to fly to map
        card.addEventListener('click', function () {
            var latestUnit = trackerUnits.find(function (u) { return String(u.id) === String(card.dataset.unitId); });
            if (latestUnit && latestUnit.hasPosition && trackerMap) {
                // Focus the vehicle and start the focus auto-clear timer
                setTrackerVehicleFocus(latestUnit.id);

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
        var assignment = trackerAssignments.find(function (a) {
            var aLorry = typeof extractBaseVehicleName === 'function' ? extractBaseVehicleName(a.lorry_number) : a.lorry_number.trim().toUpperCase();
            return aLorry === baseName;
        });
        var driver = assignment ? trackerDrivers.find(function (d) { return d.id === assignment.driver_id; }) : null;

        var targetDriverId = driver ? String(driver.id) : '';
        if (card.dataset.driverId !== targetDriverId) {
            card.dataset.driverId = targetDriverId;

            var nickname = driver ? (typeof getNickname === 'function' ? getNickname(driver.name) : '') : '';
            var driverName = driver
                ? (typeof cleanDriverName === 'function' ? cleanDriverName(driver.name) : driver.name) + (nickname ? ' (' + nickname + ')' : '')
                : 'Not Assigned';

            var driverVal = card.querySelector('.tracker-driver-row .detail-value');
            if (driverVal) driverVal.textContent = driverName;

            // Driver Phone — tap-to-call
            var phoneEl = card.querySelector('.tracker-phone-val');
            if (phoneEl) {
                var phone = driver && driver.contact ? driver.contact.trim() : '';
                if (phone) {
                    phoneEl.textContent = phone;
                    phoneEl.href = 'tel:' + phone;
                    phoneEl.style.color = 'var(--blue, #3498DB)';
                    phoneEl.style.pointerEvents = 'auto';
                } else {
                    phoneEl.textContent = '—';
                    phoneEl.removeAttribute('href');
                    phoneEl.style.color = 'var(--text-muted, #9CA3AF)';
                    phoneEl.style.pointerEvents = 'none';
                }
            }

            // Driver photo
            var imgContainer = card.querySelector('.tracker-driver-face-container');
            if (imgContainer) {
                if (driver && driver.photo_url) {
                    var currentImg = imgContainer.querySelector('img');
                    if (!currentImg) {
                        currentImg = document.createElement('img');
                        currentImg.className = 'tracker-driver-photo';
                        currentImg.onerror = function () { this.style.display = 'none'; };
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

        // Vehicle Model
        var modelEl = card.querySelector('.tracker-model-val');
        if (modelEl) {
            var modelText = trackerVehicleModels[baseName] || '—';
            if (modelEl.textContent !== modelText) modelEl.textContent = modelText;
        }

        // 9. Update Vector Art Background
        var bgEl = card.querySelector('.tracker-card-vector-bg');
        if (bgEl) {
            var vectorArtUrl = trackerVehicleVectorArts[baseName] || '';
            var targetBg = '';
            var defaultLorrySVG = '<svg viewBox="0 0 100 50" class="vehicle-svg-art" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="38" width="10" height="2" fill="rgba(0,0,0,0.5)" rx="1"/><rect x="57" y="38" width="10" height="2" fill="rgba(0,0,0,0.5)" rx="1"/><path d="M5,12 h46 v24 h-46 z" fill="#1E212D" rx="2"/><path d="M51,18 h18 l10,8 v10 h-28 z" fill="#D1001F" rx="2"/><path d="M58,20 h8 l5,5 v4 h-13 z" fill="#0F1014" rx="1"/><circle cx="20" cy="38" r="6" fill="#121212" stroke="#FFF" stroke-width="1"/><circle cx="62" cy="38" r="6" fill="#121212" stroke="#FFF" stroke-width="1"/><circle cx="20" cy="38" r="2" fill="#FFF"/><circle cx="62" cy="38" r="2" fill="#FFF"/></svg>';
            if (vectorArtUrl) {
                targetBg = 'url("' + vectorArtUrl + '")';
            } else {
                targetBg = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(defaultLorrySVG) + '")';
            }
            if (bgEl.style.backgroundImage !== targetBg) {
                bgEl.style.backgroundImage = targetBg;
            }
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

        // 8. Update Fuel Consumption
        var fuelVal = card.querySelector('.fuel-consumption-val');
        if (fuelVal) {
            var baseName2 = typeof extractBaseVehicleName === 'function' ? extractBaseVehicleName(unit.name) : unit.name.trim().toUpperCase();
            var fuelData = trackerVehicleFuelConsumption[baseName2];
            if (fuelData !== undefined) {
                if (fuelData.L === 0) {
                    fuelVal.textContent = 'No fuel record';
                    fuelVal.style.color = 'var(--text-muted, #9CA3AF)';
                } else if (fuelData.km === 0) {
                    fuelVal.textContent = fuelData.L.toFixed(0) + ' L (no GPS trips)';
                    fuelVal.style.color = 'var(--text-muted, #9CA3AF)';
                } else {
                    fuelVal.textContent = fuelData.kmpl.toFixed(1) + ' km/L';
                    fuelVal.style.color = '#00B878';
                }
                fuelVal.title = 'GPS km: ' + Math.round(fuelData.km) + ' km | Fuel: ' + fuelData.L.toFixed(1) + ' L';
            }
            // else: still shows "Calculating..." from the card template
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

        // Reuse status property on existing unit objects instead of cloning (avoids allocating new objects every refresh)
        var filtered = units.map(function (unit) {
            unit._status = getMotionStatus(unit);
            return unit;
        });

        if (searchTerm) {
            filtered = filtered.filter(function (u) {
                return u.name.toLowerCase().indexOf(searchTerm) !== -1;
            });
        }
        if (statusVal !== 'all') {
            filtered = filtered.filter(function (u) { return u._status === statusVal; });
        }

        // Sort alphabetically/numerically by vehicle name so displaying order is completely static
        filtered.sort(function (a, b) {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Cap at 20 lorries max in TV mode as requested
        if (trackerTVMode && filtered.length > 20) {
            filtered = filtered.slice(0, 20);
        }

        // Apply dynamic density class on vehicle-tracker element based on filtered unit count (for 4K TV scaling)
        var trackerPage = document.getElementById('vehicle-tracker');
        if (trackerPage) {
            trackerPage.classList.remove('tv-count-10', 'tv-count-15', 'tv-count-20');
            var count = filtered.length;
            if (count <= 10) {
                trackerPage.classList.add('tv-count-10');
            } else if (count <= 15) {
                trackerPage.classList.add('tv-count-15');
            } else {
                trackerPage.classList.add('tv-count-20');
            }
        }

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
        var pageEl = document.getElementById('vehicle-tracker');
        if (pageEl && !pageEl.classList.contains('active')) {
            // MEMORY FIX: Stop the refresh timer when not on the tracker page
            stopTrackerRefresh();
            console.log('Stopped refresh: Vehicle tracker page is not active.');
            return;
        }

        if (!trackerSessionId) {
            return;
        }

        try {
            await fetchDriversAndAssignments();
            var units = await fetchTrackerUnits();

            if ((!units || units.length === 0) && trackerUnits && trackerUnits.length > 0) {
                console.warn('Fetched 0 units, keeping existing units in UI.');
                return;
            }

            trackerUnits = units;

            renderTrackerStats(units);
            renderTrackerMap(units);
            renderTrackerCards(units);
            setLastUpdate();

            // Trigger fuel consumption calculation asynchronously
            var now = Date.now();
            if (now - lastFuelConsumptionCalcTime > FUEL_CALC_INTERVAL) {
                lastFuelConsumptionCalcTime = now;
                calculateAndPopulateFuelConsumption();
            } else {
                // Keep cards updated with cached data if already fetched
                updateFuelConsumptionOnCards();
            }
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
            el.requestFullscreen().then(function () {
                setTimeout(function () {
                    if (trackerMap) trackerMap.invalidateSize();
                }, 300);
            }).catch(function (err) {
                console.error("Error enabling fullscreen:", err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // Monitor native fullscreen state changes
    document.addEventListener('fullscreenchange', function () {
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

        setTimeout(function () {
            if (trackerMap) trackerMap.invalidateSize();
        }, 300);
    });

    // ── 4K TV Mode Toggle Management ──
    function updateTVModeUI() {
        var el = document.getElementById('vehicle-tracker');
        var tvBtns = document.querySelectorAll('.tracker-tv-btn');
        if (!el) return;

        if (trackerTVMode) {
            el.classList.add('tv-4k-active');
            tvBtns.forEach(function (btn) {
                btn.classList.add('active');
                if (btn.id === 'trackerFSHeaderTVBtn') btn.textContent = '📺 Normal Grid';
                else btn.textContent = '📺 Standard View';
            });
        } else {
            el.classList.remove('tv-4k-active');
            tvBtns.forEach(function (btn) {
                btn.classList.remove('active');
                if (btn.id === 'trackerFSHeaderTVBtn') btn.textContent = '📺 4K Grid';
                else btn.textContent = '📺 4K TV View';
            });
        }

        setTimeout(function () {
            if (trackerMap) trackerMap.invalidateSize();
        }, 200);
    }

    function toggleTrackerTVMode(forceState) {
        if (typeof forceState === 'boolean') {
            trackerTVMode = forceState;
        } else {
            trackerTVMode = !trackerTVMode;
        }
        localStorage.setItem('tracker_tv_mode', trackerTVMode ? 'true' : 'false');
        updateTVModeUI();
    }

    // ── Wire Up Events ──
    function wireTrackerEvents() {
        // 4K TV View buttons toggle
        var tvBtns = document.querySelectorAll('.tracker-tv-btn');
        tvBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                toggleTrackerTVMode();
            });
        });

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

        // Zoom to Sri Lanka Map Button (clears focus and fits all vehicles)
        var zoomSLBtn = document.getElementById('trackerZoomSriLankaBtn');
        if (zoomSLBtn) {
            zoomSLBtn.addEventListener('click', function () {
                clearTrackerVehicleFocus();
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

        // Apply saved 4K TV mode UI layout state
        updateTVModeUI();

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
            startTrackerRefresh();
        } else {
            // No token — show empty state and settings
            showTrackerSettings();
        }
    };

    // Auto-check URL for token on page load
    checkUrlForToken();
})();
