// app.js - FIXED: Date handling uses Local Time instead of UTC
// Includes: Dark Mode, Admin ID, Role-Based Access, Photo Features, Vehicle Models, Receipt Uploads, Dashboard Stats, Vector Art & Driver Salary, Advanced Metrics & Charts, Driver Day Offs

// Supabase Configuration
const SUPABASE_URL = 'https://slmqjqkpgdhrdcoempdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbXFqcWtwZ2RocmRjb2VtcGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3OTg4NzUsImV4cCI6MjA3NjM3NDg3NX0.mXDMuhn0K5sOKhwykhf9OcomUzSVkCGnN5jr60A-TSw';

let supabaseClient = null;
let currentUser = null;
let userRole = null; // 'admin' or 'viewer'
let adminUserId = null; // Store the admin user ID for data filtering
let currentPage = 'dashboard';

// Chart Variables
let revenueChart = null;
let profitChart = null;
let fuelCostChart = null;
// NEW CHART VARIABLES
let revenueBreakdownChart = null;
let vehicleRevenueChart = null;
let distanceDistChart = null;
let fuelTrendChart = null;

// DASHBOARD WIDGET CHART VARIABLES
let vehicleRevenuePieChart = null;
let revenueTypeSplitChart = null;
let topRoutesChart = null;
let dailyActivityChart = null;
let costVsRevenueChart = null;
let dailyKmChart = null;
let dailyFuelChart = null;

// Initialize Supabase
function initSupabase() {
    if (window.supabase) {
        // Use the global window.supabase to create our client
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
}

// ============ DARK MODE TOGGLE ============
function initDarkMode() {
    // Inject CSS for the toggle button position and appearance
    const style = document.createElement('style');
    style.textContent = `
        .dark-mode-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
        }
        .dark-mode-toggle button {
            background: #2c3e50;
            border: 2px solid #34495e;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        .dark-mode-toggle button:hover {
            transform: scale(1.1);
        }
        /* Hide light icon in light mode, hide dark icon in dark mode */
        body:not(.dark-mode) .light-icon { display: none; }
        body:not(.dark-mode) .dark-icon { display: block; }
        body.dark-mode .light-icon { display: block; }
        body.dark-mode .dark-icon { display: none; }
    `;
    document.head.appendChild(style);

    // Create dark mode toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = `
        <span class="light-icon">🌙</span>
        <span class="dark-icon">☀️</span>
    `;
    toggleBtn.title = 'Toggle Dark Mode';
    toggleBtn.ariaLabel = 'Toggle Dark Mode';
    
    // Create container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'dark-mode-toggle';
    toggleContainer.appendChild(toggleBtn);
    document.body.appendChild(toggleContainer);
    
    // Check for saved theme or prefer-color-scheme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
    }
    
    // Toggle function
    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            if (e.matches) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }
    });
}

// Check user role and get admin ID
async function checkUserRole() {
    try {
        const { data, error } = await supabaseClient
            .from('user_roles')
            .select('role, admin_id')
            .eq('user_id', currentUser.id)
            .single();
        
        if (error) {
            console.error('Error fetching user role:', error);
            userRole = 'admin';
            adminUserId = currentUser.id; // Fallback: User is their own admin
        } else {
            userRole = data.role;
            // If admin_id is null (common for the main admin), use their own ID
            adminUserId = data.admin_id || currentUser.id;
        }
        
        console.log('User role:', userRole, 'Admin ID:', adminUserId);
        updateUIForRole();
    } catch (error) {
        console.error('Error checking user role:', error);
        userRole = 'admin';
        adminUserId = currentUser.id;
    }
}

// Get the user ID to use for queries (admin's ID for viewers, own ID for admins)
function getQueryUserId() {
    return adminUserId;
}

// Update UI based on user role
function updateUIForRole() {
    const isViewer = userRole === 'viewer';
    
    // Hide/disable all add buttons
    const addButtons = document.querySelectorAll('[id$="Btn"]:not(#logoutBtn)');
    addButtons.forEach(btn => {
        if (isViewer) {
            btn.style.display = 'none';
        } else {
            btn.style.display = '';
        }
    });
    
    // Handle CSS for viewer mode
    if (isViewer) {
        const style = document.createElement('style');
        style.id = 'viewer-mode-style';
        style.textContent = `
            .action-buttons { display: none !important; }
            .form-container { display: none !important; }
        `;
        document.head.appendChild(style);
    } else {
        const existingStyle = document.getElementById('viewer-mode-style');
        if (existingStyle) {
            existingStyle.remove();
        }
    }
    
    // Add viewer indicator
    if (isViewer) {
        const header = document.querySelector('.header-right');
        if (header && !document.getElementById('viewerBadge')) {
            const badge = document.createElement('span');
            badge.id = 'viewerBadge';
            badge.style.cssText = 'background: #3498db; color: white; padding: 5px 10px; border-radius: 5px; margin-right: 10px; font-size: 12px;';
            badge.textContent = '🔒 Read-Only Mode';
            header.insertBefore(badge, header.firstChild);
        }
    }
}

// Helper to check admin access for operations
function checkAdminAccess(action = 'modify') {
    if (userRole === 'viewer') {
        alert(`You don't have permission to ${action} data. Contact the administrator for access.`);
        return false;
    }
    return true;
}

// Initialize App
async function initializeApp() {
    initSupabase();
    initHamburgerMenu();
    initDarkMode(); // Initialize Dark Mode
    
    if (!supabaseClient) {
        console.error('Supabase not initialized');
        showLogin();
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            await checkUserRole();
            showApp();
            setDefaultMonths();
            initServiceTracking(); // Initialize Service Tracking
            initNotificationCenter(); // Initialize Notification Center
            initDriverKmLog(); // Initialize Driver KM Log
            await loadDashboard();
            preloadAllData(); // Preload other tabs
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Auth error:', error);
        showLogin();
    }
}

// Wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Authentication Functions
function showLogin() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('active');
    const container = document.querySelector('.pages-container');
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('.top-header');
    if (container) container.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (header) header.style.display = 'none';
}

function showApp() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
    const container = document.querySelector('.pages-container');
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('.top-header');
    if (container) container.style.display = 'block';
    if (sidebar) sidebar.style.display = 'flex';
    if (header) header.style.display = 'flex';
    if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email;
    }
}

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        try {
            errorEl.textContent = '';
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            
            if (error) throw error;
            
            currentUser = data.user;
            await checkUserRole();
            showApp();
            setDefaultMonths();
            initServiceTracking(); // Initialize Service Tracking
            await loadDashboard();
            preloadAllData(); // Preload other tabs
        } catch (error) {
            errorEl.textContent = error.message || 'Login failed';
        }
    });
}

// Logout Button
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        currentUser = null;
        userRole = null;
        adminUserId = null;
        // Don't clear theme preference on logout
        showLogin();
    });
}

// ============ FIX: UPDATED DEFAULT MONTHS TO LOCAL TIME ============
function setDefaultMonths() {
    const now = new Date();
    // Get year and month from local time, not UTC
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // +1 because months are 0-indexed
    const monthStr = `${year}-${month}`;
    
    const elements = [
        'dashboardMonth',
        'hireRecordsMonth',
        'commitmentRecordsMonth',
        'dayOffMonth',
        'advanceMonth',
        'salaryMonth',
        'driverDayOffMonth', // ADDED: New Driver Day Off filter
        'maintenanceMonth',  // ADDED: Lorry Maintenance filter
        'otherOperationHiresMonth', // ADDED: Other Operation Hires filter
        'driverKmMonthFilter' // ADDED: Driver KM Log filter
    ];
    
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = monthStr;
    });
}

// FIXED: Helper to guarantee a month input has the current month value
// Needed because display:none pages block value assignment in some browsers
function ensureMonthValue(elementId) {
    const el = document.getElementById(elementId);
    if (el && !el.value) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        el.value = `${year}-${month}`;
    }
}

// ============ HAMBURGER MENU ============
let hamburger = null;
let sidebar = null;
let mobileOverlay = null;

function initHamburgerMenu() {
    hamburger = document.getElementById('hamburgerMenu');
    sidebar = document.querySelector('.sidebar');
    mobileOverlay = document.getElementById('mobileOverlay');

    if (!hamburger) return;

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebar?.classList.contains('mobile-open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', closeMobileMenu);
    }

    document.addEventListener('click', (e) => {
        if (sidebar?.classList.contains('mobile-open') && 
            !sidebar.contains(e.target) && 
            !hamburger.contains(e.target)) {
            closeMobileMenu();
        }
    });
}

function closeMobileMenu() {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (hamburger) hamburger.classList.remove('active');
    if (mobileOverlay) mobileOverlay.classList.remove('active');
}

function openMobileMenu() {
    if (sidebar) sidebar.classList.add('mobile-open');
    if (hamburger) hamburger.classList.add('active');
    if (mobileOverlay) mobileOverlay.classList.add('active');
}

// ============ GROUPED COLLAPSIBLE NAVIGATION ============

// Map of page -> group id (null = no group / standalone)
const PAGE_GROUP_MAP = {
    'dashboard':             null,
    'cheque-status':         null,
    'drivers':               'navGroupStaff',
    'driver-advances':       'navGroupStaff',
    'driver-dayoffs':        'navGroupStaff',
    'driver-km-log':         'navGroupStaff',
    'driver-salary':         'navGroupStaff',
    'hire-vehicles':         'navGroupFleet',
    'hire-records':          'navGroupFleet',
    'other-operation-hires': 'navGroupFleet',
    'commitment-vehicles':   'navGroupFleet',
    'commitment-records':    'navGroupFleet',
    'commitment-dayoffs':    'navGroupFleet',
    'lorry-maintenance':     'navGroupFleet',
};

function openNavGroup(groupId) {
    const group  = document.getElementById(groupId);
    const header = group?.querySelector('.nav-group-header');
    const items  = group?.querySelector('.nav-group-items');
    if (!group || !header || !items) return;
    header.setAttribute('aria-expanded', 'true');
    items.classList.add('open');
    group.classList.add('has-active');
}

function closeNavGroup(groupId) {
    const group  = document.getElementById(groupId);
    const header = group?.querySelector('.nav-group-header');
    const items  = group?.querySelector('.nav-group-items');
    if (!group || !header || !items) return;
    header.setAttribute('aria-expanded', 'false');
    items.classList.remove('open');
    group.classList.remove('has-active');
}

function setActiveNavItem(page) {
    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    // Activate the matching one
    const target = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (target) target.classList.add('active');

    // Close all groups, then open the relevant one
    ['navGroupStaff', 'navGroupFleet'].forEach(id => closeNavGroup(id));
    const groupId = PAGE_GROUP_MAP[page];
    if (groupId) openNavGroup(groupId);
}

// Group header — toggle expand/collapse
document.querySelectorAll('.nav-group-header').forEach(header => {
    header.addEventListener('click', () => {
        const key     = header.dataset.group; // 'staff' or 'fleet'
        const groupId = 'navGroup' + key.charAt(0).toUpperCase() + key.slice(1);
        const expanded = header.getAttribute('aria-expanded') === 'true';
        if (expanded) {
            closeNavGroup(groupId);
        } else {
            openNavGroup(groupId);
        }
    });
});

// Navigation — individual page nav items
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        currentPage = item.dataset.page;
        setActiveNavItem(currentPage);
        switchPage(currentPage);
        closeMobileMenu();
    });
});

// ============ UPDATED PAGE SWITCHER ============
function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(page);
    if (pageEl) pageEl.classList.add('active');
    
    const titles = {
        'dashboard': 'Dashboard',
        'cheque-status': 'Cheque Status',
        'drivers': 'Manage Staff',
        'driver-advances': 'Staff Salary Advances',
        'driver-salary': 'Staff Salary Calculator & Salary Slips', 
        'hire-vehicles': 'Hire-to-Pay Vehicles',
        'hire-records': 'Hire-to-Pay Records',
        'commitment-vehicles': 'Commitment Vehicles',
        'commitment-records': 'Commitment Vehicle Hires',
        'commitment-dayoffs': 'Day Offs',
        'driver-dayoffs': 'Staff Day Offs',
        'driver-km-log': "Driver's KM Log",
        'lorry-maintenance': 'Lorry Maintenance',
        'other-operation-hires': 'Other Operation Hires',
    };
    
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';
    
    if (page === 'dashboard') loadDashboard();
    if (page === 'cheque-status') loadChequeStatus();
    if (page === 'drivers') loadDrivers();
    if (page === 'driver-advances') loadDriverAdvances();
    
    if (page === 'driver-salary') {
        if (typeof loadSalaryDrivers === 'function') loadSalaryDrivers();
        if (typeof loadSalaryHistory === 'function') loadSalaryHistory();
    }
    
    if (page === 'hire-vehicles') loadHireVehicles();
    if (page === 'hire-records') loadHireRecords();
    if (page === 'commitment-vehicles') loadCommitmentVehicles();
    if (page === 'commitment-records') loadCommitmentRecords();
    if (page === 'commitment-dayoffs') loadDayOffs();
    if (page === 'driver-dayoffs') { ensureMonthValue('driverDayOffMonth'); loadDriverDayOffs(); }
    if (page === 'driver-km-log') { ensureMonthValue('driverKmMonthFilter'); loadDriverKmLogPage(); }
    if (page === 'lorry-maintenance') {
        const mEl = document.getElementById('maintenanceMonth');
        if (mEl && !mEl.value) {
            const n = new Date();
            mEl.value = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
        }
        loadMaintenanceRecords();
    }
    if (page === 'other-operation-hires') {
        ensureMonthValue('otherOperationHiresMonth');
        loadOtherOperationHires();
        updateOtherOperationHireVehicleFilter();
    }
}

// ============ BACKGROUND PRELOADER ============
async function preloadAllData() {
    console.log("Preloading background data...");
    try {
        // Run preloads concurrently where possible without blocking the main thread
        Promise.allSettled([
            loadDrivers(),
            loadHireVehicles(),
            loadCommitmentVehicles(),
            loadDriverAdvances(),
            loadHireRecords(),
            loadCommitmentRecords(),
            loadDayOffs(),
            (async () => {
                ensureMonthValue('driverDayOffMonth');
                if (typeof loadDriverDayOffs === 'function') await loadDriverDayOffs();
            })(),
            (async () => {
                const mEl = document.getElementById('maintenanceMonth');
                if (mEl && !mEl.value) {
                    const n = new Date();
                    mEl.value = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
                }
                if (typeof loadMaintenanceRecords === 'function') await loadMaintenanceRecords();
            })(),
            (async () => {
                if (typeof loadSalaryDrivers === 'function') await loadSalaryDrivers();
            })(),
            (async () => {
                if (typeof loadSalaryHistory === 'function') await loadSalaryHistory();
            })(),
            (async () => {
                ensureMonthValue('otherOperationHiresMonth');
                if (typeof loadOtherOperationHires === 'function') await loadOtherOperationHires();
            })(),
            (async () => {
                ensureMonthValue('driverKmMonthFilter');
                if (typeof loadDriverKmRecords === 'function') await loadDriverKmRecords();
            })()
        ]).then(() => console.log("Background preloading complete."));
    } catch (e) {
        console.error('Error in preloadAllData:', e);
    }
}

// ============ FIX: UPDATED LOAD DASHBOARD WITH LOCAL TIME FALLBACK ============
async function loadDashboard() {
    try {
        let monthValue = document.getElementById('dashboardMonth')?.value;
        
        // FIXED: Use Local Time for fallback
        if (!monthValue) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            monthValue = `${year}-${month}`;
            
            const dashboardMonthEl = document.getElementById('dashboardMonth');
            if (dashboardMonthEl) dashboardMonthEl.value = monthValue;
        }

        await Promise.all([
            loadDashboardData(monthValue),
            loadVehiclePerformance(monthValue), 
            loadDriverPerformance(monthValue),
            loadDashboardCharts(),
            loadAllTimeStatistics(),
            loadFleetOverview(),
            loadTopPerformingVehicles(),
            loadAdvancedDashboardStats(monthValue),
            loadVehicleRevenuePieChart(monthValue),
            loadRevenueTypeSplitChart(monthValue),
            loadTopRoutesChart(monthValue),
            loadDailyActivityChart(monthValue),
            loadCostVsRevenueChart(monthValue),
            loadDailyKmChart(monthValue),
            loadDailyFuelChart(monthValue),
            renderTrackedVehicles()
        ]);

    } catch (error) {
        console.error('Error loading dashboard:', error.message);
    }
}

document.getElementById('dashboardMonth')?.addEventListener('change', loadDashboard);

// ============ SERVICE TRACKING ============
function extractBaseVehicleName(name) {
    if (!name) return '';
    // Match common formats like WP NB-1234, 68-1234, NB - 1234
    // More permissive: matches 1-4 letters/digits, then hyphen, then 1-4 digits anywhere in string
    const match = name.match(/([a-zA-Z0-9]{1,4})\s*-\s*([0-9]{1,4})/);
    if (match) {
        // Return normalized format: "XX - YYYY"
        return `${match[1].trim().toUpperCase()} - ${match[2].trim()}`;
    }
    return name.trim().toUpperCase();
}

async function initServiceTracking() {
    const lorryNoSelect = document.getElementById('serviceLorryNo');
    const dateInput = document.getElementById('serviceDateInput');
    const locationInput = document.getElementById('serviceLocationInput');
    const addBtn = document.getElementById('addServiceTrackingBtn');
    
    if(!dateInput || !addBtn || !lorryNoSelect) return;
    
    // Populate dropdown
    const currentQueryUserId = getQueryUserId() || (currentUser ? currentUser.id : null);
    if (currentQueryUserId) {
        try {
            const [{ data: hireV }, { data: commV }] = await Promise.all([
                supabaseClient.from('hire_to_pay_vehicles').select('lorry_number, terminated').eq('user_id', currentQueryUserId),
                supabaseClient.from('commitment_vehicles').select('vehicle_number, terminated').eq('user_id', currentQueryUserId)
            ]);
            
            const baseNames = new Set();
            if (hireV) hireV.filter(v => !v.terminated).forEach(v => baseNames.add(extractBaseVehicleName(v.lorry_number)));
            if (commV) commV.filter(v => !v.terminated).forEach(v => baseNames.add(extractBaseVehicleName(v.vehicle_number)));
            
            const sortedNames = Array.from(baseNames).sort();
            
            lorryNoSelect.innerHTML = '<option value="">Select Vehicle</option>';
            sortedNames.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                lorryNoSelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Error loading service tracking vehicles:', e);
        }
    }
    
    addBtn.addEventListener('click', async () => {
        if(!lorryNoSelect.value) { alert('Please select a vehicle.'); return; }
        if(!dateInput.value) { alert('Please select a service date.'); return; }
        
        const targetKmsInput = document.getElementById('serviceTargetKms');
        const targetKms = targetKmsInput ? parseInt(targetKmsInput.value) || 5000 : 5000;
        
        const currentUserId = getQueryUserId() || (currentUser ? currentUser.id : null);
        if (!currentUserId) {
            alert('User authentication error. Cannot save.');
            return;
        }

        addBtn.disabled = true;
        addBtn.textContent = 'Saving...';

        try {
            // Remove existing entry for the same vehicle
            await supabaseClient.from('service_trackers')
                .delete()
                .eq('user_id', currentUserId)
                .eq('base_name', lorryNoSelect.value);
            
            // Insert new tracker
            const { error } = await supabaseClient.from('service_trackers')
                .insert([{
                    user_id: currentUserId,
                    base_name: lorryNoSelect.value,
                    service_date: dateInput.value,
                    service_location: locationInput.value || '',
                    target_kms: targetKms
                }]);

            if (error) throw error;

            lorryNoSelect.value = '';
            dateInput.value = '';
            locationInput.value = '';
            if(targetKmsInput) targetKmsInput.value = 5000;
            
            renderTrackedVehicles();
        } catch (e) {
            console.error('Error saving service tracker:', e);
            alert('Failed to save service tracker to database.');
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = '➕ Track Vehicle';
        }
    });
    
    // Auto-load on initialize
    renderTrackedVehicles();
}

async function renderTrackedVehicles() {
    const grid = document.getElementById('trackedVehiclesGrid');
    if (!grid) return;
    
    const currentQueryUserId = getQueryUserId() || (currentUser ? currentUser.id : null);
    if (!currentQueryUserId) return;
    
    if (grid.children.length === 0) {
        grid.innerHTML = '<div style="color: #7f8c8d; padding: 10px; text-align: center; grid-column: 1 / -1;">Loading trackers...</div>';
    }
    
    let trackedVehicles = [];
    try {
        const { data, error } = await supabaseClient.from('service_trackers')
            .select('*')
            .eq('user_id', currentQueryUserId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        trackedVehicles = data || [];
    } catch (e) {
        console.error('Error loading service trackers:', e);
        grid.innerHTML = '<div style="color: #e74c3c; padding: 10px; text-align: center; grid-column: 1 / -1;">Error loading trackers from database.</div>';
        return;
    }
    
    if (trackedVehicles.length === 0) {
        grid.innerHTML = '<div style="color: #7f8c8d; padding: 10px; text-align: center; grid-column: 1 / -1;">No vehicles are currently being tracked.</div>';
        return;
    }
    
    // Fetch all vehicles once to map IDs and Vector Art
    let allHireVehicles = [];
    let allCommVehicles = [];
    try {
        const [{ data: hireV }, { data: commV }] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, vector_art_url').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number, vector_art_url').eq('user_id', currentQueryUserId)
        ]);
        allHireVehicles = hireV || [];
        allCommVehicles = commV || [];
    } catch(e) {
        console.error('Error fetching vehicles for calculation:', e);
    }
    
    const fragment = document.createDocumentFragment();
    
    trackedVehicles.forEach((tracker, index) => {
        const safeId = 'tracker_' + index;
        const card = document.createElement('div');
        card.className = 'tracked-vehicle-card';
        
        // Find vector art url for this vehicle
        let artUrl = '';
        const foundHire = allHireVehicles.find(v => (v.lorry_number || '').toUpperCase().startsWith(tracker.base_name));
        const foundComm = allCommVehicles.find(v => (v.vehicle_number || '').toUpperCase().startsWith(tracker.base_name));
        if (foundHire && foundHire.vector_art_url) artUrl = foundHire.vector_art_url;
        else if (foundComm && foundComm.vector_art_url) artUrl = foundComm.vector_art_url;
        
        const artHtml = artUrl ? `<img src="${artUrl}" class="tracked-vehicle-art" alt="${tracker.base_name}">` : `<div class="tracked-vehicle-art" style="font-size: 32px; display:flex; align-items:center; justify-content:center; opacity:0.5;">🚚</div>`;
        
        card.innerHTML = `
            <div class="tracked-vehicle-header">
                <div class="tracked-vehicle-title">
                    ${artHtml}
                    <div>
                        ${tracker.base_name}
                        <div class="tracked-vehicle-info">
                            <strong>Serviced:</strong> ${tracker.service_date}<br>
                            ${tracker.service_location ? `<strong>At:</strong> ${tracker.service_location}` : ''}
                        </div>
                    </div>
                </div>
                <button onclick="removeTrackedVehicle('${tracker.base_name}')" class="remove-tracker-btn" title="Remove Tracker">✖</button>
            </div>
            
            <div class="tracked-vehicle-body">
                <div class="detail-metric" id="${safeId}_kms_metric">
                    <span class="detail-label">Distance Run After Service</span>
                    <span class="detail-value" id="${safeId}_kms">Calculating...</span>
                </div>
                <div class="detail-metric">
                    <span class="detail-label">Target Status</span>
                    <span class="detail-value" id="${safeId}_status" style="font-size: 1.1rem;">-</span>
                </div>
            </div>
        `;
        fragment.appendChild(card);
    });
    
    grid.innerHTML = '';
    grid.appendChild(fragment);
    
    // Now that they are in the DOM, execute the calculations concurrently
    const kmPromises = trackedVehicles.map((tracker, index) => {
        const safeId = 'tracker_' + index;
        return calculateIndividualServiceKMs(tracker, safeId, allHireVehicles, allCommVehicles);
    });
    
    await Promise.all(kmPromises);
    
    if (typeof loadNotifications === 'function') {
        loadNotifications();
    }
}

window.removeTrackedVehicle = async function(baseName) {
    if(confirm('Stop tracking this vehicle?')) {
        const currentQueryUserId = getQueryUserId() || (currentUser ? currentUser.id : null);
        if (!currentQueryUserId) return;
        
        try {
            const { error } = await supabaseClient.from('service_trackers')
                .delete()
                .eq('user_id', currentQueryUserId)
                .eq('base_name', baseName);
                
            if (error) throw error;
            renderTrackedVehicles();
            if (typeof loadNotifications === 'function') loadNotifications();
        } catch (e) {
            console.error('Error removing tracked vehicle:', e);
            alert('Failed to remove tracker. Please try again.');
        }
    }
};

async function calculateIndividualServiceKMs(tracker, elementId, allHireVehicles, allCommVehicles) {
    const kmDisplay = document.getElementById(elementId + '_kms');
    const statusDisplay = document.getElementById(elementId + '_status');
    if(!kmDisplay) return;
    
    try {
        const targetHireIds = allHireVehicles
            .filter(v => (v.lorry_number || '').toUpperCase().startsWith(tracker.base_name))
            .map(v => v.id);
            
        const targetCommIds = allCommVehicles
            .filter(v => (v.vehicle_number || '').toUpperCase().startsWith(tracker.base_name))
            .map(v => v.id);
            
        let totalKm = 0;
        
        if (targetHireIds.length > 0) {
            const { data: hireRecords } = await supabaseClient
                .from('hire_to_pay_records')
                .select('distance')
                .in('vehicle_id', targetHireIds)
                .gte('hire_date', tracker.service_date);
            if (hireRecords) {
                totalKm += hireRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
            }
        }
        
        if (targetCommIds.length > 0) {
            const { data: commRecords } = await supabaseClient
                .from('commitment_records')
                .select('distance')
                .in('vehicle_id', targetCommIds)
                .gte('hire_date', tracker.service_date);
            if (commRecords) {
                totalKm += commRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
            }
        }
        
        // ADD: Fetch other operation hires for this base name
        const { data: otherOpHires } = await supabaseClient
            .from('other_operation_hires')
            .select('distance')
            .eq('base_lorry_number', tracker.base_name)
            .gte('hire_date', tracker.service_date);
        if (otherOpHires) {
            totalKm += otherOpHires.reduce((sum, r) => sum + (r.distance || 0), 0);
        }
        
        kmDisplay.textContent = totalKm.toLocaleString() + ' KM';
        
        if (statusDisplay) {
            const target = tracker.target_kms || 5000;
            const metricBox = document.getElementById(elementId + '_kms_metric');
            
            if (totalKm >= target) {
                statusDisplay.textContent = 'Service Due!';
                statusDisplay.style.color = 'var(--brand-red)';
                statusDisplay.style.fontWeight = '700';
                if(metricBox) metricBox.classList.add('danger');
            } else {
                statusDisplay.textContent = (target - totalKm).toLocaleString() + ' KM Remaining';
                statusDisplay.style.color = 'var(--green)';
                statusDisplay.style.fontWeight = '500';
                if(metricBox) metricBox.classList.remove('danger');
            }
        }
    } catch (e) {
        console.error('Error calculating service KMs for', tracker.base_name, e);
        kmDisplay.textContent = 'Error';
    }
}

// ============ DRIVERS ============
document.getElementById('addDriverBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('driverForm').reset();
    document.getElementById('driverId').value = '';
    document.getElementById('driverSalaryType').value = 'fixed';
    toggleDriverSalaryTypeFields();
    document.getElementById('driverFormContainer').style.display = 'block';
});

// Toggle salary type fields in driver form
function toggleDriverSalaryTypeFields() {
    const salaryType = document.getElementById('driverSalaryType').value;
    const fixedFields = document.getElementById('fixedSalaryFields');
    const perTipFields = document.getElementById('perTipSalaryFields');
    if (salaryType === 'per_tip') {
        if (fixedFields) fixedFields.style.display = 'none';
        if (perTipFields) perTipFields.style.display = 'block';
    } else {
        if (fixedFields) fixedFields.style.display = 'block';
        if (perTipFields) perTipFields.style.display = 'none';
    }
}

document.getElementById('cancelDriverBtn')?.addEventListener('click', () => {
    document.getElementById('driverFormContainer').style.display = 'none';
});

// Driver Form Submit
document.getElementById('driverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('driverId').value;
    const salaryType = document.getElementById('driverSalaryType').value || 'fixed';
    const data = {
        name: document.getElementById('driverName').value,
        contact: document.getElementById('driverContact').value,
        license_number: document.getElementById('driverLicense').value || null,
        age: parseInt(document.getElementById('driverAge').value),
        address: document.getElementById('driverAddress').value,
        photo_url: document.getElementById('driverPhoto').value || null,
        role: document.getElementById('driverRole').value || null,
        salary_type: salaryType,
        basic_salary: salaryType === 'fixed' ? (parseFloat(document.getElementById('driverBasicSalary').value) || null) : null,
        km_limit: salaryType === 'fixed' ? (parseFloat(document.getElementById('driverKmLimit').value) || null) : null,
        extra_km_rate: salaryType === 'fixed' ? (parseFloat(document.getElementById('driverExtraKmRate').value) || null) : null,
        per_tip_charge: salaryType === 'per_tip' ? (parseFloat(document.getElementById('driverPerTipCharge').value) || null) : null,
        terminated: document.getElementById('driverTerminated') ? document.getElementById('driverTerminated').checked : false,
        user_id: adminUserId
    };

    try {
        // Check for duplicate license number (only if license is provided)
        if (data.license_number) {
            let dupQuery = supabaseClient
                .from('drivers')
                .select('id')
                .eq('license_number', data.license_number)
                .eq('user_id', adminUserId);
            if (id) {
                dupQuery = dupQuery.neq('id', id); // Exclude current driver when editing
            }
            const { data: duplicates } = await dupQuery;
            if (duplicates && duplicates.length > 0) {
                alert('Another staff member already has this license number. Please use a unique license number.');
                return;
            }
        }

        if (id) {
            const { error: updateError } = await supabaseClient.from('drivers').update(data).eq('id', id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseClient.from('drivers').insert([data]);
            if (insertError) throw insertError;
        }
        loadDrivers();
        document.getElementById('driverFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving driver: ' + error.message);
    }
});

// Load Drivers
async function loadDrivers() {
    try {
        const userId = getQueryUserId();
        const [
            { data, error },
            { data: assignments },
            { data: hireV },
            { data: commV }
        ] = await Promise.all([
            supabaseClient.from('drivers').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            // Include driver role so we can enforce 1-driver + 1-helper per lorry
            supabaseClient.from('staff_lorry_assignments').select('driver_id, lorry_number, driver_role').eq('user_id', userId),
            supabaseClient.from('hire_to_pay_vehicles').select('lorry_number, vector_art_url').eq('user_id', userId).neq('terminated', true),
            supabaseClient.from('commitment_vehicles').select('vehicle_number, vector_art_url').eq('user_id', userId).neq('terminated', true)
        ]);

        if (error) throw error;

        const tbody = document.querySelector('#driversTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
             tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #7F8C8D;">No staff found</td></tr>';
             return;
        }

        // Build assignment map: driverId -> { lorry_number, driver_role }
        const assignmentMap = {};
        assignments?.forEach(a => { assignmentMap[a.driver_id] = { lorry: a.lorry_number, role: a.driver_role }; });

        // Build base-plate -> vector_art_url map
        const artMap = {};
        hireV?.forEach(v => {
            const base = extractBaseVehicleName(v.lorry_number);
            if (base && v.vector_art_url) artMap[base] = v.vector_art_url;
        });
        commV?.forEach(v => {
            const base = extractBaseVehicleName(v.vehicle_number);
            if (base && v.vector_art_url && !artMap[base]) artMap[base] = v.vector_art_url;
        });

        // Build list of base plate numbers (normalised), sorted, unique
        const allVehicles = new Set();
        hireV?.forEach(v => { const b = extractBaseVehicleName(v.lorry_number); if (b) allVehicles.add(b); });
        commV?.forEach(v => { const b = extractBaseVehicleName(v.vehicle_number); if (b) allVehicles.add(b); });
        const vehicleList = Array.from(allVehicles).sort();

        // Track per-lorry role slots: lorryBase -> { hasDriver, hasHelper }
        const lorrySlots = {};
        assignments?.forEach(a => {
            const base = a.lorry_number;
            if (!lorrySlots[base]) lorrySlots[base] = { hasDriver: false, hasHelper: false };
            const r = (a.driver_role || '').toLowerCase();
            if (r === 'driver') lorrySlots[base].hasDriver = true;
            else if (r === 'helper') lorrySlots[base].hasHelper = true;
        });

        const activeDrivers = data.filter(d => !d.terminated);
        const activeStaffCountEl = document.getElementById('activeStaffCount');
        if (activeStaffCountEl) activeStaffCountEl.textContent = activeDrivers.length;
        const terminatedDrivers = data.filter(d => d.terminated);

        function buildDriverRow(driver) {
            const actionButtons = userRole === 'viewer' ? '' : `
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editDriver(${driver.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteDriver(${driver.id})">Delete</button>
                </td>
            `;
            const photoHTML = driver.photo_url ?
                `<img src="${driver.photo_url}" alt="${driver.name}" class="profile-photo" onclick="openPhotoLightbox('${driver.photo_url}')" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'no-photo\\'>📷</div>';">` :
                `<div class="no-photo">📷</div>`;

            const isPerTip = driver.salary_type === 'per_tip';
            const salaryTypeBadge = isPerTip
                ? '<span style="background:#E67E22;color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">Per Tip</span>'
                : '<span style="background:#27AE60;color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">Fixed</span>';

            let salaryInfo = '';
            if (isPerTip) {
                salaryInfo = driver.per_tip_charge ? `LKR ${driver.per_tip_charge.toFixed(2)} / tip` : '-';
            } else {
                const parts = [];
                if (driver.basic_salary) parts.push(`Basic: LKR ${driver.basic_salary.toFixed(2)}`);
                if (driver.km_limit) parts.push(`KM Limit: ${driver.km_limit} km`);
                if (driver.extra_km_rate) parts.push(`Extra: LKR ${driver.extra_km_rate.toFixed(2)}/km`);
                salaryInfo = parts.length > 0 ? parts.join('<br>') : '-';
            }

            // ── Lorry assignment badge / dropdown ──
            const assignment = assignmentMap[driver.id];
            const driverRole = (driver.role || 'Driver').toLowerCase();
            let lorryHtml = '';

            if (assignment) {
                // Already assigned — premium badge: art panel + plate panel
                const artUrl = artMap[assignment.lorry];
                const artContent = artUrl
                    ? `<img src="${artUrl}" alt="${assignment.lorry}" onerror="this.parentElement.innerHTML='<span class=\\'lorry-badge-icon\\'>🚛</span>'">`
                    : `<span class="lorry-badge-icon">🚛</span>`;
                lorryHtml = `
                <div class="lorry-assignment-wrap">
                    <span class="lorry-badge" title="Assigned: ${assignment.lorry}">
                        <span class="lorry-badge-art">${artContent}</span>
                        <span class="lorry-badge-plate">${assignment.lorry}</span>
                    </span>
                    ${userRole !== 'viewer' ? `<button class="lorry-assign-btn" onclick="unassignLorry(${driver.id})" title="Remove assignment">✖ Unassign</button>` : ''}
                </div>`;
            } else if (userRole !== 'viewer' && vehicleList.length > 0 && driverRole !== 'other') {
                // Not assigned — filtered dropdown by role slot
                const isHelper = driverRole === 'helper';
                const opts = vehicleList
                    .filter(v => {
                        const slots = lorrySlots[v];
                        if (!slots) return true;
                        if (isHelper) return !slots.hasHelper;
                        return !slots.hasDriver;
                    })
                    .map(v => {
                        const slots = lorrySlots[v];
                        let hint = '';
                        if (slots) {
                            if (!isHelper && slots.hasHelper) hint = ' (has helper)';
                            if (isHelper && slots.hasDriver) hint = ' (has driver)';
                        }
                        return `<option value="${v}">${v}${hint}</option>`;
                    })
                    .join('');
                if (opts) {
                    lorryHtml = `<br><select class="lorry-assign-select" onchange="assignLorry(${driver.id}, this, '${driver.role || 'Driver'}')" title="Assign a lorry">
                        <option value="">🚛 Assign lorry...</option>${opts}</select>`;
                }
            }


            const row = document.createElement('tr');
            if (driver.terminated) { row.style.backgroundColor = '#FADBD8'; row.style.opacity = '0.7'; }
            row.innerHTML = `
                <td>${photoHTML}</td>
                <td>${driver.name}${driver.terminated ? '<br><span style="background:#E74C3C;color:white;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:bold;">TERMINATED</span>' : ''}${lorryHtml}</td>
                <td><span style="background:#3498db;color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">${driver.role || 'Driver'}</span></td>
                <td>${salaryTypeBadge}</td>
                <td>${driver.contact}</td>
                <td>${driver.license_number || '-'}</td>
                <td>${driver.age}</td>
                <td>${driver.address}</td>
                <td style="font-size:12px;">${salaryInfo}</td>
                ${actionButtons}
            `;
            return row;
        }

        activeDrivers.forEach(driver => tbody.appendChild(buildDriverRow(driver)));

        if (terminatedDrivers.length > 0) {
            const colSpan = userRole === 'viewer' ? 9 : 10;
            const archiveToggleRow = document.createElement('tr');
            archiveToggleRow.innerHTML = `
                <td colspan="${colSpan}" onclick="toggleDriverArchive()">
                    <span id="driverArchiveIcon">▶</span>
                    📦 Archived / Terminated Staff
                    <span class="archive-badge">🔒 ${terminatedDrivers.length}</span>
                </td>`;
            tbody.appendChild(archiveToggleRow);

            terminatedDrivers.forEach(driver => {
                const row = buildDriverRow(driver);
                row.classList.add('driver-archive-row');
                row.style.display = 'none';
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading drivers:', error.message);
    }
}


window.assignLorry = async function(driverId, selectEl, driverRole) {
    const lorryNumber = selectEl.value;
    if (!lorryNumber) return;
    if (!checkAdminAccess('assign')) return;
    try {
        // Remove any existing assignment for this driver first (1 lorry per person)
        await supabaseClient.from('staff_lorry_assignments')
            .delete().eq('driver_id', driverId).eq('user_id', getQueryUserId());
        const { error } = await supabaseClient.from('staff_lorry_assignments').insert([{
            driver_id: driverId,
            lorry_number: lorryNumber,
            driver_role: driverRole || 'Driver',
            user_id: getQueryUserId()
        }]);
        if (error) throw error;
        loadDrivers();
    } catch (err) {
        console.error('Error assigning lorry:', err);
        alert('Error assigning lorry: ' + err.message);
    }
};

// Remove lorry assignment from a staff member
window.unassignLorry = async function(driverId) {
    if (!checkAdminAccess('unassign')) return;
    if (!confirm('Remove this lorry assignment?')) return;
    try {
        const { error } = await supabaseClient.from('staff_lorry_assignments')
            .delete().eq('driver_id', driverId).eq('user_id', getQueryUserId());
        if (error) throw error;
        loadDrivers();
    } catch (err) {
        console.error('Error unassigning lorry:', err);
        alert('Error removing assignment: ' + err.message);
    }
};


function toggleDriverArchive() {
    const rows = document.querySelectorAll('.driver-archive-row');
    const icon = document.getElementById('driverArchiveIcon');
    const isHidden = rows.length > 0 && rows[0].style.display === 'none';
    rows.forEach(r => r.style.display = isHidden ? '' : 'none');
    if (icon) icon.classList.toggle('open', isHidden);
}

// Edit Driver
async function editDriver(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient.from('drivers').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('driverId').value = data.id;
        document.getElementById('driverName').value = data.name;
        document.getElementById('driverContact').value = data.contact;
        document.getElementById('driverLicense').value = data.license_number || '';
        document.getElementById('driverAge').value = data.age;
        document.getElementById('driverAddress').value = data.address;
        document.getElementById('driverPhoto').value = data.photo_url || '';
        document.getElementById('driverRole').value = data.role || '';
        document.getElementById('driverSalaryType').value = data.salary_type || 'fixed';
        document.getElementById('driverBasicSalary').value = data.basic_salary || '';
        document.getElementById('driverKmLimit').value = data.km_limit || '';
        document.getElementById('driverExtraKmRate').value = data.extra_km_rate || '';
        document.getElementById('driverPerTipCharge').value = data.per_tip_charge || '';
        toggleDriverSalaryTypeFields();
        if (document.getElementById('driverTerminated')) {
            document.getElementById('driverTerminated').checked = data.terminated || false;
        }
        document.getElementById('driverFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading driver: ' + error.message);
    }
}

async function deleteDriver(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this driver?')) {
        try {
            await supabaseClient.from('drivers').delete().eq('id', id);
            loadDrivers();
        } catch (error) {
            alert('Error deleting driver: ' + error.message);
        }
    }
}

// ============ HIRE-TO-PAY VEHICLES ============
document.getElementById('addHireVehicleBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('hireVehicleForm').reset();
    document.getElementById('hireVehicleId').value = '';
    // Reset terminated checkbox
    if(document.getElementById('hireVehicleTerminated')) {
        document.getElementById('hireVehicleTerminated').checked = false;
    }
    document.getElementById('hireVehicleFormContainer').style.display = 'block';
});

