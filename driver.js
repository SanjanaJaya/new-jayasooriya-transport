// driver.js - Partner Driver App for Jayasooriya Transport
// Handles: Mobile Login, Interactive Map with Geolocation & Distributors, Monthly KM Tracker, and Live/Finalized Salary Breakdown.

// Supabase Configuration (Matching admin app)
const SUPABASE_URL = 'https://slmqjqkpgdhrdcoempdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbXFqcWtwZ2RocmRjb2VtcGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3OTg4NzUsImV4cCI6MjA3NjM3NDg3NX0.mXDMuhn0K5sOKhwykhf9OcomUzSVkCGnN5jr60A-TSw';

let supabaseClient = null;
let currentDriver = null; // Stored driver partner record
let driverLorry = null;   // Assigned vehicle/lorry plate number
let driverLorryId = null; // Associated vehicle ID in table
let activeMonth = "";     // YYYY-MM
let driverMap = null;
let markers = [];
let userLocationMarker = null;
let isOnline = true;
let distributorsList = [];

// Starting point
const KD_START_POINT = {
    name: 'John Keells Enderamulla',
    town: 'Enderamulla, Wattala',
    lat: 6.993777247636533,
    lng: 79.91975853540127,
    logoUrl: 'https://i.postimg.cc/QdvbXY1c/id-AYs-TFstv.png'
};

// Initialize App
function initApp() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error('Supabase library not loaded');
        alert('Could not initialize database connection. Please reload.');
        return;
    }

    // Register Service Worker for PWA installability
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Driver App PWA Service Worker Registered', reg.scope))
            .catch(err => console.error('Driver App PWA Service Worker Registration Failed', err));
    }

    setDefaultMonth();
    setupEventHandlers();
    checkExistingSession();
}

// Set default month to current local month
function setDefaultMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    activeMonth = `${year}-${month}`;
    
    const el = document.getElementById('salaryMonthFilter');
    if (el) el.value = activeMonth;
}

// Check if driver is already logged in
async function checkExistingSession() {
    const savedDriver = localStorage.getItem('jt_driver_session');
    if (savedDriver) {
        try {
            currentDriver = JSON.parse(savedDriver);
            // Refresh driver data from DB to ensure it's up to date
            const { data, error } = await supabaseClient
                .from('drivers')
                .select('*')
                .eq('id', currentDriver.id)
                .single();
                
            if (!error && data && !data.terminated) {
                currentDriver = data;
                localStorage.setItem('jt_driver_session', JSON.stringify(currentDriver));
                showDashboard();
            } else {
                logout();
            }
        } catch (e) {
            console.error('Session restore failed:', e);
            logout();
        }
    } else {
        showView('loginView');
    }
}

// Switch between views
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.add('active');
    }
}

// Setup Event Handlers
function setupEventHandlers() {
    // Login Form Submit
    const loginForm = document.getElementById('driverLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const contact = document.getElementById('loginContact').value;
            const license = document.getElementById('loginLicense').value;
            const errorEl = document.getElementById('loginError');
            const submitBtn = document.getElementById('loginSubmitBtn');
            
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = 'Signing in...';

            try {
                const driver = await authenticateDriver(contact, license);
                currentDriver = driver;
                localStorage.setItem('jt_driver_session', JSON.stringify(currentDriver));
                showDashboard();
            } catch (err) {
                errorEl.textContent = err.message || 'Authentication failed';
                errorEl.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = 'Sign In';
            }
        });
    }

    // Recenter Map Button
    const recenterBtn = document.getElementById('recenterMapBtn');
    if (recenterBtn) {
        recenterBtn.addEventListener('click', () => {
            trackUserLocation(true);
        });
    }

    // Toggle Offline / Online status
    const statusBtn = document.getElementById('statusToggleBtn');
    if (statusBtn) {
        statusBtn.addEventListener('click', () => {
            isOnline = !isOnline;
            if (isOnline) {
                statusBtn.className = 'status-btn online';
                document.getElementById('statusText').textContent = 'ONLINE';
            } else {
                statusBtn.className = 'status-btn offline';
                document.getElementById('statusText').textContent = 'OFFLINE';
                statusBtn.style.color = '#FF2040';
                statusBtn.style.borderColor = 'rgba(255, 32, 64, 0.4)';
            }
        });
    }

    // Touchable KM Card triggers Salary Modal
    const kmCard = document.getElementById('kmSummaryCard');
    if (kmCard) {
        kmCard.addEventListener('click', () => {
            openSalaryModal();
        });
        kmCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                openSalaryModal();
            }
        });
    }

    // Close Salary Modal Buttons
    document.getElementById('closeSalaryModalBtn')?.addEventListener('click', closeSalaryModal);
    document.getElementById('closeSalaryModalBackdrop')?.addEventListener('click', closeSalaryModal);

    // KM Log Modal Controls
    document.getElementById('openKmLogBtn')?.addEventListener('click', openKmLogModal);
    document.getElementById('closeKmLogModalBtn')?.addEventListener('click', closeKmLogModal);
    document.getElementById('closeKmLogModalBackdrop')?.addEventListener('click', closeKmLogModal);

    const kmLogForm = document.getElementById('kmLogForm');
    if (kmLogForm) {
        kmLogForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitKmLog();
        });
    }

    // Logout Button in Modal
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to log out?')) {
            logout();
        }
    });

    // Month Selector in Salary Modal
    document.getElementById('salaryMonthFilter')?.addEventListener('change', (e) => {
        activeMonth = e.target.value;
        loadSalaryDetails();
    });

    // Drawer handle tap toggle
    const handleBar = document.getElementById('distributorDrawerHandle');
    const drawer = document.getElementById('distributorDrawer');
    const arrow = handleBar?.querySelector('.drawer-toggle-arrow');
    
    if (handleBar && drawer) {
        handleBar.addEventListener('click', () => {
            drawer.classList.toggle('open');
            arrow?.classList.toggle('open');
            if (drawer.classList.contains('open')) {
                arrow.textContent = '▼';
            } else {
                arrow.textContent = '▲';
            }
        });
    }

    // Search distributors
    const searchInput = document.getElementById('searchDistributors');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterDistributorsList(e.target.value);
        });
    }
}

