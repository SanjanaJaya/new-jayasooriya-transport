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
let locationWatchId = null; // Geolocation watcher ID

// Utility helpers for staff nicknames
function cleanDriverName(fullName) {
    return (fullName || '').replace(/\s*\(.*?\)\s*$/, '').trim();
}

// Local Storage Caching Helpers for Offline Support
function getCachedData(key, defaultValue = null) {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
        console.warn('Cache read error for key:', key, e);
        return defaultValue;
    }
}

// Write to cache helper
function setCachedData(key, value) {
    try {
        if (value === null || value === undefined) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (e) {
        console.warn('Cache write error for key:', key, e);
    }
}

// Default corporate colored truck/lorry vector SVG art
const defaultLorrySVG = `
<svg viewBox="0 0 100 50" class="vehicle-svg-art" xmlns="http://www.w3.org/2000/svg">
  <rect x="15" y="38" width="10" height="2" fill="rgba(0,0,0,0.5)" rx="1"/>
  <rect x="57" y="38" width="10" height="2" fill="rgba(0,0,0,0.5)" rx="1"/>
  <path d="M5,12 h46 v24 h-46 z" fill="#1E212D" rx="2"/>
  <path d="M51,18 h18 l10,8 v10 h-28 z" fill="#D1001F" rx="2"/>
  <path d="M58,20 h8 l5,5 v4 h-13 z" fill="#0F1014" rx="1"/>
  <circle cx="20" cy="38" r="6" fill="#121212" stroke="#FFF" stroke-width="1"/>
  <circle cx="62" cy="38" r="6" fill="#121212" stroke="#FFF" stroke-width="1"/>
  <circle cx="20" cy="38" r="2" fill="#FFF"/>
  <circle cx="62" cy="38" r="2" fill="#FFF"/>
</svg>
`;

// Online/Offline status banner toggle
function updateOnlineStatus() {
    const banner = document.getElementById('offlineWarningBanner');
    if (banner) {
        if (navigator.onLine) {
            banner.classList.add('hidden');
        } else {
            banner.classList.remove('hidden');
        }
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

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
        navigator.serviceWorker.register('sw.js?v=3')
            .then(reg => console.log('Driver App PWA Service Worker Registered', reg.scope))
            .catch(err => console.error('Driver App PWA Service Worker Registration Failed', err));
    }

    updateOnlineStatus(); // Set initial online banner visibility state
    setDefaultMonth();
    setupEventHandlers();
    checkExistingSession();
}

// Set default month strictly within the year 2026
function setDefaultMonth() {
    const now = new Date();
    const year = 2026;
    const month = String(now.getMonth() + 1).padStart(2, '0');
    activeMonth = `${year}-${month}`;
    
    const el = document.getElementById('salaryMonthFilter');
    if (el) {
        el.value = activeMonth;
        el.min = '2026-01';
        el.max = '2026-12';
    }
}

// Check if driver is already logged in
async function checkExistingSession() {
    const savedDriver = localStorage.getItem('jt_driver_session');
    if (savedDriver) {
        try {
            currentDriver = JSON.parse(savedDriver);
            
            if (!navigator.onLine) {
                // If offline, bypass database check and load dashboard directly
                showDashboard();
                return;
            }

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
                if (error && error.status !== 401 && error.status !== 403) {
                    // Fallback to cached session on general database connection error
                    showDashboard();
                } else {
                    logout();
                }
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

    // Logout Button in Modal
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to log out?')) {
            logout();
        }
    });

    // Month Selector in Salary Modal with 2026 validation
    document.getElementById('salaryMonthFilter')?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val && !val.startsWith('2026-')) {
            alert('Only data from the year 2026 is accessible.');
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            activeMonth = `2026-${month}`;
            e.target.value = activeMonth;
        } else {
            activeMonth = val;
        }
        loadSalaryDetails();
    });

    // Race Modal Events
    document.getElementById('raceModalBtn')?.addEventListener('click', openRaceModal);
    document.getElementById('closeRaceModalBtn')?.addEventListener('click', closeRaceModal);
    document.getElementById('closeRaceModalBackdrop')?.addEventListener('click', closeRaceModal);

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
async function authenticateDriver(contact, password) {
    const cleanContact = contact.trim();
    const cleanPassword = password ? password.trim() : "";

    let { data, error } = await supabaseClient
        .from('drivers')
        .select('*')
        .eq('contact', cleanContact)
        .neq('terminated', true);

    // Suffix match fallback for Sri Lankan phone number format variation
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

    // Check credentials:
    // Priority 1: Match against the dedicated `password` field (if set)
    // Priority 2: Fall back to license_number match (backward compatibility)
    const matched = data.find(d => {
        if (d.password && d.password.trim() !== '') {
            // Password field is set — must match exactly (case-insensitive)
            return d.password.trim().toLowerCase() === cleanPassword.toLowerCase();
        } else {
            // No password set — fall back to license_number
            const dbLic = d.license_number ? d.license_number.trim().toLowerCase() : "";
            return dbLic === cleanPassword.toLowerCase();
        }
    });

    if (!matched) {
        throw new Error('Incorrect password. Please check your credentials or contact your administrator.');
    }

    return matched;
}