document.getElementById('cancelHireVehicleBtn')?.addEventListener('click', () => {
    document.getElementById('hireVehicleFormContainer').style.display = 'none';
});

document.getElementById('hireVehicleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('hireVehicleId').value;
    const data = {
        lorry_number: document.getElementById('lorryNumber').value,
        vehicle_model: document.getElementById('hireVehicleModel').value,
        length: parseFloat(document.getElementById('lorryLength').value),
        photo_url: document.getElementById('hireVehiclePhoto').value || null,
        vector_art_url: document.getElementById('hireVehicleVectorArt').value || null,
        price_0_100km: parseFloat(document.getElementById('price0To100').value),
        price_100_250km: parseFloat(document.getElementById('price100To250').value),
        price_250km_plus: parseFloat(document.getElementById('price250Plus').value),
        loading_charge: parseFloat(document.getElementById('loadingCharge').value),
        waiting_charge_24hrs: parseFloat(document.getElementById('waitingCharge24').value),
        waiting_charge_extra: parseFloat(document.getElementById('waitingChargeExtra').value),
        minimum_hire_amount: parseFloat(document.getElementById('minimumHireAmount').value),
        ownership: document.getElementById('ownership').value,
        terminated: document.getElementById('hireVehicleTerminated') ? document.getElementById('hireVehicleTerminated').checked : false,
        user_id: adminUserId
    };

    try {
        if (id) {
            const { error: updateError } = await supabaseClient.from('hire_to_pay_vehicles').update(data).eq('id', id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseClient.from('hire_to_pay_vehicles').insert([data]);
            if (insertError) throw insertError;
        }
        loadHireVehicles();
        document.getElementById('hireVehicleFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving vehicle: ' + error.message);
    }
});

function buildHireVehicleRow(vehicle) {
    const actionButtons = userRole === 'viewer' ? '' : `
        <td class="action-buttons">
            <button class="btn btn-edit" onclick="editHireVehicle(${vehicle.id})">Edit</button>
            <button class="btn btn-danger" onclick="deleteHireVehicle(${vehicle.id})">Delete</button>
        </td>
    `;
    const photoHTML = vehicle.photo_url ?
        `<img src="${vehicle.photo_url}" alt="${vehicle.lorry_number}" class="vehicle-photo" onclick="openPhotoLightbox('${vehicle.photo_url}')" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'no-vehicle-photo\\'>🚚</div>';">` :
        `<div class="no-vehicle-photo">🚚</div>`;
    const statusBadge = vehicle.terminated
        ? `<span style="background: #E74C3C; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">TERMINATED</span>`
        : `<span style="background: #27AE60; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">ACTIVE</span>`;
    const row = document.createElement('tr');
    if (vehicle.terminated) { row.style.backgroundColor = '#FADBD8'; row.style.opacity = '0.7'; }
    row.innerHTML = `
        <td>${photoHTML}</td>
        <td>${vehicle.lorry_number}<br>${statusBadge}</td>
        <td>${vehicle.vehicle_model || '-'}</td>
        <td>${vehicle.length}</td>
        <td>LKR ${vehicle.price_0_100km}</td>
        <td>LKR ${vehicle.price_100_250km}</td>
        <td>LKR ${vehicle.price_250km_plus}</td>
        <td>LKR ${vehicle.loading_charge}</td>
        <td>LKR ${vehicle.waiting_charge_24hrs}</td>
        <td>LKR ${vehicle.waiting_charge_extra}</td>
        <td>LKR ${vehicle.minimum_hire_amount}</td>
        <td>${vehicle.ownership}</td>
        ${actionButtons}
    `;
    return row;
}

async function loadHireVehicles() {
    try {
        const { data, error } = await supabaseClient
            .from('hire_to_pay_vehicles')
            .select('*')
            .eq('user_id', getQueryUserId())
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.querySelector('#hireVehiclesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 20px; color: #7F8C8D;">No vehicles found</td></tr>';
            return;
        }

        const activeVehicles = data.filter(v => !v.terminated);
        const terminatedVehicles = data.filter(v => v.terminated);

        // Render active vehicles first
        activeVehicles.forEach(vehicle => tbody.appendChild(buildHireVehicleRow(vehicle)));

        // Render terminated vehicles as collapsible archive
        if (terminatedVehicles.length > 0) {
            const colSpan = userRole === 'viewer' ? 12 : 13;
            const archiveToggleRow = document.createElement('tr');
            archiveToggleRow.id = 'hireArchiveToggleRow';
            archiveToggleRow.innerHTML = `
                <td colspan="${colSpan}" onclick="toggleHireArchive()">
                    <span id="hireArchiveIcon">▶</span>
                    📦 Archived / Terminated Vehicles
                    <span class="archive-badge">🔒 ${terminatedVehicles.length}</span>
                </td>`;
            tbody.appendChild(archiveToggleRow);

            terminatedVehicles.forEach(vehicle => {
                const row = buildHireVehicleRow(vehicle);
                row.classList.add('hire-archive-row');
                row.style.display = 'none';
                tbody.appendChild(row);
            });
        }
        
        updateVehicleSelectors();
    } catch (error) {
        console.error('Error loading vehicles:', error.message);
    }
}

function toggleHireArchive() {
    const rows = document.querySelectorAll('.hire-archive-row');
    const icon = document.getElementById('hireArchiveIcon');
    const isHidden = rows.length > 0 && rows[0].style.display === 'none';
    rows.forEach(r => r.style.display = isHidden ? '' : 'none');
    if (icon) icon.classList.toggle('open', isHidden);
}

async function editHireVehicle(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient.from('hire_to_pay_vehicles').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('hireVehicleId').value = data.id;
        document.getElementById('lorryNumber').value = data.lorry_number;
        document.getElementById('hireVehicleModel').value = data.vehicle_model || '';
        document.getElementById('lorryLength').value = data.length;
        document.getElementById('hireVehiclePhoto').value = data.photo_url || '';
        document.getElementById('hireVehicleVectorArt').value = data.vector_art_url || '';
        document.getElementById('price0To100').value = data.price_0_100km;
        document.getElementById('price100To250').value = data.price_100_250km;
        document.getElementById('price250Plus').value = data.price_250km_plus;
        document.getElementById('loadingCharge').value = data.loading_charge;
        document.getElementById('waitingCharge24').value = data.waiting_charge_24hrs;
        document.getElementById('waitingChargeExtra').value = data.waiting_charge_extra;
        document.getElementById('minimumHireAmount').value = data.minimum_hire_amount;
        document.getElementById('ownership').value = data.ownership;
        if(document.getElementById('hireVehicleTerminated')) {
            document.getElementById('hireVehicleTerminated').checked = data.terminated || false;
        }
        
        document.getElementById('hireVehicleFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading vehicle: ' + error.message);
    }
}

async function deleteHireVehicle(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this vehicle?')) {
        try {
            await supabaseClient.from('hire_to_pay_vehicles').delete().eq('id', id);
            loadHireVehicles();
        } catch (error) {
            alert('Error deleting vehicle: ' + error.message);
        }
    }
}

// ============ HIRE-TO-PAY RECORDS ============
document.getElementById('addHireRecordBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('hireRecordForm').reset();
    document.getElementById('hireRecordId').value = '';
    document.getElementById('hireRecordFormContainer').style.display = 'block';
});

document.getElementById('cancelHireRecordBtn')?.addEventListener('click', () => {
    document.getElementById('hireRecordFormContainer').style.display = 'none';
});

document.getElementById('hireRecordsMonth')?.addEventListener('change', loadHireRecords);
document.getElementById('hireRecordsVehicleFilter')?.addEventListener('change', loadHireRecords);

document.getElementById('hireRecordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('hireRecordId').value;
    const distance = parseFloat(document.getElementById('hireDistance').value);
    const vehicleId = parseInt(document.getElementById('hireToPayVehicle').value);
    const waitingHours = parseFloat(document.getElementById('hireWaitingHours').value) || 0;
    const fuelLitres = parseFloat(document.getElementById('hireFuel').value);
    const fuelPrice = parseFloat(document.getElementById('hireFuelPrice').value);
    const hasLoading = document.getElementById('hireLoading').checked;
    const otherCharges = parseFloat(document.getElementById('hireOtherCharges').value) || 0;

    try {
        const { data: vehicleData, error: vehicleError } = await supabaseClient
            .from('hire_to_pay_vehicles')
            .select('*')
            .eq('id', vehicleId)
            .single();
        
        if (vehicleError) throw vehicleError;

        let hireAmount = 0;
        if (distance <= 100) {
            hireAmount = distance * vehicleData.price_0_100km;
        } else if (distance <= 250) {
            hireAmount = (100 * vehicleData.price_0_100km) + 
                        ((distance - 100) * vehicleData.price_100_250km);
        } else {
            hireAmount = (100 * vehicleData.price_0_100km) + 
                        (150 * vehicleData.price_100_250km) +
                        ((distance - 250) * vehicleData.price_250km_plus);
        }

        if (hasLoading) hireAmount += vehicleData.loading_charge;
        
        let waitingCharge = 0;
        if (waitingHours > 0) {
            if (waitingHours <= 24) {
                waitingCharge = vehicleData.waiting_charge_24hrs * waitingHours;
            } else {
                waitingCharge = (vehicleData.waiting_charge_24hrs * 24) + 
                              ((waitingHours - 24) * vehicleData.waiting_charge_extra);
            }
        }
        hireAmount += waitingCharge;
        hireAmount += otherCharges;

        if (hireAmount < vehicleData.minimum_hire_amount) {
            hireAmount = vehicleData.minimum_hire_amount + waitingCharge + otherCharges;
        }

        const fuelCost = fuelLitres * fuelPrice;

        const recordData = {
            job_number: document.getElementById('jobNumber').value,
            hire_date: document.getElementById('hireDate').value,
            vehicle_id: vehicleId,
            from_location: document.getElementById('hireFrom').value,
            to_location: document.getElementById('hireTo').value,
            distance: distance,
            fuel_litres: fuelLitres,
            fuel_price_per_litre: fuelPrice,
            fuel_cost: fuelCost,
            waiting_hours: waitingHours,
            waiting_charge: waitingCharge,
            loading_applied: hasLoading,
            other_charges: otherCharges,
            hire_amount: hireAmount,
            user_id: adminUserId
        };

        if (id) {
            await supabaseClient.from('hire_to_pay_records').update(recordData).eq('id', id);
        } else {
            await supabaseClient.from('hire_to_pay_records').insert([recordData]);
        }
        
        loadHireRecords();
        if (typeof renderTrackedVehicles === 'function') {
            renderTrackedVehicles();
        }
        if (typeof loadDashboard === 'function') {
            loadDashboard();
        }
        document.getElementById('hireRecordFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving hire record: ' + error.message);
    }
});

async function loadHireRecords() {
    try {
        const monthValue = document.getElementById('hireRecordsMonth')?.value;
        const vehicleFilter = document.getElementById('hireRecordsVehicleFilter')?.value;
        
        let query = supabaseClient
            .from('hire_to_pay_records')
            .select('*, hire_to_pay_vehicles(lorry_number, price_0_100km, price_100_250km, price_250km_plus, minimum_hire_amount)')
            .eq('user_id', getQueryUserId());
        
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            // FIXED:
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            
            query = query.gte('hire_date', startDate).lte('hire_date', endDate);
        }

        if (vehicleFilter) {
            query = query.eq('vehicle_id', vehicleFilter);
        }

        const { data, error } = await query.order('hire_date', { ascending: true });
        if (error) throw error;

        const tbody = document.querySelector('#hireRecordsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        data.forEach(record => {
            const row = document.createElement('tr');
            
            let distanceCharge = 0;
            const distance = record.distance;
            
            if (distance <= 100) {
                distanceCharge = distance * record.hire_to_pay_vehicles.price_0_100km;
            } else if (distance <= 250) {
                distanceCharge = (100 * record.hire_to_pay_vehicles.price_0_100km) + 
                                ((distance - 100) * record.hire_to_pay_vehicles.price_100_250km);
            } else {
                distanceCharge = (100 * record.hire_to_pay_vehicles.price_0_100km) + 
                                (150 * record.hire_to_pay_vehicles.price_100_250km) +
                                ((distance - 250) * record.hire_to_pay_vehicles.price_250km_plus);
            }

            const actionButtons = userRole === 'viewer' ? '' : `
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editHireRecord(${record.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteHireRecord(${record.id})">Delete</button>
                </td>
            `;

            row.innerHTML = `
                <td>${record.job_number}</td>
                <td>${record.hire_date}</td>
                <td>${record.hire_to_pay_vehicles.lorry_number}</td>
                <td>${record.from_location}</td>
                <td>${record.to_location}</td>
                <td>${record.distance} km</td>
                <td>LKR ${record.fuel_cost.toFixed(2)}</td>
                <td><small>Wait: LKR ${record.waiting_charge.toFixed(2)}<br>Hrs: ${record.waiting_hours}</small></td>
                <td><small>Distance: LKR ${distanceCharge.toFixed(2)}<br>Wait: LKR ${record.waiting_charge.toFixed(2)}<br>Other: LKR ${record.other_charges.toFixed(2)}<br><strong>Total: LKR ${record.hire_amount.toFixed(2)}</strong></small></td>
                ${actionButtons}
            `;
            tbody.appendChild(row);
        });

        updateHireRecordVehicleFilter();
    } catch (error) {
        console.error('Error loading hire records:', error.message);
    }
}

async function updateHireRecordVehicleFilter() {
    try {
        const monthValue = document.getElementById('hireRecordsMonth')?.value;
        const { data: hireVehicles } = await supabaseClient
            .from('hire_to_pay_vehicles')
            .select('id, lorry_number, ownership, terminated')
            .eq('user_id', getQueryUserId());

        // Get vehicle IDs that have hires in the selected month (for terminated check)
        let vehicleIdsWithHires = new Set();
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            const { data: hiresInMonth } = await supabaseClient
                .from('hire_to_pay_records')
                .select('vehicle_id')
                .eq('user_id', getQueryUserId())
                .gte('hire_date', startDate)
                .lte('hire_date', endDate);
            if (hiresInMonth) hiresInMonth.forEach(r => vehicleIdsWithHires.add(r.vehicle_id));
        }

        const filterSelect = document.getElementById('hireRecordsVehicleFilter');
        if (!filterSelect) return;
        
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Vehicles</option>';
        
        hireVehicles?.forEach(v => {
            // Skip terminated vehicles that have no hires in the selected month
            if (v.terminated && monthValue && !vehicleIdsWithHires.has(v.id)) return;
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = `${v.lorry_number} (${v.ownership})${v.terminated ? ' [Terminated]' : ''}`;
            filterSelect.appendChild(option);
        });

        filterSelect.value = currentValue;
    } catch (error) {
        console.error('Error updating hire vehicle filter:', error.message);
    }
}

async function editHireRecord(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient.from('hire_to_pay_records').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('hireRecordId').value = data.id;
        document.getElementById('jobNumber').value = data.job_number;
        document.getElementById('hireDate').value = data.hire_date;
        document.getElementById('hireToPayVehicle').value = data.vehicle_id;
        document.getElementById('hireFrom').value = data.from_location;
        document.getElementById('hireTo').value = data.to_location;
        document.getElementById('hireDistance').value = data.distance;
        document.getElementById('hireFuel').value = data.fuel_litres;
        document.getElementById('hireFuelPrice').value = data.fuel_price_per_litre;
        document.getElementById('hireWaitingHours').value = data.waiting_hours;
        document.getElementById('hireLoading').checked = data.loading_applied;
        document.getElementById('hireOtherCharges').value = data.other_charges;
        document.getElementById('hireRecordFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading hire record: ' + error.message);
    }
}

async function deleteHireRecord(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this hire record?')) {
        try {
            await supabaseClient.from('hire_to_pay_records').delete().eq('id', id);
            loadHireRecords();
        } catch (error) {
            alert('Error deleting hire record: ' + error.message);
        }
    }
}

// ============ OTHER OPERATION HIRES ============
document.getElementById('addOtherOperationHireBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('otherOperationHireForm').reset();
    document.getElementById('otherOperationHireId').value = '';
    document.getElementById('otherOperationHireFormContainer').style.display = 'block';
});

document.getElementById('cancelOtherOperationHireBtn')?.addEventListener('click', () => {
    document.getElementById('otherOperationHireFormContainer').style.display = 'none';
});

document.getElementById('otherOperationHiresMonth')?.addEventListener('change', loadOtherOperationHires);
document.getElementById('otherOperationHiresVehicleFilter')?.addEventListener('change', loadOtherOperationHires);

document.getElementById('otherOperationHireForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('otherOperationHireId').value;
    const distance = parseFloat(document.getElementById('otherOpDistance').value) || 0;
    const first100Rate = parseFloat(document.getElementById('otherOpFirst100Rate').value) || 0;
    const restRate = parseFloat(document.getElementById('otherOpRestKmRate').value) || 0;
    
    let hireAmount = 0;
    if (distance <= 100) {
        hireAmount = distance * first100Rate;
    } else {
        hireAmount = (100 * first100Rate) + ((distance - 100) * restRate);
    }

    const fuelLitres = parseFloat(document.getElementById('otherOpFuel').value) || 0;
    const fuelPrice = parseFloat(document.getElementById('otherOpFuelPrice').value) || 0;
    const fuelCost = fuelLitres * fuelPrice;

    const recordData = {
        base_lorry_number: document.getElementById('otherOpBaseVehicle').value,
        operation_name: document.getElementById('otherOpOperationName').value,
        hire_date: document.getElementById('otherOpDate').value,
        from_location: document.getElementById('otherOpFrom').value,
        to_location: document.getElementById('otherOpTo').value,
        distance: distance,
        first_100km_rate: first100Rate,
        rest_km_rate: restRate,
        fuel_litres: fuelLitres,
        fuel_price_per_litre: fuelPrice,
        fuel_cost: fuelCost,
        hire_amount: hireAmount,
        user_id: adminUserId
    };

    try {
        if (id) {
            await supabaseClient.from('other_operation_hires').update(recordData).eq('id', id);
        } else {
            await supabaseClient.from('other_operation_hires').insert([recordData]);
        }
        
        loadOtherOperationHires();
        if (typeof renderTrackedVehicles === 'function') {
            renderTrackedVehicles();
        }
        if (typeof loadDashboard === 'function') {
            loadDashboard();
        }
        document.getElementById('otherOperationHireFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving record: ' + error.message);
    }
});

async function loadOtherOperationHires() {
    try {
        const monthValue = document.getElementById('otherOperationHiresMonth')?.value;
        const vehicleFilter = document.getElementById('otherOperationHiresVehicleFilter')?.value;
        
        let query = supabaseClient
            .from('other_operation_hires')
            .select('*')
            .eq('user_id', getQueryUserId());
        
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            query = query.gte('hire_date', startDate).lte('hire_date', endDate);
        }

        if (vehicleFilter) {
            query = query.eq('base_lorry_number', vehicleFilter);
        }

        const { data, error } = await query.order('hire_date', { ascending: true });
        if (error) {
            console.warn('Error loading other operation hires (table might not exist yet):', error.message);
        } else if (data) {
            const tbody = document.querySelector('#otherOperationHiresTable tbody');
            if (tbody) {
                tbody.innerHTML = '';
                data.forEach(record => {
                    const row = document.createElement('tr');
                    const actionButtons = userRole === 'viewer' ? '' : `
                        <td class="action-buttons">
                            <button class="btn btn-edit" onclick="editOtherOperationHire(${record.id})">Edit</button>
                            <button class="btn btn-danger" onclick="deleteOtherOperationHire(${record.id})">Delete</button>
                        </td>
                    `;
                    row.innerHTML = `
                        <td>${record.hire_date}</td>
                        <td>${record.base_lorry_number}</td>
                        <td>${record.operation_name}</td>
                        <td>${record.from_location} - ${record.to_location}</td>
                        <td>${record.distance} km</td>
                        <td><small>Litres: ${record.fuel_litres}<br>Rate: LKR ${record.fuel_price_per_litre}<br><strong>Cost: LKR ${record.fuel_cost.toFixed(2)}</strong></small></td>
                        <td><small>First 100: LKR ${record.first_100km_rate}<br>Rest KM: LKR ${record.rest_km_rate}<br><strong>Total Hire: LKR ${record.hire_amount.toFixed(2)}</strong></small></td>
                        ${actionButtons}
                    `;
                    tbody.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('Error in loadOtherOperationHires:', error.message);
    }
    // Always update vehicle filter regardless of table existence
    updateOtherOperationHireVehicleFilter();
}

async function updateOtherOperationHireVehicleFilter() {
    try {
        const queryUserId = getQueryUserId();
        if (!queryUserId) return;

        const [{ data: hireVehicles }, { data: commitmentVehicles }] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('lorry_number, terminated').eq('user_id', queryUserId),
            supabaseClient.from('commitment_vehicles').select('vehicle_number, terminated').eq('user_id', queryUserId)
        ]);

        const baseVehicles = new Set();
        hireVehicles?.forEach(v => {
            if (!v.terminated) baseVehicles.add(extractBaseVehicleName(v.lorry_number));
        });
        commitmentVehicles?.forEach(v => {
            if (!v.terminated) baseVehicles.add(extractBaseVehicleName(v.vehicle_number));
        });

        // Also add vehicles that are already in the records even if terminated now
        const { data: existingRecords } = await supabaseClient
            .from('other_operation_hires')
            .select('base_lorry_number')
            .eq('user_id', queryUserId);
        existingRecords?.forEach(r => baseVehicles.add(r.base_lorry_number));

        const sortedBaseVehicles = Array.from(baseVehicles).sort();

        const filterSelect = document.getElementById('otherOperationHiresVehicleFilter');
        const formSelect = document.getElementById('otherOpBaseVehicle');
        
        if (filterSelect) {
            const currentValue = filterSelect.value;
            filterSelect.innerHTML = '<option value="">All Base Vehicles</option>';
            sortedBaseVehicles.forEach(number => {
                const option = document.createElement('option');
                option.value = number;
                option.textContent = number;
                filterSelect.appendChild(option);
            });
            filterSelect.value = currentValue;
        }

        if (formSelect) {
            const currentFormValue = formSelect.value;
            formSelect.innerHTML = '<option value="">Select Base Vehicle</option>';
            sortedBaseVehicles.forEach(number => {
                const option = document.createElement('option');
                option.value = number;
                option.textContent = number;
                formSelect.appendChild(option);
            });
            formSelect.value = currentFormValue;
        }
    } catch (error) {
        console.error('Error updating other operation hire vehicle filter:', error.message);
    }
}

async function editOtherOperationHire(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient.from('other_operation_hires').select('*').eq('id', id).single();
        if (error) throw error;
        
        // Ensure vehicle exists in select
        const formSelect = document.getElementById('otherOpBaseVehicle');
        if (formSelect && ![...formSelect.options].some(opt => opt.value == data.base_lorry_number)) {
            const option = document.createElement('option');
            option.value = data.base_lorry_number;
            option.textContent = `${data.base_lorry_number} [Archived/Terminated]`;
            formSelect.appendChild(option);
        }

        document.getElementById('otherOperationHireId').value = data.id;
        document.getElementById('otherOpBaseVehicle').value = data.base_lorry_number;
        document.getElementById('otherOpOperationName').value = data.operation_name;
        document.getElementById('otherOpDate').value = data.hire_date;
        document.getElementById('otherOpFrom').value = data.from_location;
        document.getElementById('otherOpTo').value = data.to_location;
        document.getElementById('otherOpDistance').value = data.distance;
        document.getElementById('otherOpFirst100Rate').value = data.first_100km_rate;
        document.getElementById('otherOpRestKmRate').value = data.rest_km_rate;
        document.getElementById('otherOpFuel').value = data.fuel_litres;
        document.getElementById('otherOpFuelPrice').value = data.fuel_price_per_litre;
        
        document.getElementById('otherOperationHireFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading record: ' + error.message);
    }
}

async function deleteOtherOperationHire(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this record?')) {
        try {
            await supabaseClient.from('other_operation_hires').delete().eq('id', id);
            loadOtherOperationHires();
        } catch (error) {
            alert('Error deleting record: ' + error.message);
        }
    }
}

// ============ COMMITMENT VEHICLES ============
document.getElementById('addCommitmentVehicleBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('commitmentVehicleForm').reset();
    document.getElementById('commitmentVehicleId').value = '';
    // Reset terminated checkbox
    if(document.getElementById('commitmentVehicleTerminated')) {
        document.getElementById('commitmentVehicleTerminated').checked = false;
    }
    document.getElementById('commitmentVehicleFormContainer').style.display = 'block';
});

document.getElementById('cancelCommitmentVehicleBtn')?.addEventListener('click', () => {
    document.getElementById('commitmentVehicleFormContainer').style.display = 'none';
});

document.getElementById('commitmentVehicleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('commitmentVehicleId').value;
    const data = {
        vehicle_number: document.getElementById('commitmentVehicleNumber').value,
        vehicle_model: document.getElementById('commitmentVehicleModel').value,
        fixed_monthly_payment: parseFloat(document.getElementById('fixedPayment').value),
        photo_url: document.getElementById('commitmentVehiclePhoto').value || null,
        vector_art_url: document.getElementById('commitmentVehicleVectorArt').value || null,
        km_limit_per_month: parseFloat(document.getElementById('kmLimit').value),
        extra_km_charge: parseFloat(document.getElementById('extraKmCharge').value),
        loading_charge: parseFloat(document.getElementById('commitmentLoadingCharge').value),
        terminated: document.getElementById('commitmentVehicleTerminated') ? document.getElementById('commitmentVehicleTerminated').checked : false,
        ownership: document.getElementById('commitmentOwnership').value,
        user_id: adminUserId
    };

    try {
        if (id) {
            const { error: updateError } = await supabaseClient.from('commitment_vehicles').update(data).eq('id', id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseClient.from('commitment_vehicles').insert([data]);
            if (insertError) throw insertError;
        }
        loadCommitmentVehicles();
        document.getElementById('commitmentVehicleFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving commitment vehicle: ' + error.message);
    }
});

function buildCommitmentVehicleRow(vehicle) {
    const actionButtons = userRole === 'viewer' ? '' : `
        <td class="action-buttons">
            <button class="btn btn-edit" onclick="editCommitmentVehicle(${vehicle.id})">Edit</button>
            <button class="btn btn-danger" onclick="deleteCommitmentVehicle(${vehicle.id})">Delete</button>
        </td>
    `;
    const photoHTML = vehicle.photo_url ?
        `<img src="${vehicle.photo_url}" alt="${vehicle.vehicle_number}" class="vehicle-photo" onclick="openPhotoLightbox('${vehicle.photo_url}')" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'no-vehicle-photo\\'>🚛</div>';">` :
        `<div class="no-vehicle-photo">🚛</div>`;
    const statusBadge = vehicle.terminated
        ? `<span style="background: #E74C3C; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">TERMINATED</span>`
        : `<span style="background: #27AE60; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">ACTIVE</span>`;
    const row = document.createElement('tr');
    if (vehicle.terminated) { row.style.backgroundColor = '#FADBD8'; row.style.opacity = '0.7'; }
    row.innerHTML = `
        <td>${photoHTML}</td>
        <td>${vehicle.vehicle_number}<br>${statusBadge}</td>
        <td>${vehicle.vehicle_model || '-'}</td>
        <td>LKR ${vehicle.fixed_monthly_payment}</td>
        <td>${vehicle.km_limit_per_month} km</td>
        <td>LKR ${vehicle.extra_km_charge}/km</td>
        <td>LKR ${vehicle.loading_charge}</td>
        <td>${vehicle.ownership || '-'}</td>
        ${actionButtons}
    `;
    return row;
}

async function loadCommitmentVehicles() {
    try {
        const { data, error } = await supabaseClient
            .from('commitment_vehicles')
            .select('*')
            .eq('user_id', getQueryUserId())
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.querySelector('#commitmentVehiclesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: #7F8C8D;">No vehicles found</td></tr>';
            return;
        }

        const activeVehicles = data.filter(v => !v.terminated);
        const terminatedVehicles = data.filter(v => v.terminated);

        activeVehicles.forEach(vehicle => tbody.appendChild(buildCommitmentVehicleRow(vehicle)));

        if (terminatedVehicles.length > 0) {
            const colSpan = userRole === 'viewer' ? 8 : 9;
            const archiveToggleRow = document.createElement('tr');
            archiveToggleRow.id = 'commitmentArchiveToggleRow';
            archiveToggleRow.innerHTML = `
                <td colspan="${colSpan}" onclick="toggleCommitmentArchive()">
                    <span id="commitmentArchiveIcon">▶</span>
                    📦 Archived / Terminated Vehicles
                    <span class="archive-badge">🔒 ${terminatedVehicles.length}</span>
                </td>`;
            tbody.appendChild(archiveToggleRow);

            terminatedVehicles.forEach(vehicle => {
                const row = buildCommitmentVehicleRow(vehicle);
                row.classList.add('commitment-archive-row');
                row.style.display = 'none';
                tbody.appendChild(row);
            });
        }
        
        updateVehicleSelectors();
    } catch (error) {
        console.error('Error loading commitment vehicles:', error.message);
    }
}

function toggleCommitmentArchive() {
    const rows = document.querySelectorAll('.commitment-archive-row');
    const icon = document.getElementById('commitmentArchiveIcon');
    const isHidden = rows.length > 0 && rows[0].style.display === 'none';
    rows.forEach(r => r.style.display = isHidden ? '' : 'none');
    if (icon) icon.classList.toggle('open', isHidden);
}

async function editCommitmentVehicle(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient.from('commitment_vehicles').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('commitmentVehicleId').value = data.id;
        document.getElementById('commitmentVehicleNumber').value = data.vehicle_number;
        document.getElementById('commitmentVehicleModel').value = data.vehicle_model || '';
        document.getElementById('fixedPayment').value = data.fixed_monthly_payment;
        document.getElementById('commitmentVehiclePhoto').value = data.photo_url || '';
        document.getElementById('commitmentVehicleVectorArt').value = data.vector_art_url || '';
        document.getElementById('kmLimit').value = data.km_limit_per_month;
        document.getElementById('extraKmCharge').value = data.extra_km_charge;
        document.getElementById('commitmentLoadingCharge').value = data.loading_charge;
    document.getElementById('commitmentOwnership').value = data.ownership || '';
        if(document.getElementById('commitmentVehicleTerminated')) {
            document.getElementById('commitmentVehicleTerminated').checked = data.terminated || false;
        }
        
        document.getElementById('commitmentVehicleFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading commitment vehicle: ' + error.message);
    }
}

async function deleteCommitmentVehicle(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this vehicle?')) {
        try {
            await supabaseClient.from('commitment_vehicles').delete().eq('id', id);
            loadCommitmentVehicles();
        } catch (error) {
            alert('Error deleting commitment vehicle: ' + error.message);
        }
    }
}

// ============ COMMITMENT RECORDS ============
document.getElementById('addCommitmentRecordBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('commitmentRecordForm').reset();
    document.getElementById('commitmentRecordId').value = '';
    document.getElementById('commitmentRecordFormContainer').style.display = 'block';
});

document.getElementById('cancelCommitmentRecordBtn')?.addEventListener('click', () => {
    document.getElementById('commitmentRecordFormContainer').style.display = 'none';
});

document.getElementById('commitmentRecordsMonth')?.addEventListener('change', loadCommitmentRecords);
document.getElementById('commitmentRecordsVehicleFilter')?.addEventListener('change', loadCommitmentRecords);

document.getElementById('commitmentRecordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('commitmentRecordId').value;
    const fuelLitres = parseFloat(document.getElementById('commitmentFuel').value);
    const fuelPrice = parseFloat(document.getElementById('commitmentFuelPrice').value);
    const fuelCost = fuelLitres * fuelPrice;
    const distance = parseFloat(document.getElementById('commitmentDistance').value);
    const vehicleId = parseInt(document.getElementById('commitmentVehicleSelect').value);
    const hireDate = document.getElementById('commitmentDate').value;

    // NOTE: Extra KM charges are NO LONGER calculated per-hire.
    // They are calculated once at the vehicle+month level (total KMs vs km limit)
    // in loadCommitmentRecords(), loadDashboardData(), etc.
    // This avoids double-counting when editing past records.

    try {
        const recordData = {
            job_number: document.getElementById('commitmentJobNumber').value,
            hire_date: hireDate,
            vehicle_id: vehicleId,
            from_location: document.getElementById('commitmentFrom').value,
            to_location: document.getElementById('commitmentTo').value,
            distance: distance,
            fuel_litres: fuelLitres,
            fuel_price_per_litre: fuelPrice,
            fuel_cost: fuelCost,
            user_id: adminUserId
        };

        if (id) {
            const { error: updateError } = await supabaseClient.from('commitment_records').update(recordData).eq('id', id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseClient.from('commitment_records').insert([recordData]);
            if (insertError) throw insertError;
        }
        
        loadCommitmentRecords();
        if (typeof renderTrackedVehicles === 'function') {
            renderTrackedVehicles();
        }
        if (typeof loadDashboard === 'function') {
            loadDashboard();
        }
        document.getElementById('commitmentRecordFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving commitment record: ' + error.message);
    }
});

async function loadCommitmentRecords() {
    try {
        const monthValue = document.getElementById('commitmentRecordsMonth')?.value;
        const vehicleFilter = document.getElementById('commitmentRecordsVehicleFilter')?.value;
        
        let query = supabaseClient
            .from('commitment_records')
            .select('*, commitment_vehicles(vehicle_number, km_limit_per_month, extra_km_charge)')
            .eq('user_id', getQueryUserId());
        
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            query = query.gte('hire_date', startDate).lte('hire_date', endDate);
        }

        if (vehicleFilter) {
            query = query.eq('vehicle_id', vehicleFilter);
        }

        const { data, error } = await query.order('hire_date', { ascending: true });
        if (error) throw error;

        // Sort by job_number alphabetically (numeric-aware)
        if (data) {
            data.sort((a, b) => {
                const ja = (a.job_number || '').toString().toLowerCase();
                const jb = (b.job_number || '').toString().toLowerCase();
                return ja.localeCompare(jb, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        const tbody = document.querySelector('#commitmentRecordsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // FIXED: Calculate total KMs per vehicle for the WHOLE month first,
        // then compute one monthly extra km charge per vehicle.
        // Never calculate extra km charge hire-by-hire — it causes doubling on edit.
        const vehicleTotalKm = {};
        data.forEach(record => {
            const vid = record.vehicle_id;
            vehicleTotalKm[vid] = (vehicleTotalKm[vid] || 0) + record.distance;
        });

        // Compute monthly extra km charge per vehicle (calculated once, not per hire)
        const vehicleMonthlyExtraKmCharge = {};
        data.forEach(record => {
            const vid = record.vehicle_id;
            if (vehicleMonthlyExtraKmCharge[vid] === undefined) {
                const kmLimit = record.commitment_vehicles.km_limit_per_month;
                const totalKm = vehicleTotalKm[vid];
                const exceedingKm = Math.max(0, totalKm - kmLimit);
                vehicleMonthlyExtraKmCharge[vid] = exceedingKm * record.commitment_vehicles.extra_km_charge;
            }
        });

        // Track running KM totals per vehicle for display
        const vehicleRunningKm = {};

        data.forEach(record => {
            const row = document.createElement('tr');
            const kmLimit = record.commitment_vehicles.km_limit_per_month;
            const vid = record.vehicle_id;

            if (!vehicleRunningKm[vid]) vehicleRunningKm[vid] = 0;
            vehicleRunningKm[vid] += record.distance;
            const kmAfter = vehicleRunningKm[vid];

            const monthlyExtraKmCharge = vehicleMonthlyExtraKmCharge[vid] || 0;
            const totalKmForVehicle = vehicleTotalKm[vid] || 0;
            const exceedingKm = Math.max(0, totalKmForVehicle - kmLimit);

            const actionButtons = userRole === 'viewer' ? '' : `
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editCommitmentRecord(${record.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteCommitmentRecord(${record.id})">Delete</button>
                </td>
            `;

            row.innerHTML = `
                <td>${record.job_number}</td>
                <td>${record.hire_date}</td>
                <td>${record.commitment_vehicles.vehicle_number}</td>
                <td>${record.from_location}</td>
                <td>${record.to_location}</td>
                <td>${record.distance} km</td>
                <td>LKR ${record.fuel_cost.toFixed(2)}</td>
                <td><small>Running KM: ${kmAfter} / ${kmLimit}<br>Monthly Total KM: ${totalKmForVehicle} | Exceeding: ${exceedingKm.toFixed(2)} km<br>Monthly Extra Charge: LKR ${monthlyExtraKmCharge.toFixed(2)}</small></td>
                ${actionButtons}
            `;
            tbody.appendChild(row);
        });

        updateCommitmentRecordVehicleFilter();
    } catch (error) {
        console.error('Error loading commitment records:', error.message);
    }
}

async function updateCommitmentRecordVehicleFilter() {
    try {
        const monthValue = document.getElementById('commitmentRecordsMonth')?.value;
        const { data: commitmentVehicles } = await supabaseClient
            .from('commitment_vehicles')
            .select('id, vehicle_number, terminated')
            .eq('user_id', getQueryUserId());

        // Get vehicle IDs that have records in the selected month (for terminated check)
        let vehicleIdsWithHires = new Set();
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            const { data: recordsInMonth } = await supabaseClient
                .from('commitment_records')
                .select('vehicle_id')
                .eq('user_id', getQueryUserId())
                .gte('hire_date', startDate)
                .lte('hire_date', endDate);
            if (recordsInMonth) recordsInMonth.forEach(r => vehicleIdsWithHires.add(r.vehicle_id));
        }

        const filterSelect = document.getElementById('commitmentRecordsVehicleFilter');
        if (!filterSelect) return;
        
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Vehicles</option>';
        
        commitmentVehicles?.forEach(v => {
            // Skip terminated vehicles that have no records in the selected month
            if (v.terminated && monthValue && !vehicleIdsWithHires.has(v.id)) return;
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = `${v.vehicle_number}${v.terminated ? ' [Terminated]' : ''}`;
            filterSelect.appendChild(option);
        });

        filterSelect.value = currentValue;
    } catch (error) {
        console.error('Error updating commitment vehicle filter:', error.message);
    }
}

async function editCommitmentRecord(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient.from('commitment_records').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('commitmentRecordId').value = data.id;
        document.getElementById('commitmentJobNumber').value = data.job_number;
        document.getElementById('commitmentDate').value = data.hire_date;
        document.getElementById('commitmentVehicleSelect').value = data.vehicle_id;
        document.getElementById('commitmentFrom').value = data.from_location;
        document.getElementById('commitmentTo').value = data.to_location;
        document.getElementById('commitmentDistance').value = data.distance;
        document.getElementById('commitmentFuel').value = data.fuel_litres;
        document.getElementById('commitmentFuelPrice').value = data.fuel_price_per_litre;
        // NOTE: extra_charges field removed from form — km charges now calculated at vehicle+month level
        document.getElementById('commitmentRecordFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading commitment record: ' + error.message);
    }
}

async function deleteCommitmentRecord(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this commitment record?')) {
        try {
            await supabaseClient.from('commitment_records').delete().eq('id', id);
            loadCommitmentRecords();
        } catch (error) {
            alert('Error deleting commitment record: ' + error.message);
        }
    }
}

// ============ DAY OFFS ============
document.getElementById('addDayOffBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('dayOffForm').reset();
    document.getElementById('dayOffId').value = '';
    document.getElementById('dayOffFormContainer').style.display = 'block';
});