// Authentication Logic
async function authenticateDriver(contact, license) {
    const cleanContact = contact.trim();
    const cleanLicense = license ? license.trim() : "";

    let { data, error } = await supabaseClient
        .from('drivers')
        .select('*')
        .eq('contact', cleanContact)
        .neq('terminated', true);

    // Suffix match fallback for Sri Lankan phone number format variation (e.g. 077... vs +9477... vs 77...)
    if ((!data || data.length === 0) && !error) {
        const digitsOnly = cleanContact.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 9) {
            const last9 = digitsOnly.slice(-9);
            const fallbackQuery = await supabaseClient
                .from('drivers')
                .select('*')
                .ilike('contact', `%${last9}`)
                .neq('terminated', true);
            
            if (!fallbackQuery.error && fallbackQuery.data && fallbackQuery.data.length > 0) {
                data = fallbackQuery.data;
            }
        }
    }

    if (error) {
        throw new Error('Database error: ' + error.message);
    }

    if (!data || data.length === 0) {
        throw new Error('No driver found with this phone number. Check the format or make sure your profile is active in the admin portal.');
    }

    // Check license match (case-insensitive, handles empty strings)
    const matched = data.find(d => {
        const dbLic = d.license_number ? d.license_number.trim().toLowerCase() : "";
        const inputLic = cleanLicense.toLowerCase();
        return dbLic === inputLic;
    });

    if (!matched) {
        throw new Error('Invalid credentials (License number incorrect).');
    }

    return matched;
}

// Logout driver partner
function logout() {
    localStorage.removeItem('jt_driver_session');
    currentDriver = null;
    driverLorry = null;
    driverLorryId = null;
    if (driverMap) {
        driverMap.remove();
        driverMap = null;
    }
    closeSalaryModal();
    showView('loginView');
}

// Load and show dashboard
async function showDashboard() {
    showView('dashboardView');
    
    // Update basic UI fields
    document.getElementById('driverName').textContent = currentDriver.name;
    if (currentDriver.photo_url) {
        document.getElementById('driverAvatar').src = currentDriver.photo_url;
    }

    // Fetch Assigned Lorry Details
    await fetchLorryAssignment();

    // Load Live Stats (KM and Estimated Earnings)
    await loadDashboardStats();

    // Initialize map
    initDriverMap();

    // Fetch and plot Kevilton distribution locations
    await loadKeviltonDistributors();
}

