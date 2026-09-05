// ============================================================
// CLIENT TRACKING APP — client.js
// Jayasooriya Transport — Client Partner Portal
// Handles: Login, Wialon GPS, Geofence Detection, Timeline, Map, History
// ============================================================

// Supabase Configuration (same as admin/driver apps)
const SUPABASE_URL = 'https://slmqjqkpgdhrdcoempdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbXFqcWtwZ2RocmRjb2VtcGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3OTg4NzUsImV4cCI6MjA3NjM3NDg3NX0.mXDMuhn0K5sOKhwykhf9OcomUzSVkCGnN5jr60A-TSw';

let supabaseClient = null;
let currentClient = null;       // Current logged-in client record
let clientVehicles = [];         // Wialon unit names this client can see
let clientDropPoints = [];       // Drop points for this client
let clientRoutes = [];           // Unique route names
let wiaVehicleData = [];         // Live Wialon vehicle positions
let dropPointEvents = [];        // Events from DB for current view
let clientMap = null;            // Leaflet map
let clientMapMarkers = {};       // Vehicle markers on map
let clientDropPointMarkers = []; // Drop point markers on map
let geofenceTimer = null;        // Geofence polling interval
let wiaSessionId = null;
let selectedDate = new Date();   // Currently viewed date
let selectedRoute = 'all';
let selectedVehicle = 'all';
let dwellTracking = {};          // { 'unitName_pointId': { enteredAt, lastSeen, inside } }

// ── Wialon Config ──
const WIALON_CONFIG_KEY = 'jt_tracker_config';
const GEOFENCE_POLL_MS = 30000;  // 30 seconds
const DWELL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const GEOFENCE_DEFAULT_RADIUS = 500; // meters
const SPEED_THRESHOLD_KMH = 5;
const HISTORY_DAYS = 7;

// ============ UTILITY FUNCTIONS ============

function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { }
}

function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { }
}