document.getElementById('cancelDayOffBtn')?.addEventListener('click', () => {
    document.getElementById('dayOffFormContainer').style.display = 'none';
});

document.getElementById('dayOffMonth')?.addEventListener('change', loadDayOffs);
document.getElementById('dayOffVehicleFilter')?.addEventListener('change', loadDayOffs);

document.getElementById('dayOffForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('dayOffId').value;
    const vehicleId = parseInt(document.getElementById('dayOffVehicle').value);
    const dayOffDate = document.getElementById('dayOffDate').value;

    try {
        const { data: vehicleData } = await supabaseClient
            .from('commitment_vehicles')
            .select('fixed_monthly_payment')
            .eq('id', vehicleId)
            .single();

        const deductionAmount = vehicleData.fixed_monthly_payment / 30;

        const dayOffData = {
            vehicle_id: vehicleId,
            day_off_date: dayOffDate,
            deduction_amount: deductionAmount,
            user_id: adminUserId
        };

        if (id) {
            const { error: updateError } = await supabaseClient.from('commitment_day_offs').update(dayOffData).eq('id', id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseClient.from('commitment_day_offs').insert([dayOffData]);
            if (insertError) throw insertError;
        }
        
        loadDayOffs();
        document.getElementById('dayOffFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving day off: ' + error.message);
    }
});

async function loadDayOffs() {
    try {
        const monthValue = document.getElementById('dayOffMonth')?.value;
        const vehicleFilter = document.getElementById('dayOffVehicleFilter')?.value;
        
        let query = supabaseClient
            .from('commitment_day_offs')
            .select('*, commitment_vehicles(vehicle_number)')
            .eq('user_id', getQueryUserId());
        
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            // FIXED:
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            query = query.gte('day_off_date', startDate).lte('day_off_date', endDate);
        }

        if (vehicleFilter) {
            query = query.eq('vehicle_id', vehicleFilter);
        }

        const { data, error } = await query.order('day_off_date', { ascending: true });
        if (error) throw error;

        const tbody = document.querySelector('#dayOffsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        data.forEach(dayOff => {
            const row = document.createElement('tr');
            const actionButtons = userRole === 'viewer' ? '' : `
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editDayOff(${dayOff.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteDayOff(${dayOff.id})">Delete</button>
                </td>
            `;

            row.innerHTML = `
                <td>${dayOff.commitment_vehicles.vehicle_number}</td>
                <td>${dayOff.day_off_date}</td>
                <td>LKR ${dayOff.deduction_amount.toFixed(2)}</td>
                ${actionButtons}
            `;
            tbody.appendChild(row);
        });

        updateDayOffVehicleFilter();
    } catch (error) {
        console.error('Error loading day offs:', error.message);
    }
}

async function updateDayOffVehicleFilter() {
    try {
        const { data: commitmentVehicles } = await supabaseClient
            .from('commitment_vehicles')
            .select('id, vehicle_number')
            .eq('user_id', getQueryUserId());

        const filterSelect = document.getElementById('dayOffVehicleFilter');
        if (!filterSelect) return;
        
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Vehicles</option>';
        
        commitmentVehicles?.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = v.vehicle_number;
            filterSelect.appendChild(option);
        });

        filterSelect.value = currentValue;
    } catch (error) {
        console.error('Error updating day off vehicle filter:', error.message);
    }
}

async function editDayOff(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient.from('commitment_day_offs').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('dayOffId').value = data.id;
        document.getElementById('dayOffVehicle').value = data.vehicle_id;
        document.getElementById('dayOffDate').value = data.day_off_date;
        document.getElementById('dayOffFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading day off: ' + error.message);
    }
}

async function deleteDayOff(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this day off?')) {
        try {
            await supabaseClient.from('commitment_day_offs').delete().eq('id', id);
            loadDayOffs();
        } catch (error) {
            alert('Error deleting day off: ' + error.message);
        }
    }
}

// ============ DASHBOARD FUNCTIONS ============
async function loadDashboardData(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;

        // Get last day correctly without timezone shift
        const lastDay = new Date(year, month, 0).getDate(); 
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

        const currentQueryUserId = getQueryUserId();

        // Fetch all data and vehicle maps concurrently
        const [
            { data: hireRecords },
            { data: commitmentRecords },
            { data: dayOffs },
            { data: otherOpHires },
            { data: allHireV },
            { data: allCommV }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_day_offs').select('*').eq('user_id', currentQueryUserId).gte('day_off_date', startDate).lte('day_off_date', endDate),
            supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId)
        ]);

        // Filter related commitment vehicles for fixed payment calc
        const commitmentVehicleIds = new Set();
        commitmentRecords?.forEach(record => {
            commitmentVehicleIds.add(record.vehicle_id);
        });

        const commitmentVehicles = allCommV?.filter(v => commitmentVehicleIds.has(v.id)) || [];

        // --- CALCULATIONS ---

        let totalRevenue = 0;
        let totalFuelCost = 0;
        let totalHires = 0;
        let totalDistance = 0;
        let totalFuelLitres = 0;

        // Set to track unique active vehicles (merged by base number plate)
        const activeVehiclesSet = new Set();
        
        // Map to quickly get base names for records
        const hireVehicleBaseMap = {};
        const commitVehicleBaseMap = {};

        allHireV?.forEach(v => { hireVehicleBaseMap[v.id] = extractBaseVehicleName(v.lorry_number); });
        allCommV?.forEach(v => { commitVehicleBaseMap[v.id] = extractBaseVehicleName(v.vehicle_number); });

        // Process Hire Records
        hireRecords?.forEach(record => {
            totalRevenue += record.hire_amount || 0;
            totalFuelCost += record.fuel_cost || 0;
            totalDistance += record.distance || 0;
            totalFuelLitres += record.fuel_litres || 0;
            totalHires++;
            if(record.vehicle_id) {
                const baseName = hireVehicleBaseMap[record.vehicle_id] || `hire_${record.vehicle_id}`;
                activeVehiclesSet.add(baseName);
            }
        });

        // Calculate Commitment Financials
        const commitmentPayment =
            commitmentVehicles?.reduce((sum, v) => sum + (v.fixed_monthly_payment || 0), 0) || 0;
        const dayOffDeductions =
            dayOffs?.reduce((sum, d) => sum + (d.deduction_amount || 0), 0) || 0;
        const commitmentFuelCost =
            commitmentRecords?.reduce((sum, r) => sum + (r.fuel_cost || 0), 0) || 0;

        // FIXED: Calculate extra km charges at vehicle+month level (total KMs vs km limit).
        // Never sum stored extra_charges per hire - that caused doubling on edit.
        let extraKmCharges = 0;
        if (commitmentVehicles && commitmentRecords) {
            const vehicleTotalKmDash = {};
            commitmentRecords.forEach(r => {
                vehicleTotalKmDash[r.vehicle_id] = (vehicleTotalKmDash[r.vehicle_id] || 0) + (r.distance || 0);
            });
            commitmentVehicles.forEach(v => {
                const totalKm = vehicleTotalKmDash[v.id] || 0;
                const exceedingKm = Math.max(0, totalKm - (v.km_limit_per_month || 0));
                extraKmCharges += exceedingKm * (v.extra_km_charge || 0);
            });
        }

        // Process Commitment Records for Distance & Activity
        commitmentRecords?.forEach(record => {
             totalDistance += record.distance || 0;
             totalFuelLitres += record.fuel_litres || 0;
             if(record.vehicle_id) {
                 const baseName = commitVehicleBaseMap[record.vehicle_id] || `commit_${record.vehicle_id}`;
                 activeVehiclesSet.add(baseName);
             }
        });

       

        totalRevenue += (commitmentPayment - dayOffDeductions + extraKmCharges);
        totalFuelCost += commitmentFuelCost;
        totalHires += (commitmentRecords?.length || 0);

        // Process Other Operation Hires
        otherOpHires?.forEach(record => {
            totalRevenue += record.hire_amount || 0;
            totalFuelCost += record.fuel_cost || 0;
            totalDistance += record.distance || 0;
            totalFuelLitres += record.fuel_litres || 0;
            totalHires++;
            if(record.base_lorry_number) {
                activeVehiclesSet.add(record.base_lorry_number);
            }
        });

        // Calculate Fuel Allowance (16.00% of Fuel Cost)
        const fuelAllowance = totalFuelCost * 0.1600;

        // Net Profit = Revenue - Fuel Cost + Fuel Allowance
        const netProfit = totalRevenue - totalFuelCost + fuelAllowance;

        // --- UPDATE UI ELEMENTS ---

        const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };

        setText('totalRevenue', `LKR ${totalRevenue.toFixed(2)}`);
        setText('fuelCost', `LKR ${totalFuelCost.toFixed(2)}`);
        setText('fuelAllowance', `LKR ${fuelAllowance.toFixed(2)}`);
        setText('totalHires', totalHires);

        // NEW UI UPDATES
        setText('activeLorries', activeVehiclesSet.size);
        setText('totalDistance', `${totalDistance.toLocaleString()} km`);
        setText('totalDieselLitres', `${totalFuelLitres.toFixed(0)} L`);

        // Profit (Revenue - Fuel Cost + Fuel Allowance)
        setText('netProfit', `LKR ${netProfit.toFixed(2)}`);

        // Trigger Charts
        if (typeof loadVehicleRevenueChart === 'function') {
             await loadVehicleRevenueChart(monthValue);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error.message);
    }
}

// ============ VEHICLE PERFORMANCE ============
async function loadVehiclePerformance(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        
        const currentQueryUserId = getQueryUserId();

        const [
            { data: hireVehicles },
            { data: otherOpRecords },
            { data: allHireRecords },
            { data: allCommitmentRecordsMonth },
            { data: allDayOffs },
            { data: commitmentVehicles }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_day_offs').select('*').eq('user_id', currentQueryUserId).gte('day_off_date', startDate).lte('day_off_date', endDate),
            supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId)
        ]);

        // Get hire vehicles with at least one record this month
        const vehiclesWithData = [];

        // Group hire-to-pay records by vehicle_id
        const hireRecordsByVehicle = {};
        allHireRecords?.forEach(r => {
            if (!hireRecordsByVehicle[r.vehicle_id]) hireRecordsByVehicle[r.vehicle_id] = [];
            hireRecordsByVehicle[r.vehicle_id].push(r);
        });

        // Check hire-to-pay vehicles
        for (const vehicle of hireVehicles || []) {
            const records = hireRecordsByVehicle[vehicle.id] || [];

            // Only include if there's at least one hire record
            if (records.length > 0) {
                const totalKm = records.reduce((sum, r) => sum + r.distance, 0);
                const totalRevenue = records.reduce((sum, r) => sum + r.hire_amount, 0);
                const totalFuel = records.reduce((sum, r) => sum + r.fuel_cost, 0);
                const totalFuelLitres = records.reduce((sum, r) => sum + (r.fuel_litres || 0), 0);
                const profit = totalRevenue - totalFuel;
                const ownershipLabel = vehicle.ownership === 'company' ? '🏢 Company' : '🚛 Rented';

                vehiclesWithData.push({
                    type: 'Hire-to-Pay',
                    number: extractBaseVehicleName(vehicle.lorry_number),
                    model: vehicle.vehicle_model || '-',
                    ownership: ownershipLabel,
                    totalKm,
                    totalRevenue,
                    totalFuel,
                    totalFuelLitres,
                    profit,
                    recordsCount: records.length,
                    kmLimit: null,
                    commitmentKmPct: null
                });
            }
        }

        // Group commitment records by vehicle_id
        const commitRecordsByVehicle = {};
        allCommitmentRecordsMonth?.forEach(r => {
            if (!commitRecordsByVehicle[r.vehicle_id]) commitRecordsByVehicle[r.vehicle_id] = [];
            commitRecordsByVehicle[r.vehicle_id].push(r);
        });

        // Group commitment day offs by vehicle_id
        const dayOffsByVehicle = {};
        allDayOffs?.forEach(d => {
            if (!dayOffsByVehicle[d.vehicle_id]) dayOffsByVehicle[d.vehicle_id] = [];
            dayOffsByVehicle[d.vehicle_id].push(d);
        });

        // Check commitment vehicles with hires this month
        const commitmentVehicleIdsWithHires = new Set(allCommitmentRecordsMonth?.map(r => r.vehicle_id));
        const filteredCommitmentVehicles = commitmentVehicles?.filter(v => commitmentVehicleIdsWithHires.has(v.id)) || [];

        for (const vehicle of filteredCommitmentVehicles) {
            const records = commitRecordsByVehicle[vehicle.id] || [];
            const dayOffs = dayOffsByVehicle[vehicle.id] || [];

            // Only include if there's at least one commitment record
            if (records.length > 0) {
                const totalKm = records.reduce((sum, r) => sum + r.distance, 0) || 0;
                const basePay = vehicle.fixed_monthly_payment;
                const dayOffDeductions = dayOffs.reduce((sum, d) => sum + (d.deduction_amount || 0), 0) || 0;
                // FIXED: Calculate extra km charge at vehicle+month level (not summing per-hire stored values)
                const exceedingKm = Math.max(0, totalKm - (vehicle.km_limit_per_month || 0));
                const extraKmCharges = exceedingKm * (vehicle.extra_km_charge || 0);
                const totalRevenue = basePay - dayOffDeductions + extraKmCharges;
                const totalFuel = records.reduce((sum, r) => sum + r.fuel_cost, 0) || 0;
                const totalFuelLitres = records.reduce((sum, r) => sum + (r.fuel_litres || 0), 0);
                const profit = totalRevenue - totalFuel;
                const ownershipLabel = vehicle.ownership === 'company' ? '🏢 Company' : '🚛 Rented';

                const kmLimit = vehicle.km_limit_per_month || 0;
                const commitmentKmPct = kmLimit > 0 ? Math.min((totalKm / kmLimit) * 100, 100) : null;

                const normalizedNum = extractBaseVehicleName(vehicle.vehicle_number);
                vehiclesWithData.push({
                    type: 'Commitment',
                    number: normalizedNum,
                    model: vehicle.vehicle_model || '-',
                    ownership: ownershipLabel,
                    totalKm,
                    totalRevenue,
                    totalFuel,
                    totalFuelLitres,
                    profit,
                    recordsCount: records.length,
                    kmLimit,
                    commitmentKmPct
                });
            }
        }

        // 3. Process Other Operation Hires and merge with existing data if base name matches
        if (otherOpRecords && otherOpRecords.length > 0) {
            const otherOpGrouped = {};
            otherOpRecords.forEach(r => {
                const base = extractBaseVehicleName(r.base_lorry_number);
                if (!otherOpGrouped[base]) {
                    otherOpGrouped[base] = {
                        totalKm: 0,
                        totalRevenue: 0,
                        totalFuel: 0,
                        totalFuelLitres: 0,
                        recordsCount: 0
                    };
                }
                otherOpGrouped[base].totalKm += r.distance || 0;
                otherOpGrouped[base].totalRevenue += r.hire_amount || 0;
                otherOpGrouped[base].totalFuel += r.fuel_cost || 0;
                otherOpGrouped[base].totalFuelLitres += r.fuel_litres || 0;
                otherOpGrouped[base].recordsCount++;
            });

            for (const [baseName, stats] of Object.entries(otherOpGrouped)) {
                vehiclesWithData.push({
                    type: 'Other Operation',
                    number: baseName,
                    model: '-',
                    ownership: '🏢 Company', // Defaulting to company for other ops
                    totalKm: stats.totalKm,
                    totalRevenue: stats.totalRevenue,
                    totalFuel: stats.totalFuel,
                    totalFuelLitres: stats.totalFuelLitres,
                    profit: stats.totalRevenue - stats.totalFuel,
                    recordsCount: stats.recordsCount,
                    kmLimit: null,
                    commitmentKmPct: null
                });
            }
        }

        // Sort by type (Commitment, then Hire-to-Pay, then Other Operation) and then by profit (highest first)
        const typeOrder = {
            'Commitment': 1,
            'Hire-to-Pay': 2,
            'Other Operation': 3
        };
        vehiclesWithData.sort((a, b) => {
            const orderA = typeOrder[a.type] || 99;
            const orderB = typeOrder[b.type] || 99;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return b.profit - a.profit;
        });

        // Generate HTML with separate sections per vehicle type
        let performanceHtml = '';
        
        if (vehiclesWithData.length === 0) {
            performanceHtml = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3 class="empty-state-text">No Vehicle Activity This Month</h3>
                    <p class="empty-state-subtext">No hires recorded for any vehicle in ${monthValue}.</p>
                </div>
            `;
        } else {
            // Split by groups
            const commitmentVehicles = vehiclesWithData.filter(v => v.type === 'Commitment');
            const hireToPayVehicles = vehiclesWithData.filter(v => v.type === 'Hire-to-Pay');
            const otherOpVehicles = vehiclesWithData.filter(v => v.type === 'Other Operation');

            // 1. Commitment Section
            if (commitmentVehicles.length > 0) {
                const totalKm = commitmentVehicles.reduce((sum, v) => sum + v.totalKm, 0);
                const totalHires = commitmentVehicles.reduce((sum, v) => sum + v.recordsCount, 0);
                const totalRevenue = commitmentVehicles.reduce((sum, v) => sum + v.totalRevenue, 0);
                const totalFuel = commitmentVehicles.reduce((sum, v) => sum + v.totalFuel, 0);
                const totalFuelLitres = commitmentVehicles.reduce((sum, v) => sum + v.totalFuelLitres, 0);
                const totalProfit = commitmentVehicles.reduce((sum, v) => sum + v.profit, 0);

                performanceHtml += `
                    <div class="vehicle-group-section group-commitment">
                        <div class="vehicle-group-header">
                            <div class="vehicle-group-title">🏢 Commitment Operations</div>
                            <span class="vehicle-group-badge">${commitmentVehicles.length} Vehicle(s)</span>
                        </div>
                        <div class="table-responsive">
                            <table class="group-table commitment-table">
                                <thead>
                                    <tr>
                                        <th>Vehicle</th>
                                        <th>Model</th>
                                        <th>Ownership</th>
                                        <th style="text-align: right;">Total KM</th>
                                        <th style="text-align: center;">KM Progress</th>
                                        <th style="text-align: center;">Hires</th>
                                        <th style="text-align: right;">Total Revenue</th>
                                        <th style="text-align: right;">Fuel Cost</th>
                                        <th style="text-align: right;">Fuel Litres</th>
                                        <th style="text-align: right;">Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;

                commitmentVehicles.forEach(vehicle => {
                    const profitColor = vehicle.profit >= 0 ? 'var(--green)' : 'var(--brand-red)';
                    performanceHtml += `
                        <tr>
                            <td style="font-weight: bold;">${vehicle.number}</td>
                            <td>${vehicle.model}</td>
                            <td>${vehicle.ownership}</td>
                            <td style="text-align: right;">${vehicle.totalKm.toFixed(0)} km</td>
                            <td style="min-width:140px;">
                                ${vehicle.commitmentKmPct !== null ? `
                                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;text-align:center;">
                                        ${vehicle.totalKm.toFixed(0)} / ${vehicle.kmLimit} km (${vehicle.commitmentKmPct.toFixed(0)}%)
                                    </div>
                                    <div style="background:var(--surface-border);border-radius:6px;height:10px;overflow:hidden;">
                                        <div style="width:${vehicle.commitmentKmPct}%;height:100%;border-radius:6px;background:${vehicle.commitmentKmPct >= 100 ? '#E74C3C' : vehicle.commitmentKmPct >= 75 ? '#F39C12' : '#27AE60'};transition:width 0.4s;"></div>
                                    </div>
                                ` : '<span style="color:#bdc3c7;font-size:11px;">—</span>'}
                            </td>
                            <td style="text-align: center;">
                                <span style="background: var(--blue-bg); color: var(--blue); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                    ${vehicle.recordsCount}
                                </span>
                            </td>
                            <td style="text-align: right;">LKR ${vehicle.totalRevenue.toFixed(2)}</td>
                            <td style="text-align: right;">LKR ${vehicle.totalFuel.toFixed(2)}</td>
                            <td style="text-align: right;">${vehicle.totalFuelLitres.toFixed(0)} L</td>
                            <td style="text-align: right; color: ${profitColor}; font-weight: bold;">
                                LKR ${vehicle.profit.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });

                performanceHtml += `
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3">Total</td>
                                        <td style="text-align: right;">${totalKm.toFixed(0)} km</td>
                                        <td></td>
                                        <td style="text-align: center;">
                                            <span style="background: var(--blue-bg); color: var(--blue); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                                ${totalHires}
                                            </span>
                                        </td>
                                        <td style="text-align: right;">LKR ${totalRevenue.toFixed(2)}</td>
                                        <td style="text-align: right;">LKR ${totalFuel.toFixed(2)}</td>
                                        <td style="text-align: right;">${totalFuelLitres.toFixed(0)} L</td>
                                        <td style="text-align: right; color: ${totalProfit >= 0 ? 'var(--green)' : 'var(--brand-red)'}; font-weight: bold;">
                                            LKR ${totalProfit.toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                `;
            }

            // 2. Hire-to-Pay Section
            if (hireToPayVehicles.length > 0) {
                const totalKm = hireToPayVehicles.reduce((sum, v) => sum + v.totalKm, 0);
                const totalHires = hireToPayVehicles.reduce((sum, v) => sum + v.recordsCount, 0);
                const totalRevenue = hireToPayVehicles.reduce((sum, v) => sum + v.totalRevenue, 0);
                const totalFuel = hireToPayVehicles.reduce((sum, v) => sum + v.totalFuel, 0);
                const totalFuelLitres = hireToPayVehicles.reduce((sum, v) => sum + v.totalFuelLitres, 0);
                const totalProfit = hireToPayVehicles.reduce((sum, v) => sum + v.profit, 0);

                performanceHtml += `
                    <div class="vehicle-group-section group-hire-to-pay">
                        <div class="vehicle-group-header">
                            <div class="vehicle-group-title">🛣️ Hire-to-Pay Operations</div>
                            <span class="vehicle-group-badge">${hireToPayVehicles.length} Vehicle(s)</span>
                        </div>
                        <div class="table-responsive">
                            <table class="group-table hire-to-pay-table">
                                <thead>
                                    <tr>
                                        <th>Vehicle</th>
                                        <th>Model</th>
                                        <th>Ownership</th>
                                        <th style="text-align: right;">Total KM</th>
                                        <th style="text-align: center;">Hires</th>
                                        <th style="text-align: right;">Total Revenue</th>
                                        <th style="text-align: right;">Fuel Cost</th>
                                        <th style="text-align: right;">Fuel Litres</th>
                                        <th style="text-align: right;">Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;

                hireToPayVehicles.forEach(vehicle => {
                    const profitColor = vehicle.profit >= 0 ? 'var(--green)' : 'var(--brand-red)';
                    performanceHtml += `
                        <tr>
                            <td style="font-weight: bold;">${vehicle.number}</td>
                            <td>${vehicle.model}</td>
                            <td>${vehicle.ownership}</td>
                            <td style="text-align: right;">${vehicle.totalKm.toFixed(0)} km</td>
                            <td style="text-align: center;">
                                <span style="background: var(--amber-bg); color: var(--amber); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                    ${vehicle.recordsCount}
                                </span>
                            </td>
                            <td style="text-align: right;">LKR ${vehicle.totalRevenue.toFixed(2)}</td>
                            <td style="text-align: right;">LKR ${vehicle.totalFuel.toFixed(2)}</td>
                            <td style="text-align: right;">${vehicle.totalFuelLitres.toFixed(0)} L</td>
                            <td style="text-align: right; color: ${profitColor}; font-weight: bold;">
                                LKR ${vehicle.profit.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });

                performanceHtml += `
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3">Total</td>
                                        <td style="text-align: right;">${totalKm.toFixed(0)} km</td>
                                        <td style="text-align: center;">
                                            <span style="background: var(--amber-bg); color: var(--amber); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                                ${totalHires}
                                            </span>
                                        </td>
                                        <td style="text-align: right;">LKR ${totalRevenue.toFixed(2)}</td>
                                        <td style="text-align: right;">LKR ${totalFuel.toFixed(2)}</td>
                                        <td style="text-align: right;">${totalFuelLitres.toFixed(0)} L</td>
                                        <td style="text-align: right; color: ${totalProfit >= 0 ? 'var(--green)' : 'var(--brand-red)'}; font-weight: bold;">
                                            LKR ${totalProfit.toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                `;
            }

            // 3. Other Operations Section
            if (otherOpVehicles.length > 0) {
                const totalKm = otherOpVehicles.reduce((sum, v) => sum + v.totalKm, 0);
                const totalHires = otherOpVehicles.reduce((sum, v) => sum + v.recordsCount, 0);
                const totalRevenue = otherOpVehicles.reduce((sum, v) => sum + v.totalRevenue, 0);
                const totalFuel = otherOpVehicles.reduce((sum, v) => sum + v.totalFuel, 0);
                const totalFuelLitres = otherOpVehicles.reduce((sum, v) => sum + v.totalFuelLitres, 0);
                const totalProfit = otherOpVehicles.reduce((sum, v) => sum + v.profit, 0);

                performanceHtml += `
                    <div class="vehicle-group-section group-other-operations">
                        <div class="vehicle-group-header">
                            <div class="vehicle-group-title">💼 Other Operations</div>
                            <span class="vehicle-group-badge">${otherOpVehicles.length} Vehicle(s)</span>
                        </div>
                        <div class="table-responsive">
                            <table class="group-table other-operations-table">
                                <thead>
                                    <tr>
                                        <th>Vehicle</th>
                                        <th style="text-align: right;">Total KM</th>
                                        <th style="text-align: center;">Hires</th>
                                        <th style="text-align: right;">Total Revenue</th>
                                        <th style="text-align: right;">Fuel Cost</th>
                                        <th style="text-align: right;">Fuel Litres</th>
                                        <th style="text-align: right;">Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;

                otherOpVehicles.forEach(vehicle => {
                    const profitColor = vehicle.profit >= 0 ? 'var(--green)' : 'var(--brand-red)';
                    performanceHtml += `
                        <tr>
                            <td style="font-weight: bold;">${vehicle.number}</td>
                            <td style="text-align: right;">${vehicle.totalKm.toFixed(0)} km</td>
                            <td style="text-align: center;">
                                <span style="background: rgba(123, 53, 196, 0.12); color: var(--purple); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                    ${vehicle.recordsCount}
                                </span>
                            </td>
                            <td style="text-align: right;">LKR ${vehicle.totalRevenue.toFixed(2)}</td>
                            <td style="text-align: right;">LKR ${vehicle.totalFuel.toFixed(2)}</td>
                            <td style="text-align: right;">${vehicle.totalFuelLitres.toFixed(0)} L</td>
                            <td style="text-align: right; color: ${profitColor}; font-weight: bold;">
                                LKR ${vehicle.profit.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });

                performanceHtml += `
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td>Total</td>
                                        <td style="text-align: right;">${totalKm.toFixed(0)} km</td>
                                        <td style="text-align: center;">
                                            <span style="background: rgba(123, 53, 196, 0.12); color: var(--purple); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                                ${totalHires}
                                            </span>
                                        </td>
                                        <td style="text-align: right;">LKR ${totalRevenue.toFixed(2)}</td>
                                        <td style="text-align: right;">LKR ${totalFuel.toFixed(2)}</td>
                                        <td style="text-align: right;">${totalFuelLitres.toFixed(0)} L</td>
                                        <td style="text-align: right; color: ${totalProfit >= 0 ? 'var(--green)' : 'var(--brand-red)'}; font-weight: bold;">
                                            LKR ${totalProfit.toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                `;
            }

            performanceHtml += `
                <div class="text-muted text-center" style="margin-top: 15px; font-size: 12px; text-align: center;">
                    Showing ${vehiclesWithData.length} vehicle(s) with hire activity in ${monthValue}
                </div>
            `;
        }

        const perfEl = document.getElementById('vehiclePerformance');
        if (perfEl) perfEl.innerHTML = performanceHtml;
    } catch (error) {
        console.error('Error loading vehicle performance:', error.message);
        const perfEl = document.getElementById('vehiclePerformance');
        if (perfEl) perfEl.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--brand-red);">
                Error loading vehicle performance data
            </div>
        `;
    }
}

async function updateVehicleSelectors() {
    try {
        const currentQueryUserId = getQueryUserId();
        
        // Filter out terminated vehicles for selectors
        const { data: hireVehicles } = await supabaseClient
            .from('hire_to_pay_vehicles')
            .select('id, lorry_number, terminated')
            .eq('user_id', currentQueryUserId)
            .eq('terminated', false);

        const { data: commitmentVehicles } = await supabaseClient
            .from('commitment_vehicles')
            .select('id, vehicle_number, terminated')
            .eq('user_id', currentQueryUserId)
            .eq('terminated', false);

        const hireSelect = document.getElementById('hireToPayVehicle');
        const commitmentSelect = document.getElementById('commitmentVehicleSelect');
        const dayOffSelect = document.getElementById('dayOffVehicle');

        if (hireSelect) {
            hireSelect.innerHTML = '<option value="">Select Vehicle</option>';
            hireVehicles?.forEach(v => {
                const option = document.createElement('option');
                option.value = v.id;
                option.textContent = v.lorry_number;
                hireSelect.appendChild(option);
            });
        }

        if (commitmentSelect) {
            commitmentSelect.innerHTML = '<option value="">Select Vehicle</option>';
            commitmentVehicles?.forEach(v => {
                const option = document.createElement('option');
                option.value = v.id;
                option.textContent = v.vehicle_number;
                commitmentSelect.appendChild(option);
            });
        }

        if (dayOffSelect) {
            dayOffSelect.innerHTML = '<option value="">Select Vehicle</option>';
            commitmentVehicles?.forEach(v => {
                const option = document.createElement('option');
                option.value = v.id;
                option.textContent = v.vehicle_number;
                dayOffSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error updating vehicle selectors:', error.message);
    }
}

async function loadDashboardCharts() {
    try {
        const currentQueryUserId = getQueryUserId();
        const months = [];
        const revenues = [];
        const profits = [];
        const creditAmounts = [];
        const fuelCosts = [];
        let totalRevenue6M = 0;
        let totalProfit6M = 0;
        let totalCreditAmount6M = 0;
        let totalHires6M = 0;

        // Calculate 6-month date range
        const today = new Date();
        const startMonthDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        const endMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // last day of current month

        const startMonthYear = startMonthDate.getFullYear();
        const startMonthMonth = String(startMonthDate.getMonth() + 1).padStart(2, '0');
        const startDate6M = `${startMonthYear}-${startMonthMonth}-01`;

        const endMonthYear = endMonthDate.getFullYear();
        const endMonthMonth = String(endMonthDate.getMonth() + 1).padStart(2, '0');
        const endMonthDay = String(endMonthDate.getDate()).padStart(2, '0');
        const endDate6M = `${endMonthYear}-${endMonthMonth}-${endMonthDay}`;

        // Selected month breakdown range calculation
        const selMonth = document.getElementById('dashboardMonth')?.value;
        const selMonthStr = selMonth || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
        const [selYear, selMon] = selMonthStr.split('-');
        const selMonPadded = String(selMon).padStart(2, '0');
        const selStart = `${selYear}-${selMonPadded}-01`;
        const selLastDay = new Date(selYear, parseInt(selMon), 0).getDate();
        const selEnd = `${selYear}-${selMonPadded}-${String(selLastDay).padStart(2, '0')}`;

        // Fetch all 6-month datasets, commitment vehicles, and selected month breakdown data concurrently
        const [
            { data: allHireRecords6M },
            { data: allCommitmentRecords6M },
            { data: allDayOffs6M },
            { data: allOtherOpRecords6M },
            { data: allCommitmentVehicles },
            // Selected Month Breakdown data
            { data: bdHireRec },
            { data: bdCommRec },
            { data: bdOtherRec },
            { data: bdDayOffs }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate6M).lte('hire_date', endDate6M),
            supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate6M).lte('hire_date', endDate6M),
            supabaseClient.from('commitment_day_offs').select('*').eq('user_id', currentQueryUserId).gte('day_off_date', startDate6M).lte('day_off_date', endDate6M),
            supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate6M).lte('hire_date', endDate6M),
            supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId),
            // Selected Month Breakdown data
            supabaseClient.from('hire_to_pay_records').select('hire_amount').eq('user_id', currentQueryUserId).gte('hire_date', selStart).lte('hire_date', selEnd),
            supabaseClient.from('commitment_records').select('vehicle_id, distance').eq('user_id', currentQueryUserId).gte('hire_date', selStart).lte('hire_date', selEnd),
            supabaseClient.from('other_operation_hires').select('hire_amount').eq('user_id', currentQueryUserId).gte('hire_date', selStart).lte('hire_date', selEnd),
            supabaseClient.from('commitment_day_offs').select('deduction_amount').eq('user_id', currentQueryUserId).gte('day_off_date', selStart).lte('day_off_date', selEnd)
        ]);

        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setDate(1); // FIX: Set to 1st of month to avoid month skipping
            date.setMonth(date.getMonth() - i);
            const year = date.getFullYear();
            
            // Ensure month is 2 digits for the string
            const monthRaw = date.getMonth() + 1;
            const month = String(monthRaw).padStart(2, '0');
            const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            
            const targetMonthKey = `${year}-${month}`; // YYYY-MM

            // Filter 6-month datasets in-memory
            const hireRecords = allHireRecords6M?.filter(r => r.hire_date?.startsWith(targetMonthKey)) || [];
            const commitmentRecords = allCommitmentRecords6M?.filter(r => r.hire_date?.startsWith(targetMonthKey)) || [];
            const dayOffs = allDayOffs6M?.filter(r => r.day_off_date?.startsWith(targetMonthKey)) || [];
            const otherOpRecords = allOtherOpRecords6M?.filter(r => r.hire_date?.startsWith(targetMonthKey)) || [];

            const commitmentVehicleIds = new Set(commitmentRecords.map(r => r.vehicle_id));
            const commitmentVehicles = allCommitmentVehicles?.filter(v => commitmentVehicleIds.has(v.id)) || [];

            let monthRevenue = 0;
            let monthFuelCost = 0;

            hireRecords?.forEach(record => {
                monthRevenue += record.hire_amount;
                monthFuelCost += record.fuel_cost;
            });

            const commitmentPayment = commitmentVehicles?.reduce((sum, v) => sum + v.fixed_monthly_payment, 0) || 0;
            const dayOffDeductions = dayOffs?.reduce((sum, d) => sum + d.deduction_amount, 0) || 0;
            const commitmentFuelCost = commitmentRecords?.reduce((sum, r) => sum + r.fuel_cost, 0) || 0;
            
            // FIXED: Calculate extra km charges at vehicle+month level
            let extraKmCharges = 0;
            if (commitmentVehicles && commitmentRecords && commitmentVehicles.length > 0 && commitmentRecords.length > 0) {
                const vKmMap = {};
                commitmentRecords.forEach(r => { vKmMap[r.vehicle_id] = (vKmMap[r.vehicle_id] || 0) + (r.distance || 0); });
                commitmentVehicles.forEach(v => {
                    const exc = Math.max(0, (vKmMap[v.id] || 0) - (v.km_limit_per_month || 0));
                    extraKmCharges += exc * (v.extra_km_charge || 0);
                });
            }

            monthRevenue += (commitmentPayment - dayOffDeductions + extraKmCharges);
            monthFuelCost += commitmentFuelCost;

            otherOpRecords?.forEach(record => {
                monthRevenue += (record.hire_amount || 0);
                monthFuelCost += (record.fuel_cost || 0);
            });

            const monthProfit = monthRevenue - monthFuelCost;
            const monthFuelAllowance = monthFuelCost * 0.1600;
            const monthCreditAmount = monthProfit + monthFuelAllowance;

            months.push(monthLabel);
            revenues.push(monthRevenue);
            profits.push(monthProfit);
            creditAmounts.push(monthCreditAmount);
            fuelCosts.push(monthFuelCost);
            totalRevenue6M += monthRevenue;
            totalProfit6M += monthProfit;
            totalCreditAmount6M += monthCreditAmount;
            totalHires6M += (hireRecords?.length || 0) + (commitmentRecords?.length || 0) + (otherOpRecords?.length || 0);
        }

        const avgRevenue = totalRevenue6M / 6;
        const avgProfit = totalProfit6M / 6;
        const avgCreditAmount = totalCreditAmount6M / 6;
        const profitMargin = totalRevenue6M > 0 ? ((totalProfit6M / totalRevenue6M) * 100) : 0;

        document.getElementById('avgRevenue').textContent = `LKR ${avgRevenue.toFixed(2)}`;
        document.getElementById('avgProfit').textContent = `LKR ${avgCreditAmount.toFixed(2)}`;
        document.getElementById('profitMargin').textContent = `${profitMargin.toFixed(1)}%`;
        document.getElementById('sixMonthHires').textContent = totalHires6M;

        if (revenueChart) revenueChart.destroy();
        if (profitChart) profitChart.destroy();
        if (fuelCostChart) fuelCostChart.destroy();
        if (revenueBreakdownChart) revenueBreakdownChart.destroy();
        if (vehicleRevenueChart) vehicleRevenueChart.destroy();

        const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
        if (revenueCtx) {
            revenueChart = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Monthly Revenue',
                        data: revenues,
                        borderColor: '#DC143C',
                        backgroundColor: 'rgba(220, 14, 60, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#DC143C',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top' }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => `LKR ${(v/1000).toFixed(0)}K` }
                        }
                    }
                }
            });
        }

        const profitCtx = document.getElementById('profitChart')?.getContext('2d');
        if (profitCtx) {
            profitChart = new Chart(profitCtx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Monthly Total Credit Amount',
                        data: creditAmounts,
                        borderColor: '#27AE60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#27AE60',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: ctx => `LKR ${Math.round(ctx.parsed.y).toLocaleString()}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => `LKR ${(v/1000).toFixed(0)}K` }
                        }
                    }
                }
            });
        }

        const fuelCtx = document.getElementById('fuelCostChart')?.getContext('2d');
        if (fuelCtx) {
            fuelCostChart = new Chart(fuelCtx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Fuel Cost',
                        data: fuelCosts,
                        backgroundColor: 'rgba(230, 126, 34, 0.7)',
                        borderColor: '#E67E22',
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top' }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => `LKR ${(v/1000).toFixed(0)}K` }
                        }
                    }
                }
            });
        }

        const breakdownCtx = document.getElementById('revenueBreakdownChart')?.getContext('2d');
        if (breakdownCtx) {
            // Filter commitment vehicles in-memory
            const bdCommVehicleIds = [...new Set((bdCommRec || []).map(r => r.vehicle_id).filter(Boolean))];
            const bdCommVehicles = allCommitmentVehicles?.filter(v => bdCommVehicleIds.includes(v.id)) || [];

            // Hire-to-Pay revenue
            const bdHireRev = (bdHireRec || []).reduce((s, r) => s + (r.hire_amount || 0), 0);

            // Commitment revenue = fixed_monthly_payment - day_off_deductions + extra_km_charges
            const bdCommFixed = bdCommVehicles.reduce((s, v) => s + (v.fixed_monthly_payment || 0), 0);
            const bdDayOffDed = (bdDayOffs || []).reduce((s, d) => s + (d.deduction_amount || 0), 0);
            let bdExtraKm = 0;
            if (bdCommVehicles.length > 0 && bdCommRec && bdCommRec.length > 0) {
                const vKmMap = {};
                bdCommRec.forEach(r => { vKmMap[r.vehicle_id] = (vKmMap[r.vehicle_id] || 0) + (r.distance || 0); });
                bdCommVehicles.forEach(v => {
                    const exc = Math.max(0, (vKmMap[v.id] || 0) - (v.km_limit_per_month || 0));
                    bdExtraKm += exc * (v.extra_km_charge || 0);
                });
            }
            const bdCommRev = Math.max(0, bdCommFixed - bdDayOffDed) + bdExtraKm;

            // Other Operation revenue
            const bdOtherRev = (bdOtherRec || []).reduce((s, r) => s + (r.hire_amount || 0), 0);

            const totalBreakdown = bdHireRev + bdCommRev + bdOtherRev;

            if (revenueBreakdownChart) revenueBreakdownChart.destroy();
            revenueBreakdownChart = new Chart(breakdownCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Hire-to-Pay', 'Commitment', 'Other Operation'],
                    datasets: [{
                        data: [bdHireRev, bdCommRev, bdOtherRev],
                        backgroundColor: ['#0072CE', '#00B37E', '#E67E22'],
                        borderColor: ['#fff', '#fff', '#fff'],
                        borderWidth: 2,
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `Revenue Breakdown — ${selMonthStr}`,
                            font: { size: 13, weight: 'bold' }
                        },
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: function(ctx) {
                                    const pct = totalBreakdown > 0 ? ((ctx.parsed / totalBreakdown) * 100).toFixed(1) : 0;
                                    return `${ctx.label}: LKR ${ctx.parsed.toLocaleString()} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        if (typeof loadVehicleRevenueChart === 'function') {
            await loadVehicleRevenueChart(document.getElementById('dashboardMonth')?.value);
        }
    } catch (error) {
        console.error('Error loading charts:', error.message);
    }
}

// ============ ALL-TIME STATISTICS ============
async function loadAllTimeStatistics() {
    try {
        const currentQueryUserId = getQueryUserId();
        
        const [
            { data: allHireRecords },
            { data: allCommitmentRecords },
            { data: allCommitmentVehicles },
            { data: allDayOffs },
            { data: allOtherOpRecords }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_day_offs').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId)
        ]);

        let totalRevenue = 0;
        let totalFuelCost = 0;
        let totalHires = 0;

        // Calculate from hire records
        allHireRecords?.forEach(record => {
            totalRevenue += record.hire_amount || 0;
            totalFuelCost += record.fuel_cost || 0;
            totalHires++;
        });

        // Calculate months for commitment vehicles
        const commitmentMonths = new Set();
        allCommitmentRecords?.forEach(record => {
            const month = record.hire_date.substring(0, 7);
            commitmentMonths.add(`${record.vehicle_id}-${month}`);
            totalFuelCost += record.fuel_cost || 0;
            totalHires++;
        });

        // Calculate commitment payments
        const vehicleMonths = {};
        allCommitmentRecords?.forEach(record => {
            const vehicleId = record.vehicle_id;
            const month = record.hire_date.substring(0, 7);
            const key = `${vehicleId}-${month}`;
            if (!vehicleMonths[key]) {
                vehicleMonths[key] = { vehicleId, month };
            }
        });

        for (const key in vehicleMonths) {
            const { vehicleId, month } = vehicleMonths[key];
            const vehicle = allCommitmentVehicles?.find(v => v.id === vehicleId);
            if (vehicle) {
                totalRevenue += vehicle.fixed_monthly_payment;
            }
        }

        // Subtract day off deductions
        const dayOffDeductions = allDayOffs?.reduce((sum, d) => sum + (d.deduction_amount || 0), 0) || 0;
        totalRevenue -= dayOffDeductions;

        // FIXED: Calculate extra km charges at vehicle+month level (not summing per-hire stored values)
        const vehicleMonthKmMap = {};
        allCommitmentRecords?.forEach(r => {
            const key = r.vehicle_id + '-' + r.hire_date.substring(0, 7);
            vehicleMonthKmMap[key] = (vehicleMonthKmMap[key] || 0) + (r.distance || 0);
        });
        let extraKmCharges = 0;
        for (const key in vehicleMonthKmMap) {
            const vehicleId = parseInt(key.split('-')[0]);
            const vehicle = allCommitmentVehicles?.find(v => v.id === vehicleId);
            if (vehicle) {
                const exc = Math.max(0, vehicleMonthKmMap[key] - (vehicle.km_limit_per_month || 0));
                extraKmCharges += exc * (vehicle.extra_km_charge || 0);
            }
        }
        totalRevenue += extraKmCharges;

        // Calculate from other operation hires
        allOtherOpRecords?.forEach(record => {
            totalRevenue += record.hire_amount || 0;
            totalFuelCost += record.fuel_cost || 0;
            totalHires++;
        });

        const totalProfit = totalRevenue - totalFuelCost;

        document.getElementById('allTimeRevenue').textContent = `LKR ${totalRevenue.toFixed(2)}`;
        document.getElementById('allTimeProfit').textContent = `LKR ${totalProfit.toFixed(2)}`;
        document.getElementById('allTimeFuelCost').textContent = `LKR ${totalFuelCost.toFixed(2)}`;
        document.getElementById('allTimeHires').textContent = totalHires;
    } catch (error) {
        console.error('Error loading all-time statistics:', error.message);
    }
}

// ============ FLEET OVERVIEW ============
async function loadFleetOverview() {
    try {
        const currentQueryUserId = getQueryUserId();

        const [
            { data: hireVehicles },
            { data: commitmentVehicles },
            { data: drivers }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, terminated').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number, terminated').eq('user_id', currentQueryUserId),
            supabaseClient.from('drivers').select('id, terminated').eq('user_id', currentQueryUserId)
        ]);

        const baseNames = new Set();
        if (hireVehicles) {
            hireVehicles.forEach(v => {
                if (!v.terminated && v.lorry_number) {
                    baseNames.add(extractBaseVehicleName(v.lorry_number));
                }
            });
        }
        if (commitmentVehicles) {
            commitmentVehicles.forEach(v => {
                if (!v.terminated && v.vehicle_number) {
                    baseNames.add(extractBaseVehicleName(v.vehicle_number));
                }
            });
        }

        const activeDrivers = drivers ? drivers.filter(d => !d.terminated).length : 0;

        document.getElementById('totalVehicles').textContent = baseNames.size;
        document.getElementById('totalDrivers').textContent = activeDrivers;
    } catch (error) {
        console.error('Error loading fleet overview:', error.message);
    }
}