// Fetch staff lorry assignment
async function fetchLorryAssignment() {
    const assignEl = document.getElementById('assignedLorry');
    assignEl.innerHTML = '<div class="skeleton skeleton-text" style="width: 50px;"></div>';
    driverLorry = null;
    driverLorryId = null;

    try {
        const { data, error } = await supabaseClient
            .from('staff_lorry_assignments')
            .select('lorry_number')
            .eq('driver_id', currentDriver.id)
            .maybeSingle();

        if (error) throw error;
        
        if (data) {
            driverLorry = data.lorry_number;
            assignEl.textContent = driverLorry;
            
            // Now resolve the vehicle ID in database (needed for trip estimates)
            const baseLorryName = extractBaseVehicleName(driverLorry);
            
            // Try fetching from hire_to_pay_vehicles
            const { data: hireV } = await supabaseClient
                .from('hire_to_pay_vehicles')
                .select('id')
                .ilike('lorry_number', `%${baseLorryName}%`)
                .maybeSingle();

            if (hireV) {
                driverLorryId = hireV.id;
            } else {
                // Try from commitment_vehicles
                const { data: commV } = await supabaseClient
                    .from('commitment_vehicles')
                    .select('id')
                    .ilike('vehicle_number', `%${baseLorryName}%`)
                    .maybeSingle();

                if (commV) {
                    driverLorryId = commV.id;
                }
            }
        }
    } catch (err) {
        console.error('Error fetching assignment:', err.message);
    }
}

// Helper: Normalize vehicle names for matching
function extractBaseVehicleName(name) {
    if (!name) return '';
    const match = name.match(/([a-zA-Z0-9]{1,4})\s*-\s*([0-9]{1,4})/);
    if (match) {
        return `${match[1].trim().toUpperCase()} - ${match[2].trim()}`;
    }
    return name.trim().toUpperCase();
}

// Load Dashboard Statistics (KM & quick estimate)
async function loadDashboardStats() {
    try {
        const [year, month] = activeMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        document.getElementById('monthlyKmValue').innerHTML = '<div class="skeleton skeleton-value"></div>';
        document.getElementById('salaryQuickEstimate').innerHTML = '<div class="skeleton skeleton-desc"></div>';

        // 1. Fetch KM records for current month
        const { data: kmRecs, error: kmError } = await supabaseClient
            .from('driver_km_records')
            .select('km_amount')
            .eq('driver_id', currentDriver.id)
            .gte('record_date', startDate)
            .lte('record_date', endDate);

        if (kmError) throw kmError;

        let totalKm = 0;
        if (kmRecs) {
            totalKm = kmRecs.reduce((sum, r) => sum + parseFloat(r.km_amount || 0), 0);
        }

        animateNumericText('monthlyKmValue', 0, totalKm, 800);

        // 2. Fetch Advances, Day Offs, Deductions and salary slip to display quick estimate
        const [
            { data: salarySlip },
            { data: advances },
            { data: dayOffs },
            { data: deductions }
        ] = await Promise.all([
            supabaseClient.from('driver_salary').select('net_salary').eq('driver_id', currentDriver.id).eq('salary_month', activeMonth).maybeSingle(),
            supabaseClient.from('driver_advances').select('amount').eq('driver_id', currentDriver.id).gte('advance_date', startDate).lte('advance_date', endDate),
            supabaseClient.from('driver_day_offs').select('deduction_amount').eq('driver_id', currentDriver.id).gte('day_off_date', startDate).lte('day_off_date', endDate),
            supabaseClient.from('staff_deductions').select('amount').eq('driver_id', currentDriver.id).eq('salary_month', activeMonth)
        ]);

        const estimateEl = document.getElementById('salaryQuickEstimate');

        if (salarySlip) {
            estimateEl.textContent = `Salary: LKR ${parseFloat(salarySlip.net_salary).toFixed(2)}`;
            estimateEl.style.color = '#00B37E'; // green finalized
        } else {
            // Live estimation calculation
            const totalAdvances = advances?.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0) || 0;
            const totalDayOffs = dayOffs?.reduce((sum, d) => sum + parseFloat(d.deduction_amount || 0), 0) || 0;
            const totalDeductions = deductions?.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0) || 0;

            let gross = 0;
            if (currentDriver.salary_type === 'fixed') {
                const basic = parseFloat(currentDriver.basic_salary || 0);
                const limit = parseFloat(currentDriver.km_limit || 0);
                const rate = parseFloat(currentDriver.extra_km_rate || 0);
                const extraKm = Math.max(0, totalKm - limit);
                const extraKmSal = extraKm * rate;
                gross = basic + extraKmSal;
            } else {
                // Per-tip live estimation needs completed trips count
                let tripCount = 0;
                if (driverLorryId) {
                    const [{ count: hireCount }, { count: commCount }] = await Promise.all([
                        supabaseClient.from('hire_to_pay_records').select('*', { count: 'exact', head: true }).eq('vehicle_id', driverLorryId).gte('hire_date', startDate).lte('hire_date', endDate),
                        supabaseClient.from('commitment_records').select('*', { count: 'exact', head: true }).eq('vehicle_id', driverLorryId).gte('hire_date', startDate).lte('hire_date', endDate)
                    ]);
                    tripCount = (hireCount || 0) + (commCount || 0);
                }
                const perTipCharge = parseFloat(currentDriver.per_tip_charge || 0);
                gross = tripCount * perTipCharge;
            }

            const net = gross - totalAdvances - totalDayOffs - totalDeductions;
            estimateEl.textContent = `Est. Salary: LKR ${net.toFixed(2)}`;
            estimateEl.style.color = '#F0A500'; // amber estimate
        }

    } catch (err) {
        console.error('Error calculating dashboard stats:', err.message);
    }
}

