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
const GEOFENCE_POLL_MS = 10000;  // 10 seconds for real-time tracking
const DWELL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const GEOFENCE_DEFAULT_RADIUS = 500; // meters
const SPEED_THRESHOLD_KMH = 5;
const HISTORY_DAYS = 7;
const ROUTE_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 min grace for new routes
const DROP_POINT_REFRESH_MS = 10000; // Auto-refresh routes every 10 seconds
const SHIFT_START_HOUR = 18; // Evening 6:00 PM shift start
let dropPointRefreshTimer = null;
let currentShiftKey = null;

// Operational Shift Window (6:00 PM - 1:00 PM next day)
function getOperationalShiftWindow(dateObj = new Date()) {
    const start = new Date(dateObj);
    if (start.getHours() < SHIFT_START_HOUR) {
        start.setDate(start.getDate() - 1);
    }
    start.setHours(SHIFT_START_HOUR, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
}

function checkShiftTransition() {
    const { start } = getOperationalShiftWindow(new Date());
    const shiftKey = start.toISOString();

    if (currentShiftKey && currentShiftKey !== shiftKey) {
        console.log('[ShiftTransition] New evening shift started (6:00 PM)! Auto-refreshing tracking & dwell states...');
        dwellTracking = {};
        currentShiftKey = shiftKey;
        if (isToday(selectedDate)) {
            loadEventsForDate(selectedDate);
        }
        showToast('🌆 New Evening Shift started! Tracking refreshed.', 'success', 5000);
    } else {
        currentShiftKey = shiftKey;
    }
}

async function startNewHireManual() {
    dwellTracking = {};
    showToast('🚀 System refreshed! Ready for new hire tracking.', 'success', 3000);
    await loadEventsForDate(selectedDate);
    if (clientMap) {
        updateMapMarkers();
    }
}

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

function extractBaseVehicleName(name) {
    if (!name) return '';
    const match = String(name).match(/([a-zA-Z0-9]{1,4})\s*-\s*([0-9]{1,4})/);
    if (match) {
        return `${match[1].trim().toUpperCase()} - ${match[2].trim()}`;
    }
    return String(name).trim().toUpperCase();
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
        stopDropPointRefresh();
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
        clientVehicles = (vehicles || []).map(v => v.vehicle_number || v.wialon_unit_name).filter(Boolean);

        // Load drop points
        const { data: points } = await supabaseClient
            .from('client_drop_points')
            .select('*')
            .eq('client_id', currentClient.id)
            .order('route_name', { ascending: true })
            .order('point_order', { ascending: true });
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

        // Start periodic route refresh so admin changes appear automatically
        startDropPointRefresh();

        // Subscribe to Supabase Realtime for instant 0-second updates
        subscribeToRealtimeUpdates();

    } catch (err) {
        console.error('Error loading client data:', err);
        showToast('Failed to load data. Please refresh.', 'error');
    }
}