// ============ TOP PERFORMING VEHICLES (ENHANCED & DARK MODE FIXED) ============
async function loadTopPerformingVehicles() {
    try {
        const currentQueryUserId = getQueryUserId();
        
        // 3. Fetch Basic Vehicle Data and all records concurrently
        const [
            { data: hireVehicles },
            { data: commitmentVehicles },
            { data: allHireRecords },
            { data: allCommitmentRecords },
            { data: otherOpRecords }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId)
        ]);

        const mergedMap = {};

        // Group hire records by vehicle_id
        const hireRecordsByVehicle = {};
        allHireRecords?.forEach(r => {
            if (!hireRecordsByVehicle[r.vehicle_id]) {
                hireRecordsByVehicle[r.vehicle_id] = [];
            }
            hireRecordsByVehicle[r.vehicle_id].push(r);
        });

        // Group commitment records by vehicle_id
        const commitmentRecordsByVehicle = {};
        allCommitmentRecords?.forEach(r => {
            if (!commitmentRecordsByVehicle[r.vehicle_id]) {
                commitmentRecordsByVehicle[r.vehicle_id] = [];
            }
            commitmentRecordsByVehicle[r.vehicle_id].push(r);
        });

        // 4. Process Hire Vehicles (In-memory)
        for (const vehicle of hireVehicles || []) {
            const allRecords = hireRecordsByVehicle[vehicle.id] || [];
            if (allRecords.length === 0) continue;

            // --- All-Time Metrics ---
            const allTimeDist = allRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
            const allTimeFuel = allRecords.reduce((sum, r) => sum + (r.fuel_litres || 0), 0);
            const allTimeHires = allRecords.length;

            // --- Metrics (All-Time) ---
            const recentRecords = allRecords;
            
            const rev6m = recentRecords.reduce((sum, r) => sum + (r.hire_amount || 0), 0);
            const fuelCost6m = recentRecords.reduce((sum, r) => sum + (r.fuel_cost || 0), 0);
            const profit6m = rev6m - fuelCost6m;
            const km6m = recentRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
            const hires6m = recentRecords.length;

            if (rev6m > 0) {
                const baseName = extractBaseVehicleName(vehicle.lorry_number);
                if (!mergedMap[baseName]) {
                    mergedMap[baseName] = {
                        name: baseName, type: 'Hire-to-Pay', revenue: 0, profit: 0, km: 0, hires: 0,
                        allTimeKm: 0, allTimeHiresTotal: 0, allTimeDist: 0, allTimeFuel: 0, vectorArt: vehicle.vector_art_url
                    };
                }
                mergedMap[baseName].revenue += rev6m;
                mergedMap[baseName].profit += profit6m;
                mergedMap[baseName].km += km6m;
                mergedMap[baseName].hires += hires6m;
                mergedMap[baseName].allTimeKm += allTimeDist;
                mergedMap[baseName].allTimeHiresTotal += allTimeHires;
                mergedMap[baseName].allTimeDist += allTimeDist;
                mergedMap[baseName].allTimeFuel += allTimeFuel;
                if (!mergedMap[baseName].vectorArt) mergedMap[baseName].vectorArt = vehicle.vector_art_url;
            }
        }

        // 5. Process Commitment Vehicles (In-memory)
        for (const vehicle of commitmentVehicles || []) {
            const allRecords = commitmentRecordsByVehicle[vehicle.id] || [];
            if (allRecords.length === 0) continue;

            const allTimeDist = allRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
            const allTimeFuel = allRecords.reduce((sum, r) => sum + (r.fuel_litres || 0), 0);
            const allTimeHires = allRecords.length;

            const recentRecords = allRecords;

            const uniqueMonths = new Set(recentRecords.map(r => r.hire_date.substring(0, 7)));
            const baseRevenue = vehicle.fixed_monthly_payment * uniqueMonths.size;
            // FIXED: Calculate extra km charges at vehicle+month level per month
            let extraCharges = 0;
            uniqueMonths.forEach(mon => {
                const monthRecords = recentRecords.filter(r => r.hire_date.substring(0, 7) === mon);
                const monthKm = monthRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
                const exc = Math.max(0, monthKm - (vehicle.km_limit_per_month || 0));
                extraCharges += exc * (vehicle.extra_km_charge || 0);
            });

            const rev6m = baseRevenue + extraCharges;
            const fuelCost6m = recentRecords.reduce((sum, r) => sum + (r.fuel_cost || 0), 0);
            const profit6m = rev6m - fuelCost6m;
            const km6m = recentRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
            const hires6m = recentRecords.length;

            if (rev6m > 0) {
                const baseName = extractBaseVehicleName(vehicle.vehicle_number);
                if (!mergedMap[baseName]) {
                    mergedMap[baseName] = {
                        name: baseName, type: 'Commitment', revenue: 0, profit: 0, km: 0, hires: 0,
                        allTimeKm: 0, allTimeHiresTotal: 0, allTimeDist: 0, allTimeFuel: 0, vectorArt: vehicle.vector_art_url
                    };
                } else {
                    if (mergedMap[baseName].type !== 'Commitment') {
                        mergedMap[baseName].type = 'Mixed';
                    }
                }
                mergedMap[baseName].revenue += rev6m;
                mergedMap[baseName].profit += profit6m;
                mergedMap[baseName].km += km6m;
                mergedMap[baseName].hires += hires6m;
                mergedMap[baseName].allTimeKm += allTimeDist;
                mergedMap[baseName].allTimeHiresTotal += allTimeHires;
                mergedMap[baseName].allTimeDist += allTimeDist;
                mergedMap[baseName].allTimeFuel += allTimeFuel;
                if (!mergedMap[baseName].vectorArt) mergedMap[baseName].vectorArt = vehicle.vector_art_url;
            }
        }

        // 6. Process Other Operation Hires
        otherOpRecords?.forEach(r => {
            const baseName = extractBaseVehicleName(r.base_lorry_number);
            if (!mergedMap[baseName]) {
                mergedMap[baseName] = {
                    name: baseName, type: 'Other Operation', revenue: 0, profit: 0, km: 0, hires: 0,
                    allTimeKm: 0, allTimeHiresTotal: 0, allTimeDist: 0, allTimeFuel: 0, vectorArt: null
                };
            } else if (mergedMap[baseName].type !== 'Other Operation' && mergedMap[baseName].type !== 'Mixed') {
                 mergedMap[baseName].type = 'Mixed';
            }
            
            const revenue = r.hire_amount || 0;
            const fuelCost = r.fuel_cost || 0;
            const distance = r.distance || 0;
            const fuelLitres = r.fuel_litres || 0;
            const profit = revenue - fuelCost;

            mergedMap[baseName].revenue += revenue;
            mergedMap[baseName].profit += profit;
            mergedMap[baseName].km += distance;
            mergedMap[baseName].hires += 1;
            mergedMap[baseName].allTimeKm += distance;
            mergedMap[baseName].allTimeHiresTotal += 1;
            mergedMap[baseName].allTimeDist += distance;
            mergedMap[baseName].allTimeFuel += fuelLitres;
        });

        const vehiclePerformance = Object.values(mergedMap).map(v => {
            return {
                ...v,
                profitMargin: v.revenue > 0 ? (v.profit / v.revenue * 100) : 0,
                allTimeEfficiency: v.allTimeFuel > 0 ? (v.allTimeDist / v.allTimeFuel) : 0
            };
        });

        // 6. Sort and Slice
        vehiclePerformance.sort((a, b) => b.profit - a.profit);
        const topVehicles = vehiclePerformance.slice(0, 5); // Top 5

        // 7. Render "Great Vehicle Cards"
        const container = document.getElementById('topVehicles');
        if (!container) return;

        if (topVehicles.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: var(--pure-white, white); border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="font-size: 50px; margin-bottom: 15px; opacity: 0.5;">📉</div>
                    <h3 style="color: var(--text-dark, #333); margin-bottom: 10px;">No Data Available</h3>
                    <p style="color: #95a5a6;">Add hire records to generate performance insights.</p>
                </div>
            `;
            // Add dark mode style for empty state manually here as fallback
            if (document.body.classList.contains('dark-mode')) {
                const emptyCard = container.querySelector('div');
                emptyCard.style.background = 'var(--dark-bg-card, #1a1a1a)';
                emptyCard.querySelector('h3').style.color = 'var(--dark-text-primary, #f8f9fa)';
            }
            return;
        }

        container.innerHTML = topVehicles.map((vehicle, index) => {
            const rankEmoji = `#${index + 1}`;
            
            const iconHtml = vehicle.vectorArt 
                ? `<img src="${vehicle.vectorArt}" alt="Vehicle Art">`
                : (vehicle.type === 'Hire-to-Pay' ? '🚚' : '🚛');

            const profitClass = vehicle.profit >= 0 ? 'highlight' : 'danger';

            return `
                <div class="premium-vehicle-card">
                    <div class="rank-badge-overlay">${rankEmoji}</div>
                    
                    <div class="card-header-section">
                        <div class="vehicle-icon-large">
                            ${iconHtml}
                        </div>
                        <div class="vehicle-info-block">
                            <h4>${vehicle.name}</h4>
                            <span class="vehicle-type-pill">${vehicle.type}</span>
                        </div>
                    </div>

                    <div class="card-body-section">
                        <span class="section-title">ALL-TIME PERFORMANCE</span>
                        
                        <div class="premium-metric-row">
                            <span class="metric-label">Revenue</span>
                            <span class="metric-value">LKR ${vehicle.revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div class="premium-metric-row">
                            <span class="metric-label">Profit</span>
                            <span class="metric-value ${profitClass}">LKR ${vehicle.profit.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div class="premium-metric-row">
                            <span class="metric-label">Margin</span>
                            <span class="metric-value">${vehicle.profitMargin.toFixed(0)}%</span>
                        </div>
                        <div class="premium-metric-row">
                            <span class="metric-label">Total KM</span>
                            <span class="metric-value">${vehicle.km.toLocaleString(undefined, {maximumFractionDigits: 0})} km</span>
                        </div>
                        <div class="premium-metric-row">
                            <span class="metric-label">Total Hires</span>
                            <span class="metric-value">${vehicle.hires}</span>
                        </div>

                        <div class="efficiency-section">
                            <div class="efficiency-label">
                                <span>⛽ Fuel Efficiency</span>
                            </div>
                            <div class="efficiency-value">
                                ${vehicle.allTimeEfficiency.toFixed(2)} <span style="font-size: 0.8em; font-weight: normal; color: #7f8c8d;">Km/L</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading top performing vehicles:', error.message);
    }
}

// ============ DRIVER ADVANCES WITH RECEIPT UPLOAD ============

let currentReceiptFile = null;
let existingReceiptUrl = null;

document.getElementById('addAdvanceBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('advanceForm').reset();
    document.getElementById('advanceId').value = '';
    currentReceiptFile = null;
    existingReceiptUrl = null;
    document.getElementById('currentReceipt').style.display = 'none';
    document.getElementById('uploadProgress').style.display = 'none';
    document.getElementById('advanceFormContainer').style.display = 'block';
});

document.getElementById('cancelAdvanceBtn')?.addEventListener('click', () => {
    document.getElementById('advanceFormContainer').style.display = 'none';
    currentReceiptFile = null;
    existingReceiptUrl = null;
});

document.getElementById('advanceMonth')?.addEventListener('change', loadDriverAdvances);
document.getElementById('advanceDriverFilter')?.addEventListener('change', loadDriverAdvances);

// Handle file selection
document.getElementById('advanceReceipt')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file only');
            e.target.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            e.target.value = '';
            return;
        }
        currentReceiptFile = file;
        console.log('Receipt file selected:', file.name);
    }
});

// Remove existing receipt
document.getElementById('removeReceiptBtn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to remove this receipt?')) {
        existingReceiptUrl = null;
        document.getElementById('currentReceipt').style.display = 'none';
        document.getElementById('advanceReceipt').value = '';
        currentReceiptFile = null;
    }
});

// Upload receipt to Supabase Storage
async function uploadReceipt(file, advanceId) {
    if (!file) return null;
    
    try {
        const progressDiv = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('uploadProgressBar');
        const progressText = document.getElementById('uploadProgressText');
        
        progressDiv.style.display = 'block';
        progressBar.style.width = '30%';
        progressText.textContent = 'Uploading receipt...';
        
        const timestamp = Date.now();
        const filename = `${adminUserId}/${advanceId}_${timestamp}_${file.name}`;
        
        progressBar.style.width = '60%';
        
        const { data, error } = await supabaseClient.storage
            .from('advance-receipts')
            .upload(filename, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;
        
        progressBar.style.width = '90%';
        
        const { data: urlData } = supabaseClient.storage
            .from('advance-receipts')
            .getPublicUrl(filename);
        
        progressBar.style.width = '100%';
        progressText.textContent = 'Upload complete!';
        
        setTimeout(() => {
            progressDiv.style.display = 'none';
            progressBar.style.width = '0%';
        }, 1000);
        
        return urlData.publicUrl;
    } catch (error) {
        console.error('Error uploading receipt:', error);
        document.getElementById('uploadProgress').style.display = 'none';
        alert('Failed to upload receipt: ' + error.message);
        return null;
    }
}

// Delete receipt from storage
async function deleteReceipt(receiptUrl) {
    if (!receiptUrl) return;
    
    try {
        const urlParts = receiptUrl.split('/');
        const bucketIndex = urlParts.findIndex(part => part === 'advance-receipts');
        if (bucketIndex === -1) return;
        
        const filename = urlParts.slice(bucketIndex + 1).join('/');
        
        await supabaseClient.storage
            .from('advance-receipts')
            .remove([filename]);
    } catch (error) {
        console.error('Error deleting receipt:', error);
    }
}

document.getElementById('advanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('advanceId').value;
    const driverId = parseInt(document.getElementById('advanceDriver').value);
    const advanceDate = document.getElementById('advanceDate').value;
    const amount = parseFloat(document.getElementById('advanceAmount').value);
    const notes = document.getElementById('advanceNotes').value || null;

    try {
        let receiptUrl = existingReceiptUrl;
        
        // If editing and removing old receipt, delete it
        if (id && existingReceiptUrl && !currentReceiptFile) {
            await deleteReceipt(existingReceiptUrl);
            receiptUrl = null;
        }
        
        let savedAdvanceId = id;
        
        const advanceData = {
            driver_id: driverId,
            advance_date: advanceDate,
            amount: amount,
            notes: notes,
            user_id: adminUserId
        };

        if (id) {
            await supabaseClient.from('driver_advances').update(advanceData).eq('id', id);
        } else {
            const { data: newAdvance, error: insertError } = await supabaseClient
                .from('driver_advances')
                .insert([advanceData])
                .select()
                .single();
            
            if (insertError) throw insertError;
            savedAdvanceId = newAdvance.id;
        }
        
        if (currentReceiptFile) {
            if (existingReceiptUrl) {
                await deleteReceipt(existingReceiptUrl);
            }
            
            receiptUrl = await uploadReceipt(currentReceiptFile, savedAdvanceId);
            
            if (receiptUrl) {
                await supabaseClient
                    .from('driver_advances')
                    .update({ receipt_url: receiptUrl })
                    .eq('id', savedAdvanceId);
            }
        }
        
        loadDriverAdvances();
        document.getElementById('advanceFormContainer').style.display = 'none';
        currentReceiptFile = null;
        existingReceiptUrl = null;
    } catch (error) {
        console.error('Error saving advance:', error);
        alert('Error saving advance: ' + error.message);
    }
});

async function loadDriverAdvances() {
    try {
        const monthValue = document.getElementById('advanceMonth')?.value;
        const driverFilter = document.getElementById('advanceDriverFilter')?.value;
        
        await loadAdvanceSummary();
        
        let query = supabaseClient
            .from('driver_advances')
            .select('*, drivers(name)')
            .eq('user_id', getQueryUserId());
        
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            // FIXED:
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            query = query.gte('advance_date', startDate).lte('advance_date', endDate);
        }

        if (driverFilter) {
            query = query.eq('driver_id', driverFilter);
        }

        const { data, error } = await query.order('advance_date', { ascending: false });
        if (error) throw error;

        const tbody = document.querySelector('#advancesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        data.forEach(advance => {
            const row = document.createElement('tr');
            
            const receiptColumn = advance.receipt_url ? 
                `<a href="${advance.receipt_url}" target="_blank" class="receipt-link" title="View Receipt">
                    📄 View PDF
                </a>` : 
                '<span style="color: #95A5A6;">No receipt</span>';
            
            const actionButtons = userRole === 'viewer' ? '' : `
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editAdvance(${advance.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteAdvance(${advance.id})">Delete</button>
                </td>
            `;

            row.innerHTML = `
                <td>${advance.drivers.name}</td>
                <td>${advance.advance_date}</td>
                <td>LKR ${advance.amount.toFixed(2)}</td>
                <td>${advance.notes || '-'}</td>
                <td>${receiptColumn}</td>
                ${actionButtons}
            `;
            tbody.appendChild(row);
        });

        await updateAdvanceDriverSelectors();
        if (typeof loadNotifications === 'function') loadNotifications();
    } catch (error) {
        console.error('Error loading advances:', error.message);
    }
}

async function loadAdvanceSummary() {
    try {
        const currentQueryUserId = getQueryUserId();
        
        // 1. Get current filter values
        const monthValue = document.getElementById('advanceMonth')?.value;
        const driverFilter = document.getElementById('advanceDriverFilter')?.value;

        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id, name')
            .eq('user_id', currentQueryUserId);

        // 2. Start the query for advances — now fetch full records including date and notes
        let query = supabaseClient
            .from('driver_advances')
            .select('driver_id, amount, advance_date, notes')
            .eq('user_id', currentQueryUserId)
            .order('advance_date', { ascending: true });

        // 3. Apply Date Filter if a month is selected
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            
            query = query.gte('advance_date', startDate).lte('advance_date', endDate);
        }

        // 4. Apply Driver Filter if selected (keeps numbers consistent with the table)
        if (driverFilter) {
            query = query.eq('driver_id', driverFilter);
        }

        const { data: advances } = await query;

        // Group advances by driver — store total AND individual records
        const advancesByDriver = {};
        advances?.forEach(adv => {
            if (!advancesByDriver[adv.driver_id]) {
                advancesByDriver[adv.driver_id] = { total: 0, records: [] };
            }
            advancesByDriver[adv.driver_id].total += adv.amount;
            advancesByDriver[adv.driver_id].records.push({
                date: adv.advance_date,
                amount: adv.amount,
                notes: adv.notes || ''
            });
        });

        const summaryEl = document.getElementById('advanceSummary');
        if (!summaryEl) return;
        summaryEl.innerHTML = '';

        // Determine display month label (e.g. "May 2025")
        let monthLabel = 'All Time';
        if (monthValue) {
            const [yr, mo] = monthValue.split('-');
            monthLabel = new Date(yr, mo - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        }

        // ── TOP MONTHLY TOTAL ADVANCES WIDGET ──
        const grandTotal = advances ? advances.reduce((s, a) => s + (a.amount || 0), 0) : 0;
        const advCount = advances ? advances.length : 0;
        const driverNameMap = {};
        drivers?.forEach(d => { driverNameMap[d.id] = d.name; });
        const topRanked = Object.entries(advancesByDriver)
            .map(([dId, d]) => ({ name: driverNameMap[dId] || 'Staff', total: d.total }))
            .sort((a, b) => b.total - a.total).slice(0, 3);
        const medals = ['🥇', '🥈', '🥉'];
        const topHtml = topRanked.length > 0 ? `
            <div style="display:flex;flex-direction:column;gap:5px;min-width:160px;">
                <div style="font-size:11px;opacity:.75;text-transform:uppercase;letter-spacing:1px;font-weight:700;">🏆 Highest This Period</div>
                ${topRanked.map((s,i) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;background:rgba(255,255,255,0.13);border-radius:8px;padding:5px 10px;">
                    <span>${medals[i]} ${s.name}</span>
                    <span style="font-weight:800;font-family:'Barlow Condensed',sans-serif;font-size:14px;">LKR ${s.total.toLocaleString('en-LK',{minimumFractionDigits:2})}</span>
                </div>`).join('')}
            </div>` : '';
        const topWidget = document.createElement('div');
        topWidget.style.cssText = 'grid-column:1/-1;margin-bottom:4px;';
        topWidget.innerHTML = `<div class="summary-banner" style="background:linear-gradient(135deg,#D1001F 0%,#8B0012 100%);border-radius:14px;padding:20px 26px;display:flex;align-items:center;gap:22px;box-shadow:0 6px 24px rgba(209,0,31,.30);color:#fff;flex-wrap:wrap;">
            <div style="font-size:44px;flex-shrink:0;">💳</div>
            <div style="flex:1;min-width:180px;">
                <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.80;margin-bottom:3px;">Total Staff Advances — ${monthLabel}</div>
                <div style="font-family:'Barlow Condensed',sans-serif;font-size:38px;font-weight:900;letter-spacing:-.5px;line-height:1.05;">LKR ${grandTotal.toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                <div style="font-size:12px;opacity:.75;margin-top:5px;">${advCount} advance transaction${advCount!==1?'s':''} recorded</div>
            </div>
            ${topHtml}
        </div>`;
        summaryEl.appendChild(topWidget);

        if (Object.keys(advancesByDriver).length > 0) {
            // Only render cards for drivers who have at least one advance in the period
            const driversWithAdvances = Object.entries(advancesByDriver)
                .map(([dId, dData]) => ({
                    id: dId,
                    name: driverNameMap[dId] || 'Staff',
                    ...dData
                }))
                .sort((a, b) => b.total - a.total);

            driversWithAdvances.forEach(driver => {
                const smsMessage = buildAdvanceSmsMessage(driver.name, monthLabel, driver.records);

                const card = document.createElement('div');
                card.className = 'advance-card';
                card.innerHTML = `
                    <div class="advance-card-icon">💰</div>
                    <div class="advance-card-content">
                        <div class="advance-card-name">${driver.name}</div>
                        <div class="advance-card-amount">LKR ${driver.total.toFixed(2)}</div>
                        <div class="advance-card-label">Total Advances (${monthLabel})</div>
                    </div>
                    <button class="btn-copy-sms" title="Copy SMS message to clipboard">
                        📋 Copy SMS
                    </button>
                `;
                card.querySelector('.btn-copy-sms').addEventListener('click', function() {
                    copyAdvanceSms(this, smsMessage);
                });
                summaryEl.appendChild(card);
            });
        } else {
            summaryEl.innerHTML += '<p style="text-align:center;color:#7F8C8D;padding:20px;width:100%;">No advances recorded for this period.</p>';
        }
    } catch (error) {
        console.error('Error loading advance summary:', error.message);
    }
}

// Build the SMS message template for a driver's advances
function buildAdvanceSmsMessage(driverName, monthLabel, records) {
    if (records.length === 0) {
        return `Jayasooriya Transport\nDear ${driverName},\n\nYou have no recorded advances for ${monthLabel}.\n\nThank you.`;
    }

    let lines = records.map((rec, i) => {
        const formattedDate = rec.date; // already YYYY-MM-DD
        const noteStr = rec.notes ? ` (${rec.notes})` : '';
        return `${i + 1}. ${formattedDate} - LKR ${rec.amount.toFixed(2)}${noteStr}`;
    });

    const total = records.reduce((sum, r) => sum + r.amount, 0);

    return `Jayasooriya Transport\nDear ${driverName},\n\nAdvance summary for ${monthLabel}:\n\n${lines.join('\n')}\n\nTotal: LKR ${total.toFixed(2)}\n\nThank you.`;
}

// Copy the SMS message to clipboard and show feedback on the button
function copyAdvanceSms(btn, message) {
    // Try modern Clipboard API first (works on https:// and localhost)
    if (navigator.clipboard && navigator.clipboard.writeText && location.protocol !== 'file:') {
        navigator.clipboard.writeText(message).then(() => {
            showCopySmsSuccess(btn);
        }).catch(() => {
            fallbackCopyText(message, btn);
        });
    } else {
        // Fallback: works on file://, http://, and older browsers
        fallbackCopyText(message, btn);
    }
}

function fallbackCopyText(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    // Also try setSelectionRange for mobile
    try { ta.setSelectionRange(0, 99999); } catch(e) {}
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (e) {
        success = false;
    }
    document.body.removeChild(ta);
    if (success) {
        showCopySmsSuccess(btn);
    } else {
        alert('Could not copy automatically. Please copy the message below:\n\n' + text);
    }
}

function showCopySmsSuccess(btn) {
    const original = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    btn.classList.add('btn-copy-sms-success');
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('btn-copy-sms-success');
        btn.disabled = false;
    }, 2000);
}

async function updateAdvanceDriverSelectors() {
    try {
        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id, name')
            .eq('user_id', getQueryUserId())
            .neq('terminated', true);

        const advanceDriverSelect = document.getElementById('advanceDriver');
        const filterSelect = document.getElementById('advanceDriverFilter');

        if (advanceDriverSelect) {
            advanceDriverSelect.innerHTML = '<option value="">Select Staff</option>';
            drivers?.forEach(d => {
                const option = document.createElement('option');
                option.value = d.id;
                option.textContent = d.name;
                advanceDriverSelect.appendChild(option);
            });
        }

        if (filterSelect) {
            const currentValue = filterSelect.value;
            filterSelect.innerHTML = '<option value="">All Staff</option>';
            drivers?.forEach(d => {
                const option = document.createElement('option');
                option.value = d.id;
                option.textContent = d.name;
                filterSelect.appendChild(option);
            });
            filterSelect.value = currentValue;
        }
    } catch (error) {
        console.error('Error updating driver selectors:', error.message);
    }
}

async function editAdvance(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient.from('driver_advances').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('advanceId').value = data.id;
        document.getElementById('advanceDriver').value = data.driver_id;
        document.getElementById('advanceDate').value = data.advance_date;
        document.getElementById('advanceAmount').value = data.amount;
        document.getElementById('advanceNotes').value = data.notes || '';
        
        existingReceiptUrl = data.receipt_url;
        currentReceiptFile = null;
        
        if (data.receipt_url) {
            document.getElementById('currentReceipt').style.display = 'block';
            document.getElementById('currentReceiptLink').href = data.receipt_url;
        } else {
            document.getElementById('currentReceipt').style.display = 'none';
        }
        
        document.getElementById('advanceReceipt').value = '';
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('advanceFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading advance: ' + error.message);
    }
}

async function deleteAdvance(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this advance record?')) {
        try {
            const { data: advance } = await supabaseClient
                .from('driver_advances')
                .select('receipt_url')
                .eq('id', id)
                .single();
            
            if (advance?.receipt_url) {
                await deleteReceipt(advance.receipt_url);
            }
            
            await supabaseClient.from('driver_advances').delete().eq('id', id);
            loadDriverAdvances();
        } catch (error) {
            alert('Error deleting advance: ' + error.message);
        }
    }
}

// ============ REPORT GENERATION ============
document.getElementById('generateReportBtn')?.addEventListener('click', async () => {
    const monthValue = document.getElementById('dashboardMonth')?.value;
    if (!monthValue) {
        alert('Please select a month first');
        return;
    }
    if (typeof generateMonthlyReport === 'function') {
        await generateMonthlyReport(monthValue);
    }
});

// ============ HELPER FUNCTIONS (LIGHTBOX) ============

function openPhotoLightbox(photoUrl) {
    const lightbox = document.getElementById('photoLightbox');
    const lightboxImg = document.getElementById('lightboxImage');
    if (lightbox && lightboxImg) {
        lightboxImg.src = photoUrl;
        lightbox.classList.add('active');
    }
}

function closePhotoLightbox() {
    const lightbox = document.getElementById('photoLightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closePhotoLightbox();
    }
});

document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', function(e) {
    if (e.touches.length > 0) {
        e.preventDefault();
    }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
});