// Initialize Leaflet Map
function initDriverMap() {
    if (driverMap) return;

    // Center map initially around Sri Lanka center
    driverMap = L.map('driverMap', {
        center: [7.8731, 80.7718],
        zoom: 7,
        zoomControl: false, // hide default buttons to customize
        attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18
    }).addTo(driverMap);

    // Zoom buttons repositioned to top right
    L.control.zoom({ position: 'topright' }).addTo(driverMap);

    // Request driver's live GPS location
    trackUserLocation(true);
}

// Track and plot user's location
function trackUserLocation(centerMap = false) {
    if (!navigator.geolocation) {
        console.warn('Geolocation not supported by this browser');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;

            if (userLocationMarker) {
                userLocationMarker.setLatLng([latitude, longitude]);
            } else {
                const locationDotIcon = L.divIcon({
                    html: '<div class="pulsating-location-dot"></div>',
                    className: '',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });

                userLocationMarker = L.marker([latitude, longitude], { icon: locationDotIcon }).addTo(driverMap);
                userLocationMarker.bindPopup('<strong>You are here</strong>');
            }

            if (centerMap && driverMap) {
                driverMap.setView([latitude, longitude], 12);
            }
        },
        (error) => {
            console.warn('Geolocation access denied/failed:', error.message);
            if (centerMap && driverMap) {
                // Fallback to start point
                driverMap.setView([KD_START_POINT.lat, KD_START_POINT.lng], 12);
            }
        },
        { enableHighAccuracy: true }
    );
}

// Fetch Kevilton distribution locations
async function loadKeviltonDistributors() {
    try {
        const { data, error } = await supabaseClient
            .from('kd_distributors')
            .select('*');

        if (error) throw error;
        
        distributorsList = data || [];
        plotDistributorsOnMap();
        renderDistributorsList();
    } catch (err) {
        console.error('Error fetching distributors:', err.message);
    }
}

// Custom Kevilton logo marker icon
function createKeviltonIcon() {
    const size = 36;
    const html = `
        <div style="
            width:${size}px; height:${size}px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:#fff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            border: 2px solid #D1001F;
            display:flex; align-items:center; justify-content:center;
        ">
            <img src="https://i.postimg.cc/pTbqBcdz/idm2DKn-i-I.png"
                 style="width:${size * 0.65}px; height:${size * 0.65}px;
                        transform:rotate(45deg); object-fit:contain;
                        border-radius:50%;" />
        </div>`;
    return L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -(size + 4)]
    });
}

// Start point marker icon
function createStartIcon() {
    const size = 42;
    const html = `
        <div style="
            width:${size}px; height:${size}px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:#fff;
            box-shadow: 0 4px 12px rgba(0,72,180,0.5);
            border: 2.5px solid #0048B4;
            display:flex; align-items:center; justify-content:center;
        ">
            <img src="${KD_START_POINT.logoUrl}"
                 style="width:${size * 0.6}px; height:${size * 0.6}px;
                        transform:rotate(45deg); object-fit:contain;
                        border-radius:50%;" />
        </div>`;
    return L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -(size + 4)]
    });
}