async function loadEventsForDate(date) {
    if (!currentClient) return;

    try {
        let startISO, endISO;

        if (isToday(date)) {
            // Live View: Fetch events from the last 48 hours to seamlessly preserve cross-midnight hires
            // (e.g. Started yesterday 6:00 PM and finishing today 12:00 PM, or starting today 6:00 PM)
            const dStart = new Date(date);
            dStart.setDate(dStart.getDate() - 2); // 48h lookback window
            startISO = dStart.toISOString();
            endISO = new Date().toISOString();
        } else {
            // History View: Fetch 36h window around selected date to include overnight hires
            const dStart = new Date(date);
            dStart.setHours(0, 0, 0, 0);
            dStart.setHours(dStart.getHours() - 12);
            const dEnd = new Date(date);
            dEnd.setHours(23, 59, 59, 999);
            dEnd.setHours(dEnd.getHours() + 12);

            startISO = dStart.toISOString();
            endISO = dEnd.toISOString();
        }

        const { data } = await supabaseClient
            .from('drop_point_events')
            .select('*')
            .eq('client_id', currentClient.id)
            .gte('created_at', startISO)
            .lte('created_at', endISO)
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
        // Find the assigned vehicle for this route (from first point)
        const routePts = clientDropPoints.filter(p => p.route_name === route);
        const assignedV = routePts.length > 0 && routePts[0].assigned_vehicle && routePts[0].assigned_vehicle !== 'ALL'
            ? ' 🚚' : '';
        html += '<button class="route-tab' + isActive + '" data-route="' + route +
                '" onclick="selectRoute(\'' + route.replace(/'/g, "\\'") + '\', this)">' + route + assignedV + '</button>';
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
        if (!v || typeof v !== 'string') return;
        const isActive = selectedVehicle === v ? ' active' : '';
        const safeV = String(v).replace(/'/g, "\\'");
        html += '<button class="vehicle-chip' + isActive + '" data-vehicle="' + safeV +
                '" onclick="selectVehicle(\'' + safeV + '\', this)">' + v + '</button>';
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
        if (isToday(selectedDate)) {
            const shift = getOperationalShiftWindow(new Date());
            const shiftStartStr = shift.start.toLocaleDateString('en-LK', { month: 'short', day: 'numeric' });
            label.textContent = '🌆 Evening Shift — ' + shiftStartStr + ' (6:00 PM - 1:00 PM)';
        } else {
            label.textContent = formatDate(selectedDate);
        }
    }
}

// ============ TIMELINE RENDERING ============

function getPointTypeIcon(pointType) {
    switch ((pointType || '').toUpperCase()) {
        case 'START': return '🟢';
        case 'DESTINATION': return '🏁';
        case 'TURN': return '🔄';
        case 'INTERMEDIATE': default: return '📍';
    }
}

function getPointTypeLabel(pointType) {
    switch ((pointType || '').toUpperCase()) {
        case 'START': return 'Start';
        case 'DESTINATION': return 'Destination';
        case 'TURN': return 'Turning Point';
        case 'INTERMEDIATE': default: return 'Drop Point';
    }
}

function isRouteInGracePeriod(routePoints) {
    if (!routePoints || routePoints.length === 0) return false;
    const now = Date.now();
    // Check if any point in route was created within grace period
    return routePoints.some(p => {
        if (!p.created_at) return false;
        return (now - new Date(p.created_at).getTime()) < ROUTE_GRACE_PERIOD_MS;
    });
}

function getGracePeriodRemainingText(routePoints) {
    if (!routePoints || routePoints.length === 0) return '';
    const now = Date.now();
    let maxRemaining = 0;
    routePoints.forEach(p => {
        if (!p.created_at) return;
        const elapsed = now - new Date(p.created_at).getTime();
        const remaining = ROUTE_GRACE_PERIOD_MS - elapsed;
        if (remaining > maxRemaining) maxRemaining = remaining;
    });
    if (maxRemaining <= 0) return '';
    const mins = Math.ceil(maxRemaining / 60000);
    const secs = Math.ceil(maxRemaining / 1000) % 60;
    return mins > 1 ? mins + ' min remaining' : secs + 's remaining';
}

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
        const routePoints = routeGroups[routeName].sort((a, b) => (a.point_order || a.route_order || 0) - (b.point_order || b.route_order || 0));
        const inGrace = isToday(selectedDate) && isRouteInGracePeriod(routePoints);

        // Route header with assigned vehicle info
        const assignedV = routePoints[0] && routePoints[0].assigned_vehicle && routePoints[0].assigned_vehicle !== 'ALL'
            ? routePoints[0].assigned_vehicle : null;
        const stopCount = routePoints.length;
        const dropCount = routePoints.filter(p => (p.point_type || '').toUpperCase() === 'INTERMEDIATE').length;

        html += '<div style="margin-top:16px; margin-bottom:10px; padding:10px 14px; background:var(--surface-card, rgba(255,255,255,0.04)); border-radius:10px; border:1px solid var(--surface-border, rgba(255,255,255,0.08));">';
        html += '<div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">';
        html += '<div style="font-size:14px; font-weight:700; color:var(--text-primary, #fff);">🛣️ ' + routeName + '</div>';
        html += '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">';
        if (assignedV) {
            html += '<span style="font-size:10px; font-weight:700; padding:3px 8px; background:rgba(41,128,185,0.15); color:#3498db; border-radius:6px;">🚚 ' + assignedV + '</span>';
        }
        html += '<span style="font-size:10px; font-weight:600; padding:3px 8px; background:rgba(255,255,255,0.06); color:var(--text-muted, #9ca3af); border-radius:6px;">' + stopCount + ' stops · ' + dropCount + ' drops</span>';
        html += '</div></div>';

        // Grace period banner
        if (inGrace) {
            const remaining = getGracePeriodRemainingText(routePoints);
            html += '<div style="margin-top:8px; padding:6px 10px; background:rgba(241,196,15,0.1); border:1px solid rgba(241,196,15,0.25); border-radius:6px; font-size:11px; color:#f1c40f; font-weight:600;">' +
                '⏳ Route initializing — tracking starts after 5 min grace period' + (remaining ? ' (' + remaining + ')' : '') + '</div>';
        }
        html += '</div>';

        // For each vehicle, render timeline for this route
        vehicles.forEach(vehicleName => {
            const assignedPoints = routePoints.filter(p => isVehicleAssignedToPoint(vehicleName, p.assigned_vehicle));
            if (assignedPoints.length === 0) return;

            // Direction badge and shuttle run info from live loop state
            const routeKey = vehicleName + '_' + routeName;
            if (!routeLoopState[routeKey]) {
                routeLoopState[routeKey] = { leg: 'OUTBOUND', runCount: 1, status: 'IN_PROGRESS' };
            }
            const loopInfo = routeLoopState[routeKey];

            // Collect all run numbers present today for this vehicle + route
            const routeVehicleEvents = dropPointEvents.filter(e =>
                (e.vehicle_number === vehicleName || isVehicleAssignedToPoint(e.vehicle_number, vehicleName)) &&
                assignedPoints.some(p => p.id === e.point_id || p.id === e.drop_point_id)
            );

            // Group events into distinct Hire Cycles
            const hireGroups = {};
            routeVehicleEvents.forEach(evt => {
                const rNum = evt.run_number || 1;
                if (!hireGroups[rNum]) hireGroups[rNum] = [];
                hireGroups[rNum].push(evt);
            });

            const activeRunCount = loopInfo.runCount || 1;
            if (!hireGroups[activeRunCount]) {
                hireGroups[activeRunCount] = [];
            }

            const availableRuns = Object.keys(hireGroups).map(Number).sort((a, b) => a - b);

            if (!loopInfo.selectedRun || !availableRuns.includes(loopInfo.selectedRun)) {
                loopInfo.selectedRun = Math.max(...availableRuns, 1);
            }
            const activeRunNum = loopInfo.selectedRun;

            let dirBadge = '';
            if (isToday(selectedDate) && loopInfo) {
                const legColor = loopInfo.leg === 'INBOUND' ? '#e74c3c' : '#27ae60';
                const legIcon = loopInfo.leg === 'INBOUND' ? '↩️' : '➡️';
                dirBadge = ' <span style="font-size:10px; font-weight:700; padding:2px 6px; background:' + legColor + '22; color:' + legColor + '; border-radius:4px;">' + legIcon + ' ' + loopInfo.leg;
                if (loopInfo.runCount > 1) dirBadge += ' (Hire #' + loopInfo.runCount + ')';
                dirBadge += '</span>';
            }

            if (vehicles.length > 1 || selectedVehicle === 'all') {
                html += '<div style="font-size: 12px; font-weight: 700; color: var(--brand-red-light, #FF1F3A); margin: 8px 0 6px; padding-left: 28px;">🚛 ' + vehicleName + dirBadge + '</div>';
            } else if (dirBadge) {
                html += '<div style="font-size: 11px; margin: 4px 0 6px; padding-left: 28px;">' + dirBadge + '</div>';
            }

            // Shuttle run / Hire selector buttons if multiple hires exist
            if (availableRuns.length > 1) {
                html += '<div style="display:flex; gap:6px; margin:4px 0 10px 28px; align-items:center; flex-wrap:wrap;">';
                html += '<span style="font-size:11px; font-weight:700; color:var(--text-muted, #9ca3af);">Hire Runs:</span>';
                availableRuns.forEach(rNum => {
                    const isSelected = rNum === activeRunNum;
                    const isLatest = rNum === Math.max(...availableRuns);
                    const evts = hireGroups[rNum] || [];
                    const firstEvt = evts.length > 0 ? evts[0] : null;
                    const timeLabel = firstEvt && firstEvt.entry_time
                        ? ' (' + formatTime(firstEvt.entry_time) + ')'
                        : '';
                    const label = 'Hire #' + rNum + timeLabel + (isLatest ? ' 🚀' : ' 🏁');
                    const btnStyle = isSelected
                        ? 'background: linear-gradient(135deg, #E8001D, #B80017); color:#fff; font-weight:700; border:none; box-shadow:0 3px 10px rgba(232,0,29,0.4);'
                        : 'background:rgba(255,255,255,0.06); color:var(--text-muted, #9ca3af); font-weight:600; border:1px solid rgba(255,255,255,0.1);';
                    html += '<button onclick="selectShuttleRun(\'' + routeKey.replace(/'/g, "\\'") + '\', ' + rNum + ')" ' +
                        'style="padding:3px 8px; border-radius:6px; font-size:11px; cursor:pointer; ' + btnStyle + '">' +
                        label + '</button>';
                });
                html += '</div>';
            }

            html += '<div class="timeline-container"><div class="timeline-line"></div>';

            // 1. Build initial state for each assigned point in route order
            const pointStates = assignedPoints.map((point, idx) => {
                const pType = (point.point_type || 'INTERMEDIATE').toUpperCase();
                const typeIcon = getPointTypeIcon(pType);
                const typeLabel = getPointTypeLabel(pType);

                // Check grace period for this specific point
                const pointInGrace = isToday(selectedDate) && point.created_at &&
                    (Date.now() - new Date(point.created_at).getTime()) < ROUTE_GRACE_PERIOD_MS;

                // Find event for this point + vehicle + date + activeRunNum
                const event = dropPointEvents.find(e =>
                    (e.point_id === point.id || e.drop_point_id === point.id) &&
                    (e.vehicle_number === vehicleName || isVehicleAssignedToPoint(e.vehicle_number, vehicleName)) &&
                    (e.run_number === activeRunNum || (!e.run_number && activeRunNum === 1))
                );

                // Check live dwell tracking
                const dwellKey = vehicleName + '_' + point.id;
                const baseVName = extractBaseVehicleName(vehicleName);
                const dwellInfo = dwellTracking[dwellKey] || (baseVName ? dwellTracking[baseVName + '_' + point.id] : null);

                let status = pointInGrace ? 'grace' : 'pending';
                let entryDateObj = null;
                let exitDateObj = null;
                let waitedMinsNum = null;

                if (!pointInGrace && event) {
                    status = event.status || 'pending';
                    if (event.entry_time) {
                        entryDateObj = new Date(event.entry_time);
                    }
                    const leftTimeRaw = event.exit_time || event.left_time;
                    if (leftTimeRaw) {
                        exitDateObj = new Date(leftTimeRaw);
                    }
                    if (event.waited_minutes != null) {
                        waitedMinsNum = event.waited_minutes;
                    }
                }

                if (!pointInGrace && isToday(selectedDate) && dwellInfo && dwellInfo.inside && dwellInfo.enteredAt) {
                    if (!entryDateObj) entryDateObj = new Date(dwellInfo.enteredAt);
                    const elapsed = Date.now() - dwellInfo.enteredAt;
                    if (elapsed >= DWELL_THRESHOLD_MS) {
                        if (status !== 'departed') status = 'waiting';
                    } else {
                        status = 'approaching';
                    }
                }

                return {
                    point,
                    idx,
                    pType,
                    typeIcon,
                    typeLabel,
                    pointInGrace,
                    event,
                    dwellInfo,
                    status,
                    entryDateObj,
                    exitDateObj,
                    waitedMinsNum
                };
            });

            // 2. Sequential Progression Rule: If any subsequent stop j > i has an entry time, then stop i has DEPARTED!
            for (let i = 0; i < pointStates.length; i++) {
                const st = pointStates[i];
                if (!st.entryDateObj || st.pointInGrace) continue;

                // Look for subsequent entered stop
                let nextEntryDate = null;
                for (let j = i + 1; j < pointStates.length; j++) {
                    if (pointStates[j].entryDateObj) {
                        nextEntryDate = pointStates[j].entryDateObj;
                        break;
                    }
                }

                if (nextEntryDate) {
                    st.status = 'departed';
                    if (!st.exitDateObj || st.exitDateObj > nextEntryDate) {
                        st.exitDateObj = nextEntryDate;
                    }
                    const diffMs = Math.max(0, st.exitDateObj.getTime() - st.entryDateObj.getTime());
                    st.waitedMinsNum = Math.round(diffMs / 60000);

                    // Fix DB if it still had status = waiting
                    if (st.event && st.event.status !== 'departed') {
                        st.event.status = 'departed';
                        st.event.exit_time = st.exitDateObj.toISOString();
                        st.event.waited_minutes = st.waitedMinsNum;

                        supabaseClient.from('drop_point_events')
                            .update({
                                status: 'departed',
                                exit_time: st.exitDateObj.toISOString(),
                                waited_minutes: st.waitedMinsNum
                            })
                            .eq('id', st.event.id)
                            .then(() => {})
                            .catch(err => console.error('DB auto-fix error:', err));
                    }
                }
            }

            // 3. Render HTML for pointStates
            pointStates.forEach(st => {
                let entryTime = st.entryDateObj ? formatTime(st.entryDateObj) : '--:--';
                let waitedTime = '--';
                let leftTime = st.exitDateObj ? formatTime(st.exitDateObj) : '--:--';

                if (st.status === 'departed') {
                    if (st.waitedMinsNum != null) {
                        waitedTime = Math.round(st.waitedMinsNum) + ' min';
                    } else if (st.entryDateObj && st.exitDateObj) {
                        const mins = Math.round((st.exitDateObj.getTime() - st.entryDateObj.getTime()) / 60000);
                        waitedTime = Math.max(0, mins) + ' min';
                    }
                } else if (st.status === 'waiting') {
                    if (st.entryDateObj) {
                        const elapsedMins = Math.round((Date.now() - st.entryDateObj.getTime()) / 60000);
                        waitedTime = Math.max(0, elapsedMins) + ' min';
                    }
                    leftTime = '--:--'; // Active stop waiting, left time not reached yet!
                } else if (st.status === 'approaching') {
                    if (st.dwellInfo && st.dwellInfo.enteredAt) {
                        const elapsedSecs = Math.round((Date.now() - st.dwellInfo.enteredAt) / 1000);
                        waitedTime = 'Detected ' + elapsedSecs + 's ago';
                    }
                    leftTime = '--:--';
                }

                const dotClass = st.status;
                const isActive = (st.status === 'waiting' || st.status === 'entered') ? ' active' : '';
                const typeBadge = '<span style="font-size:9px; font-weight:700; padding:1px 5px; background:rgba(255,255,255,0.06); color:var(--text-muted, #9ca3af); border-radius:3px; margin-left:4px;">' + st.typeIcon + ' ' + st.typeLabel + '</span>';

                html += '<div class="timeline-item">' +
                    '<div class="timeline-dot ' + dotClass + '"></div>' +
                    '<div class="timeline-card' + isActive + '">' +
                    '<div class="timeline-point-name">' + st.typeIcon + ' ' + st.point.point_name + typeBadge + '</div>' +
                    '<div class="timeline-point-route">#' + (st.point.point_order || st.point.route_order || 1) + ' on ' + (st.point.route_name || 'Route') + '</div>' +
                    '<div class="timeline-times">' +
                    '<div class="timeline-time-block"><div class="time-label">ENTRY</div><div class="time-value ' + (st.status === 'departed' || st.status === 'waiting' ? 'green' : 'muted') + '">' + entryTime + '</div></div>' +
                    '<div class="timeline-time-block"><div class="time-label">WAITED</div><div class="time-value ' + (st.status === 'waiting' ? 'blue' : 'muted') + '">' + waitedTime + '</div></div>' +
                    '<div class="timeline-time-block"><div class="time-label">LEFT</div><div class="time-value ' + (st.status === 'departed' || leftTime !== '--:--' ? 'amber' : 'muted') + '">' + leftTime + '</div></div>' +
                    '</div>' +
                    '<div class="timeline-status-badge ' + st.status + '">' + getStatusIcon(st.status) + ' ' + getStatusText(st.status) + '</div>' +
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
        case 'grace': return '⏱️';
        default: return '⏸️';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'departed': return 'Departed';
        case 'waiting': return 'Waiting';
        case 'entered': return 'Entered Area';
        case 'approaching': return 'Approaching';
        case 'grace': return 'Initializing...';
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

function fetchWialonJSONP(svc, params, sid = null) {
    return new Promise((resolve, reject) => {
        const callbackName = 'wialon_cb_' + Math.random().toString(36).substring(2, 9);
        let url = `https://hst-api.wialon.com/wialon/ajax.html?svc=${svc}&params=${encodeURIComponent(JSON.stringify(params))}&callback=${callbackName}`;
        if (sid) url += `&sid=${sid}`;

        const script = document.createElement('script');
        script.src = url;

        window[callbackName] = function(data) {
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
            resolve(data);
        };

        script.onerror = function(err) {
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
            reject(err);
        };

        document.body.appendChild(script);
    });
}

function connectToWialon() {
    console.log('Connecting to Wialon GPS tracking (JSONP Mode)...');
    fetchAndProcessVehicles();
    startGeofencePolling();
}

async function fetchAndProcessVehicles() {
    const config = getWialonConfig();
    const token = config.token || '2dc41f89a60d68ba8fd0a5e34722386f728895444F6CEE221D45222A43B65B5606DE57A0';

    try {
        // 1. Authenticate with Wialon API via JSONP (CORS-safe)
        const loginData = await fetchWialonJSONP('token/login', { token });

        if (!loginData || !loginData.eid) {
            console.error('Wialon JSONP login failed:', loginData);
            return;
        }

        const sid = loginData.eid;

        // 2. Fetch all AVL units with position data (flags = 1025)
        const searchData = await fetchWialonJSONP('core/search_items', {
            spec: { itemsType: 'avl_unit', propName: 'sys_name', propValueMask: '*', sortType: 'sys_name' },
            force: 1, flags: 1025, from: 0, to: 0
        }, sid);

        // Clean logout
        fetchWialonJSONP('core/logout', {}, sid).catch(() => {});

        const items = (searchData && searchData.items) ? searchData.items : [];

        // Filter to only vehicles this client has access to
        wiaVehicleData = items
            .filter(item => {
                const name = (item.nm || '').trim();
                if (!name) return false;
                if (!clientVehicles || clientVehicles.length === 0) return true; // Show all if no filter set
                return clientVehicles.some(cv => {
                    if (!cv) return false;
                    const cvClean = String(cv).trim().toUpperCase();
                    const nmClean = name.toUpperCase();
                    return cvClean === nmClean || extractBaseVehicleName(cv) === extractBaseVehicleName(name);
                });
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

        console.log(`[Wialon GPS] Updated ${wiaVehicleData.length} vehicles for client tracking`);

        // Update UI components & run geofence engine
        renderVehiclesList();
        updateMapMarkers();
        processGeofences();

    } catch (err) {
        console.error('fetchAndProcessVehicles JSONP error:', err);
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

function isVehicleAssignedToPoint(vehicleName, assignedVehicle) {
    if (!assignedVehicle || assignedVehicle === 'ALL') return true;
    if (!vehicleName) return false;
    const vClean = String(assignedVehicle).trim().toUpperCase();
    const nmClean = String(vehicleName).trim().toUpperCase();
    if (vClean === nmClean) return true;
    const base1 = extractBaseVehicleName(assignedVehicle);
    const base2 = extractBaseVehicleName(vehicleName);
    return (base1 && base2 && base1 === base2);
}

let routeLoopState = {}; // { 'vehicle_route': { leg: 'OUTBOUND' | 'INBOUND', runCount: 1 } }

function processGeofences() {
    if (!isToday(selectedDate)) return; // Only process for today
    if (wiaVehicleData.length === 0 || clientDropPoints.length === 0) return;

    const now = Date.now();

    wiaVehicleData.forEach(vehicle => {
        if (!vehicle.hasPosition) return;

        clientDropPoints.forEach(point => {
            // Respect vehicle-to-route point assignments
            if (!isVehicleAssignedToPoint(vehicle.name, point.assigned_vehicle)) return;

            // 5-minute grace period: skip newly created route points
            // so the vehicle at the starting point doesn't trigger immediately
            if (point.created_at) {
                const createdTime = new Date(point.created_at).getTime();
                const ROUTE_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
                if (now - createdTime < ROUTE_GRACE_PERIOD_MS) {
                    return; // Route too new, skip until 5 min after creation
                }
            }

            const dwellKey = vehicle.name + '_' + point.id;
            const routeKey = vehicle.name + '_' + (point.route_name || 'default');

            if (!routeLoopState[routeKey]) {
                routeLoopState[routeKey] = { leg: 'OUTBOUND', runCount: 1 };
            }
            const loopState = routeLoopState[routeKey];

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

                    // Check Point Role
                    const pType = point.point_type || (point.is_start_point ? 'START' : point.is_turning_point ? 'TURN' : 'INTERMEDIATE');

                    if (pType === 'TURN' || point.is_turning_point) {
                        loopState.leg = 'INBOUND'; // Reached Turning Point, now returning back!
                        console.log('[Loop] ' + vehicle.name + ' reached TURNING POINT ' + point.point_name + '. Switched leg to INBOUND.');
                    } else if ((pType === 'DESTINATION' || pType === 'START' || point.is_start_point) && loopState.leg === 'INBOUND') {
                        // Vehicle reached Destination Point (or returned to Starting Point) after turning! Complete round trip!
                        completeShuttleRun(vehicle, point, routeKey);
                    }
                } else {
                    // Still inside
                    dwell.lastSeen = now;

                    // Check if 5-min threshold reached and not yet confirmed
                    if (!dwell.confirmed && (now - dwell.enteredAt >= DWELL_THRESHOLD_MS)) {
                        // Record entry event in DB
                        recordEntryEvent(vehicle, point, dwell, loopState.leg);
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

                    // Check if this point is DESTINATION point (or final stop on route)
                    const routePts = clientDropPoints.filter(p => p.route_name === point.route_name)
                        .sort((a, b) => (a.point_order || a.route_order || 0) - (b.point_order || b.route_order || 0));
                    const isDestPoint = (point.point_type || '').toUpperCase() === 'DESTINATION' ||
                        point.is_destination_point ||
                        (routePts.length > 0 && routePts[routePts.length - 1].id === point.id);

                    if (isDestPoint) {
                        console.log('[Shuttle Engine] Vehicle ' + vehicle.name + ' left DESTINATION point ' + point.point_name + '. Shuttle run completed!');
                        if (routeLoopState[routeKey]) {
                            routeLoopState[routeKey].status = 'COMPLETED_WAITING_RESTART';
                        }
                        showToast('🏁 Shuttle Run #' + (loopState.runCount || 1) + ' Completed! Vehicle left destination ' + point.point_name + '. Next run starts when vehicle returns to starting point & waits 5 mins.', 'success', 6000);
                    }

                    // Reset tracking for this point
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

function selectShuttleRun(routeKey, runNum) {
    if (!routeLoopState[routeKey]) {
        routeLoopState[routeKey] = { leg: 'OUTBOUND', runCount: 1, status: 'IN_PROGRESS' };
    }
    routeLoopState[routeKey].selectedRun = runNum;
    renderTimeline();
}

async function completeShuttleRun(vehicle, startPoint, routeKey) {
    showToast('🏁 Shuttle Run Completed! ' + vehicle.name + ' returned to ' + startPoint.point_name + '. Timeline refreshed for next run.', 'success', 5000);
    
    clientDropPoints.filter(p => p.route_name === startPoint.route_name).forEach(p => {
        const k = vehicle.name + '_' + p.id;
        delete dwellTracking[k];
    });

    if (routeLoopState[routeKey]) {
        routeLoopState[routeKey].leg = 'OUTBOUND';
        routeLoopState[routeKey].runCount += 1;
    }

    // Refresh history and today's timeline
    await loadEventsForDate(selectedDate);
}

async function recordEntryEvent(vehicle, point, dwell, legType = 'OUTBOUND') {
    try {
        const routeKey = vehicle.name + '_' + (point.route_name || 'default');
        if (!routeLoopState[routeKey]) {
            routeLoopState[routeKey] = { leg: 'OUTBOUND', runCount: 1, status: 'IN_PROGRESS' };
        }
        const loopState = routeLoopState[routeKey];

        // Check if point is the START point (or first stop on route)
        const routePts = clientDropPoints.filter(p => p.route_name === point.route_name)
            .sort((a, b) => (a.point_order || a.route_order || 0) - (b.point_order || b.route_order || 0));
        const isStartPoint = (point.point_type || '').toUpperCase() === 'START' ||
            point.is_start_point ||
            (routePts.length > 0 && routePts[0].id === point.id);

        // A new Hire/Run starts when:
        // 1) Vehicle arrives at START point AND previous hire was completed (status === 'COMPLETED_WAITING_RESTART')
        // OR 2) Vehicle arrives at START point after a completion gap (> 10 minutes)
        const isNewHireTrigger = isStartPoint && (
            loopState.status === 'COMPLETED_WAITING_RESTART' ||
            (loopState.completedAt && (Date.now() - loopState.completedAt > 10 * 60 * 1000))
        );

        if (isNewHireTrigger) {
            loopState.runCount += 1;
            loopState.status = 'IN_PROGRESS';
            loopState.selectedRun = loopState.runCount;
            loopState.completedAt = null;

            // Clear dwell tracking for other points on this route for the new hire
            clientDropPoints.filter(p => p.route_name === point.route_name).forEach(p => {
                const k = vehicle.name + '_' + p.id;
                delete dwellTracking[k];
            });

            showToast('🚀 New Hire / Shuttle Run #' + loopState.runCount + ' Started! Vehicle waited 5 minutes at ' + point.point_name + '.', 'success', 6000);
        }

        const currentRunNum = loopState.runCount || 1;
        const entryDate = new Date(dwell.enteredAt);
        const entryIso = entryDate.toISOString();

        // 1. DEDUPLICATION CHECK: Do not insert if an active waiting event for this vehicle & point & run ALREADY exists
        const existingWaitingEvent = dropPointEvents.find(e =>
            (e.point_id === point.id || e.drop_point_id === point.id) &&
            (e.vehicle_number === vehicle.name || isVehicleAssignedToPoint(e.vehicle_number, vehicle.name)) &&
            (e.run_number === currentRunNum || (!e.run_number && currentRunNum === 1)) &&
            e.status === 'waiting'
        );

        if (existingWaitingEvent) {
            console.log('[Geofence] Active waiting event already recorded for ' + point.point_name + ' (id: ' + existingWaitingEvent.id + '). Skipping duplicate.');
            dwell.eventId = existingWaitingEvent.id;
            return;
        }

        // 2. AUTO-CLOSE ALL PRIOR UNCLOSED WAITING EVENTS for this vehicle on this route
        const activePrevEvents = dropPointEvents.filter(e =>
            (e.vehicle_number === vehicle.name || isVehicleAssignedToPoint(e.vehicle_number, vehicle.name)) &&
            e.status === 'waiting'
        );

        for (const prevEvt of activePrevEvents) {
            const prevEntryTime = prevEvt.entry_time ? new Date(prevEvt.entry_time).getTime() : dwell.enteredAt;
            const diffMins = Math.max(0, (dwell.enteredAt - prevEntryTime) / 60000);
            await supabaseClient
                .from('drop_point_events')
                .update({
                    exit_time: entryIso,
                    waited_minutes: Math.round(diffMins),
                    status: 'departed'
                })
                .eq('id', prevEvt.id);
        }

        // 3. Insert new entry event with run_number and trip_id
        const { data, error } = await supabaseClient
            .from('drop_point_events')
            .insert({
                user_id: currentClient.user_id || currentClient.id,
                client_id: currentClient.id,
                point_id: point.id,
                vehicle_number: vehicle.name,
                leg_type: legType,
                run_number: currentRunNum,
                trip_id: 'HIRE-' + formatDateISO(entryDate) + '-RUN-' + currentRunNum,
                entry_time: entryIso,
                status: 'waiting'
            })
            .select()
            .single();

        if (!error && data) {
            dwell.eventId = data.id;
            showToast('🚛 ' + vehicle.name + ' arrived at ' + point.point_name + ' (Hire #' + currentRunNum + ')', 'success');
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
        const waitedMinutes = (departureTimestamp - dwell.enteredAt) / 60000;

        const { error } = await supabaseClient
            .from('drop_point_events')
            .update({
                exit_time: leftTime.toISOString(),
                waited_minutes: Math.round(waitedMinutes),
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

    // Add drop point markers — color-coded by point type
    clientDropPoints.forEach(p => {
        if (!p.latitude || !p.longitude) return;

        const pType = (p.point_type || 'INTERMEDIATE').toUpperCase();
        const typeColors = {
            'START': { bg: '#27AE60', circle: '#27AE60', icon: '🟢' },
            'DESTINATION': { bg: '#E74C3C', circle: '#E74C3C', icon: '🏁' },
            'TURN': { bg: '#F39C12', circle: '#F39C12', icon: '🔄' },
            'INTERMEDIATE': { bg: '#38BDF8', circle: '#38BDF8', icon: '📍' }
        };
        const tc = typeColors[pType] || typeColors['INTERMEDIATE'];

        const dpIcon = L.divIcon({
            html: '<div style="background: ' + tc.bg + '; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; ' +
                  'transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; ' +
                  'border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">' +
                  '<span style="transform: rotate(45deg); font-size: 12px;">' + tc.icon + '</span></div>' +
                  '<div style="position: absolute; top: 28px; left: 50%; transform: translateX(-50%); ' +
                  'background: ' + tc.bg + 'E6; color: #fff; padding: 2px 6px; border-radius: 4px; ' +
                  'font-size: 9px; font-weight: 700; white-space: nowrap;">' + p.point_name + '</div>',
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 24],
            popupAnchor: [0, -28]
        });

        // Draw radius circle with point-type color
        const circle = L.circle([p.latitude, p.longitude], {
            radius: p.radius_meters || 500,
            color: tc.circle,
            fillColor: tc.circle,
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: '5,5'
        }).addTo(clientMap);
        clientDropPointMarkers.push(circle);

        const typeLabel = getPointTypeLabel(pType);
        const marker = L.marker([p.latitude, p.longitude], { icon: dpIcon })
            .bindPopup('<b>' + tc.icon + ' ' + p.point_name + '</b><br>' +
                       '<span style="font-size:11px;">Type: ' + typeLabel + '</span><br>' +
                       'Route: ' + (p.route_name || 'N/A') +
                       '<br>Radius: ' + (p.radius_meters || 500) + 'm' +
                       (p.assigned_vehicle && p.assigned_vehicle !== 'ALL' ? '<br>Vehicle: 🚚 ' + p.assigned_vehicle : ''))
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

        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        const { data } = await supabaseClient
            .from('drop_point_events')
            .select('*')
            .eq('client_id', currentClient.id)
            .gte('created_at', startISO)
            .lte('created_at', endISO)
            .order('created_at', { ascending: false });

        const events = data || [];

        if (events.length === 0) {
            container.innerHTML = '<div class="empty-state">' +
                '<div class="empty-icon">📋</div>' +
                '<div class="empty-text">No events in the last ' + HISTORY_DAYS + ' days</div>' +
                '<div class="empty-sub">Drop point arrival events will appear here.</div>' +
                '</div>';
            return;
        }

        // Group by date string (YYYY-MM-DD)
        const grouped = {};
        events.forEach(e => {
            const key = e.created_at ? e.created_at.substring(0, 10) : 'Today';
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
                const matchedPoint = clientDropPoints.find(p => p.id === e.point_id || p.id === e.drop_point_id);
                const pointName = matchedPoint ? matchedPoint.point_name : 'Drop Point';
                const routeName = matchedPoint ? matchedPoint.route_name : (e.route_name || '');
                const dotClass = e.status === 'departed' ? 'departed' : 'waiting';
                const vehicleNum = e.vehicle_number || e.vehicle_name || 'Vehicle';
                const leftTimeStr = (e.exit_time || e.left_time) ? formatTime(e.exit_time || e.left_time) : '--:--';

                html += '<div class="history-event-card">' +
                    '<div class="history-event-dot ' + dotClass + '"></div>' +
                    '<div class="history-event-info">' +
                    '<div class="history-event-name">' + pointName + (routeName ? ' — ' + routeName : '') + '</div>' +
                    '<div class="history-event-times">' +
                    '<span>⏰ Entry: ' + formatTime(e.entry_time) + '</span>' +
                    '<span>⏳ Waited: ' + (e.waited_minutes != null ? Math.round(e.waited_minutes) + ' min' : '-') + '</span>' +
                    '<span>🚛 Left: ' + leftTimeStr + '</span>' +
                    '</div>' +
                    '<div class="history-event-vehicle">🚛 ' + vehicleNum + '</div>' +
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

// ============ PERIODIC DROP POINT REFRESH & REALTIME ============
// Re-fetches routes every 10 seconds and subscribes to Supabase WebSockets for instant updates without page refresh

let realtimeChannel = null;

function subscribeToRealtimeUpdates() {
    if (!supabaseClient || !currentClient) return;

    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
        .channel('client-live-updates-' + currentClient.id)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'client_drop_points',
            filter: 'client_id=eq.' + currentClient.id
        }, async () => {
            console.log('[Realtime] Route points changed by admin, updating UI...');
            const { data: points } = await supabaseClient
                .from('client_drop_points')
                .select('*')
                .eq('client_id', currentClient.id)
                .order('route_name', { ascending: true })
                .order('point_order', { ascending: true });

            clientDropPoints = points || [];
            clientRoutes = [...new Set(clientDropPoints.map(p => p.route_name).filter(Boolean))];
            renderRouteTabs();
            renderVehicleFilter();
            renderTimeline();
            updateMapMarkers();
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'drop_point_events',
            filter: 'client_id=eq.' + currentClient.id
        }, async (payload) => {
            console.log('[Realtime] Event recorded, updating timeline...', payload);
            if (payload?.new?.status === 'RESTART_HIRE') {
                const resetRoute = payload.new.route_name;
                if (!resetRoute || resetRoute === 'SYSTEM_RESET') {
                    dwellTracking = {};
                    showToast('🚀 Transport Admin restarted hire tracking for all routes!', 'info', 4000);
                } else {
                    const routePointIds = new Set(clientDropPoints.filter(p => p.route_name === resetRoute).map(p => p.id));
                    Object.keys(dwellTracking).forEach(key => {
                        const parts = key.split('_');
                        const pointId = parts[parts.length - 1];
                        if (routePointIds.has(pointId)) {
                            delete dwellTracking[key];
                        }
                    });
                    showToast('🚀 Transport Admin restarted hire tracking for ' + resetRoute + '!', 'info', 4000);
                }
            }
            await loadEventsForDate(selectedDate);
        })
        .subscribe((status) => {
            console.log('[Realtime Subscription Status]:', status);
        });
}

function startDropPointRefresh() {
    stopDropPointRefresh();
    dropPointRefreshTimer = setInterval(async () => {
        if (!currentClient) return;
        try {
            const { data: points } = await supabaseClient
                .from('client_drop_points')
                .select('*')
                .eq('client_id', currentClient.id)
                .order('route_name', { ascending: true })
                .order('point_order', { ascending: true });

            const newPoints = points || [];
            // Compare full points JSON signature to detect any route, name, or vehicle assignment change
            if (JSON.stringify(newPoints) !== JSON.stringify(clientDropPoints)) {
                clientDropPoints = newPoints;
                clientRoutes = [...new Set(clientDropPoints.map(p => p.route_name).filter(Boolean))];
                renderRouteTabs();
                renderVehicleFilter();
                renderTimeline();
                updateMapMarkers();
                console.log('[AutoRefresh] Routes updated — ' + clientDropPoints.length + ' points loaded');
            }

            // Check evening 6:00 PM shift boundary auto-refresh
            checkShiftTransition();

            // Periodically refresh events for live status sync
            if (isToday(selectedDate)) {
                await loadEventsForDate(selectedDate);
            }
        } catch (err) {
            console.error('Drop point auto-refresh error:', err);
        }
    }, DROP_POINT_REFRESH_MS);
}

function stopDropPointRefresh() {
    if (dropPointRefreshTimer) {
        clearInterval(dropPointRefreshTimer);
        dropPointRefreshTimer = null;
    }
    if (realtimeChannel && supabaseClient) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
}

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