// ============ NEW: ADVANCED METRICS & CHARTS ============
async function loadAdvancedDashboardStats(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${daysInMonth}`;
        const currentQueryUserId = getQueryUserId();

        // 1. Fetch Data
        const [
            { data: hireRecords },
            { data: commitmentRecords },
            { data: otherOpHires },
            { data: allVehicles },
            { data: allCommitVehicles }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, terminated').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number, terminated').eq('user_id', currentQueryUserId)
        ]);

        const baseNames = new Set();
        const vehicleMap = {}; 

        if (allVehicles) {
            allVehicles.forEach(v => {
                if (v.lorry_number) {
                    const baseName = extractBaseVehicleName(v.lorry_number);
                    vehicleMap[`hire_${v.id}`] = baseName;
                    if (!v.terminated) baseNames.add(baseName);
                }
            });
        }
        if (allCommitVehicles) {
            allCommitVehicles.forEach(v => {
                if (v.vehicle_number) {
                    const baseName = extractBaseVehicleName(v.vehicle_number);
                    vehicleMap[`commit_${v.id}`] = baseName;
                    if (!v.terminated) baseNames.add(baseName);
                }
            });
        }

        // Fleet-wide count of unique non-terminated vehicles (aligns with Overview widget)
        const fleetCount = baseNames.size;

        // Combine Records and add type for mapping
        let combinedRecords = [];
        if (hireRecords) {
            const mappedHire = hireRecords.map(r => ({ ...r, _recordType: 'hire' }));
            combinedRecords = [...combinedRecords, ...mappedHire];
        }
        if (commitmentRecords) {
            const mappedCommit = commitmentRecords.map(r => ({ ...r, _recordType: 'commit' }));
            combinedRecords = [...combinedRecords, ...mappedCommit];
        }
        if (otherOpHires) {
            const mappedOther = otherOpHires.map(r => ({ ...r, _recordType: 'other' }));
            combinedRecords = [...combinedRecords, ...mappedOther];
        }

        // --- CALCULATIONS ---

        let totalRevenue = 0;
        let totalProfit = 0;
        let totalFuelCost = 0;
        let totalDistance = 0;
        let totalWaitingRev = 0;
        let totalJobs = combinedRecords.length;
        let totalFuelLitres = 0;
        
        // Utilization Set: Store "BaseName-Date" strings
        const activeVehicleDays = new Set();

        combinedRecords.forEach(r => {
            // Financials
            const revenue = r.hire_amount || 0; 
            
            // Operational totals:
            totalDistance += (r.distance || 0);
            totalFuelCost += (r.fuel_cost || 0);
            totalFuelLitres += (r.fuel_litres || 0);
            
            if (r.waiting_charge) totalWaitingRev += r.waiting_charge;
            
            // Utilization
            let baseName = 'unknown';
            if (r._recordType === 'other') {
                baseName = r.base_lorry_number;
            } else {
                baseName = vehicleMap[`${r._recordType}_${r.vehicle_id}`] || `unknown_${r._recordType}_${r.vehicle_id}`;
            }
            activeVehicleDays.add(`${baseName}-${r.hire_date}`);
        });

        // Get Totals from the DOM (calculated in loadDashboardData) to ensure consistency with base pay
        const domRevenue = parseFloat(document.getElementById('totalRevenue').textContent.replace(/[^\d.-]/g, '')) || 0;
        const domProfit = parseFloat(document.getElementById('netProfit').textContent.replace(/[^\d.-]/g, '')) || 0;

        // 1. Profit per KM
        const profitPerKm = totalDistance > 0 ? (domProfit / totalDistance) : 0;

        // 2. Vehicle Utilization Rate
        // (Total Active Vehicle Days) / (Total Vehicles * Days in Month)
        const totalPossibleDays = fleetCount * daysInMonth;
        const utilizationRate = totalPossibleDays > 0 ? (activeVehicleDays.size / totalPossibleDays) * 100 : 0;

        // 3. Revenue per Vehicle per Day
        const revPerVehDay = totalPossibleDays > 0 ? (domRevenue / totalPossibleDays) : 0;

        // 4. Avg Fuel Efficiency
        const avgEfficiency = totalFuelLitres > 0 ? (totalDistance / totalFuelLitres) : 0;

        // 5. Avg Trip Distance
        const avgTripDist = totalJobs > 0 ? (totalDistance / totalJobs) : 0;

        // 6. Jobs per Vehicle
        const jobsPerVeh = fleetCount > 0 ? (totalJobs / fleetCount) : 0;
        
        // 7. Distance per Vehicle
        const distPerVeh = fleetCount > 0 ? (totalDistance / fleetCount) : 0;

        // --- UPDATE UI ---
        
        const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };

        setText('profitPerKm', `LKR ${profitPerKm.toFixed(2)}`);
        setText('utilizationRate', `${utilizationRate.toFixed(1)}%`);
        setText('revPerVehicleDay', `LKR ${revPerVehDay.toFixed(2)}`);
        setText('avgFuelEfficiency', `${avgEfficiency.toFixed(2)} Km/L`);
        
        setText('avgTripDistance', `${avgTripDist.toFixed(1)} km`);
        setText('waitingRevenue', `LKR ${totalWaitingRev.toFixed(2)}`);
        setText('jobsPerVehicle', jobsPerVeh.toFixed(1));
        setText('distPerVehicle', `${distPerVeh.toFixed(0)} km`);


        // --- CHARTS GENERATION ---
        
        // Chart 1: Distance Distribution (Histogram bucket logic)
        const buckets = { '0-50km': 0, '51-100km': 0, '101-200km': 0, '200km+': 0 };
        
        combinedRecords.forEach(r => {
            const d = r.distance || 0;
            if (d <= 50) buckets['0-50km']++;
            else if (d <= 100) buckets['51-100km']++;
            else if (d <= 200) buckets['101-200km']++;
            else buckets['200km+']++;
        });

        // Render Distance Chart
        if (distanceDistChart) distanceDistChart.destroy();
        const distCtx = document.getElementById('distanceDistChart')?.getContext('2d');
        if (distCtx) {
            distanceDistChart = new Chart(distCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(buckets),
                    datasets: [{
                        label: 'Number of Jobs',
                        data: Object.values(buckets),
                        backgroundColor: 'rgba(52, 152, 219, 0.7)',
                        borderColor: '#2980b9',
                        borderWidth: 1,
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        title: { display: true, text: 'Jobs by Distance' },
                        legend: { display: false }
                    },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });
        }

        // Chart 2: Fuel Efficiency Trend (Last 6 Months)
        // We need to fetch 6 months of data aggregated
        const months = [];
        const efficiencyData = [];
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setDate(1); 
            date.setMonth(date.getMonth() - i);
            const mYear = date.getFullYear();
            const mRaw = date.getMonth() + 1;
            const mStr = String(mRaw).padStart(2, '0');
            const mLabel = date.toLocaleDateString('en-US', { month: 'short' });
            
            const startD = `${mYear}-${mStr}-01`;
            const endD = `${mYear}-${mStr}-${new Date(mYear, mRaw, 0).getDate()}`;

            // Fetch specific month sums
            const { data: hRecs } = await supabaseClient.from('hire_to_pay_records')
                .select('distance, fuel_litres').eq('user_id', currentQueryUserId)
                .gte('hire_date', startD).lte('hire_date', endD);
                
            const { data: cRecs } = await supabaseClient.from('commitment_records')
                .select('distance, fuel_litres').eq('user_id', currentQueryUserId)
                .gte('hire_date', startD).lte('hire_date', endD);

            const { data: oRecs } = await supabaseClient.from('other_operation_hires')
                .select('distance, fuel_litres').eq('user_id', currentQueryUserId)
                .gte('hire_date', startD).lte('hire_date', endD);

            let mDist = 0; 
            let mFuel = 0;
            
            [...(hRecs||[]), ...(cRecs||[]), ...(oRecs||[])].forEach(r => {
                mDist += (r.distance || 0);
                mFuel += (r.fuel_litres || 0);
            });

            months.push(mLabel);
            efficiencyData.push(mFuel > 0 ? (mDist / mFuel) : 0);
        }

        // Render Fuel Trend Chart
        if (fuelTrendChart) fuelTrendChart.destroy();
        const fuelCtx = document.getElementById('fuelTrendChart')?.getContext('2d');
        if (fuelCtx) {
            fuelTrendChart = new Chart(fuelCtx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Fleet Avg Efficiency (Km/L)',
                        data: efficiencyData,
                        borderColor: '#27AE60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#27AE60'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        title: { display: true, text: 'Fuel Efficiency Trend (Last 6 Months)' }
                    },
                    scales: { y: { beginAtZero: false } }
                }
            });
        }

    } catch (error) {
        console.error('Error loading advanced stats:', error.message);
    }
}

// ============ NEW DASHBOARD WIDGET CHARTS ============

// Shared color palette for charts
const CHART_COLORS = [
    '#D1001F', '#0072CE', '#00B37E', '#E07B00', '#7B35C4',
    '#E91E63', '#009688', '#FF5722', '#3F51B5', '#8BC34A',
    '#FF9800', '#00BCD4', '#795548', '#607D8B', '#CDDC39',
    '#F44336', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0'
];

// Helper: Get chart text/grid colors based on current theme
function getChartTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    return {
        textColor: isDark ? '#A8B0C2' : '#4B5260',
        titleColor: isDark ? '#F0F2F7' : '#1A1D24',
        gridColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        borderColor: isDark ? '#fff' : '#fff',
        tooltipBg: isDark ? '#1E2028' : '#fff',
        tooltipText: isDark ? '#F0F2F7' : '#1A1D24',
        tooltipBorder: isDark ? '#2A2D38' : '#E2E5EA'
    };
}

// 1. Vehicle Revenue Contribution — PIE CHART
async function loadVehicleRevenuePieChart(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        // Fetch hire records with vehicle info concurrently
        const [
            { data: hireRecords },
            { data: commitmentRecords },
            { data: otherOpRecords }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('vehicle_id, hire_amount, hire_to_pay_vehicles(lorry_number)').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('vehicle_id, distance, commitment_vehicles(vehicle_number, fixed_monthly_payment, km_limit_per_month, extra_km_charge)').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('base_lorry_number, hire_amount').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
        ]);

        // Aggregate revenue per vehicle
        const vehicleRevMap = {};

        hireRecords?.forEach(r => {
            const rawName = r.hire_to_pay_vehicles?.lorry_number || `Vehicle #${r.vehicle_id}`;
            const name = extractBaseVehicleName(rawName);
            vehicleRevMap[name] = (vehicleRevMap[name] || 0) + (r.hire_amount || 0);
        });
        
        otherOpRecords?.forEach(r => {
            if (r.base_lorry_number) {
                const name = extractBaseVehicleName(r.base_lorry_number);
                vehicleRevMap[name] = (vehicleRevMap[name] || 0) + (r.hire_amount || 0);
            }
        });

        // Group commitment records by vehicle for monthly payment + extra km charges
        const commitVehicleData = {};
        commitmentRecords?.forEach(r => {
            const rawName = r.commitment_vehicles?.vehicle_number || `Vehicle #${r.vehicle_id}`;
            if (!commitVehicleData[rawName]) {
                commitVehicleData[rawName] = {
                    vehicle: r.commitment_vehicles,
                    totalKm: 0,
                    counted: false
                };
            }
            commitVehicleData[rawName].totalKm += (r.distance || 0);
        });

        Object.entries(commitVehicleData).forEach(([rawName, data]) => {
            if (data.vehicle) {
                let rev = data.vehicle.fixed_monthly_payment || 0;
                const exceed = Math.max(0, data.totalKm - (data.vehicle.km_limit_per_month || 0));
                rev += exceed * (data.vehicle.extra_km_charge || 0);
                
                const baseName = extractBaseVehicleName(rawName);
                vehicleRevMap[baseName] = (vehicleRevMap[baseName] || 0) + rev;
            }
        });

        // Sort by revenue descending
        const sorted = Object.entries(vehicleRevMap)
            .sort((a, b) => b[1] - a[1]);

        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);

        // Destroy old
        if (vehicleRevenuePieChart) vehicleRevenuePieChart.destroy();

        const ctx = document.getElementById('vehicleRevenuePieChart')?.getContext('2d');
        if (!ctx || labels.length === 0) return;

        const theme = getChartTheme();
        vehicleRevenuePieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: CHART_COLORS.slice(0, labels.length),
                    borderColor: theme.borderColor,
                    borderWidth: 2,
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Vehicle Revenue Share — ${monthValue}`,
                        color: theme.titleColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        position: 'bottom',
                        labels: { padding: 14, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, color: theme.textColor }
                    },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        titleColor: theme.tooltipText,
                        bodyColor: theme.tooltipText,
                        borderColor: theme.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: function(ctx) {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                                return `${ctx.label}: LKR ${ctx.parsed.toLocaleString()} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading vehicle revenue pie chart:', error.message);
    }
}

// 2. Revenue Type Split — DOUGHNUT (Hire-to-Pay vs Commitment)
async function loadRevenueTypeSplitChart(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${monthPadded}-01`;
        const endDate = `${year}-${monthPadded}-${String(daysInMonth).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        const [{ data: hireRecords }, { data: commRecords }, { data: otherOpRecords }, { data: rtsCommDayOffs }] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('hire_amount').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('vehicle_id, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('hire_amount').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_day_offs').select('deduction_amount').eq('user_id', currentQueryUserId).gte('day_off_date', startDate).lte('day_off_date', endDate)
        ]);

        // Fetch only vehicles that had records this month
        const rtsCommVehicleIds = [...new Set((commRecords || []).map(r => r.vehicle_id).filter(Boolean))];
        let rtsCommVehicles = [];
        if (rtsCommVehicleIds.length > 0) {
            const { data: cvData } = await supabaseClient
                .from('commitment_vehicles')
                .select('id, fixed_monthly_payment, km_limit_per_month, extra_km_charge')
                .eq('user_id', currentQueryUserId)
                .in('id', rtsCommVehicleIds);
            rtsCommVehicles = cvData || [];
        }

        // Hire-to-Pay revenue
        const hireRevenue = (hireRecords || []).reduce((sum, r) => sum + (r.hire_amount || 0), 0);

        // Commitment revenue = fixed_monthly_payment - day_off_deductions + extra_km_charges
        const rtsCommFixed = rtsCommVehicles.reduce((sum, v) => sum + (v.fixed_monthly_payment || 0), 0);
        const rtsCommDayOffDed = (rtsCommDayOffs || []).reduce((sum, d) => sum + (d.deduction_amount || 0), 0);
        let rtsExtraKm = 0;
        if (rtsCommVehicles.length > 0 && commRecords && commRecords.length > 0) {
            const vKmMap = {};
            commRecords.forEach(r => { vKmMap[r.vehicle_id] = (vKmMap[r.vehicle_id] || 0) + (r.distance || 0); });
            rtsCommVehicles.forEach(v => {
                const exc = Math.max(0, (vKmMap[v.id] || 0) - (v.km_limit_per_month || 0));
                rtsExtraKm += exc * (v.extra_km_charge || 0);
            });
        }
        const commRevenue = Math.max(0, rtsCommFixed - rtsCommDayOffDed) + rtsExtraKm;

        // Other Operation revenue
        const otherOpRevenue = (otherOpRecords || []).reduce((sum, r) => sum + (r.hire_amount || 0), 0);

        const ctx = document.getElementById('revenueTypeSplitChart')?.getContext('2d');
        if (!ctx) return;

        if (window.revenueTypeSplitChartInstance) window.revenueTypeSplitChartInstance.destroy();

        const totalRev = hireRevenue + commRevenue + otherOpRevenue;
        const theme2 = getChartTheme();
        
        window.revenueTypeSplitChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Hire-to-Pay', 'Commitment', 'Other Operation'],
                datasets: [{
                    data: [hireRevenue, commRevenue, otherOpRevenue],
                    backgroundColor: ['#0072CE', '#00B37E', '#E67E22'],
                    borderColor: theme2.borderColor,
                    borderWidth: 3,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    title: {
                        display: true,
                        text: `Revenue Breakdown — LKR ${totalRev.toLocaleString()}`,
                        color: theme2.titleColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        position: 'bottom',
                        labels: { padding: 14, usePointStyle: true, pointStyle: 'circle', font: { size: 12 }, color: theme2.textColor }
                    },
                    tooltip: {
                        backgroundColor: theme2.tooltipBg,
                        titleColor: theme2.tooltipText,
                        bodyColor: theme2.tooltipText,
                        borderColor: theme2.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: function(ctx) {
                                const pct = totalRev > 0 ? ((ctx.parsed / totalRev) * 100).toFixed(1) : 0;
                                return `${ctx.label}: LKR ${ctx.parsed.toLocaleString()} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading revenue type split chart:', error.message);
    }
}

// 3. Top Visited Towns — HORIZONTAL BAR CHART
async function loadTopRoutesChart(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${daysInMonth}`;
        const currentQueryUserId = getQueryUserId();

        const townMap = {};

        const processLocation = (loc) => {
            if (!loc) return;
            const lowerLoc = loc.toLowerCase();
            let townsPart = loc;
            
            // Check if "via" exists
            const viaIndex = lowerLoc.indexOf('via');
            if (viaIndex !== -1) {
                // Extract everything after "via"
                townsPart = loc.substring(viaIndex + 3);
            }
            
            // Split by comma
            const towns = townsPart.split(',');
            towns.forEach(t => {
                const cleanTown = t.trim();
                if (!cleanTown) return;
                
                // Exclude "ederamulla" specifically as requested
                if (cleanTown.toLowerCase().includes('ederamulla')) return;
                if (cleanTown.toLowerCase() === 'via') return;
                
                if (cleanTown.length > 1) {
                    // Title case formatting
                    const formattedTown = cleanTown.split(' ')
                        .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '')
                        .join(' ');
                        
                    if (!townMap[formattedTown]) townMap[formattedTown] = 0;
                    townMap[formattedTown]++;
                }
            });
        };

        const [
            { data: hireRecords },
            { data: commitRecords },
            { data: otherOpRecords }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('to_location').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('to_location').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('to_location').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
        ]);

        hireRecords?.forEach(r => processLocation(r.to_location));
        commitRecords?.forEach(r => processLocation(r.to_location));
        otherOpRecords?.forEach(r => processLocation(r.to_location));

        // Sort by visit count, take top 10
        const sorted = Object.entries(townMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const labels = sorted.map(s => s[0].length > 28 ? s[0].substring(0, 26) + '…' : s[0]);
        const tripData = sorted.map(s => s[1]);

        // Destroy old
        if (topRoutesChart) topRoutesChart.destroy();

        const ctx = document.getElementById('topTownsChart')?.getContext('2d');
        if (!ctx || labels.length === 0) return;

        const theme3 = getChartTheme();
        topRoutesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Visits',
                        data: tripData,
                        backgroundColor: 'rgba(0, 114, 206, 0.75)',
                        borderColor: '#0072CE',
                        borderWidth: 1,
                        borderRadius: 5
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Top 10 Visited Towns — ${monthValue}`,
                        color: theme3.titleColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: theme3.tooltipBg,
                        titleColor: theme3.tooltipText,
                        bodyColor: theme3.tooltipText,
                        borderColor: theme3.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: function(ctx) {
                                return `Visits: ${ctx.parsed.x}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { font: { size: 11 }, color: theme3.textColor },
                        grid: { color: theme3.gridColor }
                    },
                    x: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: theme3.textColor },
                        grid: { color: theme3.gridColor }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading top towns chart:', error.message);
    }
}

// 4. Daily Activity — BAR CHART (Jobs per Day)
async function loadDailyActivityChart(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        const [
            { data: hireRecords },
            { data: commitRecords },
            { data: otherOpRecords }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('hire_date').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('hire_date').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('hire_date').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
        ]);

        // Build daily counts (use lastDay which is already computed above)
        const dailyCounts = {};
        for (let d = 1; d <= lastDay; d++) {
            const dayStr = `${year}-${monthPadded}-${String(d).padStart(2, '0')}`;
            dailyCounts[dayStr] = 0;
        }

        hireRecords?.forEach(r => {
            if (dailyCounts[r.hire_date] !== undefined) dailyCounts[r.hire_date]++;
        });
        commitRecords?.forEach(r => {
            if (dailyCounts[r.hire_date] !== undefined) dailyCounts[r.hire_date]++;
        });
        otherOpRecords?.forEach(r => {
            if (dailyCounts[r.hire_date] !== undefined) dailyCounts[r.hire_date]++;
        });

        const labels = Object.keys(dailyCounts).map(d => {
            const day = parseInt(d.split('-')[2]);
            return day;
        });
        const data = Object.values(dailyCounts);

        // Color based on activity level
        const maxJobs = Math.max(...data, 1);
        const colors = data.map(v => {
            if (v === 0) return 'rgba(189, 195, 199, 0.4)';
            const ratio = v / maxJobs;
            if (ratio >= 0.75) return 'rgba(209, 0, 31, 0.75)';
            if (ratio >= 0.4) return 'rgba(224, 123, 0, 0.75)';
            return 'rgba(0, 114, 206, 0.65)';
        });

        // Destroy old
        if (dailyActivityChart) dailyActivityChart.destroy();

        const ctx = document.getElementById('dailyActivityChart')?.getContext('2d');
        if (!ctx) return;

        const theme4 = getChartTheme();
        dailyActivityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Jobs',
                    data: data,
                    backgroundColor: colors,
                    borderColor: colors.map(c => c.replace(/[\d.]+\)$/, '1)')),
                    borderWidth: 1,
                    borderRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Daily Job Activity — ${monthValue}`,
                        color: theme4.titleColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: theme4.tooltipBg,
                        titleColor: theme4.tooltipText,
                        bodyColor: theme4.tooltipText,
                        borderColor: theme4.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            title: function(ctx) {
                                return `Day ${ctx[0].label}, ${monthValue}`;
                            },
                            label: function(ctx) {
                                return `${ctx.parsed.y} job(s)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: theme4.textColor },
                        grid: { color: theme4.gridColor }
                    },
                    x: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 0,
                            color: theme4.textColor
                        },
                        grid: { color: theme4.gridColor }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading daily activity chart:', error.message);
    }
}

// 5. Cost vs Revenue Comparison — GROUPED BAR (Per Vehicle)
async function loadCostVsRevenueChart(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        // Fetch records concurrently
        const [
            { data: hireRecords },
            { data: commitmentRecords },
            { data: otherOpHires }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('vehicle_id, hire_amount, fuel_cost, hire_to_pay_vehicles(lorry_number)').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('vehicle_id, fuel_cost, distance, commitment_vehicles(vehicle_number, fixed_monthly_payment, km_limit_per_month, extra_km_charge)').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('base_lorry_number, hire_amount, fuel_cost').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
        ]);

        // Aggregate per vehicle
        const vehicleData = {};

        hireRecords?.forEach(r => {
            const rawName = r.hire_to_pay_vehicles?.lorry_number || `H-${r.vehicle_id}`;
            const name = extractBaseVehicleName(rawName);
            if (!vehicleData[name]) vehicleData[name] = { revenue: 0, fuelCost: 0 };
            vehicleData[name].revenue += (r.hire_amount || 0);
            vehicleData[name].fuelCost += (r.fuel_cost || 0);
        });

        otherOpHires?.forEach(r => {
            if (r.base_lorry_number) {
                const name = extractBaseVehicleName(r.base_lorry_number);
                if (!vehicleData[name]) vehicleData[name] = { revenue: 0, fuelCost: 0 };
                vehicleData[name].revenue += (r.hire_amount || 0);
                vehicleData[name].fuelCost += (r.fuel_cost || 0);
            }
        });

        // Group commitment by vehicle for base pay + extra km (keep raw name for individual calculation)
        const commitGrouped = {};
        commitmentRecords?.forEach(r => {
            const name = r.commitment_vehicles?.vehicle_number || `C-${r.vehicle_id}`;
            if (!commitGrouped[name]) {
                commitGrouped[name] = { vehicle: r.commitment_vehicles, totalKm: 0, fuelCost: 0 };
            }
            commitGrouped[name].totalKm += (r.distance || 0);
            commitGrouped[name].fuelCost += (r.fuel_cost || 0);
        });

        Object.entries(commitGrouped).forEach(([rawName, d]) => {
            if (d.vehicle) {
                let rev = d.vehicle.fixed_monthly_payment || 0;
                const exc = Math.max(0, d.totalKm - (d.vehicle.km_limit_per_month || 0));
                rev += exc * (d.vehicle.extra_km_charge || 0);
                
                const name = extractBaseVehicleName(rawName);
                if (!vehicleData[name]) vehicleData[name] = { revenue: 0, fuelCost: 0 };
                vehicleData[name].revenue += rev;
                vehicleData[name].fuelCost += d.fuelCost;
            }
        });

        // Sort by revenue descending
        const sorted = Object.entries(vehicleData)
            .sort((a, b) => b[1].revenue - a[1].revenue);

        const labels = sorted.map(s => s[0]);
        const revenues = sorted.map(s => s[1].revenue);
        const fuelCosts = sorted.map(s => s[1].fuelCost);
        const profits = sorted.map((s, i) => revenues[i] - fuelCosts[i]);

        // Destroy old
        if (costVsRevenueChart) costVsRevenueChart.destroy();

        const ctx = document.getElementById('costVsRevenueChart')?.getContext('2d');
        if (!ctx || labels.length === 0) return;

        const theme5 = getChartTheme();
        costVsRevenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenues,
                        backgroundColor: 'rgba(0, 179, 126, 0.75)',
                        borderColor: '#00B37E',
                        borderWidth: 1,
                        borderRadius: 5
                    },
                    {
                        label: 'Fuel Cost',
                        data: fuelCosts,
                        backgroundColor: 'rgba(224, 123, 0, 0.70)',
                        borderColor: '#E07B00',
                        borderWidth: 1,
                        borderRadius: 5
                    },
                    {
                        label: 'Profit',
                        data: profits,
                        backgroundColor: profits.map(p => p >= 0 ? 'rgba(0, 114, 206, 0.60)' : 'rgba(209, 0, 31, 0.60)'),
                        borderColor: profits.map(p => p >= 0 ? '#0072CE' : '#D1001F'),
                        borderWidth: 1,
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Vehicle Cost vs Revenue — ${monthValue}`,
                        color: theme5.titleColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: { position: 'top', labels: { color: theme5.textColor } },
                    tooltip: {
                        backgroundColor: theme5.tooltipBg,
                        titleColor: theme5.tooltipText,
                        bodyColor: theme5.tooltipText,
                        borderColor: theme5.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: function(ctx) {
                                return `${ctx.dataset.label}: LKR ${ctx.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => `LKR ${(v / 1000).toFixed(0)}K`,
                            color: theme5.textColor
                        },
                        grid: { color: theme5.gridColor }
                    },
                    x: {
                        ticks: {
                            font: { size: 11 },
                            maxRotation: 45,
                            minRotation: 0,
                            color: theme5.textColor
                        },
                        grid: { color: theme5.gridColor }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading cost vs revenue chart:', error.message);
    }
}

// 6. Daily KM Run Chart — BAR (Per Day in Month)
async function loadDailyKmChart(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        // Fetch distance data from all three sources
        const [{ data: hireRecords }, { data: commitRecords }, { data: otherOpRecords }] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
        ]);

        // Build daily KM totals
        const dailyKms = {};
        for (let d = 1; d <= lastDay; d++) {
            const dayStr = `${year}-${monthPadded}-${String(d).padStart(2, '0')}`;
            dailyKms[dayStr] = 0;
        }

        hireRecords?.forEach(r => { if (dailyKms[r.hire_date] !== undefined) dailyKms[r.hire_date] += (r.distance || 0); });
        commitRecords?.forEach(r => { if (dailyKms[r.hire_date] !== undefined) dailyKms[r.hire_date] += (r.distance || 0); });
        otherOpRecords?.forEach(r => { if (dailyKms[r.hire_date] !== undefined) dailyKms[r.hire_date] += (r.distance || 0); });

        const labels = Object.keys(dailyKms).map(d => parseInt(d.split('-')[2]));
        const data = Object.values(dailyKms);

        // Color bars: green gradient based on KM value
        const maxKm = Math.max(...data, 1);
        const colors = data.map(v => {
            if (v === 0) return 'rgba(189, 195, 199, 0.35)';
            const ratio = v / maxKm;
            if (ratio >= 0.75) return 'rgba(0, 163, 108, 0.80)';
            if (ratio >= 0.40) return 'rgba(39, 174, 96, 0.70)';
            return 'rgba(46, 213, 115, 0.60)';
        });
        const borderColors = colors.map(c => c.replace(/[\d.]+\)$/, '1)'));

        if (dailyKmChart) dailyKmChart.destroy();

        const ctx = document.getElementById('dailyKmChart')?.getContext('2d');
        if (!ctx) return;

        const theme = getChartTheme();
        dailyKmChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'KM Run',
                    data: data,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Daily Distance Run (KM) — ${monthValue}`,
                        color: theme.titleColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        titleColor: theme.tooltipText,
                        bodyColor: theme.tooltipText,
                        borderColor: theme.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            title: function(ctx) {
                                return `Day ${ctx[0].label} — ${monthValue}`;
                            },
                            label: function(ctx) {
                                return `Distance: ${ctx.parsed.y.toLocaleString()} km`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => `${v} km`,
                            color: theme.textColor
                        },
                        grid: { color: theme.gridColor }
                    },
                    x: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 0,
                            color: theme.textColor
                        },
                        grid: { color: theme.gridColor }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading daily KM chart:', error.message);
    }
}

// 7. Daily Fuel Usage & Cost Chart — GROUPED BAR (Per Day in Month)
async function loadDailyFuelChart(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        // Fetch fuel data from all three sources
        const [{ data: hireRecords }, { data: commitRecords }, { data: otherOpRecords }] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('hire_date, fuel_litres, fuel_cost').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('hire_date, fuel_litres, fuel_cost').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('hire_date, fuel_litres, fuel_cost').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
        ]);

        // Build daily fuel totals
        const dailyFuelLitres = {};
        const dailyFuelCost = {};
        for (let d = 1; d <= lastDay; d++) {
            const dayStr = `${year}-${monthPadded}-${String(d).padStart(2, '0')}`;
            dailyFuelLitres[dayStr] = 0;
            dailyFuelCost[dayStr] = 0;
        }

        [...(hireRecords || []), ...(commitRecords || []), ...(otherOpRecords || [])].forEach(r => {
            if (dailyFuelLitres[r.hire_date] !== undefined) {
                dailyFuelLitres[r.hire_date] += (r.fuel_litres || 0);
                dailyFuelCost[r.hire_date] += (r.fuel_cost || 0);
            }
        });

        const labels = Object.keys(dailyFuelLitres).map(d => parseInt(d.split('-')[2]));
        const litresData = Object.values(dailyFuelLitres);
        const costData = Object.values(dailyFuelCost);

        // Monthly totals for subtitle
        const totalLitres = litresData.reduce((a, b) => a + b, 0);
        const totalCost = costData.reduce((a, b) => a + b, 0);

        if (dailyFuelChart) dailyFuelChart.destroy();

        const ctx = document.getElementById('dailyFuelChart')?.getContext('2d');
        if (!ctx) return;

        const theme = getChartTheme();
        dailyFuelChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Fuel Used (Litres)',
                        data: litresData,
                        backgroundColor: 'rgba(230, 126, 34, 0.75)',
                        borderColor: '#E07B00',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'yLitres'
                    },
                    {
                        label: 'Fuel Cost (LKR)',
                        data: costData,
                        backgroundColor: 'rgba(209, 0, 31, 0.65)',
                        borderColor: '#D1001F',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'yCost'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: {
                        display: true,
                        text: [`Daily Fuel Usage & Cost — ${monthValue}`, `Total: ${totalLitres.toFixed(1)} L  |  LKR ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
                        color: theme.titleColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        position: 'top',
                        labels: { color: theme.textColor, usePointStyle: true, pointStyle: 'rect', padding: 16 }
                    },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        titleColor: theme.tooltipText,
                        bodyColor: theme.tooltipText,
                        borderColor: theme.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            title: function(ctx) {
                                return `Day ${ctx[0].label} — ${monthValue}`;
                            },
                            label: function(ctx) {
                                if (ctx.dataset.yAxisID === 'yLitres') {
                                    return `Fuel Used: ${ctx.parsed.y.toFixed(2)} Litres`;
                                } else {
                                    return `Fuel Cost: LKR ${ctx.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    yLitres: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        ticks: {
                            callback: v => `${v} L`,
                            color: '#E07B00'
                        },
                        grid: { color: theme.gridColor },
                        title: {
                            display: true,
                            text: 'Litres',
                            color: '#E07B00',
                            font: { size: 11 }
                        }
                    },
                    yCost: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        ticks: {
                            callback: v => `LKR ${(v / 1000).toFixed(1)}K`,
                            color: '#D1001F'
                        },
                        grid: { drawOnChartArea: false },
                        title: {
                            display: true,
                            text: 'Cost (LKR)',
                            color: '#D1001F',
                            font: { size: 11 }
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 0,
                            color: theme.textColor
                        },
                        grid: { color: theme.gridColor }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading daily fuel chart:', error.message);
    }
}

// ============ DRIVER DAY OFFS ============
// 1. Event Listeners for Buttons
document.getElementById('addDriverDayOffBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('driverDayOffForm').reset();
    document.getElementById('driverDayOffId').value = '';
    document.getElementById('suggestedDeduction').textContent = '';
    document.getElementById('driverDayOffFormContainer').style.display = 'block';
    
    // Populate the dropdown inside the form
    updateDriverDayOffSelectors(); 
});

document.getElementById('cancelDriverDayOffBtn')?.addEventListener('click', () => {
    document.getElementById('driverDayOffFormContainer').style.display = 'none';
});

// 2. Event Listeners for Filters
document.getElementById('driverDayOffMonth')?.addEventListener('change', loadDriverDayOffs);
document.getElementById('driverDayOffFilter')?.addEventListener('change', loadDriverDayOffs);

// 3. Auto-Calculate Deduction when Driver is selected
document.getElementById('driverDayOffDriver')?.addEventListener('change', async (e) => {
    const driverId = e.target.value;
    const amountInput = document.getElementById('driverDayOffAmount');
    const suggestionText = document.getElementById('suggestedDeduction');
    
    if (!driverId) return;

    try {
        const { data: driver } = await supabaseClient
            .from('drivers')
            .select('basic_salary')
            .eq('id', driverId)
            .single();

        if (driver && driver.basic_salary) {
            const dailyRate = driver.basic_salary / 30;
            amountInput.value = dailyRate.toFixed(2);
            suggestionText.textContent = `Auto-calculated: (Basic ${driver.basic_salary} / 30)`;
        } else {
            amountInput.value = '';
            suggestionText.textContent = 'No basic salary set for this driver.';
        }
    } catch (error) {
        console.error('Error fetching driver salary:', error);
    }
});

// 4. Form Submit (Save/Update)
document.getElementById('driverDayOffForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('driverDayOffId').value;
    
    const data = {
        driver_id: document.getElementById('driverDayOffDriver').value,
        day_off_date: document.getElementById('driverDayOffDate').value,
        deduction_amount: parseFloat(document.getElementById('driverDayOffAmount').value) || 0,
        notes: document.getElementById('driverDayOffNotes').value || null,
        user_id: adminUserId
    };

    try {
        if (id) {
            const { error: updateError } = await supabaseClient.from('driver_day_offs').update(data).eq('id', id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseClient.from('driver_day_offs').insert([data]);
            if (insertError) throw insertError;
        }
        
        loadDriverDayOffs();
        document.getElementById('driverDayOffFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving driver day off: ' + error.message);
    }
});

// 5. Load Data
async function loadDriverDayOffs() {
    try {
        const monthValue = document.getElementById('driverDayOffMonth')?.value;
        const driverFilter = document.getElementById('driverDayOffFilter')?.value;
        
        let query = supabaseClient
            .from('driver_day_offs')
            .select('*, drivers(name)')
            .eq('user_id', getQueryUserId());
        
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            query = query.gte('day_off_date', startDate).lte('day_off_date', endDate);
        }

        if (driverFilter) {
            query = query.eq('driver_id', driverFilter);
        }

        const { data, error } = await query.order('day_off_date', { ascending: false });
        if (error) throw error;

        const tbody = document.querySelector('#driverDayOffsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #7F8C8D; padding: 20px;">No day offs found.</td></tr>';
        } else {
            data.forEach(item => {
                const row = document.createElement('tr');
                const actionButtons = userRole === 'viewer' ? '' : `
                    <td class="action-buttons">
                        <button class="btn btn-edit" onclick="editDriverDayOff(${item.id})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteDriverDayOff(${item.id})">Delete</button>
                    </td>
                `;

                row.innerHTML = `
                    <td>${item.drivers?.name || 'Unknown'}</td>
                    <td>${item.day_off_date}</td>
                    <td style="color: #E74C3C; font-weight: bold;">LKR ${item.deduction_amount.toFixed(2)}</td>
                    <td>${item.notes || '-'}</td>
                    ${actionButtons}
                `;
                tbody.appendChild(row);
            });
        }

        await renderDayOffWidgets(data);
        updateDriverDayOffSelectors();
    } catch (error) {
        console.error('Error loading driver day offs:', error.message);
    }
}

// 5b. Render per-driver day-off summary widgets
async function renderDayOffWidgets(dayOffData) {
    const section = document.getElementById('driverDayOffWidgetsSection');
    const container = document.getElementById('driverDayOffWidgets');
    if (!container || !section) return;

    if (!dayOffData || dayOffData.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = '';

    const monthValue = document.getElementById('driverDayOffMonth')?.value;
    let monthLabel = 'All Time';
    if (monthValue) {
        const [yr, mo] = monthValue.split('-');
        monthLabel = new Date(yr, mo - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    // Aggregate by driver
    const byDriver = {};
    dayOffData.forEach(item => {
        const driverId = item.driver_id;
        const name = item.drivers?.name || 'Unknown';
        if (!byDriver[driverId]) {
            byDriver[driverId] = { name, count: 0, totalDeduction: 0 };
        }
        byDriver[driverId].count += 1;
        byDriver[driverId].totalDeduction += (item.deduction_amount || 0);
    });

    // Grand total widget
    const totalDayOffs = dayOffData.length;
    const grandDeduction = dayOffData.reduce((s, i) => s + (i.deduction_amount || 0), 0);
    const driverCount = Object.keys(byDriver).length;

    const topWidget = document.createElement('div');
    topWidget.style.cssText = 'grid-column:1/-1;margin-bottom:4px;';
    topWidget.innerHTML = `<div class="summary-banner" style="background:linear-gradient(135deg,#c0392b 0%,#7b241c 100%);border-radius:14px;padding:20px 26px;display:flex;align-items:center;gap:22px;box-shadow:0 6px 24px rgba(192,57,43,.30);color:#fff;flex-wrap:wrap;">
        <div style="font-size:44px;flex-shrink:0;">⛔</div>
        <div style="flex:1;min-width:180px;">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.80;margin-bottom:3px;">Total Day Off Deductions — ${monthLabel}</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:38px;font-weight:900;letter-spacing:-.5px;line-height:1.05;">LKR ${grandDeduction.toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div style="font-size:12px;opacity:.75;margin-top:5px;">${totalDayOffs} day off record${totalDayOffs!==1?'s':''} across ${driverCount} staff member${driverCount!==1?'s':''}</div>
        </div>
    </div>`;
    container.appendChild(topWidget);

    // Individual driver cards
    Object.values(byDriver)
        .sort((a, b) => b.totalDeduction - a.totalDeduction)
        .forEach(d => {
            const card = document.createElement('div');
            card.className = 'advance-card';
            card.innerHTML = `
                <div class="advance-card-icon">📅</div>
                <div class="advance-card-content">
                    <div class="advance-card-name">${d.name}</div>
                    <div class="advance-card-amount" style="color:#E74C3C;">LKR ${d.totalDeduction.toFixed(2)}</div>
                    <div class="advance-card-label">${d.count} day off${d.count!==1?'s':''} — ${monthLabel}</div>
                </div>
            `;
            container.appendChild(card);
        });
}

// 6. Helper: Update Selectors
async function updateDriverDayOffSelectors(preserveFormValue = false) {
    try {
        // Only fetch active (non-terminated) staff
        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id, name')
            .eq('user_id', getQueryUserId())
            .neq('terminated', true)
            .order('name', { ascending: true });

        const formSelect = document.getElementById('driverDayOffDriver');
        const filterSelect = document.getElementById('driverDayOffFilter');

        // Update Filter dropdown (preserve current selection)
        if (filterSelect) {
            const currentFilter = filterSelect.value;
            filterSelect.innerHTML = '<option value="">All Staff</option>';
            drivers?.forEach(d => {
                const option = document.createElement('option');
                option.value = d.id;
                option.textContent = d.name;
                filterSelect.appendChild(option);
            });
            filterSelect.value = currentFilter;
        }

        // Always repopulate the form dropdown to ensure terminated staff are excluded
        if (formSelect) {
            const currentFormValue = preserveFormValue ? formSelect.value : '';
            formSelect.innerHTML = '<option value="">Select Staff</option>';
            drivers?.forEach(d => {
                const option = document.createElement('option');
                option.value = d.id;
                option.textContent = d.name;
                formSelect.appendChild(option);
            });
            if (preserveFormValue && currentFormValue) {
                formSelect.value = currentFormValue;
            }
        }
    } catch (error) {
        console.error('Error updating driver selectors:', error.message);
    }
}

// 7. Edit Function
async function editDriverDayOff(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient
            .from('driver_day_offs')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        // Ensure selectors are loaded before setting value (preserves form value after population)
        await updateDriverDayOffSelectors(false);

        document.getElementById('driverDayOffId').value = data.id;
        document.getElementById('driverDayOffDriver').value = data.driver_id;
        document.getElementById('driverDayOffDate').value = data.day_off_date;
        document.getElementById('driverDayOffAmount').value = data.deduction_amount;
        document.getElementById('driverDayOffNotes').value = data.notes || '';
        document.getElementById('suggestedDeduction').textContent = ''; // Clear auto-suggest text on edit

        document.getElementById('driverDayOffFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading day off: ' + error.message);
    }
}

// 8. Delete Function
async function deleteDriverDayOff(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this day off record?')) {
        try {
            await supabaseClient.from('driver_day_offs').delete().eq('id', id);
            loadDriverDayOffs();
        } catch (error) {
            alert('Error deleting record: ' + error.message);
        }
    }
}
// ============ LORRY MAINTENANCE ============

// 1. Open / Close Form
document.getElementById('addMaintenanceBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('maintenanceForm').reset();
    document.getElementById('maintenanceId').value = '';
    document.getElementById('maintenanceFormContainer').style.display = 'block';
    populateMaintenanceVehicleDropdown();
});

document.getElementById('cancelMaintenanceBtn')?.addEventListener('click', () => {
    document.getElementById('maintenanceFormContainer').style.display = 'none';
});

// 2. Filter Listeners
document.getElementById('maintenanceMonth')?.addEventListener('change', loadMaintenanceRecords);
document.getElementById('maintenanceVehicleFilter')?.addEventListener('change', loadMaintenanceRecords);

// 3. Form Submit
document.getElementById('maintenanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { alert('Session not ready. Please wait a moment and try again.'); return; }

    const id = document.getElementById('maintenanceId').value;
    const vehicleRaw = document.getElementById('maintenanceVehicle').value;
    
    // We now save the base name directly.
    const data = {
        vehicle_ref:    vehicleRaw,
        vehicle_type:   'merged',
        vehicle_id:     0,
        expense_type:   document.getElementById('maintenanceExpense').value,
        amount:         parseFloat(document.getElementById('maintenanceAmount').value) || 0,
        maintenance_date: document.getElementById('maintenanceDate').value,
        notes:          document.getElementById('maintenanceNotes').value || null,
        user_id:        adminUserId
    };

    try {
        if (id) {
            const { error: updateError } = await supabaseClient.from('lorry_maintenance').update(data).eq('id', id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseClient.from('lorry_maintenance').insert([data]);
            if (insertError) throw insertError;
        }
        loadMaintenanceRecords();
        document.getElementById('maintenanceFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving maintenance record: ' + error.message);
    }
});

// 4. Load Records + Widgets
async function loadMaintenanceRecords() {
    try {
        const monthEl = document.getElementById('maintenanceMonth');
        let monthValue = monthEl ? monthEl.value : '';
        if (!monthValue) {
            const now = new Date();
            monthValue = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            if (monthEl) monthEl.value = monthValue;
        }

        const vehicleFilter = document.getElementById('maintenanceVehicleFilter')?.value || '';

        const [yr, mo] = monthValue.split('-');
        const startDate = `${yr}-${mo}-01`;
        const lastDay = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const endDate = `${yr}-${mo}-${String(lastDay).padStart(2,'0')}`;

        let query = supabaseClient
            .from('lorry_maintenance')
            .select('*')
            .eq('user_id', getQueryUserId())
            .gte('maintenance_date', startDate)
            .lte('maintenance_date', endDate);

        const { data, error } = await query.order('maintenance_date', { ascending: false });
        if (error) throw error;

        const tbody = document.querySelector('#maintenanceTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#7F8C8D;padding:20px;">No maintenance records found for this month.</td></tr>';
        } else {
            const labelMap = await getVehicleLabelMap();
            
            // Filter locally to support merged base names for old records
            const filteredData = vehicleFilter 
                ? data.filter(item => (labelMap[item.vehicle_ref] || item.vehicle_ref) === vehicleFilter)
                : data;
                
            if (filteredData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#7F8C8D;padding:20px;">No maintenance records found for the selected vehicle.</td></tr>';
            } else {
                filteredData.forEach(item => {
                    const row = document.createElement('tr');
                    const actionButtons = userRole === 'viewer' ? '' : `
                        <td class="action-buttons">
                            <button class="btn btn-edit" onclick="editMaintenanceRecord(${item.id})">Edit</button>
                            <button class="btn btn-danger" onclick="deleteMaintenanceRecord(${item.id})">Delete</button>
                        </td>
                    `;
                    row.innerHTML = `
                        <td>${labelMap[item.vehicle_ref] || item.vehicle_ref}</td>
                        <td>${item.maintenance_date}</td>
                        <td>${item.expense_type}</td>
                        <td style="color:#E74C3C;font-weight:bold;">LKR ${item.amount.toFixed(2)}</td>
                        <td>${item.notes || '-'}</td>
                        ${actionButtons}
                    `;
                    tbody.appendChild(row);
                });
            }
        }

        await renderMaintenanceWidgets(monthValue);
        await populateMaintenanceVehicleFilter();

    } catch (error) {
        console.error('Error loading maintenance records:', error.message);
    }
}
// 5. Render per-vehicle cost widgets
async function renderMaintenanceWidgets(monthValue) {
    try {
        if (!adminUserId) return; // Already waited in loadMaintenanceRecords
        
        // Fetch all maintenance records for all-time totals and filtering
        const { data, error } = await supabaseClient
            .from('lorry_maintenance')
            .select('vehicle_ref, amount, maintenance_date')
            .eq('user_id', getQueryUserId());

        if (error) throw error;
        if (!data) return;

        const labelMap = await getVehicleLabelMap();

        // Calculate period totals and all-time totals
        const totals = {};
        const allTimeTotals = {};

        // Date range boundaries for current month filter
        let startDateStr = null;
        let endDateStr = null;
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            startDateStr = startDate;
            endDateStr = endDate;
        }

        data.forEach(row => {
            const baseName = labelMap[row.vehicle_ref] || row.vehicle_ref;
            allTimeTotals[baseName] = (allTimeTotals[baseName] || 0) + row.amount;

            // Check if record is within the filtered month period
            if (row.maintenance_date && (!startDateStr || (row.maintenance_date >= startDateStr && row.maintenance_date <= endDateStr))) {
                totals[baseName] = (totals[baseName] || 0) + row.amount;
            }
        });

        const container = document.getElementById('maintenanceVehicleWidgets');
        if (!container) return;
        container.innerHTML = '';

        const allVehicles = Array.from(new Set([
            ...Object.keys(totals),
            ...Object.keys(allTimeTotals)
        ])).sort();

        if (allVehicles.length === 0) {
            container.innerHTML = '<p style="color:#7F8C8D;padding:10px;">No maintenance data available.</p>';
            return;
        }

        allVehicles.forEach(baseName => {
            const periodTotal = totals[baseName] || 0;
            const allTimeTotal = allTimeTotals[baseName] || 0;

            // Only show cards for vehicles that have either all-time cost or period cost
            if (allTimeTotal === 0) return;

            const card = document.createElement('div');
            card.className = 'metric-card';
            card.innerHTML = `
                <div class="metric-icon">🔧</div>
                <div class="metric-content">
                    <div class="metric-label">${baseName}</div>
                    <div class="metric-value" style="color:#E74C3C;font-size:16px;">
                        LKR ${periodTotal.toFixed(2)} 
                        <span style="font-size:12px;color:var(--text-muted);font-weight:normal;">(period)</span>
                    </div>
                    <div class="metric-value" style="color:var(--text-muted);font-size:12px;margin-top:2px;font-weight:normal;">
                        All-Time: <strong style="color:var(--text-primary);">LKR ${allTimeTotal.toFixed(2)}</strong>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // Overall total widget (for this period)
        const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
        const grandAllTimeTotal = Object.values(allTimeTotals).reduce((a, b) => a + b, 0);
        const totalCard = document.createElement('div');
        totalCard.className = 'metric-card';
        totalCard.style.borderLeft = '4px solid #8E44AD';
        totalCard.innerHTML = `
            <div class="metric-icon">💰</div>
            <div class="metric-content">
                <div class="metric-label">Total Maintenance (Period)</div>
                <div class="metric-value" style="color:#8E44AD;font-size:16px;">
                    LKR ${grandTotal.toFixed(2)}
                </div>
                <div class="metric-value" style="color:var(--text-muted);font-size:12px;margin-top:2px;font-weight:normal;">
                    All-Time Total: <strong style="color:var(--text-primary);">LKR ${grandAllTimeTotal.toFixed(2)}</strong>
                </div>
            </div>
        `;
        container.appendChild(totalCard);

    } catch (error) {
        console.error('Error rendering maintenance widgets:', error.message);
    }
}

// 6. Helper: build vehicle label map (hire + commitment)
async function getVehicleLabelMap() {
    const map = {};
    try {
        const [{ data: hireVehicles }, { data: commitmentVehicles }] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number').eq('user_id', getQueryUserId()),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number').eq('user_id', getQueryUserId())
        ]);
        hireVehicles?.forEach(v => { map[`hire_${v.id}`] = extractBaseVehicleName(v.lorry_number); });
        commitmentVehicles?.forEach(v => { map[`commitment_${v.id}`] = extractBaseVehicleName(v.vehicle_number); });
    } catch (e) { /* silent */ }
    return map;
}