// Plot markers on map
function plotDistributorsOnMap() {
    if (!driverMap) return;

    // Clear existing markers
    markers.forEach(m => m.remove());
    markers = [];

    // Add Start Point Marker
    const startMapsLink = `https://maps.google.com/?q=${KD_START_POINT.lat},${KD_START_POINT.lng}`;
    const startPopup = `
        <div class="kd-popup">
            <div class="kd-popup-name" style="color:#0048B4;">🏭 ${KD_START_POINT.name}</div>
            <div class="kd-popup-town">📍 ${KD_START_POINT.town}</div>
            <div class="kd-popup-actions">
                <a class="kd-popup-open-btn" href="${startMapsLink}" target="_blank">🗺️ Open in Google Maps</a>
            </div>
        </div>`;
    const startMarker = L.marker([KD_START_POINT.lat, KD_START_POINT.lng], { icon: createStartIcon() })
        .bindPopup(startPopup)
        .addTo(driverMap);
    markers.push(startMarker);

    // Add Distributor Markers
    distributorsList.forEach(r => {
        if (!r.lat || !r.lng) return;

        const mapsLink = `https://www.google.com/maps?q=${r.lat},${r.lng}`;
        const popupContent = `
            <div class="kd-popup">
                <div class="kd-popup-name">${r.distributor_name}</div>
                <div class="kd-popup-town">📍 ${r.town_name}</div>
                <div class="kd-popup-actions">
                    <button class="kd-popup-copy-btn" onclick="copyMapLocation('${mapsLink}', this)">📋 Copy Link</button>
                    <a class="kd-popup-open-btn" href="${mapsLink}" target="_blank">🗺️ Navigate</a>
                </div>
            </div>`;

        const marker = L.marker([r.lat, r.lng], { icon: createKeviltonIcon() })
            .bindPopup(popupContent)
            .addTo(driverMap);
        
        markers.push(marker);
    });
}