// Logout driver partner
function logout() {
    // Stop continuous location tracking
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    if (userLocationMarker) {
        userLocationMarker = null;
    }

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
    
    // Update basic UI fields with dynamic greeting and cleaned name (no nickname)
    const hr = new Date().getHours();
    let greeting = 'Hello';
    if (hr < 12) greeting = 'Good morning';
    else if (hr < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';
    
    const welcomeEl = document.querySelector('.welcome-text');
    if (welcomeEl) {
        welcomeEl.textContent = `${greeting},`;
    }

    document.getElementById('driverName').textContent = cleanDriverName(currentDriver.name);
    if (currentDriver.photo_url) {
        document.getElementById('driverAvatar').src = currentDriver.photo_url;
    }

    // Populate profile details inside the modal
    if (document.getElementById('profileRole')) {
        document.getElementById('profileRole').textContent = currentDriver.role ? (currentDriver.role.charAt(0).toUpperCase() + currentDriver.role.slice(1)) : 'Driver';
    }
    if (document.getElementById('profileContact')) {
        document.getElementById('profileContact').textContent = currentDriver.contact || '-';
    }
    if (document.getElementById('profileLicense')) {
        document.getElementById('profileLicense').textContent = currentDriver.license_number || '-';
    }
    if (document.getElementById('profileAge')) {
        document.getElementById('profileAge').textContent = currentDriver.age ? `${currentDriver.age} years` : '-';
    }
    if (document.getElementById('profileAddress')) {
        document.getElementById('profileAddress').textContent = currentDriver.address || '-';
    }
    if (document.getElementById('profileSalaryType')) {
        if (currentDriver.salary_type === 'per_tip') {
            document.getElementById('profileSalaryType').textContent = `Per Tip (LKR ${parseFloat(currentDriver.per_tip_charge || 0).toFixed(2)} / trip)`;
        } else {
            const basic = parseFloat(currentDriver.basic_salary || 0).toFixed(2);
            const limit = currentDriver.km_limit || 0;
            const rate = parseFloat(currentDriver.extra_km_rate || 0).toFixed(2);
            document.getElementById('profileSalaryType').innerHTML = `Fixed Salary (LKR ${basic})<br><small style="color: var(--text-secondary);">Limit: ${limit} km | Extra: LKR ${rate}/km</small>`;
        }
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

// Fetch staff lorry assignment (caches and handles vector art details)
async function fetchLorryAssignment() {
    const assignEl = document.getElementById('vehicleNumberDisplay');
    const modelEl = document.getElementById('vehicleModelDisplay');
    const artContainer = document.getElementById('vehicleVectorArtContainer');
    
    // Set initial loader state
    if (assignEl) assignEl.innerHTML = '<div class="skeleton skeleton-text" style="width: 50px;"></div>';
    if (modelEl) modelEl.innerHTML = '<div class="skeleton skeleton-text" style="width: 45px;"></div>';
    if (artContainer) artContainer.innerHTML = '<div class="skeleton skeleton-text" style="width: 100%; height: 24px;"></div>';
    
    driverLorry = null;
    driverLorryId = null;

    // Retrieve from cache if offline
    if (!navigator.onLine) {
        const cached = getCachedData('jt_driver_lorry_details');
        if (cached) {
            driverLorry = cached.lorry_number;
            driverLorryId = cached.id;
            updateVehicleCardUI(cached.lorry_number, cached.vehicle_model, cached.vector_art_url);
            return;
        }
    }

    try {
        const { data, error } = await supabaseClient
            .from('staff_lorry_assignments')
            .select('lorry_number')
            .eq('driver_id', currentDriver.id)
            .eq('user_id', currentDriver.user_id)
            .maybeSingle();

        if (error) throw error;
        
        if (data) {
            driverLorry = data.lorry_number;
            
            // Now resolve the vehicle details in database
            const baseLorryName = extractBaseVehicleName(driverLorry);
            let vehicleDetails = null;
            
            // Try fetching from hire_to_pay_vehicles
            const { data: hireV } = await supabaseClient
                .from('hire_to_pay_vehicles')
                .select('id, vehicle_model, vector_art_url')
                .eq('user_id', currentDriver.user_id)
                .ilike('lorry_number', `%${baseLorryName}%`)
                .maybeSingle();

            if (hireV) {
                driverLorryId = hireV.id;
                vehicleDetails = {
                    id: hireV.id,
                    lorry_number: driverLorry,
                    vehicle_model: hireV.vehicle_model || 'Standard Truck',
                    vector_art_url: hireV.vector_art_url
                };
            } else {
                // Try from commitment_vehicles
                const { data: commV } = await supabaseClient
                    .from('commitment_vehicles')
                    .select('id, vehicle_model, vector_art_url')
                    .eq('user_id', currentDriver.user_id)
                    .ilike('vehicle_number', `%${baseLorryName}%`)
                    .maybeSingle();

                if (commV) {
                    driverLorryId = commV.id;
                    vehicleDetails = {
                        id: commV.id,
                        lorry_number: driverLorry,
                        vehicle_model: commV.vehicle_model || 'Standard Truck',
                        vector_art_url: commV.vector_art_url
                    };
                }
            }

            if (!vehicleDetails) {
                vehicleDetails = {
                    id: null,
                    lorry_number: driverLorry,
                    vehicle_model: 'Unspecified Model',
                    vector_art_url: null
                };
            }

            // Cache and update UI
            setCachedData('jt_driver_lorry_details', vehicleDetails);
            updateVehicleCardUI(vehicleDetails.lorry_number, vehicleDetails.vehicle_model, vehicleDetails.vector_art_url);
        } else {
            // No assignment found
            updateVehicleCardUI('No Vehicle', 'Not Assigned', null);
            setCachedData('jt_driver_lorry_details', null);
        }
    } catch (err) {
        console.error('Error fetching assignment:', err.message);
        // Fall back to cache on failure
        const cached = getCachedData('jt_driver_lorry_details');
        if (cached) {
            driverLorry = cached.lorry_number;
            driverLorryId = cached.id;
            updateVehicleCardUI(cached.lorry_number, cached.vehicle_model, cached.vector_art_url);
        } else {
            updateVehicleCardUI('Error Loading', 'Offline/Error', null);
        }
    }
}

// Update vehicle card UI helper
function updateVehicleCardUI(lorryNum, model, artUrl) {
    const assignEl = document.getElementById('vehicleNumberDisplay');
    const modelEl = document.getElementById('vehicleModelDisplay');
    const artContainer = document.getElementById('vehicleVectorArtContainer');

    if (assignEl) assignEl.textContent = lorryNum || 'Not Assigned';
    if (modelEl) modelEl.textContent = model || 'Standard';
    
    if (artContainer) {
        if (artUrl) {
            artContainer.innerHTML = `<img src="${artUrl}" alt="Vehicle" class="vehicle-art-img" onerror="this.onerror=null; this.parentElement.innerHTML=defaultLorrySVG;">`;
        } else {
            artContainer.innerHTML = defaultLorrySVG;
        }
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

// Load Dashboard Statistics (KM & quick estimate with caching support)
async function loadDashboardStats() {
    try {
        const [year, month] = activeMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        document.getElementById('monthlyKmValue').innerHTML = '<div class="skeleton skeleton-value"></div>';
        document.getElementById('salaryQuickEstimate').innerHTML = '<div class="skeleton skeleton-desc"></div>';

        if (!navigator.onLine) {
            // Load from cache
            const cached = getCachedData(`jt_driver_dashboard_stats_${activeMonth}`);
            if (cached) {
                animateNumericText('monthlyKmValue', 0, cached.totalKm, 800);
                const estimateEl = document.getElementById('salaryQuickEstimate');
                if (estimateEl) {
                    estimateEl.textContent = cached.salaryEstimateText;
                    estimateEl.style.color = cached.salaryEstimateColor;
                }
                return;
            }
        }

        // 1. Fetch KM records for current month
        const { data: kmRecs, error: kmError } = await supabaseClient
            .from('driver_km_records')
            .select('km_amount')
            .eq('driver_id', currentDriver.id)
            .eq('user_id', currentDriver.user_id)
            .gte('record_date', startDate)
            .lte('record_date', endDate);

        if (kmError) throw kmError;

        let totalKm = 0;
        if (kmRecs) {
            totalKm = kmRecs.reduce((sum, r) => sum + parseFloat(r.km_amount || 0), 0);
        }

        animateNumericText('monthlyKmValue', 0, totalKm, 800);

        // Hide salary estimate on dashboard (salary amounts not shown to drivers)
        const estimateEl = document.getElementById('salaryQuickEstimate');
        if (estimateEl) estimateEl.textContent = '';

    } catch (err) {
        console.error('Error calculating dashboard stats:', err.message);
        // Fall back to cache on failure
        const cached = getCachedData(`jt_driver_dashboard_stats_${activeMonth}`);
        if (cached) {
            animateNumericText('monthlyKmValue', 0, cached.totalKm, 800);
            const estimateEl = document.getElementById('salaryQuickEstimate');
            if (estimateEl) {
                estimateEl.textContent = cached.salaryEstimateText;
                estimateEl.style.color = cached.salaryEstimateColor;
            }
        } else {
            document.getElementById('monthlyKmValue').textContent = '-';
            document.getElementById('salaryQuickEstimate').textContent = 'Load Error';
        }
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

// Track and plot user's location continuously via watchPosition
function trackUserLocation(centerMap = false) {
    if (!navigator.geolocation) {
        console.warn('Geolocation not supported by this browser');
        return;
    }

    // If already watching, center if requested, but don't start another watcher
    if (locationWatchId !== null) {
        if (centerMap && userLocationMarker && driverMap) {
            driverMap.setView(userLocationMarker.getLatLng(), 15);
        }
        return;
    }

    const options = {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000
    };

    locationWatchId = navigator.geolocation.watchPosition(
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

                if (driverMap) {
                    userLocationMarker = L.marker([latitude, longitude], { icon: locationDotIcon }).addTo(driverMap);
                    userLocationMarker.bindPopup('<strong>You are here</strong>');
                }
            }

            // Center map on first locate, or when recenter button is clicked
            if (centerMap && driverMap) {
                driverMap.setView([latitude, longitude], 15);
                centerMap = false; // reset flag so it doesn't snap center constantly
            }
        },
        (error) => {
            console.warn('Geolocation tracking error:', error.message);
            if (centerMap && driverMap) {
                // Fallback to start point
                driverMap.setView([KD_START_POINT.lat, KD_START_POINT.lng], 12);
            }
        },
        options
    );
}

// Fetch Kevilton distribution locations with caching support
async function loadKeviltonDistributors() {
    if (!navigator.onLine) {
        const cached = getCachedData('jt_driver_distributors');
        if (cached) {
            distributorsList = cached;
            plotDistributorsOnMap();
            renderDistributorsList();
            return;
        }
    }

    try {
        const { data, error } = await supabaseClient
            .from('kd_distributors')
            .select('*')
            .eq('user_id', currentDriver.user_id);

        if (error) throw error;
        
        distributorsList = data || [];
        setCachedData('jt_driver_distributors', distributorsList);
        plotDistributorsOnMap();
        renderDistributorsList();
    } catch (err) {
        console.error('Error fetching distributors:', err.message);
        const cached = getCachedData('jt_driver_distributors');
        if (cached) {
            distributorsList = cached;
            plotDistributorsOnMap();
            renderDistributorsList();
        }
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

// Copy location link helper
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

// Close Salary modal
function closeSalaryModal() {
    const modal = document.getElementById('salaryModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Load salary details for the selected activeMonth with caching fallback
async function loadSalaryDetails() {
    try {
        const [year, month] = activeMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        // Reset display and show loaders
        document.getElementById('salaryFinalizedBanner').classList.add('hidden');
        document.getElementById('salaryEstimateBanner').classList.add('hidden');

        document.getElementById('modalTotalKm').innerHTML = '<div class="skeleton skeleton-value" style="width: 130px; height: 26px;"></div>';
        document.getElementById('valTotalAdvances').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valTotalDayOffs').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valTotalDeductions').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';

        document.getElementById('advancesListContainer').innerHTML = '<div style="padding: 14px; text-align: center;"><div class="skeleton skeleton-desc" style="width: 100%;"></div></div>';
        document.getElementById('dayOffsListContainer').innerHTML = '<div style="padding: 14px; text-align: center;"><div class="skeleton skeleton-desc" style="width: 100%;"></div></div>';
        document.getElementById('deductionsListContainer').innerHTML = '<div style="padding: 14px; text-align: center;"><div class="skeleton skeleton-desc" style="width: 100%;"></div></div>';

        // Always clear stale cached salary details to ensure fresh data
        localStorage.removeItem(`jt_driver_salary_details_${activeMonth}`);

        if (!navigator.onLine) {
            const cached = getCachedData(`jt_driver_salary_details_${activeMonth}`);
            if (cached) {
                if (cached.isFinalized) {
                    displayFinalizedSalary(cached.record);
                } else {
                    displayLiveEstimatedSalaryFromCache(cached.data);
                }
                return;
            }
        }

        // Fetch finalized salary slip
        const { data: salaryRecord, error: salaryError } = await supabaseClient
            .from('driver_salary')
            .select('*')
            .eq('driver_id', currentDriver.id)
            .eq('user_id', currentDriver.user_id)
            .eq('salary_month', activeMonth)
            .maybeSingle();

        if (salaryError) throw salaryError;

        if (salaryRecord) {
            // Case 1: Finalized Salary Slip exists
            displayFinalizedSalary(salaryRecord);
            // Cache record
            setCachedData(`jt_driver_salary_details_${activeMonth}`, {
                isFinalized: true,
                record: salaryRecord
            });
        } else {
            // Case 2: Live Estimate (not finalized)
            const liveData = await displayLiveEstimatedSalary(startDate, endDate);
            // Cache live breakdown data
            setCachedData(`jt_driver_salary_details_${activeMonth}`, {
                isFinalized: false,
                data: liveData
            });
        }
    } catch (err) {
        console.error('Error loading salary details:', err.message);
        
        // Try fallback to cache
        const cached = getCachedData(`jt_driver_salary_details_${activeMonth}`);
        if (cached) {
            if (cached.isFinalized) {
                displayFinalizedSalary(cached.record);
            } else {
                displayLiveEstimatedSalaryFromCache(cached.data);
            }
        } else {
            alert('Failed to load salary details: ' + err.message);
        }
    }
}

// Display finalized salary info
function displayFinalizedSalary(record) {
    const fb = document.getElementById('salaryFinalizedBanner');
    fb.classList.remove('hidden');

    // Show Total KM
    const salaryData = record.salary_data || {};
    const totalKm = parseFloat(salaryData.totalKm || record.km_driven || 0);
    const kmEl = document.getElementById('modalTotalKm');
    if (kmEl) kmEl.textContent = `${totalKm.toFixed(2)} km`;

    // Deductions Summary
    document.getElementById('valTotalAdvances').textContent = `LKR ${parseFloat(record.total_advances || 0).toFixed(2)}`;
    
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
        { data: kmRecs, error: errKm },
        { data: advances, error: errAdv },
        { data: dayOffs, error: errDo },
        { data: deductions, error: errDed }
    ] = await Promise.all([
        supabaseClient.from('driver_km_records').select('km_amount').eq('driver_id', currentDriver.id).eq('user_id', currentDriver.user_id).gte('record_date', startDate).lte('record_date', endDate),
        supabaseClient.from('driver_advances').select('*').eq('driver_id', currentDriver.id).eq('user_id', currentDriver.user_id).gte('advance_date', startDate).lte('advance_date', endDate),
        supabaseClient.from('driver_day_offs').select('*').eq('driver_id', currentDriver.id).eq('user_id', currentDriver.user_id).gte('day_off_date', startDate).lte('day_off_date', endDate),
        supabaseClient.from('staff_deductions').select('*').eq('driver_id', currentDriver.id).eq('user_id', currentDriver.user_id).eq('salary_month', activeMonth)
    ]);

    if (errKm) throw errKm;
    if (errAdv) throw errAdv;
    if (errDo) throw errDo;
    if (errDed) throw errDed;

    let tripCount = 0;
    if (currentDriver.salary_type === 'per_tip' && driverLorryId) {
        const [{ count: hireCount }, { count: commCount }] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('*', { count: 'exact', head: true }).eq('vehicle_id', driverLorryId).eq('user_id', currentDriver.user_id).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('*', { count: 'exact', head: true }).eq('vehicle_id', driverLorryId).eq('user_id', currentDriver.user_id).gte('hire_date', startDate).lte('hire_date', endDate)
        ]);
        tripCount = (hireCount || 0) + (commCount || 0);
    }

    const liveData = { kmRecs, advances, dayOffs, deductions, tripCount };
    renderLiveEstimatedSalaryUI(liveData, startDate, endDate);
    return liveData;
}

function displayLiveEstimatedSalaryFromCache(liveData) {
    document.getElementById('salaryEstimateBanner').classList.remove('hidden');
    const [year, month] = activeMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    renderLiveEstimatedSalaryUI(liveData, startDate, endDate);
}

function renderLiveEstimatedSalaryUI(liveData, startDate, endDate) {
    if (!liveData) return;
    const { kmRecs, advances, dayOffs, deductions } = liveData;
    
    const totalKm = Array.isArray(kmRecs) ? kmRecs.reduce((sum, r) => sum + parseFloat(r.km_amount || 0), 0) : 0;
    const totalAdvances = Array.isArray(advances) ? advances.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0) : 0;
    const totalDayOffs = Array.isArray(dayOffs) ? dayOffs.reduce((sum, d) => sum + parseFloat(d.deduction_amount || 0), 0) : 0;
    const totalDeductions = Array.isArray(deductions) ? deductions.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0) : 0;

    // Show Total KM
    const kmEl = document.getElementById('modalTotalKm');
    if (kmEl) kmEl.textContent = `${totalKm.toFixed(2)} km`;

    // Display advance/dayoff/deduction totals
    document.getElementById('valTotalAdvances').textContent = `LKR ${totalAdvances.toFixed(2)}`;
    document.getElementById('valTotalDayOffs').textContent = `LKR ${totalDayOffs.toFixed(2)}`;
    document.getElementById('valTotalDeductions').textContent = `LKR ${totalDeductions.toFixed(2)}`;

    // Render individual item lists
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

// ==================== DRIVER RACE Standings ====================

function openRaceModal() {
    const modal = document.getElementById('raceModal');
    if (modal) {
        modal.classList.add('active');
        loadDriverRace();
    }
}

function closeRaceModal() {
    const modal = document.getElementById('raceModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Load race rankings with caching support
async function loadDriverRace() {
    const listContainer = document.getElementById('raceList');
    const loadingEl = document.getElementById('raceLoading');
    const labelEl = document.getElementById('raceMonthLabel');
    
    if (!listContainer || !loadingEl) return;

    // Show loading state, hide list
    loadingEl.classList.remove('hidden');
    listContainer.classList.add('hidden');
    listContainer.innerHTML = '';

    const now = new Date();
    // Format label strictly using 2026, e.g., "June 2026 Standings"
    const displayDate = new Date(2026, now.getMonth(), 1);
    const monthName = displayDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (labelEl) labelEl.textContent = `${monthName} Standings`;

    if (!navigator.onLine) {
        const cached = getCachedData('jt_driver_race_standings');
        if (cached) {
            renderRaceListUI(cached.rankedDrivers, cached.maxKm);
            loadingEl.classList.add('hidden');
            listContainer.classList.remove('hidden');
            return;
        }
    }

    try {
        // Use current calendar month for the race, strictly restricted to 2026
        const year = 2026;
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        // 1. Fetch active drivers
        const { data: drivers, error: driverError } = await supabaseClient
            .from('drivers')
            .select('id, name, photo_url, role')
            .eq('user_id', currentDriver.user_id)
            .neq('terminated', true);

        if (driverError) throw driverError;

        // 2. Fetch driver km records for current month
        const { data: kmRecords, error: kmError } = await supabaseClient
            .from('driver_km_records')
            .select('driver_id, km_amount')
            .eq('user_id', currentDriver.user_id)
            .gte('record_date', startDate)
            .lte('record_date', endDate);

        if (kmError) throw kmError;

        // Sum up km per driver
        const kmByDriver = {};
        kmRecords?.forEach(r => {
            kmByDriver[r.driver_id] = (kmByDriver[r.driver_id] || 0) + parseFloat(r.km_amount || 0);
        });

        // Filter: only role === 'driver', exclude 'JAAP Jayasooriya' & 'JAUK Jayasooriya', and must have run (>0 km)
        const rankedDrivers = (drivers || [])
            .filter(d => {
                if ((d.role || '').toLowerCase() !== 'driver') return false;
                const nameClean = cleanDriverName(d.name).toLowerCase();
                if (nameClean === 'jaap jayasooriya' || nameClean === 'jauk jayasooriya') return false;
                
                // Exclude if they didn't run this month
                const totalKm = kmByDriver[d.id] || 0;
                return totalKm > 0;
            })
            .map(d => {
                return {
                    ...d,
                    totalKm: kmByDriver[d.id] || 0
                };
            });

        if (rankedDrivers.length === 0) {
            listContainer.innerHTML = '<div class="no-results">No drivers in this month\'s race.</div>';
            loadingEl.classList.add('hidden');
            listContainer.classList.remove('hidden');
            // Cache empty standings
            setCachedData('jt_driver_race_standings', { rankedDrivers: [], maxKm: 1 });
            return;
        }

        rankedDrivers.sort((a, b) => b.totalKm - a.totalKm);

        const maxKm = rankedDrivers[0].totalKm || 1;

        // Cache standings
        setCachedData('jt_driver_race_standings', { rankedDrivers, maxKm });

        renderRaceListUI(rankedDrivers, maxKm);

        loadingEl.classList.add('hidden');
        listContainer.classList.remove('hidden');

    } catch (err) {
        console.error('Error loading driver race:', err.message);
        
        // Fallback to cache on error
        const cached = getCachedData('jt_driver_race_standings');
        if (cached) {
            renderRaceListUI(cached.rankedDrivers, cached.maxKm);
        } else {
            listContainer.innerHTML = `<div class="no-results" style="color:var(--brand-red);">Failed to load race: ${err.message}</div>`;
        }
        loadingEl.classList.add('hidden');
        listContainer.classList.remove('hidden');
    }
}

// Render race rank items helper
function renderRaceListUI(rankedDrivers, maxKm) {
    const listContainer = document.getElementById('raceList');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (rankedDrivers.length === 0) {
        listContainer.innerHTML = '<div class="no-results">No drivers in this month\'s race.</div>';
        return;
    }

    rankedDrivers.forEach((d, index) => {
        const rank = index + 1;
        const isCurrentUser = d.id === currentDriver.id;
        
        let rankHtml = '';
        if (rank === 1) {
            rankHtml = '<span class="race-rank-medal">🥇</span>';
        } else if (rank === 2) {
            rankHtml = '<span class="race-rank-medal">🥈</span>';
        } else if (rank === 3) {
            rankHtml = '<span class="race-rank-medal">🥉</span>';
        } else {
            rankHtml = `<span class="race-rank-number">#${rank}</span>`;
        }

        // Initials Fallback for Avatar
        const cleanedName = cleanDriverName(d.name);
        const initials = cleanedName ? cleanedName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() : '?';
        const avatarHtml = d.photo_url 
            ? `<img class="race-avatar-img" src="${d.photo_url}" alt="${cleanedName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="race-avatar-fallback" style="display:none;">${initials}</div>`
            : `<div class="race-avatar-fallback">${initials}</div>`;

        const progressPercent = Math.min(100, (d.totalKm / maxKm) * 100);

        const card = document.createElement('div');
        card.className = `race-item rank-${rank} ${isCurrentUser ? 'current-user' : ''}`;
        card.innerHTML = `
            <div class="race-rank-container">
                ${rankHtml}
            </div>
            <div class="race-avatar-container">
                ${avatarHtml}
            </div>
            <div class="race-details">
                <div class="race-name-row">
                    <span class="race-name">${cleanedName} ${isCurrentUser ? '<span class="race-badge-you">You</span>' : ''}</span>
                    <div class="race-value-container">
                        <span class="race-value">${d.totalKm.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                        <span class="race-value-unit">KM</span>
                    </div>
                </div>
                <div class="race-progress-bg">
                    <div class="race-progress-bar" style="width: 0%;"></div>
                </div>
            </div>
        `;

        listContainer.appendChild(card);

        // Animate progress bar width slightly after appending for smooth micro-animation
        setTimeout(() => {
            const bar = card.querySelector('.race-progress-bar');
            if (bar) bar.style.width = `${progressPercent}%`;
        }, 100);
    });
}

// Start everything when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