// 7. Populate Vehicle Dropdown (form)
async function populateMaintenanceVehicleDropdown() {
    try {
        const select = document.getElementById('maintenanceVehicle');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">Select Vehicle</option>';

        const [{ data: hireVehicles }, { data: commitmentVehicles }] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number').eq('user_id', getQueryUserId()).eq('terminated', false),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number').eq('user_id', getQueryUserId()).eq('terminated', false)
        ]);

        const baseNames = new Set();
        if (hireVehicles) hireVehicles.forEach(v => baseNames.add(extractBaseVehicleName(v.lorry_number)));
        if (commitmentVehicles) commitmentVehicles.forEach(v => baseNames.add(extractBaseVehicleName(v.vehicle_number)));

        const sortedNames = Array.from(baseNames).sort();
        sortedNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });

        if (currentVal) select.value = currentVal;
    } catch (error) {
        console.error('Error populating vehicle dropdown:', error.message);
    }
}

// 8. Populate Vehicle Filter (filter bar)
async function populateMaintenanceVehicleFilter() {
    try {
        const filterSelect = document.getElementById('maintenanceVehicleFilter');
        if (!filterSelect) return;
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Vehicles</option>';

        const [{ data: hireVehicles }, { data: commitmentVehicles }] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number').eq('user_id', getQueryUserId()).eq('terminated', false),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number').eq('user_id', getQueryUserId()).eq('terminated', false)
        ]);

        const baseNames = new Set();
        if (hireVehicles) hireVehicles.forEach(v => baseNames.add(extractBaseVehicleName(v.lorry_number)));
        if (commitmentVehicles) commitmentVehicles.forEach(v => baseNames.add(extractBaseVehicleName(v.vehicle_number)));

        const sortedNames = Array.from(baseNames).sort();
        sortedNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            filterSelect.appendChild(opt);
        });

        filterSelect.value = currentVal;
    } catch (error) {
        console.error('Error populating maintenance filter:', error.message);
    }
}

// 9. Edit Record
async function editMaintenanceRecord(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient
            .from('lorry_maintenance')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;

        await populateMaintenanceVehicleDropdown();

        // Handle converting old reference back to base name for edit select dropdown
        const labelMap = await getVehicleLabelMap();
        document.getElementById('maintenanceId').value = data.id;
        document.getElementById('maintenanceVehicle').value = labelMap[data.vehicle_ref] || data.vehicle_ref;
        document.getElementById('maintenanceDate').value = data.maintenance_date;
        document.getElementById('maintenanceExpense').value = data.expense_type;
        document.getElementById('maintenanceAmount').value = data.amount;
        document.getElementById('maintenanceNotes').value = data.notes || '';

        document.getElementById('maintenanceFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading maintenance record: ' + error.message);
    }
}

// 10. Delete Record
async function deleteMaintenanceRecord(id) {
    if (!checkAdminAccess('delete')) return;
    if (confirm('Are you sure you want to delete this maintenance record?')) {
        try {
            await supabaseClient.from('lorry_maintenance').delete().eq('id', id);
            loadMaintenanceRecords();
        } catch (error) {
            alert('Error deleting record: ' + error.message);
        }
    }
}

// ============================================================
//  CHEQUE STATUS MODULE
// ============================================================

// Sri Lankan bank → fallback emoji
const BANK_EMOJI_MAP = {
    'Bank of Ceylon (BOC)':       '🏗️',
    "People's Bank":              '🏗️',
    'Hatton National Bank (HNB)': '🏦',
    'Commercial Bank of Ceylon':  '🏦',
    'Sampath Bank':               '💼',
    'Seylan Bank':                '💳',
    'Nations Trust Bank (NTB)':   '🔷',
    'DFCC Bank':                  '🏗️',
    'Pan Asia Bank':              '🌏',
    'Union Bank':                 '🤝',
};

// Sri Lankan bank → logo image URL
const BANK_LOGO_MAP = {
    'Bank of Ceylon (BOC)':       'https://i.postimg.cc/hPHVZvDK/bank-of-ceylon-seeklogo.png',
    "People's Bank":              'https://i.postimg.cc/TPywzqCZ/peoples-bank-seeklogo.png',
    'Hatton National Bank (HNB)': 'https://i.postimg.cc/Qt1MtNLf/id-EGb-VVT5z.png',
    'Commercial Bank of Ceylon':  'https://i.postimg.cc/fy3kN7zN/com-bank.png',
    'Sampath Bank':               'https://i.postimg.cc/jq65Yj4Y/Sampath-Bank-id-Er-NN75DC-1.png',
    'Seylan Bank':                'https://i.postimg.cc/xTzqpPp4/seylan.png',
    'Nations Trust Bank (NTB)':   'https://i.postimg.cc/MZcyxVrd/tile-NTB.png',
    'DFCC Bank':                  'https://i.postimg.cc/pLrXjJbz/DFCC-id6b-UJt-WD6-0.png',
    'Pan Asia Bank':              'https://i.postimg.cc/13dRrVsW/500px-PAN-ASIA-BANK-LOGO-The-Truly-Sri-Lankan-ank.jpg',
    'Union Bank':                 'https://i.postimg.cc/KYgGqcYX/Union-Bank-of-Colombo-id-Yqg-Xh2uk-0.png',
};

// Flat items array used by the bank logo picker (static, all banks)
const BANK_ITEMS = Object.keys(BANK_EMOJI_MAP).map(name => ({
    value:   name,
    label:   name,
    logoUrl: BANK_LOGO_MAP[name] || null,
    emoji:   BANK_EMOJI_MAP[name] || '🏦',
}));

const CHEQUE_STATUS_META = {
    not_issued: { label: 'Not Issued', color: '#8A92A3', bg: 'rgba(138,146,163,0.12)', icon: '⚫' },
    issued:     { label: 'Issued',     color: '#E07B00', bg: 'rgba(224,123,0,0.12)',    icon: '🟠' },
    paid:       { label: 'Paid',       color: '#00B37E', bg: 'rgba(0,179,126,0.12)',    icon: '🟢' },
    stopped:    { label: 'Stopped',    color: '#0072CE', bg: 'rgba(0,114,206,0.12)',    icon: '🔵' },
    returned:   { label: 'Returned',   color: '#D1001F', bg: 'rgba(209,0,31,0.12)',     icon: '🔴' },
};

// ============================================================
//  LOGO DROPDOWN ENGINE
// ============================================================
const _lddRegistry = {};

function _lddIconHtml(item, size) {
    const sz = size || 32;
    if (item.logoUrl) {
        return `<div class="ldd-logo-wrap" style="width:${sz}px;height:${sz}px;"><img src="${item.logoUrl}" alt="" class="ldd-logo-img" loading="lazy"></div>`;
    }
    return `<div class="ldd-emoji-wrap" style="width:${sz}px;height:${sz}px;">${item.emoji || '🏦'}</div>`;
}

function buildLogoDropdown(containerId, hiddenId, items, placeholder, onChange) {
    const container = document.getElementById(containerId);
    const hidden    = document.getElementById(hiddenId);
    if (!container || !hidden) return;

    const currentVal = hidden.value || '';
    _lddRegistry[containerId] = { hiddenId, placeholder: placeholder || 'Select…', onChange, items };

    const hasSearch = items.length > 5;
    container.innerHTML = `
        <input type="hidden" id="${hiddenId}" value="${currentVal}">
        <div class="ldd-trigger" id="${containerId}_trigger" tabindex="0">
            <div class="ldd-selected-content" id="${containerId}_sel">
                <span class="ldd-placeholder">${placeholder || 'Select…'}</span>
            </div>
            <svg class="ldd-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
            </svg>
        </div>
        <div class="ldd-dropdown" id="${containerId}_drop">
            ${hasSearch ? `<div class="ldd-search-wrap"><input class="ldd-search" id="${containerId}_srch" type="text" placeholder="Search bank…" autocomplete="off"></div>` : ''}
            <div class="ldd-list" id="${containerId}_list">
                ${items.map(it => `
                    <div class="ldd-item" data-value="${it.value}" data-label="${it.label}" data-logo="${it.logoUrl || ''}" data-emoji="${it.emoji || ''}"
                        role="option" tabindex="-1">
                        ${_lddIconHtml(it, 30)}
                        <span class="ldd-item-name">${it.label}</span>
                    </div>`).join('')}
            </div>
        </div>
    `;

    const trigger  = document.getElementById(`${containerId}_trigger`);
    const dropdown = document.getElementById(`${containerId}_drop`);
    const selEl    = document.getElementById(`${containerId}_sel`);
    const list     = document.getElementById(`${containerId}_list`);
    const search   = document.getElementById(`${containerId}_srch`);

    // Open / close
    trigger.addEventListener('click', e => {
        e.stopPropagation();
        const open = dropdown.classList.contains('ldd-open');
        _lddCloseAll();
        if (!open) {
            dropdown.classList.add('ldd-open');
            trigger.classList.add('ldd-active');
            search && setTimeout(() => search.focus(), 60);
        }
    });

    // Prevent clicks inside the dropdown from bubbling to document (closing it)
    dropdown.addEventListener('click', e => {
        e.stopPropagation();
    });

    // Search filter
    if (search) {
        search.addEventListener('input', () => {
            const q = search.value.toLowerCase();
            list.querySelectorAll('.ldd-item').forEach(el => {
                el.style.display = el.dataset.label.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    }

    // Item click
    list.addEventListener('click', e => {
        const item = e.target.closest('.ldd-item');
        if (!item) return;
        _lddSelect(containerId, item.dataset.value);
        _lddCloseAll();
    });

    // Keyboard
    trigger.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
        if (e.key === 'Escape') _lddCloseAll();
    });

    // Restore pre-existing value
    if (currentVal) _lddSelect(containerId, currentVal, true);
}

function _lddSelect(containerId, value, silent) {
    const reg     = _lddRegistry[containerId];
    if (!reg) return;
    const hidden  = document.getElementById(reg.hiddenId);
    const selEl   = document.getElementById(`${containerId}_sel`);
    const list    = document.getElementById(`${containerId}_list`);
    if (!hidden || !selEl || !list) return;

    hidden.value = value;
    list.querySelectorAll('.ldd-item').forEach(el => el.classList.toggle('ldd-item-active', el.dataset.value === value));

    if (!value) {
        selEl.innerHTML = `<span class="ldd-placeholder">${reg.placeholder}</span>`;
    } else {
        const item = list.querySelector(`.ldd-item[data-value="${value}"]`);
        if (item) {
            const logo  = item.dataset.logo;
            const emoji = item.dataset.emoji;
            const label = item.dataset.label;
            const iconHtml = logo
                ? `<div class="ldd-logo-wrap ldd-sel-logo"><img src="${logo}" alt="" class="ldd-logo-img"></div>`
                : `<div class="ldd-emoji-wrap ldd-sel-emoji">${emoji || '🏦'}</div>`;
            selEl.innerHTML = `${iconHtml}<span class="ldd-sel-name">${label}</span>`;
        }
    }
    if (!silent && reg.onChange) reg.onChange(value);
}

function setLogoDropdownValue(containerId, value) {
    _lddCloseAll();
    _lddSelect(containerId, value, true); // silent — no onChange
}

function _lddCloseAll() {
    document.querySelectorAll('.ldd-dropdown.ldd-open').forEach(d => d.classList.remove('ldd-open'));
    document.querySelectorAll('.ldd-trigger.ldd-active').forEach(t => t.classList.remove('ldd-active'));
}

// Global outside-click (attached once)
if (!window._lddGlobalClickAttached) {
    window._lddGlobalClickAttached = true;
    document.addEventListener('click', _lddCloseAll);
}

async function loadChequeStatus() {
    initChequeBookForm();
    await loadChequeBooks();
    initChequeLeafSelectHandlers();
}

// ---- Init: Add Cheque Book form ----
function initChequeBookForm() {
    const toggleBtn     = document.getElementById('toggleAddBookFormBtn');
    const formContainer = document.getElementById('addBookFormContainer');
    const cancelBtn     = document.getElementById('cancelAddBookBtn');

    // Always rebuild the bank logo picker (harmless to rebuild)
    buildLogoDropdown('bankCustomSelect', 'chequeBank', BANK_ITEMS, '🏦 Select Bank', null);

    if (toggleBtn && !toggleBtn._csInited) {
        toggleBtn._csInited = true;
        toggleBtn.addEventListener('click', () => {
            formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
        });
        cancelBtn.addEventListener('click', () => {
            formContainer.style.display = 'none';
            document.getElementById('addChequeBookForm').reset();
            setLogoDropdownValue('bankCustomSelect', ''); // reset picker
        });

        document.getElementById('addChequeBookForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!checkAdminAccess('add')) return;
            await saveChequeBook();
        });
    }
}

// ---- Save a new cheque book + bulk insert leaves ----
async function saveChequeBook() {
    const bankName = document.getElementById('chequeBank').value.trim();
    const leafFrom = parseInt(document.getElementById('chequeLeafFrom').value);
    const leafTo   = parseInt(document.getElementById('chequeLeafTo').value);

    if (!bankName) { alert('Please select a bank.'); return; }
    if (isNaN(leafFrom) || isNaN(leafTo) || leafFrom < 1 || leafTo < leafFrom) {
        alert('Please enter valid leaf numbers (From must be ≤ To).'); return;
    }
    const leafCount = leafTo - leafFrom + 1;
    if (leafCount > 500) { alert('Maximum 500 leaves per book.'); return; }

    const submitBtn = document.querySelector('#addChequeBookForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const uid = getQueryUserId();

        // Insert cheque book
        const { data: book, error: bookErr } = await supabaseClient
            .from('cheque_books')
            .insert([{ user_id: uid, bank_name: bankName, leaf_from: leafFrom, leaf_to: leafTo }])
            .select()
            .single();
        if (bookErr) throw bookErr;

        // Bulk insert leaves
        const leaves = [];
        for (let n = leafFrom; n <= leafTo; n++) {
            leaves.push({ user_id: uid, book_id: book.id, leaf_number: n, status: 'not_issued' });
        }
        const { error: leavesErr } = await supabaseClient.from('cheque_leaves').insert(leaves);
        if (leavesErr) throw leavesErr;

        document.getElementById('addChequeBookForm').reset();
        document.getElementById('addBookFormContainer').style.display = 'none';
        showChequeToast(`✅ Cheque book added! ${leafCount} leaves created.`);
        await loadChequeBooks();
        if (typeof loadNotifications === 'function') loadNotifications();
    } catch (err) {
        console.error('Error saving cheque book:', err);
        alert('Failed to save cheque book: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Add Cheque Book';
    }
}

// ---- Load all cheque books, render cards & populate leaf selector ----
async function loadChequeBooks() {
    const uid = getQueryUserId();
    const grid = document.getElementById('chequeBooksGrid');
    const bookSelect = document.getElementById('chequeBookSelect');

    try {
        const { data: books, error } = await supabaseClient
            .from('cheque_books')
            .select('*, cheque_leaves(status)')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });
        if (error) throw error;

        // ── Render book cards ──
        grid.innerHTML = '';
        if (!books || books.length === 0) {
            grid.innerHTML = '<div class="cheque-no-books">No cheque books added yet. Click <strong>+ Add Cheque Book</strong> to get started.</div>';
        } else {
            books.forEach(book => {
                const leaves = book.cheque_leaves || [];
                const counts = { paid: 0, stopped: 0, returned: 0, not_issued: 0, issued: 0 };
                leaves.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
                const total = leaves.length;
                const emoji   = BANK_EMOJI_MAP[book.bank_name] || '🏦';
                const logoUrl = BANK_LOGO_MAP[book.bank_name] || null;

                // Build the icon block — real logo if available, emoji fallback otherwise
                const iconHtml = logoUrl
                    ? `<div class="cheque-book-logo-wrap"><img src="${logoUrl}" alt="${book.bank_name} logo" class="cheque-bank-logo" style="max-height:30px;width:auto;"></div>`
                    : `<span class="cheque-book-emoji">${emoji}</span>`;

                const card = document.createElement('div');
                card.className = 'cheque-book-card';
                card.innerHTML = `
                    <div class="cheque-book-card-top">
                        <div class="cheque-book-bank">
                            ${iconHtml}
                            <div>
                                <div class="cheque-book-bank-name">${book.bank_name}</div>
                                <div class="cheque-book-range">Leaves #${book.leaf_from} – #${book.leaf_to} &nbsp;·&nbsp; ${total} total</div>
                            </div>
                        </div>
                        <button class="cheque-book-delete-btn" title="Delete Book" onclick="deleteChequeBook('${book.id}')">🗑️</button>
                    </div>
                    <div class="cheque-book-pills">
                        <span class="cheque-pill cheque-pill-paid">✅ ${counts.paid} Paid</span>
                        <span class="cheque-pill cheque-pill-issued">🟠 ${counts.issued} Issued</span>
                        <span class="cheque-pill cheque-pill-stopped">🔵 ${counts.stopped} Stopped</span>
                        <span class="cheque-pill cheque-pill-returned">🔴 ${counts.returned} Returned</span>
                        <span class="cheque-pill cheque-pill-notissued">⚫ ${counts.not_issued} Not Issued</span>
                    </div>
                    <button class="cheque-book-view-btn" onclick="selectChequeBook('${book.id}')">
                        📋 View Leaves
                    </button>
                `;
                grid.appendChild(card);
            });
        }

        // ── Populate book logo-dropdown in leaves section ──
        const prevBookId = document.getElementById('chequeBookSelect').value;
        const bookItems = (books || []).map(book => ({
            value:   book.id,
            label:   `${book.bank_name}  ( ${book.leaf_from}–${book.leaf_to} )`,
            logoUrl: BANK_LOGO_MAP[book.bank_name] || null,
            emoji:   BANK_EMOJI_MAP[book.bank_name] || '🏦',
        }));
        buildLogoDropdown('bookCustomSelect', 'chequeBookSelect', bookItems,
            '— Select a Cheque Book —',
            (bookId) => {
                document.getElementById('chequeLeafEditContainer').style.display = 'none';
                if (bookId) loadChequeLeaves(bookId);
                else {
                    document.getElementById('chequeLeavesTable').style.display = 'none';
                    document.getElementById('chequeLeavesEmpty').style.display = 'flex';
                }
            }
        );
        if (prevBookId) setLogoDropdownValue('bookCustomSelect', prevBookId);

        // ── Update global summary strip ──
        await updateChequeSummaryStrip(uid);

    } catch (err) {
        console.error('Error loading cheque books:', err);
        grid.innerHTML = '<div class="cheque-no-books" style="color:var(--brand-red);">Error loading cheque books.</div>';
    }
}

// ---- Summary strip counts & amount metrics (all books) ----
async function updateChequeSummaryStrip(uid) {
    try {
        const { data, error } = await supabaseClient
            .from('cheque_leaves')
            .select('status, amount')
            .eq('user_id', uid);
        if (error) throw error;

        const total     = data.length;
        const paid      = data.filter(l => l.status === 'paid').length;
        const issued    = data.filter(l => l.status === 'issued').length;
        const stopped   = data.filter(l => l.status === 'stopped').length;
        const returned  = data.filter(l => l.status === 'returned').length;
        const notIssued = data.filter(l => l.status === 'not_issued').length;

        document.getElementById('csTotal').textContent    = total;
        document.getElementById('csPaid').textContent     = paid;
        document.getElementById('csIssued').textContent   = issued;
        document.getElementById('csStopped').textContent  = stopped;
        document.getElementById('csReturned').textContent = returned;
        document.getElementById('csNotIssued').textContent= notIssued;

        // Financial sum calculations
        const paidAmt     = data.filter(l => l.status === 'paid').reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
        const stoppedAmt  = data.filter(l => l.status === 'stopped').reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
        const returnedAmt = data.filter(l => l.status === 'returned').reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

        const formatLKR = val => 'LKR ' + val.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        document.getElementById('amtPaid').textContent     = formatLKR(paidAmt);
        document.getElementById('amtStopped').textContent  = formatLKR(stoppedAmt);
        document.getElementById('amtReturned').textContent = formatLKR(returnedAmt);
    } catch (err) {
        console.error('Error updating cheque summary strip:', err);
    }
}

// ---- Quick-select a book from its card's "View Leaves" button ----
function selectChequeBook(bookId) {
    setLogoDropdownValue('bookCustomSelect', bookId);
    document.getElementById('chequeBookSelect').value = bookId; // keep hidden in sync
    loadChequeLeaves(bookId);
    document.getElementById('chequeLeafEditContainer').style.display = 'none';
    document.querySelector('.cheque-panel:last-of-type')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Init status-filter + edit form handlers (book selector now handled by ldd onChange) ----
function initChequeLeafSelectHandlers() {
    const statusFilter = document.getElementById('chequeStatusFilter');
    if (statusFilter && !statusFilter._csInited) {
        statusFilter._csInited = true;
        statusFilter.addEventListener('change', () => {
            const bookId = document.getElementById('chequeBookSelect').value;
            if (bookId) loadChequeLeaves(bookId);
        });
    }

    // Cancel edit button
    const cancelEditBtn = document.getElementById('cancelLeafEditBtn');
    if (cancelEditBtn && !cancelEditBtn._csInited) {
        cancelEditBtn._csInited = true;
        cancelEditBtn.addEventListener('click', () => {
            document.getElementById('chequeLeafEditContainer').style.display = 'none';
            document.getElementById('chequeLeafEditForm').reset();
        });
    }

    // Edit form submit
    const editForm = document.getElementById('chequeLeafEditForm');
    if (editForm && !editForm._csInited) {
        editForm._csInited = true;
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!checkAdminAccess('edit')) return;
            await saveChequeLeaf();
        });
    }
}

// ---- Load leaves for a specific book ----
async function loadChequeLeaves(bookId) {
    const uid          = getQueryUserId();
    const statusFilter = document.getElementById('chequeStatusFilter').value;
    const tbody        = document.getElementById('chequeLeavesBody');
    const table        = document.getElementById('chequeLeavesTable');
    const emptyState   = document.getElementById('chequeLeavesEmpty');

    emptyState.style.display = 'none';
    table.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">Loading…</td></tr>';
    table.style.display = 'table';

    try {
        let query = supabaseClient
            .from('cheque_leaves')
            .select('*')
            .eq('user_id', uid)
            .eq('book_id', bookId)
            .order('leaf_number', { ascending: true });

        if (statusFilter) query = query.eq('status', statusFilter);

        const { data: leaves, error } = await query;
        if (error) throw error;

        tbody.innerHTML = '';

        if (!leaves || leaves.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">No leaves match the selected filter.</td></tr>';
            return;
        }

        leaves.forEach(leaf => {
            const meta = CHEQUE_STATUS_META[leaf.status] || CHEQUE_STATUS_META.not_issued;
            const tr = document.createElement('tr');
            tr.className = `cheque-leaf-row cheque-row-${leaf.status}`;
            tr.innerHTML = `
                <td><strong class="cheque-leaf-num">#${leaf.leaf_number}</strong></td>
                <td>${leaf.cheque_date ? new Date(leaf.cheque_date + 'T00:00:00').toLocaleDateString('en-GB') : '<span class="text-muted">—</span>'}</td>
                <td>${leaf.amount != null ? 'LKR ' + Number(leaf.amount).toLocaleString('en-LK', {minimumFractionDigits:2}) : '<span class="text-muted">—</span>'}</td>
                <td>${leaf.payee || '<span class="text-muted">—</span>'}</td>
                <td>${leaf.notes || '<span class="text-muted">—</span>'}</td>
                <td>
                    <span class="cheque-status-badge" style="background:${meta.bg};color:${meta.color};border-color:${meta.color}20;">
                        ${meta.icon} ${meta.label}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editChequeLeaf('${leaf.id}')">✏️ Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Error loading cheque leaves:', err);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--brand-red);padding:20px;">Error: ${err.message}</td></tr>`;
    }
}

// ---- Open inline edit form for a leaf ----
async function editChequeLeaf(leafId) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data: leaf, error } = await supabaseClient
            .from('cheque_leaves')
            .select('*')
            .eq('id', leafId)
            .single();
        if (error) throw error;

        document.getElementById('editLeafId').value          = leaf.id;
        document.getElementById('editLeafNumberDisplay').textContent = leaf.leaf_number;
        document.getElementById('editChequeDate').value      = leaf.cheque_date || '';
        document.getElementById('editChequeAmount').value    = leaf.amount != null ? leaf.amount : '';
        document.getElementById('editChequePayee').value     = leaf.payee || '';
        document.getElementById('editChequeStatus').value    = leaf.status || 'not_issued';
        document.getElementById('editChequeNotes').value     = leaf.notes || '';

        const container = document.getElementById('chequeLeafEditContainer');
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        alert('Error loading leaf: ' + err.message);
    }
}

// ---- Save changes to a cheque leaf ----
async function saveChequeLeaf() {
    const id      = document.getElementById('editLeafId').value;
    const updates = {
        cheque_date: document.getElementById('editChequeDate').value || null,
        amount:      document.getElementById('editChequeAmount').value !== '' ? parseFloat(document.getElementById('editChequeAmount').value) : null,
        payee:       document.getElementById('editChequePayee').value.trim() || null,
        status:      document.getElementById('editChequeStatus').value,
        notes:       document.getElementById('editChequeNotes').value.trim() || null,
    };

    const submitBtn = document.querySelector('#chequeLeafEditForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
        const { error } = await supabaseClient
            .from('cheque_leaves')
            .update(updates)
            .eq('id', id);
        if (error) throw error;

        document.getElementById('chequeLeafEditContainer').style.display = 'none';
        document.getElementById('chequeLeafEditForm').reset();
        showChequeToast('✅ Cheque leaf updated!');

        const bookId = document.getElementById('chequeBookSelect').value;
        await loadChequeLeaves(bookId);
        await loadChequeBooks(); // refresh cards + summary
        if (typeof loadNotifications === 'function') loadNotifications();
    } catch (err) {
        alert('Error saving leaf: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Save Changes';
    }
}

// ---- Delete a cheque book (and all its leaves via cascade) ----
async function deleteChequeBook(bookId) {
    if (!checkAdminAccess('delete')) return;
    if (!confirm('Delete this cheque book and ALL its leaves? This cannot be undone.')) return;
    try {
        const { error } = await supabaseClient.from('cheque_books').delete().eq('id', bookId);
        if (error) throw error;

        // If deleted book was selected in leaves section, reset
        const bookHidden = document.getElementById('chequeBookSelect');
        if (bookHidden.value === bookId) {
            setLogoDropdownValue('bookCustomSelect', '');
            document.getElementById('chequeLeavesTable').style.display = 'none';
            document.getElementById('chequeLeavesEmpty').style.display = 'flex';
            document.getElementById('chequeLeafEditContainer').style.display = 'none';
        }
        showChequeToast('🗑️ Cheque book deleted.');
        await loadChequeBooks();
        if (typeof loadNotifications === 'function') loadNotifications();
    } catch (err) {
        alert('Error deleting cheque book: ' + err.message);
    }
}

// ---- Toast notification ----
function showChequeToast(msg) {
    const existing = document.getElementById('chequeToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'chequeToast';
    toast.className = 'cheque-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('cheque-toast-show'), 10);
    setTimeout(() => {
        toast.classList.remove('cheque-toast-show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ============ UNIFIED NOTIFICATION CENTER ============

// Keep track of active alerts in memory
let activeAlerts = [];

function initNotificationCenter() {
    const bellBtn = document.getElementById('notificationBellBtn');
    const dropdown = document.getElementById('notificationDropdown');
    const clearBtn = document.getElementById('clearNotificationsBtn');

    if (!bellBtn || !dropdown) return;

    // Toggle dropdown
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = dropdown.style.display === 'none';
        dropdown.style.display = show ? 'block' : 'none';
        if (show) {
            loadNotifications();
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        const center = document.getElementById('notificationCenter');
        if (dropdown.style.display === 'block' && center && !center.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    // Clear all / dismiss all active alerts
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dismissed = JSON.parse(localStorage.getItem('jtms_dismissed_alerts') || '[]');
            activeAlerts.forEach(alert => {
                if (!dismissed.includes(alert.id)) {
                    dismissed.push(alert.id);
                }
            });
            localStorage.setItem('jtms_dismissed_alerts', JSON.stringify(dismissed));
            loadNotifications();
            dropdown.style.display = 'none';
        });
    }

    // Initial load of alerts count
    loadNotifications();
}

async function loadNotifications() {
    const badge = document.getElementById('notificationBadge');
    const list = document.getElementById('notificationList');
    if (!badge || !list) return;

    const userId = getQueryUserId();
    if (!userId) return;

    try {
        // Fetch background vehicles once for service tracking calculations
        const [{ data: hireV }, { data: commV }] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, vector_art_url').eq('user_id', userId),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number, vector_art_url').eq('user_id', userId)
        ]);

        const allHireVehicles = hireV || [];
        const allCommVehicles = commV || [];

        // Concurrently run alert fetches
        const [chequeAlerts, serviceAlerts, advanceAlerts] = await Promise.all([
            fetchChequeAlerts(userId),
            fetchServiceAlerts(userId, allHireVehicles, allCommVehicles),
            fetchAdvanceAlerts(userId)
        ]);

        const allAlerts = [...chequeAlerts, ...serviceAlerts, ...advanceAlerts];
        
        // Filter out dismissed alerts from localStorage
        const dismissedIds = JSON.parse(localStorage.getItem('jtms_dismissed_alerts') || '[]');
        activeAlerts = allAlerts.filter(alert => !dismissedIds.includes(alert.id));

        // Update badge count
        if (activeAlerts.length > 0) {
            badge.textContent = activeAlerts.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        // Render notifications list
        list.innerHTML = '';
        if (activeAlerts.length === 0) {
            list.innerHTML = '<div class="notification-empty">No active notifications</div>';
            return;
        }

        activeAlerts.forEach(alert => {
            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-item-icon">${alert.icon}</div>
                <div class="notification-item-content">
                    <div class="notification-item-title">${alert.title}</div>
                    <div class="notification-item-desc">${alert.desc}</div>
                    <span class="notification-item-time">${alert.date ? 'Target Date: ' + alert.date : ''}</span>
                </div>
                <button class="remove-tracker-btn" style="padding: 2px 5px; font-size: 10px; margin-left: 8px; border:none; background:none; cursor:pointer;" title="Dismiss alert">✖</button>
            `;

            // Click listener for navigation
            item.addEventListener('click', (e) => {
                // If clicked dismiss button, ignore navigation
                if (e.target.tagName === 'BUTTON' || e.target.classList.contains('remove-tracker-btn')) return;
                
                // Hide dropdown
                document.getElementById('notificationDropdown').style.display = 'none';
                
                // Handle navigation shortcuts
                if (alert.type === 'cheque') {
                    currentPage = 'cheque-status';
                    setActiveNavItem('cheque-status');
                    switchPage('cheque-status');
                    setTimeout(() => {
                        if (alert.bookId) {
                            selectChequeBook(alert.bookId);
                        }
                        document.getElementById('chequeLeavesTable')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 200);
                } else if (alert.type === 'service') {
                    currentPage = 'dashboard';
                    setActiveNavItem('dashboard');
                    switchPage('dashboard');
                    setTimeout(() => {
                        document.getElementById('trackedVehiclesGrid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 200);
                } else if (alert.type === 'advance') {
                    currentPage = 'driver-advances';
                    setActiveNavItem('driver-advances');
                    switchPage('driver-advances');
                    setTimeout(() => {
                        const filterSelect = document.getElementById('advanceDriverFilter');
                        if (filterSelect) {
                            filterSelect.value = alert.driverId;
                            filterSelect.dispatchEvent(new Event('change'));
                        }
                        document.getElementById('advancesTable')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 200);
                }
            });

            // Individual dismiss click handler
            const dismissBtn = item.querySelector('button');
            dismissBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dismissed = JSON.parse(localStorage.getItem('jtms_dismissed_alerts') || '[]');
                if (!dismissed.includes(alert.id)) {
                    dismissed.push(alert.id);
                }
                localStorage.setItem('jtms_dismissed_alerts', JSON.stringify(dismissed));
                loadNotifications();
            });

            list.appendChild(item);
        });
    } catch (err) {
        console.error('Error loading notifications:', err);
    }
}

async function fetchChequeAlerts(userId) {
    try {
        const [{ data: books }, { data: leaves }] = await Promise.all([
            supabaseClient.from('cheque_books').select('id, bank_name').eq('user_id', userId),
            supabaseClient.from('cheque_leaves').select('*').eq('user_id', userId).in('status', ['returned', 'issued'])
        ]);

        const alerts = [];
        if (!leaves || !books) return alerts;

        leaves.forEach(leaf => {
            const book = books.find(b => b.id === leaf.book_id);
            const bankName = book ? book.bank_name : 'Cheque Book';
            const amountStr = leaf.amount != null ? 'LKR ' + leaf.amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'LKR 0.00';
            const payeeName = leaf.payee ? leaf.payee : 'Unknown Payee';

            if (leaf.status === 'returned') {
                alerts.push({
                    id: `cheque_returned_${leaf.id}`,
                    title: `⚠️ Bounced Cheque: ${bankName}`,
                    desc: `Cheque #${leaf.leaf_number} for ${amountStr} to ${payeeName} is returned.`,
                    icon: `⚠️`,
                    type: 'cheque',
                    bookId: leaf.book_id,
                    date: leaf.cheque_date || ''
                });
            } else if (leaf.status === 'issued' && leaf.cheque_date) {
                const date = new Date(leaf.cheque_date);
                const today = new Date();
                today.setHours(0,0,0,0);
                
                // Calculate days remaining
                const diffTime = date - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 7) {
                    let descText = `Cheque #${leaf.leaf_number} for ${amountStr} to ${payeeName} matures in ${diffDays} days.`;
                    if (diffDays < 0) {
                        descText = `Cheque #${leaf.leaf_number} for ${amountStr} to ${payeeName} is overdue (matured on ${leaf.cheque_date}).`;
                    } else if (diffDays === 0) {
                        descText = `Cheque #${leaf.leaf_number} for ${amountStr} to ${payeeName} matures today!`;
                    }
                    
                    alerts.push({
                        id: `cheque_due_${leaf.id}`,
                        title: `🏦 Cheque Due: ${bankName}`,
                        desc: descText,
                        icon: `📅`,
                        type: 'cheque',
                        bookId: leaf.book_id,
                        date: leaf.cheque_date
                    });
                }
            }
        });

        return alerts;
    } catch (e) {
        console.error('Error fetching cheque alerts:', e);
        return [];
    }
}