// Copy location link helper (scoped to window for onclick handlers)
window.copyMapLocation = function(link, btn) {
    navigator.clipboard.writeText(link).then(() => {
        btn.textContent = 'Copied!';
        btn.style.background = '#00B37E';
        setTimeout(() => {
            btn.textContent = '📋 Copy Link';
            btn.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
};

// Render Kevilton distributors in the search drawer
function renderDistributorsList(filteredList = null) {
    const container = document.getElementById('distributorsList');
    if (!container) return;

    const list = filteredList || distributorsList;

    if (list.length === 0) {
        container.innerHTML = '<div class="no-results">No distribution points found.</div>';
        return;
    }

    container.innerHTML = '';
    list.forEach(r => {
        const mapsLink = `https://www.google.com/maps?q=${r.lat},${r.lng}`;
        const item = document.createElement('div');
        item.className = 'distributor-item';
        item.innerHTML = `
            <div class="distributor-item-details">
                <span class="distributor-item-name">${r.distributor_name}</span>
                <span class="distributor-item-town">📍 ${r.town_name}</span>
            </div>
            <div class="distributor-item-actions">
                <button class="btn-circle" title="Locate on Map" onclick="focusOnMarker(${r.lat}, ${r.lng}); event.stopPropagation();">📍</button>
                <a class="btn-circle" title="Google Maps Navigation" href="${mapsLink}" target="_blank" onclick="event.stopPropagation();" style="text-decoration:none;">🗺️</a>
            </div>
        `;
        
        item.addEventListener('click', () => {
            focusOnMarker(r.lat, r.lng, true);
        });

        container.appendChild(item);
    });
}

// Filter distributors drawer list
function filterDistributorsList(query) {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) {
        renderDistributorsList(distributorsList);
        return;
    }

    const filtered = distributorsList.filter(d => 
        d.distributor_name.toLowerCase().includes(cleanQuery) ||
        d.town_name.toLowerCase().includes(cleanQuery)
    );

    renderDistributorsList(filtered);
}

// Map helper to center on marker and pop it open
window.focusOnMarker = function(lat, lng, openPopup = false) {
    if (!driverMap) return;

    driverMap.setView([lat, lng], 15);
    
    // Close distributors drawer on select for mobile screen space
    document.getElementById('distributorDrawer').classList.remove('open');
    document.querySelector('.drawer-toggle-arrow').textContent = '▲';
    document.querySelector('.drawer-toggle-arrow').classList.remove('open');

    if (openPopup) {
        // Find matching marker and open popup
        markers.forEach(m => {
            const pos = m.getLatLng();
            if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
                setTimeout(() => m.openPopup(), 400);
            }
        });
    }
};

// ==================== SALARY DETAILS SHEET ====================

function openSalaryModal() {
    const modal = document.getElementById('salaryModal');
    if (modal) {
        modal.classList.add('active');
        loadSalaryDetails();
    }
}

function closeSalaryModal() {
    const modal = document.getElementById('salaryModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Load salary details for the selected activeMonth
async function loadSalaryDetails() {
    try {
        const [year, month] = activeMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        // Reset display and show loaders
        document.getElementById('salaryFinalizedBanner').classList.add('hidden');
        document.getElementById('salaryEstimateBanner').classList.add('hidden');

        document.getElementById('modalNetSalary').innerHTML = '<div class="skeleton skeleton-value" style="width: 130px; height: 26px;"></div>';
        document.getElementById('modalGrossSalary').innerHTML = '<div class="skeleton skeleton-value" style="width: 130px; height: 26px;"></div>';
        document.getElementById('valBasicSalary').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valExtraKm').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valTipSalary').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valAllowance').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valTotalAdvances').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valTotalDayOffs').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valTotalDeductions').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';

        document.getElementById('advancesListContainer').innerHTML = '<div style="padding: 14px; text-align: center;"><div class="skeleton skeleton-desc" style="width: 100%;"></div></div>';
        document.getElementById('dayOffsListContainer').innerHTML = '<div style="padding: 14px; text-align: center;"><div class="skeleton skeleton-desc" style="width: 100%;"></div></div>';
        document.getElementById('deductionsListContainer').innerHTML = '<div style="padding: 14px; text-align: center;"><div class="skeleton skeleton-desc" style="width: 100%;"></div></div>';

        // Fetch finalized salary slip
        const { data: salaryRecord, error: salaryError } = await supabaseClient
            .from('driver_salary')
            .select('*')
            .eq('driver_id', currentDriver.id)
            .eq('salary_month', activeMonth)
            .maybeSingle();

        if (salaryError) throw salaryError;

        if (salaryRecord) {
            // Case 1: Finalized Salary Slip exists
            displayFinalizedSalary(salaryRecord);
        } else {
            // Case 2: Live Estimate (not finalized)
            await displayLiveEstimatedSalary(startDate, endDate);
        }
    } catch (err) {
        console.error('Error loading salary details:', err.message);
        alert('Failed to load salary details: ' + err.message);
    }
}

// Display finalized salary info
function displayFinalizedSalary(record) {
    const fb = document.getElementById('salaryFinalizedBanner');
    fb.classList.remove('hidden');

    const downloadBtn = document.getElementById('downloadReceiptBtn');
    if (record.receipt_url) {
        downloadBtn.href = record.receipt_url;
        downloadBtn.classList.remove('hidden');
    } else {
        downloadBtn.classList.add('hidden');
    }

    // Set Summary Info
    animateNumericText('modalNetSalary', 0, parseFloat(record.net_salary), 750, 'LKR ');
    animateNumericText('modalGrossSalary', 0, parseFloat(record.gross_salary), 750, 'LKR ');

    // Set details based on salary type
    const isFixed = record.salary_type === 'fixed';
    toggleSalaryTypeRows(isFixed);

    if (isFixed) {
        document.getElementById('valBasicSalary').textContent = `LKR ${parseFloat(record.basic_salary || 0).toFixed(2)}`;
        
        // Calculate extra km details
        const details = record.salary_data || {};
        const extraKm = parseFloat(details.extraKm || 0);
        const rate = parseFloat(details.extraKmRate || 0);
        
        document.getElementById('extraKmDistance').textContent = extraKm.toFixed(2);
        document.getElementById('extraKmRate').textContent = rate.toFixed(2);
        document.getElementById('valExtraKm').textContent = `LKR ${parseFloat(record.extra_km_salary || 0).toFixed(2)}`;
    } else {
        const details = record.salary_data || {};
        const normalTips = parseInt(details.tipCount || 0);
        const halfTips = parseInt(details.halfTipCount || 0);
        const totalTips = normalTips + halfTips;

        document.getElementById('tipCountDisplay').textContent = totalTips;
        document.getElementById('valTipSalary').textContent = `LKR ${parseFloat(record.tip_salary || 0).toFixed(2)}`;
    }

    // Allowances
    document.getElementById('valAllowance').textContent = `LKR ${parseFloat(record.additional_allowance || 0).toFixed(2)}`;

    // Deductions Summary
    document.getElementById('valTotalAdvances').textContent = `LKR ${parseFloat(record.total_advances || 0).toFixed(2)}`;
    
    const salaryData = record.salary_data || {};
    const dayOffDeductions = parseFloat(salaryData.dayOffDeductions || 0);
    document.getElementById('valTotalDayOffs').textContent = `LKR ${dayOffDeductions.toFixed(2)}`;
    document.getElementById('valTotalDeductions').textContent = `LKR ${parseFloat(record.other_deductions || 0).toFixed(2)}`;

    // Lists
    renderAdvancesList(salaryData.advances || []);
    renderDayOffsList(salaryData.dayOffRecords || []);
    renderDeductionsList(salaryData.deductions || []);
}

// Display live estimated values
async function displayLiveEstimatedSalary(startDate, endDate) {
    document.getElementById('salaryEstimateBanner').classList.remove('hidden');

    // Fetch live data from individual tables
    const [
        { data: kmRecs },
        { data: advances },
        { data: dayOffs },
        { data: deductions }
    ] = await Promise.all([
        supabaseClient.from('driver_km_records').select('km_amount').eq('driver_id', currentDriver.id).gte('record_date', startDate).lte('record_date', endDate),
        supabaseClient.from('driver_advances').select('*').eq('driver_id', currentDriver.id).gte('advance_date', startDate).lte('advance_date', endDate),
        supabaseClient.from('driver_day_offs').select('*').eq('driver_id', currentDriver.id).gte('day_off_date', startDate).lte('day_off_date', endDate),
        supabaseClient.from('staff_deductions').select('*').eq('driver_id', currentDriver.id).eq('salary_month', activeMonth)
    ]);

    const totalKm = kmRecs?.reduce((sum, r) => sum + parseFloat(r.km_amount || 0), 0) || 0;
    const totalAdvances = advances?.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0) || 0;
    const totalDayOffs = dayOffs?.reduce((sum, d) => sum + parseFloat(d.deduction_amount || 0), 0) || 0;
    const totalDeductions = deductions?.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0) || 0;

    let gross = 0;
    const isFixed = currentDriver.salary_type === 'fixed';
    toggleSalaryTypeRows(isFixed);

    if (isFixed) {
        const basic = parseFloat(currentDriver.basic_salary || 0);
        const limit = parseFloat(currentDriver.km_limit || 0);
        const rate = parseFloat(currentDriver.extra_km_rate || 0);
        const extraKm = Math.max(0, totalKm - limit);
        const extraKmSal = extraKm * rate;

        document.getElementById('valBasicSalary').textContent = `LKR ${basic.toFixed(2)}`;
        document.getElementById('extraKmDistance').textContent = extraKm.toFixed(2);
        document.getElementById('extraKmRate').textContent = rate.toFixed(2);
        document.getElementById('valExtraKm').textContent = `LKR ${extraKmSal.toFixed(2)}`;
        
        gross = basic + extraKmSal;
    } else {
        // Per-tip estimated salary
        let tripCount = 0;
        if (driverLorryId) {
            const [{ count: hireCount }, { count: commCount }] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('*', { count: 'exact', head: true }).eq('vehicle_id', driverLorryId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('*', { count: 'exact', head: true }).eq('vehicle_id', driverLorryId).gte('hire_date', startDate).lte('hire_date', endDate)
            ]);
            tripCount = (hireCount || 0) + (commCount || 0);
        }

        const perTipCharge = parseFloat(currentDriver.per_tip_charge || 0);
        const tipSal = tripCount * perTipCharge;

        document.getElementById('tipCountDisplay').textContent = tripCount;
        document.getElementById('valTipSalary').textContent = `LKR ${tipSal.toFixed(2)}`;
        
        gross = tipSal;
    }

    // Allowances (0 for live estimates)
    document.getElementById('valAllowance').textContent = 'LKR 0.00';

    const net = gross - totalAdvances - totalDayOffs - totalDeductions;

    // Display calculated totals
    animateNumericText('modalNetSalary', 0, net, 750, 'LKR ');
    animateNumericText('modalGrossSalary', 0, gross, 750, 'LKR ');
    document.getElementById('valTotalAdvances').textContent = `LKR ${totalAdvances.toFixed(2)}`;
    document.getElementById('valTotalDayOffs').textContent = `LKR ${totalDayOffs.toFixed(2)}`;
    document.getElementById('valTotalDeductions').textContent = `LKR ${totalDeductions.toFixed(2)}`;

    // Render lists
    renderAdvancesList(advances || []);
    renderDayOffsList(dayOffs || []);
    renderDeductionsList(deductions || []);
}