// SHA-256 hash for password verification
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Haversine formula — distance in meters between two lat/lng points
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function formatTime(dateOrStr) {
    if (!dateOrStr) return '--:--';
    const d = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(date) {
    return date.toLocaleDateString('en-LK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateISO(date) {
    return date.getFullYear() + '-' +
           String(date.getMonth() + 1).padStart(2, '0') + '-' +
           String(date.getDate()).padStart(2, '0');
}

function isToday(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
}

function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('clientToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'clientToastContainer';
        container.className = 'client-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'client-toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============ THEME ============

function getCurrentTheme() {
    return safeGet('jt_client_theme') || 'dark';
}

function applyTheme(theme) {
    safeSet('jt_client_theme', theme);
    const isDark = theme === 'dark';
    document.body.classList.toggle('light-mode', !isDark);
    document.body.classList.toggle('dark-mode', isDark);
    const icon = document.getElementById('themeToggleIcon');
    if (icon) icon.textContent = isDark ? '🌙' : '☀️';
    const loginBtn = document.getElementById('loginThemeToggle');
    if (loginBtn) loginBtn.textContent = isDark ? '🌙' : '☀️';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#080A0F' : '#F5F6FA');
}

function toggleTheme() {
    applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
}

// ============ NAVIGATION ============

function switchClientPage(pageId, tabEl) {
    document.querySelectorAll('.content-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
    if (tabEl) tabEl.classList.add('active');

    if (pageId === 'mapPage') {
        setTimeout(() => {
            if (clientMap) clientMap.invalidateSize();
            else initClientMap();
        }, 200);
    }
    if (pageId === 'historyPage') {
        loadHistory();
    }
}

// ============ AUTHENTICATION ============

async function loginClient(email, password) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    try {
        const pwHash = await hashPassword(password);

        const { data, error } = await supabaseClient
            .from('client_users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .eq('is_active', true)
            .single();

        if (error || !data) {
            errorEl.textContent = 'No active account found with this email.';
            return;
        }

        if (data.password_hash !== pwHash) {
            errorEl.textContent = 'Incorrect password. Please try again.';
            return;
        }

        currentClient = data;
        safeSet('jt_client_session', JSON.stringify(data));
        showApp();
        showToast('Welcome, ' + data.client_name + '!', 'success');

    } catch (err) {
        console.error('Login error:', err);
        errorEl.textContent = 'Login failed. Please try again.';
    }
}

function showApp() {
    document.getElementById('loginView').classList.remove('active');
    document.getElementById('appView').classList.add('active');

    const nameEl = document.getElementById('clientNameDisplay');
    if (nameEl && currentClient) nameEl.textContent = currentClient.client_name || currentClient.email;

    const avatarEl = document.getElementById('clientAvatarIcon');
    if (avatarEl && currentClient && currentClient.client_name) {
        avatarEl.textContent = currentClient.client_name.charAt(0).toUpperCase();
    }

    loadClientData();
}

function showLogin() {
    document.getElementById('appView').classList.remove('active');
    document.getElementById('loginView').classList.add('active');
}

function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        currentClient = null;
        safeRemove('jt_client_session');
        stopGeofencePolling();
        showLogin();
    }
}

async function checkExistingSession() {
    const saved = safeGet('jt_client_session');
    if (saved) {
        try {
            currentClient = JSON.parse(saved);
            if (navigator.onLine) {
                // Verify session is still valid
                const { data, error } = await supabaseClient
                    .from('client_users')
                    .select('*')
                    .eq('id', currentClient.id)
                    .eq('is_active', true)
                    .single();

                if (!error && data) {
                    currentClient = data;
                    safeSet('jt_client_session', JSON.stringify(data));
                    showApp();
                } else {
                    safeRemove('jt_client_session');
                    showLogin();
                }
            } else {
                showApp();
            }
        } catch (e) {
            safeRemove('jt_client_session');
            showLogin();
        }
    } else {
        showLogin();
    }
}

// ============ DATA LOADING ============

async function loadClientData() {
    if (!currentClient) return;

    try {
        // Load assigned vehicles
        const { data: vehicles } = await supabaseClient
            .from('client_vehicle_access')
            .select('*')
            .eq('client_id', currentClient.id);
        clientVehicles = (vehicles || []).map(v => v.wialon_unit_name);

        // Load drop points
        const { data: points } = await supabaseClient
            .from('client_drop_points')
            .select('*')
            .eq('client_id', currentClient.id)
            .order('route_name', { ascending: true })
            .order('route_order', { ascending: true });
        clientDropPoints = points || [];

        // Extract unique routes
        clientRoutes = [...new Set(clientDropPoints.map(p => p.route_name).filter(Boolean))];

        // Render route tabs
        renderRouteTabs();
        renderVehicleFilter();

        // Load today's events from DB
        await loadEventsForDate(selectedDate);

        // Connect to Wialon and start tracking
        connectToWialon();

    } catch (err) {
        console.error('Error loading client data:', err);
        showToast('Failed to load data. Please refresh.', 'error');
    }
}

async function loadEventsForDate(date) {
    if (!currentClient) return;

    const dateStr = formatDateISO(date);
    try {
        const { data } = await supabaseClient
            .from('drop_point_events')
            .select('*, client_drop_points(point_name, route_name, route_order)')
            .eq('client_id', currentClient.id)
            .eq('trip_date', dateStr)
            .order('created_at', { ascending: true });
        dropPointEvents = data || [];
    } catch (err) {
        console.error('Error loading events:', err);
        dropPointEvents = [];
    }

    renderTimeline();
}

async function refreshAllData() {
    showToast('Refreshing...', 'info', 1500);
    await loadClientData();
}

// ============ ROUTE TABS & FILTERS ============

function renderRouteTabs() {
    const container = document.getElementById('routeTabsContainer');
    if (!container) return;

    let html = '<button class="route-tab' + (selectedRoute === 'all' ? ' active' : '') +
               '" data-route="all" onclick="selectRoute(\'all\', this)">All Routes</button>';

    clientRoutes.forEach(route => {
        const isActive = selectedRoute === route ? ' active' : '';
        html += '<button class="route-tab' + isActive + '" data-route="' + route +
                '" onclick="selectRoute(\'' + route.replace(/'/g, "\\'") + '\', this)">' + route + '</button>';
    });

    container.innerHTML = html;
}

function selectRoute(route, el) {
    selectedRoute = route;
    document.querySelectorAll('.route-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    renderTimeline();
}

function renderVehicleFilter() {
    const container = document.getElementById('vehicleFilterRow');
    if (!container) return;

    let html = '<button class="vehicle-chip' + (selectedVehicle === 'all' ? ' active' : '') +
               '" data-vehicle="all" onclick="selectVehicle(\'all\', this)">All Vehicles</button>';

    clientVehicles.forEach(v => {
        const isActive = selectedVehicle === v ? ' active' : '';
        html += '<button class="vehicle-chip' + isActive + '" data-vehicle="' + v +
                '" onclick="selectVehicle(\'' + v.replace(/'/g, "\\'") + '\', this)">' + v + '</button>';
    });

    container.innerHTML = html;
}

function selectVehicle(vehicle, el) {
    selectedVehicle = vehicle;
    document.querySelectorAll('.vehicle-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    renderTimeline();
}

// ============ DATE NAVIGATION ============

function navigateDate(delta) {
    selectedDate.setDate(selectedDate.getDate() + delta);
    // Don't allow future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedDate > today) {
        selectedDate = new Date();
    }
    updateDateLabel();
    loadEventsForDate(selectedDate);
}

function updateDateLabel() {
    const label = document.getElementById('timelineDateLabel');
    if (label) {
        label.textContent = isToday(selectedDate) ? 'Today — ' + formatDate(selectedDate) : formatDate(selectedDate);
    }
}

// ============ TIMELINE RENDERING ============

function renderTimeline() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    // Filter drop points by selected route
    let points = clientDropPoints;
    if (selectedRoute !== 'all') {
        points = points.filter(p => p.route_name === selectedRoute);
    }

    // Filter by selected vehicle
    let vehicles = clientVehicles;
    if (selectedVehicle !== 'all') {
        vehicles = [selectedVehicle];
    }

    if (points.length === 0) {
        container.innerHTML = '<div class="empty-state">' +
            '<div class="empty-icon">📍</div>' +
            '<div class="empty-text">No drop points configured</div>' +
            '<div class="empty-sub">Contact your administrator to set up tracking points.</div>' +
            '</div>';
        return;
    }

    // Group points by route
    const routeGroups = {};
    points.forEach(p => {
        const key = p.route_name || 'Default Route';
        if (!routeGroups[key]) routeGroups[key] = [];
        routeGroups[key].push(p);
    });

    let html = '';

    Object.keys(routeGroups).forEach(routeName => {
        const routePoints = routeGroups[routeName].sort((a, b) => a.route_order - b.route_order);

        html += '<div class="section-title" style="margin-top: 16px; margin-bottom: 8px;">🛣️ ' + routeName + '</div>';

        // For each vehicle, render timeline for this route
        vehicles.forEach(vehicleName => {
            if (vehicles.length > 1 || selectedVehicle === 'all') {
                html += '<div style="font-size: 12px; font-weight: 700; color: var(--accent-blue); margin: 8px 0 6px; padding-left: 28px;">🚛 ' + vehicleName + '</div>';
            }

            html += '<div class="timeline-container"><div class="timeline-line"></div>';

            routePoints.forEach(point => {
                // Find event for this point + vehicle + date
                const event = dropPointEvents.find(e =>
                    e.drop_point_id === point.id &&
                    e.vehicle_name === vehicleName
                );

                // Check live dwell tracking
                const dwellKey = vehicleName + '_' + point.id;
                const dwellInfo = dwellTracking[dwellKey];

                let status = 'pending';
                let entryTime = '--:--';
                let waitedTime = '--';
                let leftTime = '--:--';

                if (event) {
                    status = event.status || 'pending';
                    if (event.entry_time) entryTime = formatTime(event.entry_time);
                    if (event.left_time) leftTime = formatTime(event.left_time);
                    if (event.waited_minutes) {
                        waitedTime = Math.round(event.waited_minutes) + ' min';
                    } else if (event.entry_time && !event.left_time) {
                        // Still waiting — calculate live
                        const elapsed = (Date.now() - new Date(event.entry_time).getTime()) / 60000;
                        waitedTime = Math.round(elapsed) + ' min';
                    }
                }

                // Override with live dwell data if available and today
                if (isToday(selectedDate) && dwellInfo) {
                    if (dwellInfo.inside && !dwellInfo.confirmed && dwellInfo.enteredAt) {
                        const elapsed = Date.now() - dwellInfo.enteredAt;
                        if (elapsed >= DWELL_THRESHOLD_MS) {
                            status = 'waiting';
                            entryTime = formatTime(new Date(dwellInfo.enteredAt));
                            waitedTime = Math.round(elapsed / 60000) + ' min';
                        } else {
                            status = 'approaching';
                            waitedTime = 'Detected ' + Math.round(elapsed / 1000) + 's ago';
                        }
                    }
                }

                const dotClass = status;
                const isActive = (status === 'waiting' || status === 'entered') ? ' active' : '';

                html += '<div class="timeline-item">' +
                    '<div class="timeline-dot ' + dotClass + '"></div>' +
                    '<div class="timeline-card' + isActive + '">' +
                    '<div class="timeline-point-name">' + point.point_name + '</div>' +
                    '<div class="timeline-point-route">#' + point.route_order + ' on ' + (point.route_name || 'Route') + '</div>' +
                    '<div class="timeline-times">' +
                    '<div class="timeline-time-block"><div class="time-label">ENTRY</div><div class="time-value ' + (status === 'departed' || status === 'waiting' ? 'green' : 'muted') + '">' + entryTime + '</div></div>' +
                    '<div class="timeline-time-block"><div class="time-label">WAITED</div><div class="time-value ' + (status === 'waiting' ? 'blue' : 'muted') + '">' + waitedTime + '</div></div>' +
                    '<div class="timeline-time-block"><div class="time-label">LEFT</div><div class="time-value ' + (status === 'departed' ? 'amber' : 'muted') + '">' + leftTime + '</div></div>' +
                    '</div>' +
                    '<div class="timeline-status-badge ' + status + '">' + getStatusIcon(status) + ' ' + getStatusText(status) + '</div>' +
                    '</div></div>';
            });

            html += '</div>'; // close timeline-container
        });
    });

    container.innerHTML = html;
}

function getStatusIcon(status) {
    switch (status) {
        case 'departed': return '✅';
        case 'waiting': return '⏳';
        case 'entered': return '📍';
        case 'approaching': return '🔄';
        default: return '⏸️';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'departed': return 'Departed';
        case 'waiting': return 'Waiting';
        case 'entered': return 'Entered Area';
        case 'approaching': return 'Approaching';
        default: return 'Pending';
    }
}

// ============ WIALON CONNECTION ============

function getWialonConfig() {
    try {
        const raw = safeGet(WIALON_CONFIG_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.token) return parsed;
        }
    } catch (e) { }
    return {
        server: 'hst-api.wialon.com',
        token: '2dc41f89a60d68ba8fd0a5e34722386f728895444F6CEE221D45222A43B65B5606DE57A0',
        interval: 30
    };
}

function connectToWialon() {
    const config = getWialonConfig();
    if (!config.token) {
        showToast('GPS tracking not configured. Contact administrator.', 'error');
        return;
    }

    if (typeof wialon === 'undefined' || !wialon.core || !wialon.core.Session) {
        console.error('Wialon SDK not loaded');
        showToast('GPS SDK not loaded. Check internet connection.', 'error');
        return;
    }

    try {
        const session = wialon.core.Session.getInstance();
        let serverUrl = config.server;
        if (serverUrl.indexOf('http') !== 0) serverUrl = 'https://' + serverUrl;

        try { session.initSession(serverUrl); } catch (e) {
            console.log('Session already initialized');
        }

        const doLogin = function () {
            session.loginToken(config.token, '', function (code) {
                if (code) {
                    console.error('Wialon login failed, code:', code);
                    showToast('GPS connection failed. Retrying...', 'error');
                    setTimeout(() => connectToWialon(), 10000);
                } else {
                    wiaSessionId = session.getId();
                    console.log('Wialon connected for client tracking');
                    fetchAndProcessVehicles();
                    startGeofencePolling();
                }
            });
        };

        if (session.getId()) {
            session.logout(function () { doLogin(); });
        } else {
            doLogin();
        }
    } catch (err) {
        console.error('Wialon connection error:', err);
        setTimeout(() => connectToWialon(), 10000);
    }
}

function fetchAndProcessVehicles() {
    if (typeof wialon === 'undefined' || !wialon.core) return;

    try {
        const remote = wialon.core.Remote.getInstance();
        remote.remoteCall('core/search_items', {
            spec: {
                itemsType: 'avl_unit',
                propName: 'sys_name',
                propValueMask: '*',
                sortType: 'sys_name'
            },
            force: 0,
            flags: 1025, // base + last position
            from: 0,
            to: 0
        }, function (code, data) {
            if (code) {
                console.error('Wialon search failed:', code);
                if (code === 1) {
                    // Session expired, reconnect
                    connectToWialon();
                }
                return;
            }

            const items = (data && data.items) ? data.items : [];

            // Filter to only vehicles this client has access to
            wiaVehicleData = items
                .filter(item => {
                    const name = (item.nm || '').trim();
                    return clientVehicles.some(cv =>
                        cv.trim().toUpperCase() === name.toUpperCase()
                    );
                })
                .map(item => {
                    const pos = item.pos || {};
                    return {
                        id: item.id,
                        name: (item.nm || '').trim(),
                        lat: pos.y || 0,
                        lng: pos.x || 0,
                        speed: pos.s || 0,
                        course: pos.c || 0,
                        lastTime: pos.t || 0,
                        hasPosition: !!(pos.y && pos.x)
                    };
                });

            // Update UI
            renderVehiclesList();
            updateMapMarkers();
            processGeofences();

            // Cleanup SDK memory
            if (!code && data && data.searchSpec) {
                remote.remoteCall('core/update_data_flags', {
                    spec: [{ type: 'type', data: 'avl_unit', flags: 1025, mode: 2 }]
                }, function () { });
            }
        });
    } catch (err) {
        console.error('fetchAndProcessVehicles error:', err);
    }
}

// ============ GEOFENCE DETECTION ENGINE ============

function startGeofencePolling() {
    stopGeofencePolling();
    geofenceTimer = setInterval(() => {
        fetchAndProcessVehicles();
    }, GEOFENCE_POLL_MS);
}

function stopGeofencePolling() {
    if (geofenceTimer) {
        clearInterval(geofenceTimer);
        geofenceTimer = null;
    }
}

function processGeofences() {
    if (!isToday(selectedDate)) return; // Only process for today
    if (wiaVehicleData.length === 0 || clientDropPoints.length === 0) return;

    const now = Date.now();

    wiaVehicleData.forEach(vehicle => {
        if (!vehicle.hasPosition) return;

        clientDropPoints.forEach(point => {
            const dwellKey = vehicle.name + '_' + point.id;
            const distance = haversineDistance(vehicle.lat, vehicle.lng, point.latitude, point.longitude);
            const radius = point.radius_meters || GEOFENCE_DEFAULT_RADIUS;
            const isInsideZone = distance <= radius;
            const isSlowOrStopped = vehicle.speed <= SPEED_THRESHOLD_KMH;
            const isInGeofence = isInsideZone && isSlowOrStopped;

            if (!dwellTracking[dwellKey]) {
                dwellTracking[dwellKey] = {
                    enteredAt: null,
                    lastSeen: null,
                    inside: false,
                    confirmed: false,  // true when 5-min dwell recorded to DB
                    eventId: null
                };
            }

            const dwell = dwellTracking[dwellKey];

            if (isInGeofence) {
                if (!dwell.inside) {
                    // Vehicle just entered geofence zone
                    dwell.inside = true;
                    dwell.enteredAt = now;
                    dwell.lastSeen = now;
                    dwell.confirmed = false;
                    console.log('[Geofence] ' + vehicle.name + ' entered zone near ' + point.point_name + ' (dist: ' + Math.round(distance) + 'm)');
                } else {
                    // Still inside
                    dwell.lastSeen = now;

                    // Check if 5-min threshold reached and not yet confirmed
                    if (!dwell.confirmed && (now - dwell.enteredAt >= DWELL_THRESHOLD_MS)) {
                        // Record entry event in DB
                        recordEntryEvent(vehicle, point, dwell);
                        dwell.confirmed = true;
                    }
                }
            } else {
                if (dwell.inside) {
                    // Vehicle just left the geofence
                    console.log('[Geofence] ' + vehicle.name + ' left zone near ' + point.point_name);

                    if (dwell.confirmed && dwell.eventId) {
                        // Record departure
                        recordDepartureEvent(dwell, now);
                    }

                    // Reset tracking
                    dwell.inside = false;
                    dwell.enteredAt = null;
                    dwell.lastSeen = null;
                    dwell.confirmed = false;
                    dwell.eventId = null;
                }
            }
        });
    });

    // Refresh timeline with latest dwell data
    renderTimeline();
}

async function recordEntryEvent(vehicle, point, dwell) {
    try {
        const entryDate = new Date(dwell.enteredAt);
        const { data, error } = await supabaseClient
            .from('drop_point_events')
            .insert({
                user_id: currentClient.user_id,
                client_id: currentClient.id,
                drop_point_id: point.id,
                vehicle_name: vehicle.name,
                trip_date: formatDateISO(entryDate),
                direction: 'outbound', // TODO: detect direction based on route order
                entry_time: entryDate.toISOString(),
                status: 'waiting'
            })
            .select()
            .single();

        if (!error && data) {
            dwell.eventId = data.id;
            showToast('🚛 ' + vehicle.name + ' arrived at ' + point.point_name, 'success');

            // Refresh events
            await loadEventsForDate(selectedDate);
        } else {
            console.error('Error recording entry event:', error);
        }
    } catch (err) {
        console.error('recordEntryEvent error:', err);
    }
}

async function recordDepartureEvent(dwell, departureTimestamp) {
    try {
        const leftTime = new Date(departureTimestamp);
        const entryTime = new Date(dwell.enteredAt);
        const waitedMinutes = (departureTimestamp - dwell.enteredAt) / 60000;

        const { error } = await supabaseClient
            .from('drop_point_events')
            .update({
                left_time: leftTime.toISOString(),
                waited_minutes: Math.round(waitedMinutes * 100) / 100,
                status: 'departed'
            })
            .eq('id', dwell.eventId);

        if (!error) {
            // Refresh events
            await loadEventsForDate(selectedDate);
        } else {
            console.error('Error recording departure:', error);
        }
    } catch (err) {
        console.error('recordDepartureEvent error:', err);
    }
}

// ============ VEHICLE LIST RENDERING ============

function renderVehiclesList() {
    const container = document.getElementById('vehiclesListContainer');
    if (!container) return;

    if (wiaVehicleData.length === 0) {
        container.innerHTML = '<div class="empty-state">' +
            '<div class="empty-icon">🚛</div>' +
            '<div class="empty-text">No vehicles found</div>' +
            '<div class="empty-sub">Vehicles assigned to you will appear here.</div>' +
            '</div>';
        return;
    }

    let html = '';
    wiaVehicleData.forEach(v => {
        const now = Math.floor(Date.now() / 1000);
        const timeSince = v.lastTime ? (now - v.lastTime) : Infinity;
        let status = 'offline';
        if (timeSince < 1800) {
            status = v.speed > 0 ? 'moving' : 'idle';
        }

        const statusBadgeClass = 'badge-' + status;
        const speedClass = status;
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);

        html += '<div class="vehicle-status-card ' + status + '">' +
            '<div class="vehicle-card-header">' +
            '<span class="vehicle-plate">' + v.name + '</span>' +
            '<span class="vehicle-speed ' + speedClass + '">' + Math.round(v.speed) + ' km/h</span>' +
            '</div>' +
            '<div class="vehicle-location">📍 ' + v.lat.toFixed(4) + ', ' + v.lng.toFixed(4) + '</div>' +
            '<div style="display: flex; align-items: center; justify-content: space-between;">' +
            '<span class="vehicle-status-badge ' + statusBadgeClass + '">' +
            (status === 'moving' ? '🟢' : status === 'idle' ? '🟡' : '🔴') + ' ' + statusText + '</span>' +
            '<button class="vehicle-map-btn" onclick="focusVehicleOnMap(\'' + v.name.replace(/'/g, "\\'") + '\')">📍 Show on Map</button>' +
            '</div>' +
            '</div>';
    });

    container.innerHTML = html;
}

// ============ MAP ============

function initClientMap() {
    if (clientMap) {
        clientMap.invalidateSize();
        return;
    }

    const mapEl = document.getElementById('clientMap');
    if (!mapEl) return;

    clientMap = L.map('clientMap', {
        center: [7.8731, 80.7718], // Sri Lanka center
        zoom: 8,
        zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
    }).addTo(clientMap);

    setTimeout(() => { if (clientMap) clientMap.invalidateSize(); }, 300);
    updateMapMarkers();
}

function updateMapMarkers() {
    if (!clientMap) return;

    // Clear old vehicle markers
    Object.values(clientMapMarkers).forEach(m => clientMap.removeLayer(m));
    clientMapMarkers = {};

    // Clear old drop point markers
    clientDropPointMarkers.forEach(m => clientMap.removeLayer(m));
    clientDropPointMarkers = [];

    // Add vehicle markers
    wiaVehicleData.forEach(v => {
        if (!v.hasPosition) return;

        const now = Math.floor(Date.now() / 1000);
        const timeSince = v.lastTime ? (now - v.lastTime) : Infinity;
        let status = 'offline';
        if (timeSince < 1800) {
            status = v.speed > 0 ? 'moving' : 'idle';
        }

        const colors = { moving: '#00B878', idle: '#FFA000', offline: '#6B7280' };
        const color = colors[status];

        const icon = L.divIcon({
            html: '<div style="background:' + color + '; width: 32px; height: 32px; border-radius: 50%; ' +
                  'display: flex; align-items: center; justify-content: center; font-size: 16px; ' +
                  'border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">🚛</div>' +
                  '<div style="position: absolute; top: 36px; left: 50%; transform: translateX(-50%); ' +
                  'background: rgba(0,0,0,0.8); color: #fff; padding: 2px 6px; border-radius: 4px; ' +
                  'font-size: 10px; font-weight: 700; white-space: nowrap;">' + v.name + '</div>',
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -20]
        });

        const marker = L.marker([v.lat, v.lng], { icon: icon })
            .bindPopup('<b>' + v.name + '</b><br>Speed: ' + Math.round(v.speed) + ' km/h<br>Status: ' + status)
            .addTo(clientMap);
        clientMapMarkers[v.name] = marker;
    });

    // Add drop point markers
    clientDropPoints.forEach(p => {
        if (!p.latitude || !p.longitude) return;

        const dpIcon = L.divIcon({
            html: '<div style="background: #38BDF8; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; ' +
                  'transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; ' +
                  'border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">' +
                  '<span style="transform: rotate(45deg); font-size: 12px;">📍</span></div>' +
                  '<div style="position: absolute; top: 28px; left: 50%; transform: translateX(-50%); ' +
                  'background: rgba(56,189,248,0.9); color: #fff; padding: 2px 6px; border-radius: 4px; ' +
                  'font-size: 9px; font-weight: 700; white-space: nowrap;">' + p.point_name + '</div>',
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 24],
            popupAnchor: [0, -28]
        });

        // Draw radius circle
        const circle = L.circle([p.latitude, p.longitude], {
            radius: p.radius_meters || 500,
            color: '#38BDF8',
            fillColor: '#38BDF8',
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: '5,5'
        }).addTo(clientMap);
        clientDropPointMarkers.push(circle);

        const marker = L.marker([p.latitude, p.longitude], { icon: dpIcon })
            .bindPopup('<b>' + p.point_name + '</b><br>Route: ' + (p.route_name || 'N/A') +
                       '<br>Radius: ' + (p.radius_meters || 500) + 'm')
            .addTo(clientMap);
        clientDropPointMarkers.push(marker);
    });

    fitMapToVehicles();
}

function fitMapToVehicles() {
    if (!clientMap) return;

    const bounds = [];
    wiaVehicleData.forEach(v => {
        if (v.hasPosition) bounds.push([v.lat, v.lng]);
    });
    clientDropPoints.forEach(p => {
        if (p.latitude && p.longitude) bounds.push([p.latitude, p.longitude]);
    });

    if (bounds.length > 0) {
        clientMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
}

function focusVehicleOnMap(vehicleName) {
    // Switch to map page
    const mapTab = document.querySelector('.nav-tab[data-page="mapPage"]');
    switchClientPage('mapPage', mapTab);

    setTimeout(() => {
        if (clientMapMarkers[vehicleName]) {
            const marker = clientMapMarkers[vehicleName];
            clientMap.setView(marker.getLatLng(), 15, { animate: true });
            marker.openPopup();
        }
    }, 400);
}

// ============ HISTORY ============

async function loadHistory() {
    const container = document.getElementById('historyContainer');
    if (!container || !currentClient) return;

    container.innerHTML = '<div class="loading-state"><div class="loading-icon">🔄</div><div>Loading history...</div></div>';

    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - HISTORY_DAYS);

        const { data } = await supabaseClient
            .from('drop_point_events')
            .select('*, client_drop_points(point_name, route_name)')
            .eq('client_id', currentClient.id)
            .gte('trip_date', formatDateISO(startDate))
            .lte('trip_date', formatDateISO(endDate))
            .order('trip_date', { ascending: false })
            .order('entry_time', { ascending: true });

        const events = data || [];

        if (events.length === 0) {
            container.innerHTML = '<div class="empty-state">' +
                '<div class="empty-icon">📋</div>' +
                '<div class="empty-text">No events in the last ' + HISTORY_DAYS + ' days</div>' +
                '<div class="empty-sub">Drop point arrival events will appear here.</div>' +
                '</div>';
            return;
        }

        // Group by date
        const grouped = {};
        events.forEach(e => {
            const key = e.trip_date;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(e);
        });

        let html = '';
        Object.keys(grouped).sort().reverse().forEach(dateStr => {
            const dayEvents = grouped[dateStr];
            const d = new Date(dateStr + 'T00:00:00');
            html += '<div class="history-day-group">';
            html += '<div class="history-day-header">📅 ' + formatDate(d) + ' (' + dayEvents.length + ' events)</div>';

            dayEvents.forEach(e => {
                const pointName = e.client_drop_points ? e.client_drop_points.point_name : 'Unknown';
                const routeName = e.client_drop_points ? e.client_drop_points.route_name : '';
                const dotClass = e.status === 'departed' ? 'departed' : 'waiting';

                html += '<div class="history-event-card">' +
                    '<div class="history-event-dot ' + dotClass + '"></div>' +
                    '<div class="history-event-info">' +
                    '<div class="history-event-name">' + pointName + (routeName ? ' — ' + routeName : '') + '</div>' +
                    '<div class="history-event-times">' +
                    '<span>⏰ Entry: ' + formatTime(e.entry_time) + '</span>' +
                    '<span>⏳ Waited: ' + (e.waited_minutes ? Math.round(e.waited_minutes) + ' min' : '-') + '</span>' +
                    '<span>🚛 Left: ' + formatTime(e.left_time) + '</span>' +
                    '</div>' +
                    '<div class="history-event-vehicle">🚛 ' + e.vehicle_name + '</div>' +
                    '</div></div>';
            });

            html += '</div>';
        });

        container.innerHTML = html;

    } catch (err) {
        console.error('Error loading history:', err);
        container.innerHTML = '<div class="empty-state"><div class="empty-text">Failed to load history</div></div>';
    }
}

// ============ ONLINE/OFFLINE ============

function updateOnlineStatus() {
    const banner = document.getElementById('offlineWarningBanner');
    if (banner) banner.classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ============ INITIALIZATION ============

function initApp() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error('Supabase library not loaded');
        return;
    }

    updateOnlineStatus();
    applyTheme(getCurrentTheme());
    updateDateLabel();

    // Login form handler
    const loginForm = document.getElementById('clientLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await loginClient(email, password);
        });
    }

    // Check existing session
    checkExistingSession();
}

// Boot
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