async function fetchServiceAlerts(userId, allHireVehicles, allCommVehicles) {
    try {
        const { data: trackers, error } = await supabaseClient
            .from('service_trackers')
            .select('*')
            .eq('user_id', userId);
        
        if (error) throw error;
        if (!trackers || trackers.length === 0) return [];
        
        const alertPromises = trackers.map(async (tracker) => {
            const targetHireIds = allHireVehicles
                .filter(v => (v.lorry_number || '').toUpperCase().startsWith(tracker.base_name))
                .map(v => v.id);
                
            const targetCommIds = allCommVehicles
                .filter(v => (v.vehicle_number || '').toUpperCase().startsWith(tracker.base_name))
                .map(v => v.id);
                
            let totalKm = 0;
            const queries = [];
            
            if (targetHireIds.length > 0) {
                queries.push(
                    supabaseClient
                        .from('hire_to_pay_records')
                        .select('distance')
                        .in('vehicle_id', targetHireIds)
                        .gte('hire_date', tracker.service_date)
                        .then(res => res.data || [])
                        .catch(err => { console.error("Error fetching hire_to_pay_records for notification:", err); return []; })
                );
            } else {
                queries.push(Promise.resolve([]));
            }
            
            if (targetCommIds.length > 0) {
                queries.push(
                    supabaseClient
                        .from('commitment_records')
                        .select('distance')
                        .in('vehicle_id', targetCommIds)
                        .gte('hire_date', tracker.service_date)
                        .then(res => res.data || [])
                        .catch(err => { console.error("Error fetching commitment_records for notification:", err); return []; })
                );
            } else {
                queries.push(Promise.resolve([]));
            }
            
            queries.push(
                supabaseClient
                    .from('other_operation_hires')
                    .select('distance')
                    .eq('base_lorry_number', tracker.base_name)
                    .gte('hire_date', tracker.service_date)
                    .then(res => res.data || [])
                    .catch(err => { console.error("Error fetching other_operation_hires for notification:", err); return []; })
            );
            
            const [hireRecords, commRecords, otherOpHires] = await Promise.all(queries);
            
            totalKm += hireRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
            totalKm += commRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
            totalKm += otherOpHires.reduce((sum, r) => sum + (r.distance || 0), 0);
            
            const target = tracker.target_kms || 5000;
            if (totalKm >= target) {
                return {
                    id: `service_${tracker.base_name}_${tracker.service_date}`,
                    title: `🚨 Service Overdue: ${tracker.base_name}`,
                    desc: `Driven ${totalKm.toLocaleString()} KM since service on ${tracker.service_date} (Limit: ${target.toLocaleString()} KM).`,
                    icon: `🔧`,
                    type: 'service',
                    date: tracker.service_date
                };
            }
            return null;
        });
        
        const results = await Promise.all(alertPromises);
        return results.filter(a => a !== null);
    } catch (e) {
        console.error('Error fetching service alerts:', e);
        return [];
    }
}

async function fetchAdvanceAlerts(userId) {
    try {
        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id, name, basic_salary, salary_type')
            .eq('user_id', userId)
            .neq('terminated', true);

        if (!drivers || drivers.length === 0) return [];

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;

        const { data: advances } = await supabaseClient
            .from('driver_advances')
            .select('driver_id, amount')
            .eq('user_id', userId)
            .gte('advance_date', startDate)
            .lte('advance_date', endDate);

        const advanceMap = {};
        advances?.forEach(adv => {
            const dId = adv.driver_id;
            advanceMap[dId] = (advanceMap[dId] || 0) + (adv.amount || 0);
        });

        const alerts = [];
        drivers.forEach(driver => {
            const totalAdv = advanceMap[driver.id] || 0;
            let threshold = 25000;
            if (driver.salary_type === 'fixed' && driver.basic_salary) {
                threshold = driver.basic_salary * 0.5;
            }

            if (totalAdv > threshold) {
                const totalAdvStr = 'LKR ' + totalAdv.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const thresholdStr = 'LKR ' + threshold.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                alerts.push({
                    id: `advance_${driver.id}_${year}_${month}`,
                    title: `💸 High Advance: ${driver.name}`,
                    desc: `Accumulated ${totalAdvStr} in advances this month, exceeding 50% basic limit (${thresholdStr}).`,
                    icon: `💵`,
                    type: 'advance',
                    driverId: driver.id,
                    date: startDate
                });
            }
        });

        return alerts;
    } catch (e) {
        console.error('Error fetching advance alerts:', e);
        return [];
    }
}

// ============ DRIVER KM TRACKER & PROJECTED SALARY WIDGET ============

function initDriverKmLog() {
    // Add KM Record button (toggles form)
    document.getElementById('addDriverKmBtn')?.addEventListener('click', () => {
        if (!checkAdminAccess('add')) return;
        const container = document.getElementById('driverKmFormContainer');
        if (container) {
            if (container.style.display === 'none') {
                showDriverKmForm();
            } else {
                hideDriverKmForm();
            }
        }
    });

    // Form submit
    document.getElementById('driverKmForm')?.addEventListener('submit', saveDriverKmRecord);

    // Cancel form
    document.getElementById('cancelDriverKmBtn')?.addEventListener('click', hideDriverKmForm);

    // Filter changes
    document.getElementById('driverKmMonthFilter')?.addEventListener('change', () => {
        loadDriverKmRecords();
        updateKmSalaryWidget();
    });

    document.getElementById('driverKmDriverFilter')?.addEventListener('change', () => {
        loadDriverKmRecords();
        updateKmSalaryWidget();
    });
}

async function updateDriverKmSelectors() {
    try {
        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id, name, role')
            .eq('user_id', getQueryUserId())
            .neq('terminated', true)
            .order('name');

        const driversOnly = drivers?.filter(d => (d.role || '').toLowerCase() === 'driver') || [];

        const formSelect = document.getElementById('driverKmDriverSelect');
        const filterSelect = document.getElementById('driverKmDriverFilter');

        if (formSelect) {
            const currentVal = formSelect.value;
            formSelect.innerHTML = '<option value="">Select Driver</option>';
            driversOnly.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.name;
                formSelect.appendChild(opt);
            });
            if (currentVal) formSelect.value = currentVal;
        }

        if (filterSelect) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="">Select a Driver</option>';
            driversOnly.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.name;
                filterSelect.appendChild(opt);
            });
            if (currentVal) filterSelect.value = currentVal;
        }
    } catch (err) {
        console.error('Error updating driver KM selectors:', err.message);
    }
}

function showDriverKmForm(record = null) {
    const container = document.getElementById('driverKmFormContainer');
    if (!container) return;
    
    container.style.display = 'block';
    
    if (record) {
        document.getElementById('driverKmRecordId').value = record.id;
        document.getElementById('driverKmDriverSelect').value = record.driver_id;
        document.getElementById('driverKmDateInput').value = record.record_date;
        document.getElementById('driverKmAmountInput').value = record.km_amount;
        document.getElementById('saveDriverKmBtn').textContent = '💾 Update KM Record';
    } else {
        document.getElementById('driverKmRecordId').value = '';
        // Set default driver from filter if selected
        const filterDriver = document.getElementById('driverKmDriverFilter').value;
        document.getElementById('driverKmDriverSelect').value = filterDriver || '';
        
        // Set default date to today
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        document.getElementById('driverKmDateInput').value = dateStr;
        document.getElementById('driverKmAmountInput').value = '';
        document.getElementById('saveDriverKmBtn').textContent = '💾 Save KM Record';
    }
    container.scrollIntoView({ behavior: 'smooth' });
}

function hideDriverKmForm() {
    const container = document.getElementById('driverKmFormContainer');
    if (container) container.style.display = 'none';
    document.getElementById('driverKmRecordId').value = '';
    document.getElementById('driverKmForm').reset();
}

async function loadDriverKmLogPage() {
    ensureMonthValue('driverKmMonthFilter');
    await updateDriverKmSelectors();
    await loadDriverKmRecords();
    updateKmSalaryWidget();
}

async function loadDriverKmRecords() {
    try {
        const monthVal = document.getElementById('driverKmMonthFilter')?.value;
        const driverFilter = document.getElementById('driverKmDriverFilter')?.value;

        const tbody = document.querySelector('#driverKmTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Loading KM records...</td></tr>';

        let query = supabaseClient
            .from('driver_km_records')
            .select('*, drivers(name)')
            .eq('user_id', getQueryUserId());

        if (monthVal) {
            const [year, month] = monthVal.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            query = query.gte('record_date', startDate).lte('record_date', endDate);
        }

        if (driverFilter) {
            query = query.eq('driver_id', driverFilter);
        }

        const { data, error } = await query.order('record_date', { ascending: false });
        if (error) throw error;

        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #7F8C8D;">No KM records found for the selected criteria.</td></tr>';
            return;
        }

        data.forEach(rec => {
            const row = document.createElement('tr');
            const actionsHtml = userRole === 'viewer' ? '' : `
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editDriverKmRecord(${rec.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteDriverKmRecord(${rec.id})">Delete</button>
                </td>
            `;
            
            row.innerHTML = `
                <td>${rec.drivers?.name || 'Unknown'}</td>
                <td>${rec.record_date}</td>
                <td>${parseFloat(rec.km_amount).toFixed(2)} km</td>
                ${actionsHtml}
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error('Error loading driver KM records:', err.message);
    }
}

async function saveDriverKmRecord(e) {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;

    const recordId = document.getElementById('driverKmRecordId').value;
    const driverId = document.getElementById('driverKmDriverSelect').value;
    const recordDate = document.getElementById('driverKmDateInput').value;
    const kmAmount = parseFloat(document.getElementById('driverKmAmountInput').value);

    if (!driverId || !recordDate || isNaN(kmAmount) || kmAmount <= 0) {
        alert('Please fill out all fields with valid data.');
        return;
    }

    const saveBtn = document.getElementById('saveDriverKmBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const payload = {
            user_id: getQueryUserId(),
            driver_id: parseInt(driverId),
            record_date: recordDate,
            km_amount: kmAmount
        };

        if (recordId) {
            const { error } = await supabaseClient
                .from('driver_km_records')
                .update(payload)
                .eq('id', recordId)
                .eq('user_id', getQueryUserId());
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('driver_km_records')
                .insert([payload]);
            if (error) throw error;
        }

        hideDriverKmForm();
        await loadDriverKmRecords();
        updateKmSalaryWidget();
    } catch (err) {
        console.error('Error saving driver KM record:', err.message);
        alert('Failed to save record: ' + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save KM Record';
    }
}

async function editDriverKmRecord(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient
            .from('driver_km_records')
            .select('*')
            .eq('id', id)
            .eq('user_id', getQueryUserId())
            .single();

        if (error) throw error;
        showDriverKmForm(data);
    } catch (err) {
        console.error('Error loading record for edit:', err.message);
        alert('Error: ' + err.message);
    }
}

async function deleteDriverKmRecord(id) {
    if (!checkAdminAccess('delete')) return;
    if (!confirm('Are you sure you want to delete this KM record?')) return;

    try {
        const { error } = await supabaseClient
            .from('driver_km_records')
            .delete()
            .eq('id', id)
            .eq('user_id', getQueryUserId());

        if (error) throw error;
        await loadDriverKmRecords();
        updateKmSalaryWidget();
    } catch (err) {
        console.error('Error deleting record:', err.message);
        alert('Failed to delete: ' + err.message);
    }
}

async function updateKmSalaryWidget() {
    const widget = document.getElementById('kmSalaryWidget');
    if (!widget) return;

    const driverId = document.getElementById('driverKmDriverFilter')?.value;
    const monthVal = document.getElementById('driverKmMonthFilter')?.value;

    if (!monthVal) {
        widget.style.display = 'none';
        widget.innerHTML = '';
        return;
    }

    try {
        widget.style.display = 'flex';
        widget.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; width: 100%;">Calculating mileage summary...</div>';

        const [year, month] = monthVal.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        if (!driverId) {
            // Display summary cards for EACH active driver's KM amount
            const [
                { data: drivers, error: driverError },
                { data: kmRecords, error: kmError }
            ] = await Promise.all([
                supabaseClient.from('drivers').select('id, name, role, salary_type, per_tip_charge').eq('user_id', getQueryUserId()).neq('terminated', true).order('name'),
                supabaseClient.from('driver_km_records').select('driver_id, km_amount').eq('user_id', getQueryUserId()).gte('record_date', startDate).lte('record_date', endDate)
            ]);

            if (driverError) throw driverError;
            if (kmError) throw kmError;

            const driversOnly = drivers?.filter(d => (d.role || '').toLowerCase() === 'driver') || [];

            const kmByDriver = {};
            kmRecords?.forEach(r => {
                kmByDriver[r.driver_id] = (kmByDriver[r.driver_id] || 0) + parseFloat(r.km_amount || 0);
            });

            if (driversOnly.length === 0) {
                widget.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; width: 100%;">No active drivers found.</div>';
                return;
            }

            let html = `
                <div style="width: 100%;">
                    <h4 style="margin-bottom: 15px; color: var(--text-primary); font-family: 'Barlow Condensed', sans-serif; font-size: 1.25rem;">📊 Driver Mileage Summary for ${monthVal}</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px;">
            `;

            driversOnly.forEach(d => {
                const totalKm = kmByDriver[d.id] || 0;
                const isPerTip = d.salary_type === 'per_tip';
                const salaryTypeBadge = isPerTip
                    ? '<span style="background:#E67E22;color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold;">Per Tip</span>'
                    : '<span style="background:#27AE60;color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold;">Fixed</span>';

                html += `
                    <div class="km-widget-detail-card" style="cursor: pointer;" onclick="document.getElementById('driverKmDriverFilter').value='${d.id}'; document.getElementById('driverKmDriverFilter').dispatchEvent(new Event('change'));">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <span style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${d.name}</span>
                            ${salaryTypeBadge}
                        </div>
                        <span class="km-widget-detail-label">KM Accumulated</span>
                        <span class="km-widget-detail-value highlight-blue" style="font-size: 18px;">${totalKm.toFixed(2)} km</span>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;

            widget.innerHTML = html;
        } else {
            // Display a single driver's detailed Projected Salary Card
            const { data: driver, error: driverError } = await supabaseClient
                .from('drivers')
                .select('*')
                .eq('id', driverId)
                .eq('user_id', getQueryUserId())
                .single();

            if (driverError) throw driverError;

            const [
                { data: kmRecords, error: kmError },
                { data: advances, error: advError },
                { data: deductions, error: dedError },
                { data: dayOffs, error: dayOffError }
            ] = await Promise.all([
                supabaseClient.from('driver_km_records').select('km_amount').eq('driver_id', driverId).gte('record_date', startDate).lte('record_date', endDate),
                supabaseClient.from('driver_advances').select('amount').eq('driver_id', driverId).gte('advance_date', startDate).lte('advance_date', endDate),
                supabaseClient.from('staff_deductions').select('amount').eq('driver_id', driverId).eq('salary_month', monthVal),
                supabaseClient.from('driver_day_offs').select('deduction_amount').eq('driver_id', driverId).gte('day_off_date', startDate).lte('day_off_date', endDate)
            ]);

            if (kmError) throw kmError;
            if (advError) throw advError;
            if (dedError) throw dedError;
            if (dayOffError) throw dayOffError;

            const totalKm = kmRecords?.reduce((sum, r) => sum + parseFloat(r.km_amount || 0), 0) || 0;
            const totalAdvances = advances?.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0) || 0;
            const baseDeductions = deductions?.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0) || 0;
            const totalDayOffDeductions = dayOffs?.reduce((sum, d) => sum + parseFloat(d.deduction_amount || 0), 0) || 0;

            const kmLimit = driver.km_limit || 0;
            const isFixed = driver.salary_type === 'fixed';
            const didNotMeetMinKm = isFixed && (totalKm < kmLimit);
            const appliedDayOffDeductions = didNotMeetMinKm ? totalDayOffDeductions : 0;
            const totalDeductions = baseDeductions + appliedDayOffDeductions;

            const nameClean = (driver.name || '').trim();
            const skipSalary = nameClean === 'JAUK Jayasooriya' || nameClean === 'JAAP Jayasooriya';

            let html = '';
            if (skipSalary) {
                html = `
                    <div class="km-widget-main">
                        <div class="km-widget-title">Projected Salary Card</div>
                        <div class="km-widget-driver-name">${driver.name}</div>
                        <div class="km-widget-month">📆 ${monthVal}</div>
                    </div>
                    <div class="km-widget-details">
                        <div class="km-widget-detail-card" style="grid-column: span 2;">
                            <span class="km-widget-detail-label">Total Distance</span>
                            <span class="km-widget-detail-value highlight-blue" style="font-size: 20px;">${totalKm.toFixed(2)} km</span>
                        </div>
                        <div class="km-widget-detail-card km-widget-net-salary-card" style="grid-column: span 2;">
                            <span class="km-widget-detail-label">Salary Info</span>
                            <span class="km-widget-detail-value">Salary Calculation Excluded</span>
                        </div>
                    </div>
                `;
            } else {
                const isPerTip = driver.salary_type === 'per_tip';
                if (isPerTip) {
                    const rate = driver.per_tip_charge || 0;
                    html = `
                        <div class="km-widget-main">
                            <div class="km-widget-title">Projected Salary Card (Per Tip)</div>
                            <div class="km-widget-driver-name">${driver.name}</div>
                            <div class="km-widget-month">📆 ${monthVal}</div>
                        </div>
                        <div class="km-widget-details">
                            <div class="km-widget-detail-card">
                                <span class="km-widget-detail-label">Total Distance</span>
                                <span class="km-widget-detail-value highlight-blue">${totalKm.toFixed(2)} km</span>
                            </div>
                            <div class="km-widget-detail-card">
                                <span class="km-widget-detail-label">Salary Type</span>
                                <span class="km-widget-detail-value highlight-amber">Per Tip</span>
                            </div>
                            <div class="km-widget-detail-card">
                                <span class="km-widget-detail-label">Rate / Tip</span>
                                <span class="km-widget-detail-value">LKR ${rate.toFixed(2)}</span>
                            </div>
                            <div class="km-widget-detail-card km-widget-net-salary-card">
                                <span class="km-widget-detail-label">Total Mileage Logged</span>
                                <span class="km-widget-detail-value">${totalKm.toFixed(0)} KM</span>
                            </div>
                        </div>
                    `;
                } else {
                    const basicSalary = driver.basic_salary || 0;
                    const extraKmRate = driver.extra_km_rate || 0;

                    const extraKm = Math.max(0, totalKm - kmLimit);
                    const extraKmSalary = extraKm * extraKmRate;
                    const grossSalary = basicSalary + extraKmSalary;
                    const netSalary = grossSalary - totalAdvances - totalDeductions;

                    html = `
                        <div class="km-widget-main">
                            <div class="km-widget-title">Projected Salary Card (Mileage Log)</div>
                            <div class="km-widget-driver-name">${driver.name}</div>
                            <div class="km-widget-month">📆 ${monthVal}</div>
                        </div>
                        <div class="km-widget-details">
                            <div class="km-widget-detail-card">
                                <span class="km-widget-detail-label">Total Distance</span>
                                <span class="km-widget-detail-value highlight-blue">${totalKm.toFixed(2)} km</span>
                            </div>
                            <div class="km-widget-detail-card">
                                <span class="km-widget-detail-label">Basic Salary</span>
                                <span class="km-widget-detail-value">LKR ${basicSalary.toFixed(2)}</span>
                            </div>
                            <div class="km-widget-detail-card">
                                <span class="km-widget-detail-label">Extra KM (Rate)</span>
                                <span class="km-widget-detail-value highlight-amber">${extraKm.toFixed(2)} km (LKR ${extraKmRate}/km)</span>
                            </div>
                            <div class="km-widget-detail-card">
                                <span class="km-widget-detail-label">Advances & Deds</span>
                                <span class="km-widget-detail-value highlight-purple">LKR ${(totalAdvances + totalDeductions).toFixed(2)}</span>
                                ${totalDayOffDeductions > 0 ? `
                                    <span style="font-size: 10px; display: block; margin-top: 4px; color: ${didNotMeetMinKm ? 'var(--brand-red)' : 'var(--green)'}; font-weight: 600;">
                                        ${didNotMeetMinKm ? `⚠️ LKR ${totalDayOffDeductions.toFixed(2)} Day-Off Deductions Applied (KM < Min)` : `✅ LKR ${totalDayOffDeductions.toFixed(2)} Day-Off Deductions Waived (KM ≥ Min)`}
                                    </span>
                                ` : ''}
                            </div>
                            <div class="km-widget-detail-card km-widget-net-salary-card">
                                <span class="km-widget-detail-label">Est. Net Salary</span>
                                <span class="km-widget-detail-value">LKR ${netSalary.toFixed(2)}</span>
                            </div>
                        </div>
                    `;
                }
            }

            widget.innerHTML = html;
        }
    } catch (err) {
        console.error('Error updating salary widget:', err.message);
        widget.innerHTML = `<div style="color: var(--brand-red); font-size: 14px; text-align: center; width: 100%;">Failed to load salary widget: ${err.message}</div>`;
    }
}

async function loadDriverPerformance(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        
        const currentQueryUserId = getQueryUserId();

        const [
            { data: drivers, error: driverError },
            { data: kmRecords, error: kmError },
            { data: advances, error: advError },
            { data: deductions, error: dedError },
            { data: dayOffs, error: dayOffError },
            { data: savedSalaries, error: salaryError }
        ] = await Promise.all([
            supabaseClient.from('drivers').select('*').eq('user_id', currentQueryUserId).neq('terminated', true),
            supabaseClient.from('driver_km_records').select('*').eq('user_id', currentQueryUserId).gte('record_date', startDate).lte('record_date', endDate),
            supabaseClient.from('driver_advances').select('*').eq('user_id', currentQueryUserId).gte('advance_date', startDate).lte('advance_date', endDate),
            supabaseClient.from('staff_deductions').select('*').eq('user_id', currentQueryUserId).eq('salary_month', monthValue),
            supabaseClient.from('driver_day_offs').select('*').eq('user_id', currentQueryUserId).gte('day_off_date', startDate).lte('day_off_date', endDate),
            supabaseClient.from('driver_salary').select('*').eq('user_id', currentQueryUserId).eq('salary_month', monthValue)
        ]);

        if (driverError) throw driverError;
        if (kmError) throw kmError;
        if (advError) throw advError;
        if (dedError) throw dedError;
        if (dayOffError) throw dayOffError;
        if (salaryError) console.error('Error fetching driver salaries:', salaryError);

        const tableDiv = document.getElementById('driverPerformance');
        if (!tableDiv) return;

        const driversOnly = drivers?.filter(d => (d.role || '').toLowerCase() === 'driver') || [];

        if (driversOnly.length === 0) {
            tableDiv.innerHTML = '<div style="color: #7f8c8d; padding: 20px; text-align: center; background: var(--surface-card); border-radius: var(--radius-md); border: 1px solid var(--surface-border);">No active drivers found.</div>';
            return;
        }

        // Group KM records, advances, and deductions by driver_id
        const kmByDriver = {};
        kmRecords?.forEach(r => {
            kmByDriver[r.driver_id] = (kmByDriver[r.driver_id] || 0) + parseFloat(r.km_amount || 0);
        });

        const advByDriver = {};
        advances?.forEach(a => {
            advByDriver[a.driver_id] = (advByDriver[a.driver_id] || 0) + parseFloat(a.amount || 0);
        });

        const dedByDriver = {};
        deductions?.forEach(d => {
            dedByDriver[d.driver_id] = (dedByDriver[d.driver_id] || 0) + parseFloat(d.amount || 0);
        });

        const dayOffByDriver = {};
        dayOffs?.forEach(d => {
            dayOffByDriver[d.driver_id] = (dayOffByDriver[d.driver_id] || 0) + parseFloat(d.deduction_amount || 0);
        });

        const savedSalaryMap = {};
        savedSalaries?.forEach(s => {
            savedSalaryMap[s.driver_id] = s;
        });

        // Sort drivers by total KM logged descending
        driversOnly.sort((a, b) => {
            const kmA = kmByDriver[a.id] || 0;
            const kmB = kmByDriver[b.id] || 0;
            return kmB - kmA;
        });

        // Build per-driver data for both table rows and mobile cards
        let tableRows = '';
        let mobileCards = '';

        driversOnly.forEach((driver, index) => {
            const totalKm = kmByDriver[driver.id] || 0;
            const nameClean = (driver.name || '').trim();
            const skipSalary = nameClean === 'JAUK Jayasooriya' || nameClean === 'JAAP Jayasooriya';

            const rank = index + 1;
            let rankEmoji = '';
            let rankDisplay = '';
            if (rank === 1) {
                rankEmoji = '🥇';
                rankDisplay = '🥇 <span style="font-weight: 700; color: #f1c40f;">1</span>';
            } else if (rank === 2) {
                rankEmoji = '🥈';
                rankDisplay = '🥈 <span style="font-weight: 700; color: #7f8c8d;">2</span>';
            } else if (rank === 3) {
                rankEmoji = '🥉';
                rankDisplay = '🥉 <span style="font-weight: 700; color: #d35400;">3</span>';
            } else {
                rankEmoji = `#${rank}`;
                rankDisplay = `<span style="font-weight: 600; color: var(--text-secondary); padding-left: 8px;">${rank}</span>`;
            }

            let advText = '-';
            let dedText = '-';
            let dedTextPlain = '-';
            let fullSalaryText = '-';
            let netSalaryText = '-';
            let advColor = 'var(--text-secondary)';
            let dedColor = 'var(--text-secondary)';
            let salaryColor = 'var(--text-secondary)';
            let netColor = 'var(--text-secondary)';

            if (!skipSalary) {
                const totalAdv = advByDriver[driver.id] || 0;
                const baseDed = dedByDriver[driver.id] || 0;
                const dayOffDed = dayOffByDriver[driver.id] || 0;

                const kmLimit = driver.km_limit || 0;
                const isFixed = driver.salary_type === 'fixed';
                const didNotMeetMinKm = isFixed && (totalKm < kmLimit);
                const appliedDayOffDeductions = didNotMeetMinKm ? dayOffDed : 0;
                const totalDed = baseDed + appliedDayOffDeductions;

                advColor = '#e74c3c';
                dedColor = '#e67e22';
                salaryColor = 'var(--blue)';
                netColor = 'var(--green)';
                
                advText = `LKR ${totalAdv.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                dedTextPlain = `LKR ${totalDed.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                
                let dedDetails = '';
                if (dayOffDed > 0) {
                    if (didNotMeetMinKm) {
                        dedDetails = ` <span title="Includes LKR ${dayOffDed.toFixed(2)} Day-Off Deductions (KM < Min ${kmLimit} km)" style="cursor:help;color:var(--brand-red);font-weight:bold;">⚠️</span>`;
                    } else {
                        dedDetails = ` <span title="LKR ${dayOffDed.toFixed(2)} Day-Off Deductions waived (KM ≥ Min ${kmLimit} km)" style="cursor:help;color:var(--green);font-weight:bold;">✅</span>`;
                    }
                }
                dedText = `LKR ${totalDed.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${dedDetails}`;

                const savedSalary = savedSalaryMap[driver.id];
                const isPerTip = driver.salary_type === 'per_tip';

                if (savedSalary) {
                    fullSalaryText = `LKR ${savedSalary.gross_salary.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    netSalaryText = `LKR ${savedSalary.net_salary.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                } else if (!isPerTip) {
                    const basicSalary = driver.basic_salary || 0;
                    const extraKmRate = driver.extra_km_rate || 0;
                    const extraKm = Math.max(0, totalKm - kmLimit);
                    const extraKmSalary = extraKm * extraKmRate;
                    const grossSalary = basicSalary + extraKmSalary;
                    const netSalary = grossSalary - totalAdv - totalDed;
                    
                    fullSalaryText = `LKR ${grossSalary.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    netSalaryText = `LKR ${netSalary.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                } else {
                    const rate = driver.per_tip_charge || 0;
                    fullSalaryText = `Per Tip (LKR ${rate.toFixed(2)})`;
                    netSalaryText = `Per Tip (LKR ${rate.toFixed(2)})`;
                }
            }

            const isPerTip = driver.salary_type === 'per_tip';
            const salaryTypeBadge = isPerTip
                ? '<span style="background:#E67E22;color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">Per Tip</span>'
                : '<span style="background:#27AE60;color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">Fixed</span>';

            // Desktop table row
            tableRows += `
                <tr style="border-bottom: 1px solid var(--surface-border);">
                    <td style="padding: 12px; text-align: center;">${rankDisplay}</td>
                    <td style="padding: 12px; font-weight: 600;">${driver.name}</td>
                    <td style="padding: 12px;">${salaryTypeBadge}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 600; color: var(--blue);">${totalKm.toFixed(2)} km</td>
                    <td style="padding: 12px; text-align: right; font-weight: 600; color: ${salaryColor};">${fullSalaryText}</td>
                    <td style="padding: 12px; text-align: right; color: ${advColor};">${advText}</td>
                    <td style="padding: 12px; text-align: right; color: ${dedColor};">${dedText}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 700; color: ${netColor};">${netSalaryText}</td>
                </tr>
            `;

            // Mobile card
            const rankBadgeStyle = rank === 1
                ? 'background: linear-gradient(135deg,#f1c40f,#e67e22); color:#fff;'
                : rank === 2
                    ? 'background: linear-gradient(135deg,#95a5a6,#7f8c8d); color:#fff;'
                    : rank === 3
                        ? 'background: linear-gradient(135deg,#e67e22,#c0392b); color:#fff;'
                        : 'background: var(--surface-hover); color: var(--text-secondary);';

            mobileCards += `
                <div class="driver-perf-card">
                    <div class="driver-perf-card-header">
                        <span class="driver-perf-rank-badge" style="${rankBadgeStyle}">${rankEmoji}</span>
                        <div class="driver-perf-name-wrap">
                            <span class="driver-perf-name">${driver.name}</span>
                            ${salaryTypeBadge}
                        </div>
                    </div>
                    <div class="driver-perf-card-grid">
                        <div class="driver-perf-stat">
                            <span class="driver-perf-stat-label">KM Logged</span>
                            <span class="driver-perf-stat-value" style="color:var(--blue);">${totalKm.toFixed(2)} km</span>
                        </div>
                        <div class="driver-perf-stat">
                            <span class="driver-perf-stat-label">Full Salary</span>
                            <span class="driver-perf-stat-value" style="color:${salaryColor};">${fullSalaryText}</span>
                        </div>
                        <div class="driver-perf-stat">
                            <span class="driver-perf-stat-label">Advances</span>
                            <span class="driver-perf-stat-value" style="color:${advColor};">${advText}</span>
                        </div>
                        <div class="driver-perf-stat">
                            <span class="driver-perf-stat-label">Deductions</span>
                            <span class="driver-perf-stat-value" style="color:${dedColor};">${dedTextPlain}</span>
                        </div>
                    </div>
                    <div class="driver-perf-net-row">
                        <span class="driver-perf-net-label">Projected Net Salary</span>
                        <span class="driver-perf-net-value" style="color:${netColor};">${netSalaryText}</span>
                    </div>
                </div>
            `;
        });

        // Assemble: desktop table (scrollable) + mobile cards
        const html = `
            <div class="driver-perf-table-wrap table-responsive">
                <table style="width: 100%; border-collapse: collapse; min-width: 700px;">
                    <thead>
                        <tr style="background: var(--brand-red); color: white;">
                            <th style="padding: 12px; text-align: center; width: 80px; border-radius: var(--radius-sm) 0 0 var(--radius-sm);">Rank</th>
                            <th style="padding: 12px; text-align: left;">Driver</th>
                            <th style="padding: 12px; text-align: left;">Salary Type</th>
                            <th style="padding: 12px; text-align: right;">Total KM Logged</th>
                            <th style="padding: 12px; text-align: right;">Full Salary</th>
                            <th style="padding: 12px; text-align: right;">Advances</th>
                            <th style="padding: 12px; text-align: right;">Deductions</th>
                            <th style="padding: 12px; text-align: right; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">Projected Net Salary</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            <div class="driver-perf-cards">${mobileCards}</div>
        `;

        tableDiv.innerHTML = html;
    } catch (e) {
        console.error('Error loading driver performance dashboard section:', e);
        const tableDiv = document.getElementById('driverPerformance');
        if (tableDiv) tableDiv.innerHTML = '<div style="color: #e74c3c; padding: 20px; text-align: center;">Error loading driver performance data.</div>';
    }
}

window.editDriverKmRecord = editDriverKmRecord;
window.deleteDriverKmRecord = deleteDriverKmRecord;

// =====================================================================
// ============ NEW FEATURES — ALL 20 IMPROVEMENTS =====================
// =====================================================================

// ── New chart variables ──
let revenueSegmentChart = null;
let advanceTrendChartInstance = null;
let maintenancePieChartInstance = null;
let maintenanceVehicleBarChartInstance = null;
let driverKmDailyChartInstance = null;

// ── Utility: get today's date string YYYY-MM-DD (local) ──
function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// =====================================================================
// #1  TODAY'S KPI STRIP
// =====================================================================
async function loadTodayKpiStrip() {
    try {
        const today = getTodayStr();
        const uid = getQueryUserId();
        const [
            { data: hireToday },
            { data: commitToday },
            { data: otherOpToday },
            { data: dayOffToday }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('hire_amount, fuel_litres, vehicle_id').eq('user_id', uid).eq('hire_date', today),
            supabaseClient.from('commitment_records').select('fuel_litres, vehicle_id').eq('user_id', uid).eq('hire_date', today),
            supabaseClient.from('other_operation_hires').select('hire_amount, fuel_litres').eq('user_id', uid).eq('hire_date', today),
            supabaseClient.from('driver_day_offs').select('deduction_amount').eq('user_id', uid).eq('day_off_date', today)
        ]);

        const totalHires = (hireToday?.length || 0) + (commitToday?.length || 0) + (otherOpToday?.length || 0);
        const totalRevenue = [
            ...(hireToday || []).map(r => r.hire_amount || 0),
            ...(otherOpToday || []).map(r => r.hire_amount || 0)
        ].reduce((s, v) => s + v, 0);
        const totalFuel = [
            ...(hireToday || []).map(r => r.fuel_litres || 0),
            ...(commitToday || []).map(r => r.fuel_litres || 0),
            ...(otherOpToday || []).map(r => r.fuel_litres || 0)
        ].reduce((s, v) => s + v, 0);
        const uniqueVehicles = new Set([
            ...(hireToday || []).map(r => `h_${r.vehicle_id}`),
            ...(commitToday || []).map(r => `c_${r.vehicle_id}`)
        ]).size;
        const dayOffImpact = (dayOffToday || []).reduce((s, r) => s + (r.deduction_amount || 0), 0);

        const fmt = n => 'LKR ' + n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        document.getElementById('todayVehicles').textContent = uniqueVehicles;
        document.getElementById('todayHires').textContent = totalHires;
        document.getElementById('todayRevenue').textContent = fmt(totalRevenue);
        document.getElementById('todayFuel').textContent = totalFuel.toFixed(1) + ' L';
        document.getElementById('todayDayOffImpact').textContent = fmt(dayOffImpact);
    } catch (e) {
        console.error('Error loading today KPI strip:', e);
    }
}

// ── Last-synced label (updates every 30 s) ──
let _lastSyncedAt = null;
function startLastSyncedTimer() {
    _lastSyncedAt = Date.now();
    const el = document.getElementById('lastSyncedLabel');
    if (!el) return;
    clearInterval(window._lastSyncedInterval);
    window._lastSyncedInterval = setInterval(() => {
        if (!_lastSyncedAt) return;
        const sec = Math.round((Date.now() - _lastSyncedAt) / 1000);
        el.textContent = sec < 60 ? `🟢 ${sec}s ago` : `🟡 ${Math.floor(sec/60)}m ago`;
    }, 5000);
}

// =====================================================================
// #3  SMART ALERTS WIDGET
// =====================================================================
async function loadSmartAlerts() {
    try {
        const uid = getQueryUserId();
        const today = getTodayStr();
        const in7Days = new Date(); in7Days.setDate(in7Days.getDate() + 7);
        const in7Str = in7Days.toISOString().slice(0, 10);

        const alerts = [];

        // Cheques due in next 7 days
        const { data: dueLeaves } = await supabaseClient
            .from('cheque_leaves')
            .select('leaf_number, due_date, amount, status')
            .eq('user_id', uid)
            .eq('status', 'issued')
            .gte('due_date', today)
            .lte('due_date', in7Str);
        if (dueLeaves && dueLeaves.length > 0) {
            alerts.push({ severity: 'warning', icon: '🏦', msg: `${dueLeaves.length} cheque(s) due in the next 7 days` });
        }

        // Vehicles with no commitment records this month
        const thisMonth = today.slice(0, 7);
        const [yr, mo] = thisMonth.split('-');
        const start = `${yr}-${mo}-01`;
        const lastDay = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const end = `${yr}-${mo}-${String(lastDay).padStart(2,'0')}`;

        const { data: commitVehicles } = await supabaseClient.from('commitment_vehicles').select('id, vehicle_number').eq('user_id', uid).eq('terminated', false);
        const { data: commitRec } = await supabaseClient.from('commitment_records').select('vehicle_id').eq('user_id', uid).gte('hire_date', start).lte('hire_date', end);
        const vehiclesWithRecs = new Set((commitRec || []).map(r => r.vehicle_id));
        const missing = (commitVehicles || []).filter(v => !vehiclesWithRecs.has(v.id));
        if (missing.length > 0) {
            alerts.push({ severity: 'info', icon: '📋', msg: `${missing.length} commitment vehicle(s) have no hires recorded this month` });
        }

        const alertsWidget = document.getElementById('alertsWidget');
        const alertsList = document.getElementById('alertsList');
        const badge = document.getElementById('alertsCountBadge');

        if (alerts.length === 0) {
            if (alertsWidget) alertsWidget.style.display = 'none';
            return;
        }

        if (badge) badge.textContent = alerts.length;
        if (alertsWidget) alertsWidget.style.display = '';
        if (alertsList) {
            alertsList.innerHTML = alerts.map(a => `
                <div class="alert-item alert-${a.severity}">
                    <span class="alert-icon">${a.icon}</span>
                    <span class="alert-msg">${a.msg}</span>
                </div>
            `).join('');
        }
    } catch(e) {
        console.error('Error loading smart alerts:', e);
    }
}

// =====================================================================
// #2  REVENUE BY SEGMENT — 12-MONTH STACKED BAR CHART
// =====================================================================
async function loadRevenueSegmentChart() {
    try {
        const uid = getQueryUserId();
        const now = new Date();
        const labels = [];
        const hireData = [], commitData = [], otherData = [];

        const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-01`;
        const endStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()}`;

        const [
            { data: allHire },
            { data: allCommit },
            { data: allOther },
            { data: allCommVehicles }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('hire_date, hire_amount').eq('user_id', uid).gte('hire_date', startStr).lte('hire_date', endStr),
            supabaseClient.from('commitment_records').select('hire_date, vehicle_id, distance').eq('user_id', uid).gte('hire_date', startStr).lte('hire_date', endStr),
            supabaseClient.from('other_operation_hires').select('hire_date, hire_amount').eq('user_id', uid).gte('hire_date', startStr).lte('hire_date', endStr),
            supabaseClient.from('commitment_vehicles').select('id, fixed_monthly_payment, km_limit_per_month, extra_km_charge').eq('user_id', uid)
        ]);

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));

            const hire = (allHire || []).filter(r => r.hire_date?.startsWith(key)).reduce((s, r) => s + (r.hire_amount || 0), 0);
            hireData.push(hire);

            const commitRecs = (allCommit || []).filter(r => r.hire_date?.startsWith(key));
            const commitVehicleIds = [...new Set(commitRecs.map(r => r.vehicle_id))];
            const monthVehicles = (allCommVehicles || []).filter(v => commitVehicleIds.includes(v.id));
            let commitRev = monthVehicles.reduce((s, v) => s + (v.fixed_monthly_payment || 0), 0);
            monthVehicles.forEach(v => {
                const km = commitRecs.filter(r => r.vehicle_id === v.id).reduce((s, r) => s + (r.distance || 0), 0);
                const exc = Math.max(0, km - (v.km_limit_per_month || 0));
                commitRev += exc * (v.extra_km_charge || 0);
            });
            commitData.push(commitRev);

            const other = (allOther || []).filter(r => r.hire_date?.startsWith(key)).reduce((s, r) => s + (r.hire_amount || 0), 0);
            otherData.push(other);
        }

        const ctx = document.getElementById('revenueSegmentChart')?.getContext('2d');
        if (!ctx) return;
        if (revenueSegmentChart) revenueSegmentChart.destroy();

        const theme = getChartTheme ? getChartTheme() : {};
        revenueSegmentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Hire-to-Pay', data: hireData, backgroundColor: 'rgba(220,20,60,0.75)', borderColor: '#DC143C', borderWidth: 1, borderRadius: 4 },
                    { label: 'Commitment', data: commitData, backgroundColor: 'rgba(0,179,126,0.75)', borderColor: '#00B37E', borderWidth: 1, borderRadius: 4 },
                    { label: 'Other Ops', data: otherData, backgroundColor: 'rgba(230,126,34,0.75)', borderColor: '#E67E22', borderWidth: 1, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: ctx => `LKR ${Math.round(ctx.parsed.y).toLocaleString()}` } }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, ticks: { callback: v => `LKR ${(v/1000).toFixed(0)}K` } }
                }
            }
        });
    } catch(e) {
        console.error('Error loading revenue segment chart:', e);
    }
}