// Toggle layout rows between fixed salary and per-tip
function toggleSalaryTypeRows(isFixed) {
    const fixedRowBasic = document.getElementById('rowBasicSalary');
    const fixedRowExtra = document.getElementById('rowExtraKm');
    const perTipRow = document.getElementById('rowTipSalary');

    if (isFixed) {
        fixedRowBasic.style.display = 'flex';
        fixedRowExtra.style.display = 'flex';
        perTipRow.style.display = 'none';
    } else {
        fixedRowBasic.style.display = 'none';
        fixedRowExtra.style.display = 'none';
        perTipRow.style.display = 'flex';
    }
}

// Sub list renderers
function renderAdvancesList(list) {
    const container = document.getElementById('advancesListContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = '<div class="sub-list-item" style="font-style:italic;color:var(--text-muted);">No advances taken this month</div>';
        return;
    }

    container.innerHTML = '';
    list.forEach(a => {
        const item = document.createElement('div');
        item.className = 'sub-list-item';
        item.innerHTML = `
            <div>
                <span class="sub-list-date">${a.advance_date}</span>
                ${a.notes ? `<span class="sub-list-note">(${a.notes})</span>` : ''}
            </div>
            <span class="sub-list-amount">- LKR ${parseFloat(a.amount).toFixed(2)}</span>
        `;
        container.appendChild(item);
    });
}