// =====================================================================
// #13 FLEET UTILIZATION HEATMAP
// =====================================================================
async function loadFleetUtilizationHeatmap(monthValue) {
    const grid = document.getElementById('fleetUtilizationGrid');
    if (!grid) return;
    try {
        const uid = getQueryUserId();
        if (!monthValue) {
            const now = new Date();
            monthValue = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        }
        const [yr, mo] = monthValue.split('-');
        const startDate = `${yr}-${mo}-01`;
        const daysInMonth = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const endDate = `${yr}-${mo}-${String(daysInMonth).padStart(2,'0')}`;

        const [
            { data: hireRecords },
            { data: commitRecords },
            { data: otherRecords },
            { data: hireVehicles },
            { data: commitVehicles }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('hire_date, vehicle_id').eq('user_id', uid).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('hire_date, vehicle_id').eq('user_id', uid).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('hire_date, base_lorry_number').eq('user_id', uid).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, terminated').eq('user_id', uid),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number, terminated').eq('user_id', uid)
        ]);

        // Build per-vehicle active days map and track termination status
        const vehicleActiveDays = {};
        const vehicleTerminated = {};
        const ensureVehicle = (key) => { if (!vehicleActiveDays[key]) vehicleActiveDays[key] = new Set(); };

        (hireVehicles || []).forEach(v => {
            const base = extractBaseVehicleName ? extractBaseVehicleName(v.lorry_number) : v.lorry_number;
            ensureVehicle(base);
            if (vehicleTerminated[base] === undefined) {
                vehicleTerminated[base] = v.terminated;
            } else {
                vehicleTerminated[base] = vehicleTerminated[base] && v.terminated;
            }
        });
        (commitVehicles || []).forEach(v => {
            const base = extractBaseVehicleName ? extractBaseVehicleName(v.vehicle_number) : v.vehicle_number;
            ensureVehicle(base);
            if (vehicleTerminated[base] === undefined) {
                vehicleTerminated[base] = v.terminated;
            } else {
                vehicleTerminated[base] = vehicleTerminated[base] && v.terminated;
            }
        });

        const hireIdToBase = {};
        (hireVehicles || []).forEach(v => { hireIdToBase[v.id] = extractBaseVehicleName ? extractBaseVehicleName(v.lorry_number) : v.lorry_number; });
        const commitIdToBase = {};
        (commitVehicles || []).forEach(v => { commitIdToBase[v.id] = extractBaseVehicleName ? extractBaseVehicleName(v.vehicle_number) : v.vehicle_number; });

        (hireRecords || []).forEach(r => { const base = hireIdToBase[r.vehicle_id]; if (base) { ensureVehicle(base); vehicleActiveDays[base].add(r.hire_date); } });
        (commitRecords || []).forEach(r => { const base = commitIdToBase[r.vehicle_id]; if (base) { ensureVehicle(base); vehicleActiveDays[base].add(r.hire_date); } });
        (otherRecords || []).forEach(r => { if (r.base_lorry_number) { ensureVehicle(r.base_lorry_number); vehicleActiveDays[r.base_lorry_number].add(r.hire_date); } });

        // Filter vehicles based on active status or presence of activity/old month request
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const isOldMonth = monthValue < currentMonthStr;

        const filteredVehicles = Object.keys(vehicleActiveDays).filter(vehicle => {
            const isTerminated = vehicleTerminated[vehicle];
            if (!isTerminated) return true;
            const activeCount = vehicleActiveDays[vehicle]?.size || 0;
            return activeCount > 0 || isOldMonth;
        });

        if (filteredVehicles.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center;">No vehicle data for this month.</p>';
            return;
        }

        // Generate day headers
        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${yr}-${mo}-${String(d).padStart(2,'0')}`;
            const dow = new Date(dateStr).getDay(); // 0=Sun
            days.push({ d, dateStr, dow });
        }

        let html = '<div class="fleet-heatmap-wrap">';
        const sortedVehicles = filteredVehicles.sort();
        sortedVehicles.forEach(vehicle => {
            const activeDays = vehicleActiveDays[vehicle];
            const activeCount = activeDays.size;
            const pct = Math.round((activeCount / daysInMonth) * 100);
            const color = pct >= 70 ? '#27AE60' : pct >= 40 ? '#F39C12' : pct >= 20 ? '#E67E22' : '#E74C3C';
            const isTerminated = vehicleTerminated[vehicle];
            const displayLabel = isTerminated ? `${vehicle} [T]` : vehicle;
            const labelTitle = isTerminated ? `${vehicle} (Deactivated)` : vehicle;

            html += `<div class="fleet-heatmap-row">
                <div class="fleet-heatmap-label" title="${labelTitle}" style="${isTerminated ? 'color:var(--text-muted);text-decoration:line-through;' : ''}">${displayLabel}</div>
                <div class="fleet-heatmap-dots">
                    ${days.map(({ d, dateStr, dow }) => {
                        const isActive = activeDays.has(dateStr);
                        const isWeekend = dow === 0 || dow === 6;
                        const title = `${dateStr}${isActive ? ' — Active' : isWeekend ? ' — Weekend' : ' — Idle'}`;
                        const dotClass = isActive ? 'util-dot util-active' : isWeekend ? 'util-dot util-weekend' : 'util-dot util-idle';
                        return `<div class="${dotClass}" title="${title}" data-date="${dateStr}"></div>`;
                    }).join('')}
                </div>
                <div class="fleet-heatmap-stat" style="color:${color};">${pct}%</div>
            </div>`;
        });
        html += `<div class="fleet-heatmap-legend">
            <span><span class="util-dot util-active" style="display:inline-block;"></span> Active</span>
            <span><span class="util-dot util-idle" style="display:inline-block;"></span> Idle</span>
            <span><span class="util-dot util-weekend" style="display:inline-block;"></span> Weekend</span>
        </div>`;
        html += '</div>';
        grid.innerHTML = html;
    } catch(e) {
        console.error('Error loading fleet utilization heatmap:', e);
        if (grid) grid.innerHTML = '<p style="color:var(--brand-red);padding:20px;text-align:center;">Error loading fleet data.</p>';
    }
}

// =====================================================================
// #8  HIRE RECORDS SUMMARY STRIP
// =====================================================================
function renderHireRecordsSummaryStrip(records) {
    const strip = document.getElementById('hireRecordsSummaryStrip');
    if (!strip) return;
    if (!records || records.length === 0) { strip.innerHTML = ''; return; }

    const totalJobs = records.length;
    const totalRevenue = records.reduce((s, r) => s + (r.hire_amount || 0), 0);
    const totalFuelCost = records.reduce((s, r) => s + (r.fuel_cost || 0), 0);
    const totalDistance = records.reduce((s, r) => s + (r.distance || 0), 0);
    const grossProfit = totalRevenue - totalFuelCost;
    const avgRevenue = totalJobs > 0 ? totalRevenue / totalJobs : 0;

    const fmt = n => 'LKR ' + n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    strip.innerHTML = `
        <div class="summary-strip-inner">
            <div class="rss-card">
                <span class="rss-icon">📋</span>
                <span class="rss-label">Total Jobs</span>
                <span class="rss-value">${totalJobs}</span>
            </div>
            <div class="rss-card">
                <span class="rss-icon">💰</span>
                <span class="rss-label">Total Revenue</span>
                <span class="rss-value rss-green">${fmt(totalRevenue)}</span>
            </div>
            <div class="rss-card">
                <span class="rss-icon">⛽</span>
                <span class="rss-label">Total Fuel</span>
                <span class="rss-value rss-red">${fmt(totalFuelCost)}</span>
            </div>
            <div class="rss-card">
                <span class="rss-icon">📈</span>
                <span class="rss-label">Gross Profit</span>
                <span class="rss-value" style="color:${grossProfit>=0?'var(--green)':'var(--brand-red)'};">${fmt(grossProfit)}</span>
            </div>
            <div class="rss-card">
                <span class="rss-icon">🛣️</span>
                <span class="rss-label">Total Distance</span>
                <span class="rss-value">${totalDistance.toFixed(0)} km</span>
            </div>
            <div class="rss-card">
                <span class="rss-icon">🎯</span>
                <span class="rss-label">Avg Per Job</span>
                <span class="rss-value">${fmt(avgRevenue)}</span>
            </div>
        </div>
    `;
}

// =====================================================================
// #9  COMMITMENT RECORDS SUMMARY STRIP
// =====================================================================
function renderCommitmentSummaryStrip(records) {
    const strip = document.getElementById('commitmentSummaryStrip');
    if (!strip) return;
    if (!records || records.length === 0) { strip.innerHTML = ''; return; }

    const totalJobs = records.length;
    const totalFuelCost = records.reduce((s, r) => s + (r.fuel_cost || 0), 0);
    const totalDistance = records.reduce((s, r) => s + (r.distance || 0), 0);
    const totalFuelLitres = records.reduce((s, r) => s + (r.fuel_litres || 0), 0);
    const avgFuelPerKm = totalDistance > 0 ? totalFuelLitres / totalDistance : 0;
    const uniqueVehicles = new Set(records.map(r => r.vehicle_id)).size;

    const fmt = n => 'LKR ' + n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    strip.innerHTML = `
        <div class="summary-strip-inner">
            <div class="rss-card">
                <span class="rss-icon">📋</span>
                <span class="rss-label">Total Trips</span>
                <span class="rss-value">${totalJobs}</span>
            </div>
            <div class="rss-card">
                <span class="rss-icon">🚛</span>
                <span class="rss-label">Active Vehicles</span>
                <span class="rss-value">${uniqueVehicles}</span>
            </div>
            <div class="rss-card">
                <span class="rss-icon">⛽</span>
                <span class="rss-label">Total Fuel Cost</span>
                <span class="rss-value rss-red">${fmt(totalFuelCost)}</span>
            </div>
            <div class="rss-card">
                <span class="rss-icon">🛣️</span>
                <span class="rss-label">Total Distance</span>
                <span class="rss-value">${totalDistance.toFixed(0)} km</span>
            </div>
            <div class="rss-card">
                <span class="rss-icon">📊</span>
                <span class="rss-label">Avg Fuel/km</span>
                <span class="rss-value">${(avgFuelPerKm * 100).toFixed(1)} L/100km</span>
            </div>
        </div>
    `;
}

// =====================================================================
// #6  MAINTENANCE EXPENSE PIE CHART + VEHICLE BAR CHART
// =====================================================================
async function loadMaintenancePieChart(monthValue) {
    try {
        const uid = getQueryUserId();
        if (!monthValue) {
            const now = new Date();
            monthValue = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        }
        const [yr, mo] = monthValue.split('-');
        const startDate = `${yr}-${mo}-01`;
        const lastDay = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const endDate = `${yr}-${mo}-${String(lastDay).padStart(2,'0')}`;

        const { data } = await supabaseClient.from('lorry_maintenance').select('expense_type, amount, vehicle_ref').eq('user_id', uid).gte('maintenance_date', startDate).lte('maintenance_date', endDate);
        if (!data || data.length === 0) return;

        // Group by expense type
        const expenseMap = {};
        const vehicleMap = {};
        data.forEach(r => {
            expenseMap[r.expense_type] = (expenseMap[r.expense_type] || 0) + (r.amount || 0);
            vehicleMap[r.vehicle_ref] = (vehicleMap[r.vehicle_ref] || 0) + (r.amount || 0);
        });

        const theme = getChartTheme ? getChartTheme() : {};
        const COLORS = ['#DC143C','#E67E22','#3498DB','#27AE60','#9B59B6','#F1C40F','#1ABC9C','#E91E63'];

        // Pie chart — expense type
        const pieCtx = document.getElementById('maintenancePieChart')?.getContext('2d');
        if (pieCtx) {
            if (maintenancePieChartInstance) maintenancePieChartInstance.destroy();
            const pieLabels = Object.keys(expenseMap);
            const pieData = Object.values(expenseMap);
            maintenancePieChartInstance = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: pieLabels,
                    datasets: [{ data: pieData, backgroundColor: COLORS.slice(0, pieLabels.length), borderColor: theme.borderColor || '#fff', borderWidth: 2, hoverOffset: 10 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: `Expense Breakdown — ${monthValue}`, color: theme.titleColor, font: { size: 14, weight: 'bold' } },
                        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } },
                        tooltip: { callbacks: { label: ctx => `${ctx.label}: LKR ${Math.round(ctx.parsed).toLocaleString()}` } }
                    }
                }
            });
        }

        // Bar chart — by vehicle
        const barCtx = document.getElementById('maintenanceVehicleBarChart')?.getContext('2d');
        if (barCtx) {
            if (maintenanceVehicleBarChartInstance) maintenanceVehicleBarChartInstance.destroy();
            const sorted = Object.entries(vehicleMap).sort((a, b) => b[1] - a[1]);
            maintenanceVehicleBarChartInstance = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: sorted.map(s => s[0]),
                    datasets: [{ label: 'Maintenance Cost', data: sorted.map(s => s[1]), backgroundColor: 'rgba(220,20,60,0.7)', borderColor: '#DC143C', borderWidth: 1, borderRadius: 5 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: `Cost by Vehicle — ${monthValue}`, color: theme.titleColor, font: { size: 14, weight: 'bold' } },
                        legend: { display: false }
                    },
                    scales: { y: { beginAtZero: true, ticks: { callback: v => `LKR ${v.toLocaleString()}` } } }
                }
            });
        }
    } catch(e) {
        console.error('Error loading maintenance pie chart:', e);
    }
}

// =====================================================================
// #4  DRIVER KM DAILY CHART
// =====================================================================
async function loadDriverKmDailyChart(monthValue, driverFilter) {
    const chartSection = document.getElementById('driverKmChartSection');
    if (!driverFilter || !monthValue) { if (chartSection) chartSection.style.display = 'none'; return; }

    try {
        const uid = getQueryUserId();
        const [yr, mo] = monthValue.split('-');
        const startDate = `${yr}-${mo}-01`;
        const daysInMonth = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const endDate = `${yr}-${mo}-${String(daysInMonth).padStart(2,'0')}`;

        const { data: kmRecs } = await supabaseClient.from('driver_km_records').select('record_date, km_amount').eq('user_id', uid).eq('driver_id', driverFilter).gte('record_date', startDate).lte('record_date', endDate);

        if (!kmRecs || kmRecs.length === 0) { if (chartSection) chartSection.style.display = 'none'; return; }
        if (chartSection) chartSection.style.display = '';

        const dayMap = {};
        kmRecs.forEach(r => { dayMap[r.record_date] = (dayMap[r.record_date] || 0) + (r.km_amount || 0); });

        const labels = [];
        const values = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${yr}-${mo}-${String(d).padStart(2,'0')}`;
            labels.push(d.toString());
            values.push(dayMap[ds] || 0);
        }

        const ctx = document.getElementById('driverKmDailyChart')?.getContext('2d');
        if (!ctx) return;
        if (driverKmDailyChartInstance) driverKmDailyChartInstance.destroy();

        driverKmDailyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label: 'KM Logged', data: values, backgroundColor: 'rgba(0,114,206,0.7)', borderColor: '#0072CE', borderWidth: 1, borderRadius: 4 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1)} km` } } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => `${v} km` } } }
            }
        });
    } catch(e) {
        console.error('Error loading driver KM daily chart:', e);
    }
}

// =====================================================================
// #5  ADVANCE TREND CHART (last 6 months)
// =====================================================================
async function loadAdvanceTrendChart() {
    try {
        const uid = getQueryUserId();
        const now = new Date();
        const labels = [];
        const advData = [];

        const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-01`;
        const endStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()}`;

        const { data: advances } = await supabaseClient.from('driver_advances').select('advance_date, amount').eq('user_id', uid).gte('advance_date', startStr).lte('advance_date', endStr);

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
            const total = (advances || []).filter(a => a.advance_date?.startsWith(key)).reduce((s, a) => s + (a.amount || 0), 0);
            advData.push(total);
        }

        const ctx = document.getElementById('advanceTrendChart')?.getContext('2d');
        if (!ctx) return;
        if (advanceTrendChartInstance) advanceTrendChartInstance.destroy();
        const theme = getChartTheme ? getChartTheme() : {};

        advanceTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{ label: 'Total Advances', data: advData, borderColor: '#9B59B6', backgroundColor: 'rgba(155,89,182,0.1)', borderWidth: 3, fill: true, tension: 0.4, pointBackgroundColor: '#9B59B6', pointRadius: 5 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top' }, tooltip: { callbacks: { label: ctx => `LKR ${Math.round(ctx.parsed.y).toLocaleString()}` } } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => `LKR ${(v/1000).toFixed(0)}K` } } }
            }
        });
    } catch(e) {
        console.error('Error loading advance trend chart:', e);
    }
}

// =====================================================================
// #10 STAFF BREAKDOWN WIDGETS
// =====================================================================
function renderStaffBreakdownWidgets(allDrivers) {
    if (!allDrivers) return;
    const drivers = allDrivers.filter(d => !d.terminated && (d.role || 'Driver').toLowerCase() === 'driver').length;
    const helpers = allDrivers.filter(d => !d.terminated && (d.role || '').toLowerCase() === 'helper').length;
    const other = allDrivers.filter(d => !d.terminated && !['driver', 'helper'].includes((d.role || 'driver').toLowerCase())).length;
    const terminated = allDrivers.filter(d => d.terminated).length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('staffCountDrivers', drivers);
    set('staffCountHelpers', helpers);
    set('staffCountOther', other);
    set('staffCountTerminated', terminated);
}

// =====================================================================
// #11 DAY-OFF CALENDAR HEATMAP
// =====================================================================
function renderDayOffCalendar(dayOffRecords, monthValue, driverName) {
    const section = document.getElementById('dayOffCalendarSection');
    const container = document.getElementById('dayOffCalendar');
    if (!section || !container || !dayOffRecords || dayOffRecords.length === 0 || !monthValue) {
        if (section) section.style.display = 'none';
        return;
    }
    if (section) section.style.display = '';

    const [yr, mo] = monthValue.split('-');
    const daysInMonth = new Date(parseInt(yr), parseInt(mo), 0).getDate();
    const firstDow = new Date(`${yr}-${mo}-01`).getDay(); // 0=Sun

    const dayOffDates = new Set(dayOffRecords.map(r => r.day_off_date));

    let html = `<div class="dayoff-calendar-title">${driverName ? driverName + ' — ' : ''}${monthValue}</div>`;
    html += '<div class="dayoff-calendar-grid">';
    // Day headers
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { html += `<div class="dayoff-cal-head">${d}</div>`; });
    // Empty cells for first week
    for (let i = 0; i < firstDow; i++) { html += '<div class="dayoff-cal-cell dayoff-cal-empty"></div>'; }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${yr}-${mo}-${String(d).padStart(2,'0')}`;
        const isDayOff = dayOffDates.has(ds);
        const dow = (firstDow + d - 1) % 7;
        const isWeekend = dow === 0 || dow === 6;
        const cls = isDayOff ? 'dayoff-cal-cell dayoff-marked' : isWeekend ? 'dayoff-cal-cell dayoff-weekend' : 'dayoff-cal-cell dayoff-worked';
        const title = isDayOff ? 'Day Off' : isWeekend ? 'Weekend' : 'Worked';
        html += `<div class="${cls}" title="${ds} — ${title}">${d}</div>`;
    }
    html += '</div>';
    html += '<div class="dayoff-cal-legend"><span class="dayoff-legend-item"><span class="dayoff-cal-cell dayoff-worked" style="width:16px;height:16px;display:inline-block;"></span> Worked</span><span class="dayoff-legend-item"><span class="dayoff-cal-cell dayoff-marked" style="width:16px;height:16px;display:inline-block;"></span> Day Off</span><span class="dayoff-legend-item"><span class="dayoff-cal-cell dayoff-weekend" style="width:16px;height:16px;display:inline-block;"></span> Weekend</span></div>';

    container.innerHTML = html;
}

// =====================================================================
// #12 SALARY YTD SUMMARY
// =====================================================================
async function loadSalaryYtdSummary(driverId, currentMonth) {
    const block = document.getElementById('salaryYtdBlock');
    const grid = document.getElementById('salaryYtdGrid');
    if (!block || !grid || !driverId) return;

    try {
        const uid = getQueryUserId();
        const year = (currentMonth || '').split('-')[0] || new Date().getFullYear().toString();

        const { data: salaries } = await supabaseClient.from('driver_salary').select('salary_month, gross_salary, net_salary').eq('user_id', uid).eq('driver_id', driverId).like('salary_month', `${year}-%`).order('salary_month', { ascending: true });

        if (!salaries || salaries.length === 0) { block.style.display = 'none'; return; }

        const fmt = n => 'LKR ' + n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        const totalGross = salaries.reduce((s, r) => s + (r.gross_salary || 0), 0);
        const totalNet = salaries.reduce((s, r) => s + (r.net_salary || 0), 0);

        grid.innerHTML = salaries.map(s => `
            <div class="ytd-salary-row">
                <span class="ytd-month">${s.salary_month}</span>
                <span class="ytd-gross">${fmt(s.gross_salary || 0)}</span>
                <span class="ytd-net">${fmt(s.net_salary || 0)}</span>
            </div>
        `).join('') + `
            <div class="ytd-salary-row ytd-total">
                <span class="ytd-month">YTD Total</span>
                <span class="ytd-gross">${fmt(totalGross)}</span>
                <span class="ytd-net" style="color:var(--green);font-weight:700;">${fmt(totalNet)}</span>
            </div>
        `;

        block.style.display = '';
    } catch(e) {
        console.error('Error loading salary YTD:', e);
        if (block) block.style.display = 'none';
    }
}

// =====================================================================
// #14 CHEQUES DUE SOON BANNER
// =====================================================================
async function loadChequesDueSoonBanner() {
    const banner = document.getElementById('chequesDueBanner');
    const list = document.getElementById('chequesDueBannerList');
    if (!banner || !list) return;

    try {
        const uid = getQueryUserId();
        const today = getTodayStr();
        const in7 = new Date(); in7.setDate(in7.getDate() + 7);
        const in7Str = in7.toISOString().slice(0, 10);

        const { data } = await supabaseClient.from('cheque_leaves').select('leaf_number, due_date, amount').eq('user_id', uid).eq('status', 'issued').gte('due_date', today).lte('due_date', in7Str).order('due_date', { ascending: true });

        if (!data || data.length === 0) { banner.style.display = 'none'; return; }

        banner.style.display = '';
        list.innerHTML = data.map(l => {
            const daysLeft = Math.round((new Date(l.due_date) - new Date(today)) / 86400000);
            return `<span class="cheque-due-item">Leaf #${l.leaf_number} — ${l.due_date} (${daysLeft}d) — LKR ${(l.amount || 0).toLocaleString()}</span>`;
        }).join('');
    } catch(e) {
        console.error('Error loading cheques due banner:', e);
    }
}


// =====================================================================
// #17 GLOBAL SEARCH
// =====================================================================
(function initGlobalSearch() {
    const btn = document.getElementById('globalSearchBtn');
    const modal = document.getElementById('globalSearchModal');
    const overlay = document.getElementById('globalSearchOverlay');
    const closeBtn = document.getElementById('globalSearchClose');
    const input = document.getElementById('globalSearchInput');
    const results = document.getElementById('globalSearchResults');

    if (!btn || !modal) return;

    let searchTimeout = null;

    function openSearch() {
        modal.style.display = '';
        setTimeout(() => { input?.focus(); }, 80);
    }
    function closeSearch() {
        modal.style.display = 'none';
        if (input) { input.value = ''; }
        if (results) results.innerHTML = '<div class="global-search-hint">Type at least 2 characters to search across all data...</div>';
    }

    btn.addEventListener('click', openSearch);
    closeBtn?.addEventListener('click', closeSearch);
    overlay?.addEventListener('click', closeSearch);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.style.display !== 'none') closeSearch();
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    });

    input?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = input.value.trim();
        if (q.length < 2) {
            results.innerHTML = '<div class="global-search-hint">Type at least 2 characters to search...</div>';
            return;
        }
        results.innerHTML = '<div class="global-search-hint">Searching...</div>';
        searchTimeout = setTimeout(() => performGlobalSearch(q), 400);
    });
})();

async function performGlobalSearch(query) {
    const results = document.getElementById('globalSearchResults');
    if (!results) return;
    const uid = getQueryUserId();
    const q = query.toLowerCase();
    const hits = [];

    try {
        const [
            { data: drivers },
            { data: hireVehicles },
            { data: commitVehicles },
            { data: hireRecs },
            { data: commitRecs }
        ] = await Promise.all([
            supabaseClient.from('drivers').select('id, name, contact, license_number, role').eq('user_id', uid),
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, vehicle_model, ownership').eq('user_id', uid),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number, vehicle_model, ownership').eq('user_id', uid),
            supabaseClient.from('hire_to_pay_records').select('id, job_number, hire_date, from_location, to_location, hire_amount').eq('user_id', uid).order('hire_date', { ascending: false }).limit(200),
            supabaseClient.from('commitment_records').select('id, job_number, hire_date, from_location, to_location').eq('user_id', uid).order('hire_date', { ascending: false }).limit(200)
        ]);

        (drivers || []).forEach(d => {
            if ([d.name, d.contact, d.license_number, d.role].some(v => v && v.toLowerCase().includes(q))) {
                hits.push({ category: 'Staff', icon: '👤', title: d.name, sub: `${d.role || 'Driver'} · ${d.contact || ''}`, action: `switchPage('drivers')` });
            }
        });
        (hireVehicles || []).forEach(v => {
            if ([v.lorry_number, v.vehicle_model, v.ownership].some(val => val && val.toLowerCase().includes(q))) {
                hits.push({ category: 'Vehicle', icon: '🚛', title: v.lorry_number, sub: `${v.vehicle_model || ''} · ${v.ownership || ''}`, action: `switchPage('hire-vehicles')` });
            }
        });
        (commitVehicles || []).forEach(v => {
            if ([v.vehicle_number, v.vehicle_model, v.ownership].some(val => val && val.toLowerCase().includes(q))) {
                hits.push({ category: 'Vehicle', icon: '🏢', title: v.vehicle_number, sub: `${v.vehicle_model || ''} · ${v.ownership || ''}`, action: `switchPage('commitment-vehicles')` });
            }
        });
        (hireRecs || []).forEach(r => {
            if ([r.job_number, r.from_location, r.to_location].some(v => v && v.toLowerCase().includes(q))) {
                hits.push({ category: 'Hire Record', icon: '📋', title: `Job ${r.job_number}`, sub: `${r.hire_date} · ${r.from_location} → ${r.to_location} · LKR ${(r.hire_amount || 0).toLocaleString()}`, action: `switchPage('hire-records')` });
            }
        });
        (commitRecs || []).forEach(r => {
            if ([r.job_number, r.from_location, r.to_location].some(v => v && v.toLowerCase().includes(q))) {
                hits.push({ category: 'Commitment', icon: '📝', title: `Job ${r.job_number}`, sub: `${r.hire_date} · ${r.from_location} → ${r.to_location}`, action: `switchPage('commitment-records')` });
            }
        });

        if (hits.length === 0) {
            results.innerHTML = `<div class="global-search-empty">No results for "<strong>${query}</strong>"</div>`;
            return;
        }

        results.innerHTML = hits.slice(0, 30).map(h => `
            <div class="global-search-item" onclick="${h.action}; document.getElementById('globalSearchModal').style.display='none';">
                <span class="global-search-item-icon">${h.icon}</span>
                <div class="global-search-item-content">
                    <div class="global-search-item-title">${h.title}</div>
                    <div class="global-search-item-sub">${h.sub}</div>
                </div>
                <span class="global-search-item-cat">${h.category}</span>
            </div>
        `).join('');
    } catch(e) {
        console.error('Error performing global search:', e);
        results.innerHTML = '<div class="global-search-empty">Search error. Please try again.</div>';
    }
}

// =====================================================================
// HOOK INTO EXISTING FUNCTIONS
// =====================================================================

// Hook into loadHireRecords to render summary strip
const _origLoadHireRecords = typeof loadHireRecords === 'function' ? loadHireRecords : null;
if (_origLoadHireRecords) {
    // Patch via intercepting the table population
    const origFunc = loadHireRecords;
    window._hireRecordsPatchApplied = true;
}

// Hook into loadCommitmentRecords to render summary strip
const _origLoadCommitmentRecords = typeof loadCommitmentRecords === 'function' ? loadCommitmentRecords : null;

// ──────────────────────────────────────────────
// DASHBOARD: augment page switch to load new widgets
// ──────────────────────────────────────────────
const _origSwitchPage = window.switchPage;

// Hook fleet utilization month change
document.getElementById('fleetUtilMonth')?.addEventListener('change', function() {
    loadFleetUtilizationHeatmap(this.value);
});

// Called when dashboard loads
async function loadDashboardExtras() {
    await loadTodayKpiStrip();
    await loadSmartAlerts();
    startLastSyncedTimer();
    _lastSyncedAt = Date.now();

    // Set fleet util to current month
    const fleetMonthEl = document.getElementById('fleetUtilMonth');
    if (fleetMonthEl && !fleetMonthEl.value) {
        const now = new Date();
        fleetMonthEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }
    if (fleetMonthEl?.value) loadFleetUtilizationHeatmap(fleetMonthEl.value);

    await loadRevenueSegmentChart();
}

// ── Auto-load driver breakdown when staff page loads ──
const _origLoadDrivers = window.loadDrivers || (typeof loadDrivers === 'function' ? loadDrivers : null);

// ── Auto-load maintenance charts when page loads ──
const _origLoadMaintenanceRecords = window.loadMaintenanceRecords || (typeof loadMaintenanceRecords === 'function' ? loadMaintenanceRecords : null);

// ── Load advance trend when advances page loads ──
const _origLoadAdvances = window.loadAdvances || (typeof loadAdvances === 'function' ? loadAdvances : null);

// ── Load cheques due banner when cheque page loads ──
const _origLoadChequeStatus = window.loadChequeStatus || (typeof loadChequeStatus === 'function' ? loadChequeStatus : null);

// ── Observe page switches using MutationObserver on active class ──
(function() {
    const pagesContainer = document.querySelector('.pages-container');
    if (!pagesContainer) return;

    const pageObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const page = mutation.target;
                if (page.classList.contains('active')) {
                    const id = page.id;
                    // Load extras for each page
                    setTimeout(() => {
                        if (id === 'dashboard') { loadDashboardExtras(); }
                        if (id === 'drivers') {
                            // Staff breakdown already handled inside loadDrivers
                        }
                        if (id === 'lorry-maintenance') {
                            const monthEl = document.getElementById('maintenanceMonth');
                            const mv = monthEl?.value || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
                            loadMaintenancePieChart(mv);
                        }
                        if (id === 'driver-advances') {
                            loadAdvanceTrendChart();
                        }
                        if (id === 'cheque-status') {
                            loadChequesDueSoonBanner();
                        }
                    }, 300);
                }
            }
        });
    });

    pagesContainer.querySelectorAll('.page').forEach(page => {
        pageObserver.observe(page, { attributes: true });
    });
})();

// Listen for maintenance month change to reload pie chart
document.getElementById('maintenanceMonth')?.addEventListener('change', function() {
    loadMaintenancePieChart(this.value);
});

// Listen for KM log driver filter change to show daily chart
document.getElementById('driverKmDriverFilter')?.addEventListener('change', function() {
    const month = document.getElementById('driverKmMonthFilter')?.value;
    loadDriverKmDailyChart(month, this.value);
});
document.getElementById('driverKmMonthFilter')?.addEventListener('change', function() {
    const driver = document.getElementById('driverKmDriverFilter')?.value;
    loadDriverKmDailyChart(this.value, driver);
});

// Hook salary calculator to show YTD when driver and month are selected
document.getElementById('salaryDriverSelect')?.addEventListener('change', function() {
    const month = document.getElementById('salaryMonth')?.value;
    if (this.value && month) loadSalaryYtdSummary(this.value, month);
});
document.getElementById('salaryMonth')?.addEventListener('change', function() {
    const driver = document.getElementById('salaryDriverSelect')?.value;
    if (driver && this.value) loadSalaryYtdSummary(driver, this.value);
});

// Hook day-off driver/month filter to show calendar
function tryRenderDayOffCalendar() {
    const driver = document.getElementById('driverDayOffDriver')?.value;
    const month = document.getElementById('driverDayOffMonth')?.value;
    if (!driver || !month) return;
    const uid = getQueryUserId();
    const [yr, mo] = month.split('-');
    const startDate = `${yr}-${mo}-01`;
    const daysInMonth = new Date(parseInt(yr), parseInt(mo), 0).getDate();
    const endDate = `${yr}-${mo}-${String(daysInMonth).padStart(2,'0')}`;
    supabaseClient.from('driver_day_offs').select('day_off_date').eq('user_id', uid).eq('driver_id', driver).gte('day_off_date', startDate).lte('day_off_date', endDate)
        .then(({ data }) => {
            const driverName = document.getElementById('driverDayOffDriver')?.selectedOptions?.[0]?.textContent || '';
            renderDayOffCalendar(data || [], month, driverName);
        });
}
document.getElementById('driverDayOffDriver')?.addEventListener('change', tryRenderDayOffCalendar);
document.getElementById('driverDayOffMonth')?.addEventListener('change', tryRenderDayOffCalendar);

// ── Patch loadDrivers to also call renderStaffBreakdownWidgets ──
if (typeof loadDrivers === 'function') {
    const _origLD = loadDrivers;
    window.loadDrivers = async function() {
        await _origLD.apply(this, arguments);
        // Fetch all drivers for breakdown
        try {
            const { data: allD } = await supabaseClient.from('drivers').select('id, role, terminated').eq('user_id', getQueryUserId());
            renderStaffBreakdownWidgets(allD || []);
        } catch(e) {}
    };
}

// ── Patch loadHireRecords to also render summary strip ──
if (typeof loadHireRecords === 'function') {
    const _origLHR = loadHireRecords;
    window.loadHireRecords = async function() {
        await _origLHR.apply(this, arguments);
        // Re-fetch to pass to strip
        try {
            const monthValue = document.getElementById('hireRecordsMonth')?.value;
            const vehicleFilter = document.getElementById('hireRecordsVehicleFilter')?.value;
            let q = supabaseClient.from('hire_to_pay_records').select('hire_amount, fuel_cost, distance, vehicle_id').eq('user_id', getQueryUserId());
            if (monthValue) {
                const [yr, mo] = monthValue.split('-');
                q = q.gte('hire_date', `${yr}-${mo}-01`).lte('hire_date', `${yr}-${mo}-${new Date(yr, mo, 0).getDate()}`);
            }
            if (vehicleFilter) q = q.eq('vehicle_id', vehicleFilter);
            const { data } = await q;
            renderHireRecordsSummaryStrip(data || []);
        } catch(e) {}
    };
}

// ── Patch loadCommitmentRecords to also render summary strip ──
if (typeof loadCommitmentRecords === 'function') {
    const _origLCR = loadCommitmentRecords;
    window.loadCommitmentRecords = async function() {
        await _origLCR.apply(this, arguments);
        try {
            const monthValue = document.getElementById('commitmentRecordsMonth')?.value;
            const vehicleFilter = document.getElementById('commitmentRecordsVehicleFilter')?.value;
            let q = supabaseClient.from('commitment_records').select('fuel_cost, distance, vehicle_id, fuel_litres').eq('user_id', getQueryUserId());
            if (monthValue) {
                const [yr, mo] = monthValue.split('-');
                q = q.gte('hire_date', `${yr}-${mo}-01`).lte('hire_date', `${yr}-${mo}-${new Date(yr, mo, 0).getDate()}`);
            }
            if (vehicleFilter) q = q.eq('vehicle_id', vehicleFilter);
            const { data } = await q;
            renderCommitmentSummaryStrip(data || []);
        } catch(e) {}
    };
}

// ── Patch loadMaintenanceRecords to also load charts ──
if (typeof loadMaintenanceRecords === 'function') {
    const _origLMR = loadMaintenanceRecords;
    window.loadMaintenanceRecords = async function() {
        await _origLMR.apply(this, arguments);
        const mv = document.getElementById('maintenanceMonth')?.value;
        if (mv) loadMaintenancePieChart(mv);
    };
}

// ── Patch loadChequeStatus to also load cheques due banner ──
if (typeof loadChequeStatus === 'function') {
    const _origLCS = loadChequeStatus;
    window.loadChequeStatus = async function() {
        await _origLCS.apply(this, arguments);
        await loadChequesDueSoonBanner();
    };
}


// Initial load for dashboard page (if it's already active on load)
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const dashPage = document.getElementById('dashboard');
        if (dashPage && dashPage.classList.contains('active')) {
            loadDashboardExtras();
        }
        // Load advance trend and cheque banner on relevant pages too
        const advancePage = document.getElementById('driver-advances');
        if (advancePage && advancePage.classList.contains('active')) {
            loadAdvanceTrendChart();
        }
    }, 2000); // Wait for auth + data to initialize
});