function renderDayOffsList(list) {
    const container = document.getElementById('dayOffsListContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = '<div class="sub-list-item" style="font-style:italic;color:var(--text-muted);">No day offs taken this month</div>';
        return;
    }

    container.innerHTML = '';
    list.forEach(d => {
        const item = document.createElement('div');
        item.className = 'sub-list-item';
        item.innerHTML = `
            <div>
                <span class="sub-list-date">${d.day_off_date}</span>
                ${d.notes ? `<span class="sub-list-note">(${d.notes})</span>` : ''}
            </div>
            <span class="sub-list-amount">- LKR ${parseFloat(d.deduction_amount).toFixed(2)}</span>
        `;
        container.appendChild(item);
    });
}

function renderDeductionsList(list) {
    const container = document.getElementById('deductionsListContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = '<div class="sub-list-item" style="font-style:italic;color:var(--text-muted);">No other deductions this month</div>';
        return;
    }

    container.innerHTML = '';
    list.forEach(d => {
        const item = document.createElement('div');
        item.className = 'sub-list-item';
        item.innerHTML = `
            <div>
                <span class="sub-list-date">${d.deduction_date}</span>
                ${d.reason ? `<span class="sub-list-note">(${d.reason})</span>` : ''}
            </div>
            <span class="sub-list-amount">- LKR ${parseFloat(d.amount).toFixed(2)}</span>
        `;
        container.appendChild(item);
    });
}

// Helper: Animate numeric text elements
function animateNumericText(elementId, start, end, duration, prefix = "", suffix = "") {
    const el = document.getElementById(elementId);
    if (!el) return;
    const range = end - start;
    const startTime = performance.now();
    
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress * (2 - progress); // quadratic ease-out
        const current = start + range * ease;
        
        el.textContent = `${prefix}${current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// KM Daily Log Sheet Handlers
function openKmLogModal() {
    const modal = document.getElementById('kmLogModal');
    if (modal) {
        document.getElementById('kmLogError').style.display = 'none';
        document.getElementById('kmLogSuccess').style.display = 'none';
        
        // Default log date to current local date (Sri Lanka standard)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        document.getElementById('kmLogDate').value = `${year}-${month}-${day}`;
        document.getElementById('kmLogAmount').value = '';
        
        modal.classList.add('active');
    }
}

function closeKmLogModal() {
    const modal = document.getElementById('kmLogModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function submitKmLog() {
    const dateVal = document.getElementById('kmLogDate').value;
    const amountVal = parseFloat(document.getElementById('kmLogAmount').value);
    const errorEl = document.getElementById('kmLogError');
    const successEl = document.getElementById('kmLogSuccess');
    const submitBtn = document.getElementById('kmLogSubmitBtn');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (isNaN(amountVal) || amountVal <= 0) {
        errorEl.textContent = 'Please enter a valid positive mileage distance.';
        errorEl.style.display = 'block';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Submitting...';

    try {
        const payload = {
            user_id: currentDriver.user_id, // Organization multitenant ID
            driver_id: currentDriver.id,
            record_date: dateVal,
            km_amount: amountVal
        };

        const { error } = await supabaseClient
            .from('driver_km_records')
            .insert([payload]);

        if (error) throw error;

        successEl.textContent = 'Mileage log submitted successfully!';
        successEl.style.display = 'block';
        document.getElementById('kmLogAmount').value = '';

        // Refresh dashboard metrics
        await loadDashboardStats();
        
        // Close modal after success feedback
        setTimeout(() => {
            closeKmLogModal();
        }, 1200);

    } catch (err) {
        errorEl.textContent = err.message || 'Failed to submit mileage log. Try again.';
        errorEl.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Submit Mileage Log';
    }
}

// Start everything when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
