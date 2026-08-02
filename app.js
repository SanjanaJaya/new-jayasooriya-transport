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

// Utility helpers for staff nicknames
function cleanDriverName(fullName) {
    return (fullName || '').replace(/\s*\(.*?\)\s*$/, '').trim();
}
function getNickname(fullName) {
    const match = (fullName || '').match(/\((.*?)\)$/);
    return match ? match[1].trim() : '';
}

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
let weeklyVehicleKmChart = null;
let cumulativeKmCompareChart = null;

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
        showToast(`You don't have permission to ${action} data. Contact the administrator for access.`, 'warning');
        return false;
    }
    return true;
}


// ============================================================
//  GLOBAL UTILITY SYSTEM — Toast, Confirm, Skeleton, Cache, Pagination
// ============================================================

// --- TOAST NOTIFICATIONS (Fix 3) ---
function showToast(message, type = 'info', duration = 3500) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    let container = document.getElementById('jtmsToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'jtmsToastContainer';
        container.className = 'jtms-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `jtms-toast ${type}`;
    toast.innerHTML = `<span class="jtms-toast-icon">${icons[type] || 'ℹ️'}</span><span class="jtms-toast-body">${message}</span>`;
    toast.addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 320);
    }, duration);
}

// --- CONFIRM MODAL (Fix 3) ---
function showConfirm(message, onYes, onNo = null, { title = 'Confirm Action', icon = '⚠️', yesLabel = 'Yes, proceed', noLabel = 'Cancel' } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'jtms-confirm-overlay';
    overlay.innerHTML = `
        <div class="jtms-confirm-box">
            <span class="jtms-confirm-icon">${icon}</span>
            <div class="jtms-confirm-title">${title}</div>
            <div class="jtms-confirm-msg">${message}</div>
            <div class="jtms-confirm-btns">
                <button class="jtms-confirm-yes">${yesLabel}</button>
                <button class="jtms-confirm-no">${noLabel}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.jtms-confirm-yes').addEventListener('click', () => { overlay.remove(); if (onYes) onYes(); });
    overlay.querySelector('.jtms-confirm-no').addEventListener('click',  () => { overlay.remove(); if (onNo)  onNo(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); if (onNo) onNo(); } });
}

// Async version of showConfirm for use with await in async functions
function showConfirmAsync(message, options = {}) {
    return new Promise(resolve => {
        showConfirm(message, () => resolve(true), () => resolve(false), options);
    });
}

// --- SKELETON LOADER (Fix 17) ---
function showTableSkeleton(tbodyId, cols = 5, rows = 5) {
    const tbody = document.getElementById(tbodyId) || document.querySelector(`#${tbodyId} tbody`) || (() => { const t = document.querySelector(tbodyId); return t?.querySelector('tbody') || t; })();
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: rows }, () =>
        `<tr class="skeleton-table-row">${Array.from({ length: cols }, () => '<td><span></span></td>').join('')}</tr>`
    ).join('');
}

// --- ADMIN OFFLINE CACHE (Fix 18) ---
const ADMIN_CACHE_PREFIX = 'jt_admin_';

function setCachedAdminData(key, data) {
    try { localStorage.setItem(ADMIN_CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch(e) {}
}

function getCachedAdminData(key) {
    try {
        const raw = localStorage.getItem(ADMIN_CACHE_PREFIX + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.data ?? null;
    } catch(e) { return null; }
}

function showOfflineBanner(visible) {
    const banner = document.getElementById('adminOfflineBanner');
    if (banner) banner.classList.toggle('visible', visible);
}

window.addEventListener('online',  () => showOfflineBanner(false));
window.addEventListener('offline', () => showOfflineBanner(true));

// --- PAGINATION HELPER (Fix 19) ---
function createPagination(containerId, data, renderRowFn, tableId, colCount, pageSize = 25) {
    let currentPage = 1;
    const totalPages = () => Math.max(1, Math.ceil(data.length / pageSize));

    function render() {
        const tbody = document.querySelector(`#${tableId} tbody`) || document.getElementById(tableId);
        if (!tbody) return;
        const start = (currentPage - 1) * pageSize;
        const pageData = data.slice(start, start + pageSize);
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;padding:20px;color:var(--text-muted);">No records found</td></tr>`;
        } else {
            pageData.forEach(item => {
                const row = renderRowFn(item);
                if (row) tbody.appendChild(row);
            });
        }
        renderPaginationBar();
    }

    function renderPaginationBar() {
        let bar = document.getElementById(containerId + '_pgbar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = containerId + '_pgbar';
            bar.className = 'pagination-bar';
            const container = document.getElementById(containerId);
            if (container) container.after(bar);
        }
        if (totalPages() <= 1) { bar.style.display = 'none'; return; }
        bar.style.display = 'flex';
        const tp = totalPages();
        const cp = currentPage;
        let btns = `<button class="pagination-btn" id="${containerId}_prev" ${cp===1?'disabled':''}>‹</button>`;
        const range = [];
        if (tp <= 7) { for(let i=1;i<=tp;i++) range.push(i); }
        else {
            range.push(1);
            if (cp > 3) range.push('...');
            for(let i=Math.max(2,cp-1);i<=Math.min(tp-1,cp+1);i++) range.push(i);
            if (cp < tp-2) range.push('...');
            range.push(tp);
        }
        range.forEach(p => {
            if (p === '...') btns += `<span class="pagination-btn" style="cursor:default;border:none;">…</span>`;
            else btns += `<button class="pagination-btn${p===cp?' active':''}" data-pg="${p}">${p}</button>`;
        });
        btns += `<button class="pagination-btn" id="${containerId}_next" ${cp===tp?'disabled':''}>›</button>`;
        const start = (cp-1)*pageSize+1, end = Math.min(cp*pageSize, data.length);
        bar.innerHTML = `<span class="pagination-info">Showing ${start}–${end} of ${data.length}</span><div class="pagination-btns">${btns}</div>`;
        bar.querySelector(`#${containerId}_prev`)?.addEventListener('click', () => { if(currentPage>1){currentPage--;render();} });
        bar.querySelector(`#${containerId}_next`)?.addEventListener('click', () => { if(currentPage<tp){currentPage++;render();} });
        bar.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => { currentPage=parseInt(b.dataset.pg); render(); }));
    }

    render();
    return { refresh: render, goToPage: (p) => { currentPage = Math.min(Math.max(1,p), totalPages()); render(); } };
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
            initVehicleExpiryPage(); // Init Expiry Tracker
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
    'dashboard': null,
    'cheque-status': null,
    'excessing-litres': null,
    'leasing': null,
    'credit-cards': null,
    'kevilton-distributions': null,
    'drivers': 'navGroupStaff',
    'driver-advances': 'navGroupStaff',
    'driver-dayoffs': 'navGroupStaff',
    'driver-km-log': 'navGroupStaff',
    'driver-salary': 'navGroupStaff',
    'hire-vehicles': 'navGroupFleet',
    'hire-records': 'navGroupFleet',
    'other-operation-hires': 'navGroupFleet',
    'commitment-vehicles': 'navGroupFleet',
    'commitment-records': 'navGroupFleet',
    'commitment-dayoffs': 'navGroupFleet',
    'lorry-maintenance': 'navGroupFleet',
    'vehicle-expiry': 'navGroupFleet',
    'vehicle-tracker': null,
};

function openNavGroup(groupId) {
    const group = document.getElementById(groupId);
    const header = group?.querySelector('.nav-group-header');
    const items = group?.querySelector('.nav-group-items');
    if (!group || !header || !items) return;
    header.setAttribute('aria-expanded', 'true');
    items.classList.add('open');
    group.classList.add('has-active');
}

function closeNavGroup(groupId) {
    const group = document.getElementById(groupId);
    const header = group?.querySelector('.nav-group-header');
    const items = group?.querySelector('.nav-group-items');
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
        const key = header.dataset.group; // 'staff' or 'fleet'
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
        'excessing-litres': 'Excessing Litres',
        'leasing': 'Leasing & Loans',
        'credit-cards': 'Credit Cards',
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
        'kevilton-distributions': 'Kevilton Distributions',
        'vehicle-expiry': 'Insurance Expiry Tracker',
        'vehicle-tracker': 'Vehicle Tracker',
    };

    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';

    if (page === 'dashboard') loadDashboard();
    if (page === 'cheque-status') loadChequeStatus();
    if (page === 'leasing') loadLeasingPage();
    if (page === 'credit-cards') loadCreditCardsPage();
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
            mEl.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
        }
        loadMaintenanceRecords();
    }
    if (page === 'other-operation-hires') {
        ensureMonthValue('otherOperationHiresMonth');
        loadOtherOperationHires();
        updateOtherOperationHireVehicleFilter();
    }
    if (page === 'excessing-litres') {
        ensureMonthValue('elMonthFilter');
        loadExcessingLitres();
    }
    if (page === 'kevilton-distributions') {
        loadKeviltonDistributors();
    }
    if (page === 'vehicle-expiry') {
        loadVehicleExpiryPage();
    }
    if (page === 'vehicle-tracker') {
        if (typeof initVehicleTracker === 'function') initVehicleTracker();
    }
}

// ============ BACKGROUND PRELOADER ============
// ============ BACKGROUND PRELOADER ============
async function preloadAllData() {
    console.log("Preloading background data starting in 3 seconds...");
    try {
        // Wait for the app to render and become idle before triggering heavy queries
        await new Promise(resolve => setTimeout(resolve, 3000));

        const tasks = [
            () => loadDrivers(),
            () => loadHireVehicles(),
            () => loadCommitmentVehicles(),
            () => loadDriverAdvances(),
            () => loadHireRecords(),
            () => loadCommitmentRecords(),
            () => loadDayOffs(),
            async () => {
                ensureMonthValue('driverDayOffMonth');
                if (typeof loadDriverDayOffs === 'function') await loadDriverDayOffs();
            },
            async () => {
                const mEl = document.getElementById('maintenanceMonth');
                if (mEl && !mEl.value) {
                    const n = new Date();
                    mEl.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
                }
                if (typeof loadMaintenanceRecords === 'function') await loadMaintenanceRecords();
            },
            async () => {
                if (typeof loadSalaryDrivers === 'function') await loadSalaryDrivers();
            },
            async () => {
                if (typeof loadSalaryHistory === 'function') await loadSalaryHistory();
            },
            async () => {
                ensureMonthValue('otherOperationHiresMonth');
                if (typeof loadOtherOperationHires === 'function') await loadOtherOperationHires();
            },
            async () => {
                ensureMonthValue('driverKmMonthFilter');
                if (typeof loadDriverKmRecords === 'function') await loadDriverKmRecords();
            },
            async () => {
                if (typeof loadVehicleExpiryPage === 'function') await loadVehicleExpiryPage();
            }
        ];

        // Execute background preload tasks sequentially with a small 100ms pause to prevent connection spikes
        for (const task of tasks) {
            try {
                await task();
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.error("Error in background preload task:", err);
            }
        }
        console.log("Background preloading complete.");
    } catch (e) {
        console.error('Error in preloadAllData:', e);
    }
}

// ============ FIX: UPDATED LOAD DASHBOARD WITH CONSOLIDATED LOADING & CACHING ============
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

        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

        const currentQueryUserId = getQueryUserId();

        // Phase 1: Consolidated Single Month Fetch
        const [
            { data: hireRecords },
            { data: commitmentRecords },
            { data: otherOpHires },
            { data: dayOffs },
            { data: hireVehicles },
            { data: commitmentVehicles },
            { data: excessingLitres }
        ] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_day_offs').select('*').eq('user_id', currentQueryUserId).gte('day_off_date', startDate).lte('day_off_date', endDate),
            supabaseClient.from('hire_to_pay_vehicles').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId),
            supabaseClient.from('excessing_litres').select('actual_cost, fuel_amount_l').eq('user_id', currentQueryUserId).gte('date', startDate).lte('date', endDate)
        ]);

        // In-memory mapping of joins so chart functions don't need separate queries
        const hireVehiclesMap = {};
        hireVehicles?.forEach(v => { hireVehiclesMap[v.id] = v; });
        hireRecords?.forEach(r => {
            r.hire_to_pay_vehicles = r.hire_to_pay_vehicles || hireVehiclesMap[r.vehicle_id] || null;
        });

        const commVehiclesMap = {};
        commitmentVehicles?.forEach(v => { commVehiclesMap[v.id] = v; });
        commitmentRecords?.forEach(r => {
            r.commitment_vehicles = r.commitment_vehicles || commVehiclesMap[r.vehicle_id] || null;
        });

        const cachedData = {
            hireRecords: hireRecords || [],
            commitmentRecords: commitmentRecords || [],
            otherOpHires: otherOpHires || [],
            dayOffs: dayOffs || [],
            hireVehicles: hireVehicles || [],
            commitmentVehicles: commitmentVehicles || [],
            excessingLitres: excessingLitres || []
        };

        // Render Critical UI Elements immediately using cached data (Phase 1)
        await loadDashboardData(monthValue, cachedData);
        await loadAdvancedDashboardStats(monthValue, cachedData);

        // Render tracked vehicles
        renderTrackedVehicles();

        // Render dashboard insurance alerts
        loadDashboardInsuranceWidget();

        // Load Fleet Overview
        loadFleetOverview();

        // Phase 2: Load tables and charts asynchronously without blocking the UI
        Promise.all([
            loadVehiclePerformance(monthValue, cachedData),
            loadVehicleFuelEfficiency(monthValue, cachedData),
            loadDriverPerformance(monthValue), // queries separate driver tables, so it remains independent
            loadDashboardCharts(cachedData),
            loadVehicleRevenuePieChart(monthValue, cachedData),
            loadRevenueTypeSplitChart(monthValue, cachedData),
            loadTopRoutesChart(monthValue, cachedData),
            loadDailyActivityChart(monthValue, cachedData),
            loadCostVsRevenueChart(monthValue, cachedData),
            loadDailyKmChart(monthValue, cachedData),
            loadDailyFuelChart(monthValue, cachedData),
            loadWeeklyVehicleKmChart(monthValue, cachedData),
            loadCumulativeKmCompareChart(monthValue, cachedData)
        ]).catch(err => console.error("Error loading deferred dashboard components:", err));

        // Load heavy all-time statistics last
        setTimeout(() => {
            loadAllTimeStatistics();
            loadTopPerformingVehicles();
            loadRecordsHallOfFame(monthValue);
        }, 100);

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

    if (!dateInput || !addBtn || !lorryNoSelect) return;

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
        if (!lorryNoSelect.value) { showToast('Please select a vehicle.', 'warning'); return; }
        if (!dateInput.value) { showToast('Please select a service date.', 'warning'); return; }

        const targetKmsInput = document.getElementById('serviceTargetKms');
        const targetKms = targetKmsInput ? parseInt(targetKmsInput.value) || 5000 : 5000;

        const currentUserId = getQueryUserId() || (currentUser ? currentUser.id : null);
        if (!currentUserId) {
            showToast('User authentication error. Cannot save.', 'error');
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
            if (targetKmsInput) targetKmsInput.value = 5000;

            renderTrackedVehicles();
        } catch (e) {
            console.error('Error saving service tracker:', e);
            showToast('Failed to save service tracker to database.', 'error');
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
    } catch (e) {
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

window.removeTrackedVehicle = async function (baseName) {
    if (await showConfirmAsync('Stop tracking this vehicle?')) {
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
            showToast('Failed to remove tracker. Please try again.', 'error');
        }
    }
};

async function calculateIndividualServiceKMs(tracker, elementId, allHireVehicles, allCommVehicles) {
    const kmDisplay = document.getElementById(elementId + '_kms');
    const statusDisplay = document.getElementById(elementId + '_status');
    if (!kmDisplay) return;

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
                if (metricBox) metricBox.classList.add('danger');
            } else {
                statusDisplay.textContent = (target - totalKm).toLocaleString() + ' KM Remaining';
                statusDisplay.style.color = 'var(--green)';
                statusDisplay.style.fontWeight = '500';
                if (metricBox) metricBox.classList.remove('danger');
            }
        }
    } catch (e) {
        console.error('Error calculating service KMs for', tracker.base_name, e);
        kmDisplay.textContent = 'Error';
    }
}

// ============ DRIVERS ============
function calculateAge(dobStr) {
    if (!dobStr) return null;
    const birthDate = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function formatDriverAge(ageVal) {
    if (!ageVal) return '-';
    if (ageVal > 19000000) {
        const y = Math.floor(ageVal / 10000);
        const m = Math.floor((ageVal % 10000) / 100);
        const d = ageVal % 100;
        const dobStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const age = calculateAge(dobStr);
        return age !== null ? `${age} years` : '-';
    }
    return `${ageVal} years`;
}

window.updateCalculatedAge = function() {
    const dobVal = document.getElementById('driverDob')?.value;
    const age = calculateAge(dobVal);
    const displayEl = document.getElementById('driverAgeDisplay');
    if (displayEl) {
        displayEl.value = age !== null ? `${age} years` : '';
    }
};
document.getElementById('addDriverBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('driverForm').reset();
    document.getElementById('driverId').value = '';
    document.getElementById('driverSalaryType').value = 'fixed';
    if (document.getElementById('driverOperation')) document.getElementById('driverOperation').value = '';
    if (document.getElementById('driverIsCoordinator')) document.getElementById('driverIsCoordinator').checked = false;
    
    // Clear Birthday and calculated age fields
    const dobInput = document.getElementById('driverDob');
    if (dobInput) dobInput.value = '';
    const ageDisplay = document.getElementById('driverAgeDisplay');
    if (ageDisplay) ageDisplay.value = '';

    toggleDriverSalaryTypeFields();
    document.getElementById('driverFormContainer').style.display = 'block';
    document.getElementById('driverFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Wire generate password button
    wireGeneratePasswordBtn();
});

// Generate a unique 8-char driver password
function generateUniquePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
        if (i === 4) pwd += '-';
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
}

function wireGeneratePasswordBtn() {
    const btn = document.getElementById('generatePasswordBtn');
    if (btn) {
        btn.onclick = () => {
            const pwdInput = document.getElementById('driverPassword');
            if (pwdInput) pwdInput.value = generateUniquePassword();
        };
    }
}

// Toggle salary type fields in driver form
function toggleDriverSalaryTypeFields() {
    const salaryType = document.getElementById('driverSalaryType').value;
    const role = (document.getElementById('driverRole')?.value || '').toLowerCase();
    const fixedFields = document.getElementById('fixedSalaryFields');
    const perTipFields = document.getElementById('perTipSalaryFields');
    
    const kmLimitInput = document.getElementById('driverKmLimit');
    const extraKmInput = document.getElementById('driverExtraKmRate');

    if (salaryType === 'per_tip') {
        if (fixedFields) fixedFields.style.display = 'none';
        if (perTipFields) perTipFields.style.display = 'block';
    } else {
        if (fixedFields) fixedFields.style.display = 'block';
        if (perTipFields) perTipFields.style.display = 'none';
        
        // Hide KM fields for fixed-salary helper
        if (role === 'helper') {
            if (kmLimitInput) kmLimitInput.style.display = 'none';
            if (extraKmInput) {
                extraKmInput.style.display = 'none';
                const parentRow = extraKmInput.closest('.form-row');
                if (parentRow) parentRow.style.display = 'none';
            }
        } else {
            if (kmLimitInput) kmLimitInput.style.display = '';
            if (extraKmInput) {
                extraKmInput.style.display = '';
                const parentRow = extraKmInput.closest('.form-row');
                if (parentRow) parentRow.style.display = '';
            }
        }
    }
}

document.getElementById('cancelDriverBtn')?.addEventListener('click', () => {
    document.getElementById('driverFormContainer').style.display = 'none';
});

// Driver Form Submit
document.getElementById('driverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

    const id = document.getElementById('driverId').value;
    const salaryType = document.getElementById('driverSalaryType').value || 'fixed';
    
    const nameInput = document.getElementById('driverName').value.trim();
    const nicknameInput = document.getElementById('driverNickname').value.trim();
    const combinedName = nicknameInput ? `${nameInput} (${nicknameInput})` : nameInput;

    const isHelper = (document.getElementById('driverRole').value || '').toLowerCase() === 'helper';
    const data = {
        name: combinedName,
        contact: document.getElementById('driverContact').value,
        license_number: document.getElementById('driverLicense').value || null,
        password: document.getElementById('driverPassword')?.value?.trim() || null,
        age: (() => {
            const dobVal = document.getElementById('driverDob')?.value;
            if (!dobVal) return null;
            const parts = dobVal.split('-');
            return parseInt(parts[0]) * 10000 + parseInt(parts[1]) * 100 + parseInt(parts[2]);
        })(),
        address: document.getElementById('driverAddress').value,
        photo_url: document.getElementById('driverPhoto').value || null,
        role: document.getElementById('driverRole').value || null,
        operation: document.getElementById('driverOperation')?.value || null,
        is_coordinator: document.getElementById('driverIsCoordinator') ? document.getElementById('driverIsCoordinator').checked : false,
        salary_type: salaryType,
        basic_salary: salaryType === 'fixed' ? (parseFloat(document.getElementById('driverBasicSalary').value) || null) : null,
        km_limit: (salaryType === 'fixed' && !isHelper) ? (parseFloat(document.getElementById('driverKmLimit').value) || null) : null,
        extra_km_rate: (salaryType === 'fixed' && !isHelper) ? (parseFloat(document.getElementById('driverExtraKmRate').value) || null) : null,
        per_tip_charge: salaryType === 'per_tip' ? (parseFloat(document.getElementById('driverPerTipCharge').value) || null) : null,
        terminated: document.getElementById('driverTerminated') ? document.getElementById('driverTerminated').checked : false,
        user_id: adminUserId
    };

    try {
        // Enforce single coordinator rule per operation
        if (data.is_coordinator && data.operation) {
            let uncoordQuery = supabaseClient
                .from('drivers')
                .update({ is_coordinator: false })
                .eq('operation', data.operation)
                .eq('user_id', adminUserId);
            if (id) uncoordQuery = uncoordQuery.neq('id', id);
            await uncoordQuery;
        }

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
                showToast('Another staff member already has this license number. Please use a unique license number.', 'warning');
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
        showToast('Error saving driver: ' + error.message, 'error');
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
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px; color: #7F8C8D;">No staff found</td></tr>';
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
                const isHelper = (driver.role || '').toLowerCase() === 'helper';
                if (driver.basic_salary) parts.push(`Basic: LKR ${driver.basic_salary.toFixed(2)}`);
                if (driver.km_limit && !isHelper) parts.push(`KM Limit: ${driver.km_limit} km`);
                if (driver.extra_km_rate && !isHelper) parts.push(`Extra: LKR ${driver.extra_km_rate.toFixed(2)}/km`);
                salaryInfo = parts.length > 0 ? parts.join('<br>') : '-';
            }

            // ── Lorry assignment badge / dropdown ──
            const assignment = assignmentMap[driver.id];
            const driverRole = (driver.role || 'Driver').toLowerCase();
            let lorryHtml = '';

            const nameCleanForAssign = cleanDriverName(driver.name).toLowerCase();
            const isFamilyDriverForAssign = nameCleanForAssign === 'jaap jayasooriya' || nameCleanForAssign === 'jauk jayasooriya';

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
            } else if (userRole !== 'viewer' && vehicleList.length > 0 && driverRole !== 'other' && !isFamilyDriverForAssign) {
                // Not assigned — filtered dropdown by role slot (only show for non-family drivers)
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
            
            const cleanedName = cleanDriverName(driver.name);
            const nickname = getNickname(driver.name);

            let operationHTML = '<span style="color:#7F8C8D;font-size:12px;">-</span>';
            if (driver.operation) {
                const opLower = driver.operation.toLowerCase();
                const logoUrl = opLower === 'kevilton'
                    ? 'https://i.postimg.cc/pTbqBcdz/idm2DKn-i-I.png'
                    : (opLower === 'pelwatte' ? 'https://i.postimg.cc/Kv7vZCdh/db809eadd12d21eb61044e0f3bf7c9b7.jpg' : null);
                
                const logoTag = logoUrl ? `<img src="${logoUrl}" style="width:14px;height:14px;object-fit:contain;border-radius:50%;background:#fff;padding:1px;">` : '';
                const coordTag = driver.is_coordinator ? `<span style="background:rgba(241,196,15,0.15);color:#F39C12;border:1px solid rgba(241,196,15,0.4);padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;gap:3px;white-space:nowrap;" title="Operation Coordinator">⭐ Coordinator</span>` : '';
                
                const bgStyle = opLower === 'kevilton'
                    ? 'background:rgba(209,0,31,0.18);color:#FF6B81;border:1px solid rgba(209,0,31,0.4);'
                    : 'background:rgba(0,179,126,0.18);color:#2ECC71;border:1px solid rgba(0,179,126,0.4);';
                    
                const opBadge = `<span style="${bgStyle}padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;">${logoTag}${driver.operation}</span>`;
                
                operationHTML = `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${opBadge}${coordTag}</div>`;
            }

            row.innerHTML = `
                <td>${photoHTML}</td>
                <td>${cleanedName}${driver.terminated ? '<br><span style="background:#E74C3C;color:white;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:bold;">TERMINATED</span>' : ''}${lorryHtml}</td>
                <td>${nickname || '-'}</td>
                <td><span style="background:#3498db;color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">${driver.role || 'Driver'}</span></td>
                <td>${operationHTML}</td>
                <td>${salaryTypeBadge}</td>
                <td>${driver.contact}</td>
                <td>${driver.license_number || '-'}</td>
                <td>
                    ${driver.password
                        ? `<span style="font-family:monospace;font-size:12px;letter-spacing:1px;background:rgba(0,0,0,0.06);padding:2px 7px;border-radius:6px;">${driver.password}</span>
                           <button onclick="navigator.clipboard.writeText('${driver.password}').then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='📋',1200)})" style="border:none;background:none;cursor:pointer;font-size:13px;vertical-align:middle;" title="Copy password">📋</button>`
                        : '<span style="color:#bbb;font-size:12px;">Not set</span>'
                    }
                </td>
                <td>${formatDriverAge(driver.age)}</td>
                <td>${driver.address}</td>
                <td style="font-size:12px;">${salaryInfo}</td>
                ${actionButtons}
            `;
            return row;
        }

        const normalActiveDrivers = activeDrivers.filter(d => {
            const nameClean = cleanDriverName(d.name).toLowerCase();
            return nameClean !== 'jaap jayasooriya' && nameClean !== 'jauk jayasooriya';
        });
        const familyActiveDrivers = activeDrivers.filter(d => {
            const nameClean = cleanDriverName(d.name).toLowerCase();
            return nameClean === 'jaap jayasooriya' || nameClean === 'jauk jayasooriya';
        });

        normalActiveDrivers.forEach(driver => tbody.appendChild(buildDriverRow(driver)));

        if (familyActiveDrivers.length > 0) {
            const colSpan = userRole === 'viewer' ? 11 : 12;
            const familyHeaderRow = document.createElement('tr');
            familyHeaderRow.innerHTML = `
                <td colspan="${colSpan}" style="background-color: var(--surface-hover); font-weight: bold; padding: 12px; color: var(--text-primary); text-align: left; border-bottom: 2px solid var(--brand-red);">
                    👨‍👩‍👦 Family Drivers
                </td>
            `;
            tbody.appendChild(familyHeaderRow);
            familyActiveDrivers.forEach(driver => tbody.appendChild(buildDriverRow(driver)));
        }

        if (terminatedDrivers.length > 0) {
            const colSpan = userRole === 'viewer' ? 11 : 12;
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


window.assignLorry = async function (driverId, selectEl, driverRole) {
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
        showToast('Error assigning lorry: ' + err.message, 'error');
    }
};

// Remove lorry assignment from a staff member
window.unassignLorry = async function (driverId) {
    if (!checkAdminAccess('unassign')) return;
    if (!await showConfirmAsync('Remove this lorry assignment?')) return;
    try {
        const { error } = await supabaseClient.from('staff_lorry_assignments')
            .delete().eq('driver_id', driverId).eq('user_id', getQueryUserId());
        if (error) throw error;
        loadDrivers();
    } catch (err) {
        console.error('Error unassigning lorry:', err);
        showToast('Error removing assignment: ' + err.message, 'error');
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
        document.getElementById('driverName').value = cleanDriverName(data.name);
        document.getElementById('driverNickname').value = getNickname(data.name);
        document.getElementById('driverContact').value = data.contact;
        document.getElementById('driverLicense').value = data.license_number || '';
        if (document.getElementById('driverPassword')) document.getElementById('driverPassword').value = data.password || '';
        if (data.age) {
            if (data.age > 19000000) {
                const y = Math.floor(data.age / 10000);
                const m = Math.floor((data.age % 10000) / 100);
                const d = data.age % 100;
                const dobStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                document.getElementById('driverDob').value = dobStr;
                document.getElementById('driverAgeDisplay').value = formatDriverAge(data.age);
            } else {
                document.getElementById('driverDob').value = '';
                document.getElementById('driverAgeDisplay').value = `${data.age} years`;
            }
        } else {
            document.getElementById('driverDob').value = '';
            document.getElementById('driverAgeDisplay').value = '';
        }
        document.getElementById('driverAddress').value = data.address;
        document.getElementById('driverPhoto').value = data.photo_url || '';
        document.getElementById('driverRole').value = data.role || '';
        if (document.getElementById('driverOperation')) {
            document.getElementById('driverOperation').value = data.operation || '';
        }
        if (document.getElementById('driverIsCoordinator')) {
            document.getElementById('driverIsCoordinator').checked = data.is_coordinator || false;
        }
        document.getElementById('driverSalaryType').value = data.salary_type || 'fixed';
        document.getElementById('driverBasicSalary').value = data.basic_salary || '';
        document.getElementById('driverKmLimit').value = data.km_limit || '';
        document.getElementById('driverExtraKmRate').value = data.extra_km_rate || '';
        document.getElementById('driverPerTipCharge').value = data.per_tip_charge || '';
        toggleDriverSalaryTypeFields();
        if (document.getElementById('driverTerminated')) {
            document.getElementById('driverTerminated').checked = data.terminated || false;
        }
        // Wire generate password button on edit open
        wireGeneratePasswordBtn();
        document.getElementById('driverFormContainer').style.display = 'block';
        document.getElementById('driverFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading driver: ' + error.message, 'error');
    }
}

async function deleteDriver(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this driver?')) {
        try {
            await supabaseClient.from('drivers').delete().eq('id', id);
            loadDrivers();
        } catch (error) {
            showToast('Error deleting driver: ' + error.message, 'error');
        }
    }
}

// ============ HIRE-TO-PAY VEHICLES ============
document.getElementById('addHireVehicleBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('hireVehicleForm').reset();
    document.getElementById('hireVehicleId').value = '';
    // Reset terminated checkbox
    if (document.getElementById('hireVehicleTerminated')) {
        document.getElementById('hireVehicleTerminated').checked = false;
    }
    document.getElementById('hireVehicleFormContainer').style.display = 'block';
    document.getElementById('hireVehicleFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('cancelHireVehicleBtn')?.addEventListener('click', () => {
    document.getElementById('hireVehicleFormContainer').style.display = 'none';
});

document.getElementById('hireVehicleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

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
        showToast('Error saving vehicle: ' + error.message, 'error');
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
        if (document.getElementById('hireVehicleTerminated')) {
            document.getElementById('hireVehicleTerminated').checked = data.terminated || false;
        }

        document.getElementById('hireVehicleFormContainer').style.display = 'block';
        document.getElementById('hireVehicleFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading vehicle: ' + error.message, 'error');
    }
}

async function deleteHireVehicle(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this vehicle?')) {
        try {
            await supabaseClient.from('hire_to_pay_vehicles').delete().eq('id', id);
            loadHireVehicles();
        } catch (error) {
            showToast('Error deleting vehicle: ' + error.message, 'error');
        }
    }
}

// ============ HIRE-TO-PAY RECORDS ============
document.getElementById('addHireRecordBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('hireRecordForm').reset();
    document.getElementById('hireRecordId').value = '';
    document.getElementById('hireRecordFormContainer').style.display = 'block';
    document.getElementById('hireRecordFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('cancelHireRecordBtn')?.addEventListener('click', () => {
    document.getElementById('hireRecordFormContainer').style.display = 'none';
});

document.getElementById('hireRecordsMonth')?.addEventListener('change', loadHireRecords);
document.getElementById('hireRecordsVehicleFilter')?.addEventListener('change', loadHireRecords);
document.getElementById('hireRecordsTownSearch')?.addEventListener('input', loadHireRecords);

document.getElementById('hireRecordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

    const id = document.getElementById('hireRecordId').value;

    // --- DUPLICATE JOB NUMBER CHECK ---
    const _jobNum = document.getElementById('jobNumber')?.value?.trim();
    if (_jobNum && typeof isJobNumberDuplicate === 'function') {
        const _isDup = await isJobNumberDuplicate(_jobNum, 'hire_to_pay_records', id ? parseInt(id) : null);
        if (_isDup) {
            showToast(`Job Number "${_jobNum}" already exists in Hire to Pay! Please use a unique Job Number.`, 'error', 5000);
            const _jInput = document.getElementById('jobNumber');
            if (_jInput) { _jInput.focus(); _jInput.style.borderColor = '#e74c3c'; _jInput.style.boxShadow = '0 0 0 3px rgba(231,76,60,0.2)'; setTimeout(() => { _jInput.style.borderColor = ''; _jInput.style.boxShadow = ''; }, 3000); }
            return;
        }
    }
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
        if (typeof invalidateLocationCache === 'function') invalidateLocationCache();
    } catch (error) {
        showToast('Error saving hire record: ' + error.message, 'error');
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

        const { data, error } = await query.order('hire_date', { ascending: true }).order('job_number', { ascending: true });
        if (error) throw error;

        const tbody = document.querySelector('#hireRecordsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const townSearch = document.getElementById('hireRecordsTownSearch')?.value || '';
        const lowercaseSearch = townSearch.toLowerCase().trim();

        const filteredData = (data || []).filter(record => {
            if (!lowercaseSearch) return true;
            const fromLoc = (record.from_location || '').toLowerCase();
            const toLoc = (record.to_location || '').toLowerCase();
            return fromLoc.includes(lowercaseSearch) || toLoc.includes(lowercaseSearch);
        });

        // Natural alphanumeric sort by job_number (and hire_date)
        filteredData.sort((a, b) => {
            const dateA = a.hire_date || '';
            const dateB = b.hire_date || '';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            const jobA = a.job_number || '';
            const jobB = b.job_number || '';
            return jobA.localeCompare(jobB, undefined, { numeric: true, sensitivity: 'base' });
        });

        filteredData.forEach(record => {
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
        document.getElementById('hireRecordFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading hire record: ' + error.message, 'error');
    }
}

async function deleteHireRecord(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this hire record?')) {
        try {
            await supabaseClient.from('hire_to_pay_records').delete().eq('id', id);
            loadHireRecords();
        } catch (error) {
            showToast('Error deleting hire record: ' + error.message, 'error');
        }
    }
}

// ============ OTHER OPERATION HIRES ============
document.getElementById('addOtherOperationHireBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('otherOperationHireForm').reset();
    document.getElementById('otherOperationHireId').value = '';
    
    // Reset form dynamics
    const rateFieldsRow = document.getElementById('otherOpRateFieldsRow');
    const exactAmountRow = document.getElementById('otherOpExactAmountRow');
    const cocaRow = document.getElementById('otherOpCocaColaPaidRow');
    if (rateFieldsRow) rateFieldsRow.style.display = '';
    if (exactAmountRow) exactAmountRow.style.display = 'none';
    if (cocaRow) cocaRow.style.display = 'none';
    
    const first100Input = document.getElementById('otherOpFirst100Rate');
    const restKmInput = document.getElementById('otherOpRestKmRate');
    const exactAmountInput = document.getElementById('otherOpExactAmount');
    if (first100Input) first100Input.required = true;
    if (restKmInput) restKmInput.required = true;
    if (exactAmountInput) exactAmountInput.required = false;

    // Reset Operation Select & Custom Custom field
    const nameSelect = document.getElementById('otherOpOperationNameSelect');
    const customNameInput = document.getElementById('otherOpOperationNameCustom');
    if (nameSelect) nameSelect.value = '';
    if (customNameInput) {
        customNameInput.style.display = 'none';
        customNameInput.required = false;
        customNameInput.value = '';
    }

    document.getElementById('otherOperationHireFormContainer').style.display = 'block';
    document.getElementById('otherOperationHireFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('cancelOtherOperationHireBtn')?.addEventListener('click', () => {
    document.getElementById('otherOperationHireFormContainer').style.display = 'none';
});

document.getElementById('otherOperationHiresMonth')?.addEventListener('change', loadOtherOperationHires);
document.getElementById('otherOperationHiresVehicleFilter')?.addEventListener('change', loadOtherOperationHires);
document.getElementById('otherOperationHiresTownSearch')?.addEventListener('input', loadOtherOperationHires);

// Dynamic Form Listeners
document.getElementById('otherOpHireType')?.addEventListener('change', (e) => {
    const type = e.target.value;
    const rateFieldsRow = document.getElementById('otherOpRateFieldsRow');
    const exactAmountRow = document.getElementById('otherOpExactAmountRow');
    const first100Input = document.getElementById('otherOpFirst100Rate');
    const restKmInput = document.getElementById('otherOpRestKmRate');
    const exactAmountInput = document.getElementById('otherOpExactAmount');

    if (type === 'exact_amount') {
        if (rateFieldsRow) rateFieldsRow.style.display = 'none';
        if (exactAmountRow) exactAmountRow.style.display = '';
        if (first100Input) first100Input.required = false;
        if (restKmInput) restKmInput.required = false;
        if (exactAmountInput) exactAmountInput.required = true;
    } else {
        if (rateFieldsRow) rateFieldsRow.style.display = '';
        if (exactAmountRow) exactAmountRow.style.display = 'none';
        if (first100Input) first100Input.required = true;
        if (restKmInput) restKmInput.required = true;
        if (exactAmountInput) exactAmountInput.required = false;
    }
});

document.getElementById('otherOpOperationNameSelect')?.addEventListener('change', (e) => {
    const value = e.target.value;
    const customInput = document.getElementById('otherOpOperationNameCustom');
    const realInput = document.getElementById('otherOpOperationName');
    const cocaRow = document.getElementById('otherOpCocaColaPaidRow');

    if (value === 'COCACOLA') {
        if (customInput) {
            customInput.style.display = 'none';
            customInput.required = false;
            customInput.value = '';
        }
        if (realInput) {
            realInput.value = 'COCACOLA';
        }
        if (cocaRow) cocaRow.style.display = '';
    } else if (value === 'other') {
        if (customInput) {
            customInput.style.display = '';
            customInput.required = true;
        }
        if (realInput) {
            realInput.value = customInput ? customInput.value : '';
        }
        const isCocaCola = (customInput ? customInput.value : '').toLowerCase().replace(/[\s-]/g, '').includes('cocacola');
        if (cocaRow) cocaRow.style.display = isCocaCola ? '' : 'none';
    } else {
        if (customInput) {
            customInput.style.display = 'none';
            customInput.required = false;
            customInput.value = '';
        }
        if (realInput) {
            realInput.value = '';
        }
        if (cocaRow) cocaRow.style.display = 'none';
    }
});

document.getElementById('otherOpOperationNameCustom')?.addEventListener('input', (e) => {
    const name = e.target.value || '';
    const realInput = document.getElementById('otherOpOperationName');
    if (realInput) {
        realInput.value = name;
    }
    const cocaRow = document.getElementById('otherOpCocaColaPaidRow');
    const isCocaCola = name.toLowerCase().replace(/[\s-]/g, '').includes('cocacola');
    if (cocaRow) {
        cocaRow.style.display = isCocaCola ? '' : 'none';
    }
});

document.getElementById('otherOperationHireForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

    const id = document.getElementById('otherOperationHireId').value;
    const distance = parseFloat(document.getElementById('otherOpDistance').value) || 0;
    const hireType = document.getElementById('otherOpHireType').value || 'km_rate';
    
    let hireAmount = 0;
    let first100Rate = 0;
    let restRate = 0;
    let exactAmountVal = 0;

    if (hireType === 'exact_amount') {
        exactAmountVal = parseFloat(document.getElementById('otherOpExactAmount').value) || 0;
        hireAmount = exactAmountVal;
    } else {
        first100Rate = parseFloat(document.getElementById('otherOpFirst100Rate').value) || 0;
        restRate = parseFloat(document.getElementById('otherOpRestKmRate').value) || 0;
        if (distance <= 100) {
            hireAmount = distance * first100Rate;
        } else {
            hireAmount = (100 * first100Rate) + ((distance - 100) * restRate);
        }
    }

    const fuelLitres = parseFloat(document.getElementById('otherOpFuel').value) || 0;
    const fuelPrice = parseFloat(document.getElementById('otherOpFuelPrice').value) || 0;
    const fuelCost = fuelLitres * fuelPrice;

    const opName = document.getElementById('otherOpOperationName').value;
    const isCocaCola = opName.toLowerCase().replace(/[\s-]/g, '').includes('cocacola');
    const cocacolaPaid80 = isCocaCola ? document.getElementById('otherOpCocaColaPaid').checked : false;

    const recordData = {
        base_lorry_number: document.getElementById('otherOpBaseVehicle').value,
        operation_name: opName,
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
        hire_type: hireType,
        exact_amount: exactAmountVal,
        cocacola_paid_80: cocacolaPaid80,
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
        if (typeof invalidateLocationCache === 'function') invalidateLocationCache();
    } catch (error) {
        showToast('Error saving record: ' + error.message, 'error');
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
            // Update Coca-Cola Summary Widget for the month
            const ccRecords = data.filter(r => (r.operation_name || '').toLowerCase().replace(/[\s-]/g, '').includes('cocacola'));
            const widget = document.getElementById('cocacolaSummaryWidget');
            if (ccRecords.length > 0) {
                if (widget) widget.style.display = 'block';
                const totalInvoice = ccRecords.reduce((sum, r) => sum + (r.hire_amount || 0), 0);
                const totalPaid = ccRecords.reduce((sum, r) => sum + (r.cocacola_paid_80 ? 0.8 * (r.hire_amount || 0) : 0), 0);
                const totalRemaining = ccRecords.reduce((sum, r) => sum + (r.cocacola_paid_80 ? 0.2 * (r.hire_amount || 0) : (r.hire_amount || 0)), 0);
                const paidCount = ccRecords.filter(r => r.cocacola_paid_80).length;

                const totalHiresCountEl = document.getElementById('ccTotalHiresCount');
                const totalInvoiceEl = document.getElementById('ccTotalInvoiceValue');
                const moneyPaidEl = document.getElementById('ccMoneyPaid');
                const paidHiresInfoEl = document.getElementById('ccPaidHiresInfo');
                const moneyRemainingEl = document.getElementById('ccMoneyRemaining');

                if (totalHiresCountEl) totalHiresCountEl.textContent = ccRecords.length;
                if (totalInvoiceEl) totalInvoiceEl.textContent = `LKR ${totalInvoice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                if (moneyPaidEl) moneyPaidEl.textContent = `LKR ${totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                if (paidHiresInfoEl) paidHiresInfoEl.textContent = `${paidCount} of ${ccRecords.length} hires marked 80% paid`;
                if (moneyRemainingEl) moneyRemainingEl.textContent = `LKR ${totalRemaining.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            } else {
                if (widget) widget.style.display = 'none';
            }

            const tbody = document.querySelector('#otherOperationHiresTable tbody');
            if (tbody) {
                tbody.innerHTML = '';

                const searchQuery = document.getElementById('otherOperationHiresTownSearch')?.value || '';
                const lowercaseSearch = searchQuery.toLowerCase().trim();

                const filteredData = data.filter(record => {
                    if (!lowercaseSearch) return true;
                    const fromLoc = (record.from_location || '').toLowerCase();
                    const toLoc = (record.to_location || '').toLowerCase();
                    const opName = (record.operation_name || '').toLowerCase();
                    return fromLoc.includes(lowercaseSearch) || toLoc.includes(lowercaseSearch) || opName.includes(lowercaseSearch);
                });

                filteredData.forEach(record => {
                    const row = document.createElement('tr');
                    const actionButtons = userRole === 'viewer' ? '' : `
                        <td class="action-buttons">
                            <button class="btn btn-edit" onclick="editOtherOperationHire(${record.id})">Edit</button>
                            <button class="btn btn-danger" onclick="deleteOtherOperationHire(${record.id})">Delete</button>
                        </td>
                    `;

                    const isCocaCola = (record.operation_name || '').toLowerCase().replace(/[\s-]/g, '').includes('cocacola');
                    let operationCellHTML = record.operation_name;
                    if (isCocaCola) {
                        operationCellHTML = `
                            <div class="cocacola-operation-cell" style="display: flex; align-items: center; gap: 8px; justify-content: flex-start;">
                                <label class="switch-sm" title="Toggle 80% Payment Status">
                                    <input type="checkbox" ${record.cocacola_paid_80 ? 'checked' : ''} onchange="toggleCocaColaPaid(${record.id}, this.checked)">
                                    <span class="slider-sm"></span>
                                </label>
                                <span style="font-weight: 500;">${record.operation_name}</span>
                                <span class="${record.cocacola_paid_80 ? 'cocacola-badge-paid' : 'cocacola-badge-pending'}">
                                    ${record.cocacola_paid_80 ? '80% Paid' : 'Pending'}
                                </span>
                            </div>
                        `;
                    }

                    let breakdownHTML = '';
                    if (record.hire_type === 'exact_amount') {
                        breakdownHTML = `<small>Type: Exact Amount<br><strong>Total Hire: LKR ${record.hire_amount.toFixed(2)}</strong></small>`;
                    } else {
                        breakdownHTML = `<small>First 100: LKR ${record.first_100km_rate.toFixed(2)}<br>Rest KM: LKR ${record.rest_km_rate.toFixed(2)}<br><strong>Total Hire: LKR ${record.hire_amount.toFixed(2)}</strong></small>`;
                    }

                    row.innerHTML = `
                        <td>${record.hire_date}</td>
                        <td>${record.base_lorry_number}</td>
                        <td>${operationCellHTML}</td>
                        <td>${record.from_location} - ${record.to_location}</td>
                        <td>${record.distance} km</td>
                        <td><small>Litres: ${record.fuel_litres}<br>Rate: LKR ${record.fuel_price_per_litre}<br><strong>Cost: LKR ${record.fuel_cost.toFixed(2)}</strong></small></td>
                        <td>${breakdownHTML}</td>
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

window.toggleCocaColaPaid = async function(id, checked) {
    if (!checkAdminAccess('save')) return;
    try {
        const { error } = await supabaseClient
            .from('other_operation_hires')
            .update({ cocacola_paid_80: checked })
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('Coca-Cola payment status updated successfully!', 'success');
        loadOtherOperationHires();
    } catch (error) {
        showToast('Error updating status: ' + error.message, 'error');
        loadOtherOperationHires();
    }
};

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
        
        const opName = data.operation_name || '';
        document.getElementById('otherOpOperationName').value = opName;
        
        const nameSelect = document.getElementById('otherOpOperationNameSelect');
        const customInput = document.getElementById('otherOpOperationNameCustom');

        if (opName === 'COCACOLA') {
            if (nameSelect) nameSelect.value = 'COCACOLA';
            if (customInput) {
                customInput.style.display = 'none';
                customInput.required = false;
                customInput.value = '';
            }
        } else if (opName !== '') {
            if (nameSelect) nameSelect.value = 'other';
            if (customInput) {
                customInput.style.display = '';
                customInput.required = true;
                customInput.value = opName;
            }
        } else {
            if (nameSelect) nameSelect.value = '';
            if (customInput) {
                customInput.style.display = 'none';
                customInput.required = false;
                customInput.value = '';
            }
        }

        document.getElementById('otherOpDate').value = data.hire_date;
        document.getElementById('otherOpFrom').value = data.from_location;
        document.getElementById('otherOpTo').value = data.to_location;
        document.getElementById('otherOpDistance').value = data.distance;
        document.getElementById('otherOpFirst100Rate').value = data.first_100km_rate;
        document.getElementById('otherOpRestKmRate').value = data.rest_km_rate;
        document.getElementById('otherOpFuel').value = data.fuel_litres;
        document.getElementById('otherOpFuelPrice').value = data.fuel_price_per_litre;

        // Load Hire Type and Exact Amount
        const hireType = data.hire_type || 'km_rate';
        document.getElementById('otherOpHireType').value = hireType;
        document.getElementById('otherOpExactAmount').value = data.exact_amount || 0;

        // Toggle UI states for Hire Type
        const rateFieldsRow = document.getElementById('otherOpRateFieldsRow');
        const exactAmountRow = document.getElementById('otherOpExactAmountRow');
        const first100Input = document.getElementById('otherOpFirst100Rate');
        const restKmInput = document.getElementById('otherOpRestKmRate');
        const exactAmountInput = document.getElementById('otherOpExactAmount');

        if (hireType === 'exact_amount') {
            if (rateFieldsRow) rateFieldsRow.style.display = 'none';
            if (exactAmountRow) exactAmountRow.style.display = '';
            if (first100Input) first100Input.required = false;
            if (restKmInput) restKmInput.required = false;
            if (exactAmountInput) exactAmountInput.required = true;
        } else {
            if (rateFieldsRow) rateFieldsRow.style.display = '';
            if (exactAmountRow) exactAmountRow.style.display = 'none';
            if (first100Input) first100Input.required = true;
            if (restKmInput) restKmInput.required = true;
            if (exactAmountInput) exactAmountInput.required = false;
        }

        // Toggle UI states for Coca-Cola
        const isCocaCola = (data.operation_name || '').toLowerCase().replace(/[\s-]/g, '').includes('cocacola');
        const cocaRow = document.getElementById('otherOpCocaColaPaidRow');
        if (cocaRow) {
            cocaRow.style.display = isCocaCola ? '' : 'none';
        }
        document.getElementById('otherOpCocaColaPaid').checked = data.cocacola_paid_80 || false;

        document.getElementById('otherOperationHireFormContainer').style.display = 'block';
        document.getElementById('otherOperationHireFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading record: ' + error.message, 'error');
    }
}

async function deleteOtherOperationHire(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this record?')) {
        try {
            await supabaseClient.from('other_operation_hires').delete().eq('id', id);
            loadOtherOperationHires();
        } catch (error) {
            showToast('Error deleting record: ' + error.message, 'error');
        }
    }
}

// ============ COMMITMENT VEHICLES ============
document.getElementById('addCommitmentVehicleBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('commitmentVehicleForm').reset();
    document.getElementById('commitmentVehicleId').value = '';
    // Reset terminated checkbox
    if (document.getElementById('commitmentVehicleTerminated')) {
        document.getElementById('commitmentVehicleTerminated').checked = false;
    }
    document.getElementById('commitmentVehicleFormContainer').style.display = 'block';
    document.getElementById('commitmentVehicleFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('cancelCommitmentVehicleBtn')?.addEventListener('click', () => {
    document.getElementById('commitmentVehicleFormContainer').style.display = 'none';
});

document.getElementById('commitmentVehicleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

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
        showToast('Error saving commitment vehicle: ' + error.message, 'error');
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
        if (document.getElementById('commitmentVehicleTerminated')) {
            document.getElementById('commitmentVehicleTerminated').checked = data.terminated || false;
        }

        document.getElementById('commitmentVehicleFormContainer').style.display = 'block';
        document.getElementById('commitmentVehicleFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading commitment vehicle: ' + error.message, 'error');
    }
}

async function deleteCommitmentVehicle(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this vehicle?')) {
        try {
            await supabaseClient.from('commitment_vehicles').delete().eq('id', id);
            loadCommitmentVehicles();
        } catch (error) {
            showToast('Error deleting commitment vehicle: ' + error.message, 'error');
        }
    }
}

// ============ COMMITMENT RECORDS ============
document.getElementById('addCommitmentRecordBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('commitmentRecordForm').reset();
    document.getElementById('commitmentRecordId').value = '';
    document.getElementById('commitmentRecordFormContainer').style.display = 'block';
    document.getElementById('commitmentRecordFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('cancelCommitmentRecordBtn')?.addEventListener('click', () => {
    document.getElementById('commitmentRecordFormContainer').style.display = 'none';
});

document.getElementById('commitmentRecordsMonth')?.addEventListener('change', loadCommitmentRecords);
document.getElementById('commitmentRecordsVehicleFilter')?.addEventListener('change', loadCommitmentRecords);
document.getElementById('commitmentRecordsTownSearch')?.addEventListener('input', loadCommitmentRecords);

document.getElementById('commitmentRecordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

    const id = document.getElementById('commitmentRecordId').value;

    // --- DUPLICATE JOB NUMBER CHECK ---
    const _cJobNum = document.getElementById('commitmentJobNumber')?.value?.trim();
    if (_cJobNum && typeof isJobNumberDuplicate === 'function') {
        const _cIsDup = await isJobNumberDuplicate(_cJobNum, 'commitment_records', id ? parseInt(id) : null);
        if (_cIsDup) {
            showToast(`Job Number "${_cJobNum}" already exists in Commitment Records! Please use a unique Job Number.`, 'error', 5000);
            const _cjInput = document.getElementById('commitmentJobNumber');
            if (_cjInput) { _cjInput.focus(); _cjInput.style.borderColor = '#e74c3c'; _cjInput.style.boxShadow = '0 0 0 3px rgba(231,76,60,0.2)'; setTimeout(() => { _cjInput.style.borderColor = ''; _cjInput.style.boxShadow = ''; }, 3000); }
            return;
        }
    }

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
        if (typeof invalidateLocationCache === 'function') invalidateLocationCache();
    } catch (error) {
        showToast('Error saving commitment record: ' + error.message, 'error');
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

        const townSearch = document.getElementById('commitmentRecordsTownSearch')?.value || '';
        const lowercaseSearch = townSearch.toLowerCase().trim();

        data.forEach(record => {
            const kmLimit = record.commitment_vehicles.km_limit_per_month;
            const vid = record.vehicle_id;

            if (!vehicleRunningKm[vid]) vehicleRunningKm[vid] = 0;
            vehicleRunningKm[vid] += record.distance;
            const kmAfter = vehicleRunningKm[vid];

            const monthlyExtraKmCharge = vehicleMonthlyExtraKmCharge[vid] || 0;
            const totalKmForVehicle = vehicleTotalKm[vid] || 0;
            const exceedingKm = Math.max(0, totalKmForVehicle - kmLimit);

            if (lowercaseSearch) {
                const fromLoc = (record.from_location || '').toLowerCase();
                const toLoc = (record.to_location || '').toLowerCase();
                if (!fromLoc.includes(lowercaseSearch) && !toLoc.includes(lowercaseSearch)) {
                    return; // Skip rendering this row, but running KM increments correctly
                }
            }

            const row = document.createElement('tr');

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
        document.getElementById('commitmentRecordFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading commitment record: ' + error.message, 'error');
    }
}

async function deleteCommitmentRecord(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this commitment record?')) {
        try {
            await supabaseClient.from('commitment_records').delete().eq('id', id);
            loadCommitmentRecords();
        } catch (error) {
            showToast('Error deleting commitment record: ' + error.message, 'error');
        }
    }
}

// ============ DAY OFFS ============
document.getElementById('addDayOffBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('dayOffForm').reset();
    document.getElementById('dayOffId').value = '';
    document.getElementById('dayOffFormContainer').style.display = 'block';
    document.getElementById('dayOffFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('cancelDayOffBtn')?.addEventListener('click', () => {
    document.getElementById('dayOffFormContainer').style.display = 'none';
});

document.getElementById('dayOffMonth')?.addEventListener('change', loadDayOffs);
document.getElementById('dayOffVehicleFilter')?.addEventListener('change', loadDayOffs);

document.getElementById('dayOffForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

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
        showToast('Error saving day off: ' + error.message, 'error');
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
        document.getElementById('dayOffFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading day off: ' + error.message, 'error');
    }
}

async function deleteDayOff(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this day off?')) {
        try {
            await supabaseClient.from('commitment_day_offs').delete().eq('id', id);
            loadDayOffs();
        } catch (error) {
            showToast('Error deleting day off: ' + error.message, 'error');
        }
    }
}

// ============ DASHBOARD FUNCTIONS ============
async function loadDashboardData(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;

        // Get last day correctly without timezone shift
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

        const currentQueryUserId = getQueryUserId();

        let hireRecords, commitmentRecords, dayOffs, otherOpHires, allHireV, allCommV;

        if (cachedData) {
            hireRecords = cachedData.hireRecords;
            commitmentRecords = cachedData.commitmentRecords;
            dayOffs = cachedData.dayOffs;
            otherOpHires = cachedData.otherOpHires;
            allHireV = cachedData.hireVehicles;
            allCommV = cachedData.commitmentVehicles;
        } else {
            // Fetch all data and vehicle maps concurrently
            const [
                { data: rHireRecords },
                { data: rCommitmentRecords },
                { data: rDayOffs },
                { data: rOtherOpHires },
                { data: rAllHireV },
                { data: rAllCommV }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_day_offs').select('*').eq('user_id', currentQueryUserId).gte('day_off_date', startDate).lte('day_off_date', endDate),
                supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number').eq('user_id', currentQueryUserId),
                supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId)
            ]);
            hireRecords = rHireRecords;
            commitmentRecords = rCommitmentRecords;
            dayOffs = rDayOffs;
            otherOpHires = rOtherOpHires;
            allHireV = rAllHireV;
            allCommV = rAllCommV;
        }

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
            if (record.vehicle_id) {
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
            if (record.vehicle_id) {
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
            if (record.base_lorry_number) {
                activeVehiclesSet.add(record.base_lorry_number);
            }
        });

        // Calculate Fuel Allowance (16.00% of Fuel Cost)
        const fuelAllowance = totalFuelCost * 0.1800;

        // Excessing Litres: deduct actual cost total for this month from net profit
        const elActualCostForMonth = cachedData
            ? (cachedData.excessingLitres?.reduce((sum, r) => sum + (r.actual_cost || 0), 0) || 0)
            : await getExcessingLitresActualCostForMonth(monthValue);

        // Net Profit = Revenue - Fuel Cost + Fuel Allowance - EL Actual Cost
        const netProfit = totalRevenue - totalFuelCost + fuelAllowance - elActualCostForMonth;

        // --- UPDATE UI ELEMENTS ---

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        // Excessing Litres total amount (L)
        const elTotalLitres = cachedData
            ? (cachedData.excessingLitres?.reduce((sum, r) => sum + (r.fuel_amount_l || 0), 0) || 0)
            : 0;

        setText('totalRevenue', `LKR ${totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        setText('fuelCost', `LKR ${totalFuelCost.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        setText('fuelAllowance', `LKR ${fuelAllowance.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        setText('totalHires', totalHires.toLocaleString('en-US'));

        // NEW UI UPDATES
        setText('activeLorries', activeVehiclesSet.size);
        setText('totalDistance', `${totalDistance.toLocaleString('en-US')} km`);
        setText('totalDieselLitres', `${Math.round(totalFuelLitres).toLocaleString('en-US')} L`);
        setText('dashboardExcessingLitres', `${elTotalLitres.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} L`);
        setText('dashboardExcessingCost', `LKR ${elActualCostForMonth.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`);

        // Profit (Revenue - Fuel Cost + Fuel Allowance)
        setText('netProfit', `LKR ${netProfit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`);

        // Trigger Charts
        if (typeof loadVehicleRevenueChart === 'function') {
            await loadVehicleRevenueChart(monthValue);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error.message);
    }
}

// ============ VEHICLE PERFORMANCE ============
async function loadVehiclePerformance(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;

        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

        const currentQueryUserId = getQueryUserId();

        let hireVehicles, otherOpRecords, allHireRecords, allCommitmentRecordsMonth, allDayOffs, commitmentVehicles;

        if (cachedData) {
            hireVehicles = cachedData.hireVehicles;
            otherOpRecords = cachedData.otherOpHires;
            allHireRecords = cachedData.hireRecords;
            allCommitmentRecordsMonth = cachedData.commitmentRecords;
            allDayOffs = cachedData.dayOffs;
            commitmentVehicles = cachedData.commitmentVehicles;
        } else {
            const [
                { data: rHireVehicles },
                { data: rOtherOpRecords },
                { data: rAllHireRecords },
                { data: rAllCommitmentRecordsMonth },
                { data: rAllDayOffs },
                { data: rCommitmentVehicles }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_vehicles').select('*').eq('user_id', currentQueryUserId),
                supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_day_offs').select('*').eq('user_id', currentQueryUserId).gte('day_off_date', startDate).lte('day_off_date', endDate),
                supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId)
            ]);
            hireVehicles = rHireVehicles;
            otherOpRecords = rOtherOpRecords;
            allHireRecords = rAllHireRecords;
            allCommitmentRecordsMonth = rAllCommitmentRecordsMonth;
            allDayOffs = rAllDayOffs;
            commitmentVehicles = rCommitmentVehicles;
        }

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
                const totalFuelRaw = records.reduce((sum, r) => sum + r.fuel_cost, 0);
                // Deduct 18% VAT from fuel cost (net cost = full cost × 0.82)
                const totalFuel = totalFuelRaw * 0.82;
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
                const totalFuelRaw = records.reduce((sum, r) => sum + r.fuel_cost, 0) || 0;
                // Deduct 18% VAT from fuel cost (net cost = full cost × 0.82)
                const totalFuel = totalFuelRaw * 0.82;
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
                // Deduct 18% VAT from fuel cost (net cost = full cost × 0.82)
                otherOpGrouped[base].totalFuel += (r.fuel_cost || 0) * 0.82;
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
                                        <th style="text-align: right;">Fuel Cost (After 18% VAT)</th>
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
                            <td style="text-align: right;">${Math.round(vehicle.totalKm).toLocaleString('en-US')} km</td>
                            <td style="min-width:140px;">
                                ${vehicle.commitmentKmPct !== null ? `
                                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;text-align:center;">
                                        ${Math.round(vehicle.totalKm).toLocaleString('en-US')} / ${vehicle.kmLimit.toLocaleString('en-US')} km (${vehicle.commitmentKmPct.toFixed(0)}%)
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
                            <td style="text-align: right;">LKR ${vehicle.totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                            <td style="text-align: right;">LKR ${vehicle.totalFuel.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                            <td style="text-align: right;">${Math.round(vehicle.totalFuelLitres).toLocaleString('en-US')} L</td>
                            <td style="text-align: right; color: ${profitColor}; font-weight: bold;">
                                LKR ${vehicle.profit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
                            </td>
                        </tr>
                    `;
                });

                performanceHtml += `
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3">Total</td>
                                        <td style="text-align: right;">${Math.round(totalKm).toLocaleString('en-US')} km</td>
                                        <td></td>
                                        <td style="text-align: center;">
                                            <span style="background: var(--blue-bg); color: var(--blue); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                                ${totalHires}
                                            </span>
                                        </td>
                                        <td style="text-align: right;">LKR ${totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                        <td style="text-align: right;">LKR ${totalFuel.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                        <td style="text-align: right;">${Math.round(totalFuelLitres).toLocaleString('en-US')} L</td>
                                        <td style="text-align: right; color: ${totalProfit >= 0 ? 'var(--green)' : 'var(--brand-red)'}; font-weight: bold;">
                                            LKR ${totalProfit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
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
                                        <th style="text-align: right;">Fuel Cost (After 18% VAT)</th>
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
                            <td style="text-align: right;">${Math.round(vehicle.totalKm).toLocaleString('en-US')} km</td>
                            <td style="text-align: center;">
                                <span style="background: var(--amber-bg); color: var(--amber); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                    ${vehicle.recordsCount}
                                </span>
                            </td>
                            <td style="text-align: right;">LKR ${vehicle.totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                            <td style="text-align: right;">LKR ${vehicle.totalFuel.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                            <td style="text-align: right;">${Math.round(vehicle.totalFuelLitres).toLocaleString('en-US')} L</td>
                            <td style="text-align: right; color: ${profitColor}; font-weight: bold;">
                                LKR ${vehicle.profit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
                            </td>
                        </tr>
                    `;
                });

                performanceHtml += `
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3">Total</td>
                                        <td style="text-align: right;">${Math.round(totalKm).toLocaleString('en-US')} km</td>
                                        <td style="text-align: center;">
                                            <span style="background: var(--amber-bg); color: var(--amber); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                                ${totalHires}
                                            </span>
                                        </td>
                                        <td style="text-align: right;">LKR ${totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                        <td style="text-align: right;">LKR ${totalFuel.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                        <td style="text-align: right;">${Math.round(totalFuelLitres).toLocaleString('en-US')} L</td>
                                        <td style="text-align: right; color: ${totalProfit >= 0 ? 'var(--green)' : 'var(--brand-red)'}; font-weight: bold;">
                                            LKR ${totalProfit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
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
                                        <th style="text-align: right;">Fuel Cost (After 18% VAT)</th>
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
                            <td style="text-align: right;">${Math.round(vehicle.totalKm).toLocaleString('en-US')} km</td>
                            <td style="text-align: center;">
                                <span style="background: rgba(123, 53, 196, 0.12); color: var(--purple); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                    ${vehicle.recordsCount}
                                </span>
                            </td>
                            <td style="text-align: right;">LKR ${vehicle.totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                            <td style="text-align: right;">LKR ${vehicle.totalFuel.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                            <td style="text-align: right;">${Math.round(vehicle.totalFuelLitres).toLocaleString('en-US')} L</td>
                            <td style="text-align: right; color: ${profitColor}; font-weight: bold;">
                                LKR ${vehicle.profit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
                            </td>
                        </tr>
                    `;
                });

                performanceHtml += `
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td>Total</td>
                                        <td style="text-align: right;">${Math.round(totalKm).toLocaleString('en-US')} km</td>
                                        <td style="text-align: center;">
                                            <span style="background: rgba(123, 53, 196, 0.12); color: var(--purple); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                                ${totalHires}
                                            </span>
                                        </td>
                                        <td style="text-align: right;">LKR ${totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                        <td style="text-align: right;">LKR ${totalFuel.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                        <td style="text-align: right;">${Math.round(totalFuelLitres).toLocaleString('en-US')} L</td>
                                        <td style="text-align: right; color: ${totalProfit >= 0 ? 'var(--green)' : 'var(--brand-red)'}; font-weight: bold;">
                                            LKR ${totalProfit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
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

async function loadVehicleFuelEfficiency(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        let hireVehicles, otherOpRecords, allHireRecords, allCommitmentRecordsMonth, commitmentVehicles;

        if (cachedData) {
            hireVehicles = cachedData.hireVehicles;
            otherOpRecords = cachedData.otherOpHires;
            allHireRecords = cachedData.hireRecords;
            allCommitmentRecordsMonth = cachedData.commitmentRecords;
            commitmentVehicles = cachedData.commitmentVehicles;
        } else {
            const [
                { data: rHireVehicles },
                { data: rOtherOpRecords },
                { data: rAllHireRecords },
                { data: rAllCommitmentRecordsMonth },
                { data: rCommitmentVehicles }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_vehicles').select('*').eq('user_id', currentQueryUserId),
                supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId)
            ]);
            hireVehicles = rHireVehicles;
            otherOpRecords = rOtherOpRecords;
            allHireRecords = rAllHireRecords;
            allCommitmentRecordsMonth = rAllCommitmentRecordsMonth;
            commitmentVehicles = rCommitmentVehicles;
        }

        const hireVehicleBaseMap = {};
        const commitVehicleBaseMap = {};
        hireVehicles?.forEach(v => { hireVehicleBaseMap[v.id] = v; });
        commitmentVehicles?.forEach(v => { commitVehicleBaseMap[v.id] = v; });

        const vehicleStats = {};

        function initVehicle(number, type, model) {
            if (!vehicleStats[number]) {
                vehicleStats[number] = {
                    number,
                    type,
                    model: model || '-',
                    totalDistance: 0,
                    totalFuelLitres: 0,
                };
            }
        }

        allHireRecords?.forEach(record => {
            if (record.vehicle_id) {
                const v = hireVehicleBaseMap[record.vehicle_id];
                const num = v ? extractBaseVehicleName(v.lorry_number) : `Hire Lorry ${record.vehicle_id}`;
                initVehicle(num, 'Hire-to-Pay', v?.vehicle_model);
                vehicleStats[num].totalDistance += record.distance || 0;
                vehicleStats[num].totalFuelLitres += record.fuel_litres || 0;
            }
        });

        allCommitmentRecordsMonth?.forEach(record => {
            if (record.vehicle_id) {
                const v = commitVehicleBaseMap[record.vehicle_id];
                const num = v ? extractBaseVehicleName(v.vehicle_number) : `Commitment Lorry ${record.vehicle_id}`;
                initVehicle(num, 'Commitment', v?.vehicle_model);
                vehicleStats[num].totalDistance += record.distance || 0;
                vehicleStats[num].totalFuelLitres += record.fuel_litres || 0;
            }
        });

        otherOpRecords?.forEach(record => {
            if (record.base_lorry_number) {
                const num = extractBaseVehicleName(record.base_lorry_number);
                initVehicle(num, 'Other Operation', '-');
                vehicleStats[num].totalDistance += record.distance || 0;
                vehicleStats[num].totalFuelLitres += record.fuel_litres || 0;
            }
        });

        const list = Object.values(vehicleStats).map(stat => {
            const efficiency = stat.totalFuelLitres > 0 ? (stat.totalDistance / stat.totalFuelLitres) : 0;
            return { ...stat, efficiency };
        });

        list.sort((a, b) => b.efficiency - a.efficiency);

        let html = '';
        if (list.length === 0) {
            html = `
                <div class="empty-state">
                    <div class="empty-state-icon">⛽</div>
                    <h3 class="empty-state-text">No Fuel Activity This Month</h3>
                    <p class="empty-state-subtext">No fuel usage records for any vehicle in ${monthValue}.</p>
                </div>
            `;
        } else {
            html = `
                <div class="table-responsive">
                    <table class="group-table fuel-efficiency-table">
                        <thead>
                            <tr>
                                <th>Vehicle</th>
                                <th>Model</th>
                                <th>Type</th>
                                <th style="text-align: right;">Total KM</th>
                                <th style="text-align: right;">Fuel Used</th>
                                <th style="text-align: left; padding-left: 20px;">Fuel Efficiency (KM/L)</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            list.forEach(vehicle => {
                let statusColor = 'var(--text-muted)';
                let statusBg = 'var(--surface-hover)';
                let statusLabel = 'N/A';
                let progressPct = 0;

                if (vehicle.totalFuelLitres > 0) {
                    const eff = vehicle.efficiency;
                    progressPct = Math.min((eff / 8.0) * 100, 100);
                    if (eff >= 5.0) {
                        statusColor = 'var(--green)';
                        statusBg = 'var(--green-bg)';
                        statusLabel = 'Excellent';
                    } else if (eff >= 3.5) {
                        statusColor = 'var(--amber)';
                        statusBg = 'var(--amber-bg)';
                        statusLabel = 'Good';
                    } else {
                        statusColor = 'var(--brand-red)';
                        statusBg = 'var(--brand-red-glow)';
                        statusLabel = 'Poor';
                    }
                }

                const efficiencyText = vehicle.totalFuelLitres > 0 
                    ? `${vehicle.efficiency.toFixed(2)} Km/L` 
                    : 'N/A';

                let typeBadgeStyle = '';
                if (vehicle.type === 'Commitment') {
                    typeBadgeStyle = 'background: var(--blue-bg); color: var(--blue);';
                } else if (vehicle.type === 'Hire-to-Pay') {
                    typeBadgeStyle = 'background: var(--amber-bg); color: var(--amber);';
                } else {
                    typeBadgeStyle = 'background: rgba(123, 53, 196, 0.12); color: var(--purple);';
                }

                html += `
                    <tr>
                        <td style="font-weight: bold;">${vehicle.number}</td>
                        <td>${vehicle.model}</td>
                        <td>
                            <span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; white-space: nowrap; ${typeBadgeStyle}">
                                ${vehicle.type}
                            </span>
                        </td>
                        <td style="text-align: right;">${vehicle.totalDistance.toFixed(0)} km</td>
                        <td style="text-align: right;">${vehicle.totalFuelLitres.toFixed(0)} L</td>
                        <td style="min-width: 220px; padding-left: 20px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-weight: bold; width: 85px; color: ${statusColor};">${efficiencyText}</span>
                                ${vehicle.totalFuelLitres > 0 ? `
                                    <div style="background: var(--surface-border); border-radius: 6px; height: 10px; flex: 1; overflow: hidden; position: relative;">
                                        <div style="width: ${progressPct}%; height: 100%; border-radius: 6px; background: ${statusColor}; transition: width 0.4s;"></div>
                                    </div>
                                    <span style="font-size: 11px; font-weight: 700; color: ${statusColor}; background: ${statusBg}; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
                                        ${statusLabel}
                                    </span>
                                ` : `
                                    <span style="font-size: 11px; font-weight: 500; color: var(--text-muted); background: var(--surface-hover); padding: 2px 6px; border-radius: 4px;">
                                        No Fuel Info
                                    </span>
                                `}
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
                <div class="text-muted text-center" style="margin-top: 15px; font-size: 12px; text-align: center;">
                    Showing ${list.length} vehicle(s) with activity in ${monthValue}
                </div>
            `;
        }

        const el = document.getElementById('vehicleFuelEfficiency');
        if (el) el.innerHTML = html;

    } catch (error) {
        console.error('Error loading fuel efficiency:', error.message);
        const el = document.getElementById('vehicleFuelEfficiency');
        if (el) el.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--brand-red);">
                Error loading fuel efficiency data
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

async function loadDashboardCharts(cachedData = null) {
    try {
        const currentQueryUserId = getQueryUserId();
        const months = [];
        const revenues = [];
        const profits = [];
        const fuelCosts = [];
        let totalRevenue6M = 0;
        let totalProfit6M = 0;
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
        const selMonthStr = selMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [selYear, selMon] = selMonthStr.split('-');
        const selMonPadded = String(selMon).padStart(2, '0');
        const selStart = `${selYear}-${selMonPadded}-01`;
        const selLastDay = new Date(selYear, parseInt(selMon), 0).getDate();
        const selEnd = `${selYear}-${selMonPadded}-${String(selLastDay).padStart(2, '0')}`;

        let allHireRecords6M, allCommitmentRecords6M, allDayOffs6M, allOtherOpRecords6M, allCommitmentVehicles, allElRecords6M;
        let bdHireRec, bdCommRec, bdOtherRec, bdDayOffs;

        if (cachedData) {
            bdHireRec = cachedData.hireRecords;
            bdCommRec = cachedData.commitmentRecords;
            bdOtherRec = cachedData.otherOpHires;
            bdDayOffs = cachedData.dayOffs;

            // Fetch only 6-month data concurrently
            const [
                { data: rAllHireRecords6M },
                { data: rAllCommitmentRecords6M },
                { data: rAllDayOffs6M },
                { data: rAllOtherOpRecords6M },
                { data: rAllCommitmentVehicles },
                { data: rAllElRecords6M }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate6M).lte('hire_date', endDate6M),
                supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate6M).lte('hire_date', endDate6M),
                supabaseClient.from('commitment_day_offs').select('*').eq('user_id', currentQueryUserId).gte('day_off_date', startDate6M).lte('day_off_date', endDate6M),
                supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate6M).lte('hire_date', endDate6M),
                supabaseClient.from('commitment_vehicles').select('*').eq('user_id', currentQueryUserId),
                supabaseClient.from('excessing_litres').select('*').eq('user_id', currentQueryUserId).gte('date', startDate6M).lte('date', endDate6M)
            ]);
            allHireRecords6M = rAllHireRecords6M;
            allCommitmentRecords6M = rAllCommitmentRecords6M;
            allDayOffs6M = rAllDayOffs6M;
            allOtherOpRecords6M = rAllOtherOpRecords6M;
            allCommitmentVehicles = rAllCommitmentVehicles;
            allElRecords6M = rAllElRecords6M;
        } else {
            // Fetch all 6-month datasets, commitment vehicles, and selected month breakdown data concurrently
            const [
                { data: rAllHireRecords6M },
                { data: rAllCommitmentRecords6M },
                { data: rAllDayOffs6M },
                { data: rAllOtherOpRecords6M },
                { data: rAllCommitmentVehicles },
                // Selected Month Breakdown data
                { data: rBdHireRec },
                { data: rBdCommRec },
                { data: rBdOtherRec },
                { data: rBdDayOffs },
                { data: rAllElRecords6M }
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
                supabaseClient.from('commitment_day_offs').select('deduction_amount').eq('user_id', currentQueryUserId).gte('day_off_date', selStart).lte('day_off_date', selEnd),
                supabaseClient.from('excessing_litres').select('*').eq('user_id', currentQueryUserId).gte('date', startDate6M).lte('date', endDate6M)
            ]);
            allHireRecords6M = rAllHireRecords6M;
            allCommitmentRecords6M = rAllCommitmentRecords6M;
            allDayOffs6M = rAllDayOffs6M;
            allOtherOpRecords6M = rAllOtherOpRecords6M;
            allCommitmentVehicles = rAllCommitmentVehicles;
            bdHireRec = rBdHireRec;
            bdCommRec = rBdCommRec;
            bdOtherRec = rBdOtherRec;
            bdDayOffs = rBdDayOffs;
            allElRecords6M = rAllElRecords6M;
        }

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

            const monthElRecords = allElRecords6M?.filter(r => r.date?.startsWith(targetMonthKey)) || [];
            const monthElActualCost = monthElRecords.reduce((sum, r) => sum + (r.actual_cost || 0), 0);

            const monthProfit = monthRevenue - monthFuelCost;
            const monthFuelAllowance = monthFuelCost * 0.1800; // 18.00% VAT OFF
            const monthNetProfit = monthProfit + monthFuelAllowance - monthElActualCost;

            months.push(monthLabel);
            revenues.push(monthRevenue);
            profits.push(monthNetProfit);
            fuelCosts.push(monthFuelCost);
            totalRevenue6M += monthRevenue;
            totalProfit6M += monthNetProfit;
            totalHires6M += (hireRecords?.length || 0) + (commitmentRecords?.length || 0) + (otherOpRecords?.length || 0);
        }

        const avgRevenue = totalRevenue6M / 6;
        const avgProfit = totalProfit6M / 6;
        const profitMargin = totalRevenue6M > 0 ? ((totalProfit6M / totalRevenue6M) * 100) : 0;

        document.getElementById('avgRevenue').textContent = `LKR ${avgRevenue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        document.getElementById('avgProfit').textContent = `LKR ${avgProfit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
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
                            ticks: { callback: v => `LKR ${(v / 1000).toFixed(0)}K` }
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
                        label: 'Monthly Net Profit',
                        data: profits,
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
                            ticks: { callback: v => `LKR ${(v / 1000).toFixed(0)}K` }
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
                            ticks: { callback: v => `LKR ${(v / 1000).toFixed(0)}K` }
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
                                label: function (ctx) {
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

        document.getElementById('allTimeRevenue').textContent = `LKR ${totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        document.getElementById('allTimeProfit').textContent = `LKR ${totalProfit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        document.getElementById('allTimeFuelCost').textContent = `LKR ${totalFuelCost.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
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
                            <span class="metric-value">LKR ${vehicle.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div class="premium-metric-row">
                            <span class="metric-label">Profit</span>
                            <span class="metric-value ${profitClass}">LKR ${vehicle.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div class="premium-metric-row">
                            <span class="metric-label">Margin</span>
                            <span class="metric-value">${vehicle.profitMargin.toFixed(0)}%</span>
                        </div>
                        <div class="premium-metric-row">
                            <span class="metric-label">Total KM</span>
                            <span class="metric-value">${vehicle.km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</span>
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
    document.getElementById('advanceFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            showToast('Please upload a PDF file only', 'warning');
            e.target.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('File size must be less than 5MB', 'warning');
            e.target.value = '';
            return;
        }
        currentReceiptFile = file;
        console.log('Receipt file selected:', file.name);
    }
});

// Remove existing receipt
document.getElementById('removeReceiptBtn')?.addEventListener('click', async () => {
    if (await showConfirmAsync('Are you sure you want to remove this receipt?')) {
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
        showToast('Failed to upload receipt: ' + error.message, 'error');
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
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

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
        showToast('Error saving advance: ' + error.message, 'error');
    }
});

async function loadDriverAdvances() {
    try {
        const monthValue = document.getElementById('advanceMonth')?.value;
        const driverFilter = document.getElementById('advanceDriverFilter')?.value;

        await loadAdvanceSummary();
        loadWeeklyAdvanceSummary(); // Refresh weekly tracker

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
                ${topRanked.map((s, i) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;background:rgba(255,255,255,0.13);border-radius:8px;padding:5px 10px;">
                    <span>${medals[i]} ${s.name}</span>
                    <span style="font-weight:800;font-family:'Barlow Condensed',sans-serif;font-size:14px;">LKR ${s.total.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>`).join('')}
            </div>` : '';
        const topWidget = document.createElement('div');
        topWidget.style.cssText = 'grid-column:1/-1;margin-bottom:4px;';
        topWidget.innerHTML = `<div class="summary-banner" style="background:linear-gradient(135deg,#D1001F 0%,#8B0012 100%);border-radius:14px;padding:20px 26px;display:flex;align-items:center;gap:22px;box-shadow:0 6px 24px rgba(209,0,31,.30);color:#fff;flex-wrap:wrap;">
            <div style="font-size:44px;flex-shrink:0;">💳</div>
            <div style="flex:1;min-width:180px;">
                <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.80;margin-bottom:3px;">Total Staff Advances — ${monthLabel}</div>
                <div style="font-family:'Barlow Condensed',sans-serif;font-size:38px;font-weight:900;letter-spacing:-.5px;line-height:1.05;">LKR ${grandTotal.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style="font-size:12px;opacity:.75;margin-top:5px;">${advCount} advance transaction${advCount !== 1 ? 's' : ''} recorded</div>
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
                card.querySelector('.btn-copy-sms').addEventListener('click', function () {
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

// ══════════════════════════════════════════════════════════
//  WEEKLY ADVANCE TRACKER (Admin)
//  Shows per-driver ring widgets for the current Mon–Sun week
// ══════════════════════════════════════════════════════════
async function loadWeeklyAdvanceSummary() {
    const grid = document.getElementById('weeklyAdvanceTrackerGrid');
    const weekLabel = document.getElementById('watWeekLabel');
    if (!grid) return;

    const WEEKLY_LIMIT = 7000;

    // Compute current week bounds (Monday → Sunday)
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const diffToMon = (day === 0) ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };
    const weekStart = fmt(monday);
    const weekEnd   = fmt(sunday);

    // Update week label
    const monLabel = monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const sunLabel = sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (weekLabel) weekLabel.textContent = `${monLabel} – ${sunLabel}`;

    grid.innerHTML = '<div class="wat-loading">Loading…</div>';

    try {
        const uid = getQueryUserId();

        // 1. Get all active drivers
        const { data: drivers, error: dErr } = await supabaseClient
            .from('drivers')
            .select('id, name')
            .eq('user_id', uid)
            .neq('terminated', true)
            .order('name', { ascending: true });

        if (dErr) throw dErr;
        if (!drivers || drivers.length === 0) {
            grid.innerHTML = '<div class="wat-loading">No active staff found.</div>';
            return;
        }

        // Exclude family drivers (JAUK & JAAP Jayasooriya — no advance limit applies)
        const FAMILY_EXCLUSIONS = ['jauk', 'jaap'];
        const filteredDrivers = drivers.filter(d => {
            const nameLower = (d.name || '').toLowerCase();
            return !FAMILY_EXCLUSIONS.some(keyword => nameLower.includes(keyword));
        });

        if (filteredDrivers.length === 0) {
            grid.innerHTML = '<div class="wat-loading">No staff to track this week.</div>';
            return;
        }

        // 2. Fetch this week's advances for all drivers
        const { data: advances, error: aErr } = await supabaseClient
            .from('driver_advances')
            .select('driver_id, amount')
            .eq('user_id', uid)
            .gte('advance_date', weekStart)
            .lte('advance_date', weekEnd);

        if (aErr) throw aErr;

        // 3. Sum advances per driver
        const usedByDriver = {};
        (advances || []).forEach(a => {
            usedByDriver[a.driver_id] = (usedByDriver[a.driver_id] || 0) + parseFloat(a.amount || 0);
        });

        // 4. Render cards
        const circumference = 2 * Math.PI * 36; // r=36
        grid.innerHTML = '';

        filteredDrivers.forEach(d => {
            const used = usedByDriver[d.id] || 0;
            const remaining = Math.max(0, WEEKLY_LIMIT - used);
            const pct = Math.round((remaining / WEEKLY_LIMIT) * 100);
            const remainArc = (remaining / WEEKLY_LIMIT) * circumference;

            let colorClass = 'wat-green';
            let badge = '✅ Safe';
            if (remaining < 1000) { colorClass = 'wat-red'; badge = '🔴 Near Limit'; }
            else if (remaining < 3500) { colorClass = 'wat-amber'; badge = '⚠️ Low'; }

            const fmtLKR = v => `LKR ${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            // Clean driver name (strip nicknames)
            const cleanName = (d.name || '').replace(/\s*\(.*?\)\s*$/, '').trim();

            const card = document.createElement('div');
            card.className = `wat-card ${colorClass}`;
            card.innerHTML = `
                <div class="wat-ring-wrap">
                    <svg class="wat-ring-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <circle class="wat-ring-track" cx="50" cy="50" r="36"/>
                        <circle class="wat-ring-arc" cx="50" cy="50" r="36"
                            style="stroke-dasharray:${remainArc.toFixed(2)} ${circumference.toFixed(2)};"/>
                    </svg>
                    <div class="wat-ring-inner">
                        <span class="wat-pct">${pct}%</span>
                        <span class="wat-sublabel">left</span>
                    </div>
                </div>
                <div class="wat-name">${cleanName}</div>
                <div class="wat-remaining">${remaining <= 0 ? '⚠️ Limit Reached' : fmtLKR(remaining)}</div>
                <div class="wat-used">${fmtLKR(used)} used of ${fmtLKR(WEEKLY_LIMIT)}</div>
                <span class="wat-badge">${badge}</span>
            `;
            grid.appendChild(card);
        });

    } catch (err) {
        console.error('Weekly advance tracker error:', err.message);
        grid.innerHTML = `<div class="wat-loading" style="color:#E74C3C;">Failed to load: ${err.message}</div>`;
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
    try { ta.setSelectionRange(0, 99999); } catch (e) { }
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
        showToast('Could not copy automatically. Please copy the message below:\n\n' + text, 'error');
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
        document.getElementById('advanceFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading advance: ' + error.message, 'error');
    }
}

async function deleteAdvance(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this advance record?')) {
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
            showToast('Error deleting advance: ' + error.message, 'error');
        }
    }
}

// ============ REPORT GENERATION ============
document.getElementById('generateReportBtn')?.addEventListener('click', async () => {
    const monthValue = document.getElementById('dashboardMonth')?.value;
    if (!monthValue) {
        showToast('Please select a month first', 'warning');
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

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closePhotoLightbox();
    }
});

document.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', function (e) {
    if (e.touches.length > 0) {
        e.preventDefault();
    }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
});

// ============ NEW: ADVANCED METRICS & CHARTS ============
async function loadAdvancedDashboardStats(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${daysInMonth}`;
        const currentQueryUserId = getQueryUserId();

        let hireRecords, commitmentRecords, otherOpHires, allVehicles, allCommitVehicles;

        if (cachedData) {
            hireRecords = cachedData.hireRecords;
            commitmentRecords = cachedData.commitmentRecords;
            otherOpHires = cachedData.otherOpHires;
            allVehicles = cachedData.hireVehicles;
            allCommitVehicles = cachedData.commitmentVehicles;
        } else {
            // 1. Fetch Data
            const [
                { data: rHireRecords },
                { data: rCommitmentRecords },
                { data: rOtherOpHires },
                { data: rAllVehicles },
                { data: rAllCommitVehicles }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('*').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, terminated').eq('user_id', currentQueryUserId),
                supabaseClient.from('commitment_vehicles').select('id, vehicle_number, terminated').eq('user_id', currentQueryUserId)
            ]);
            hireRecords = rHireRecords;
            commitmentRecords = rCommitmentRecords;
            otherOpHires = rOtherOpHires;
            allVehicles = rAllVehicles;
            allCommitVehicles = rAllCommitVehicles;
        }

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

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setText('profitPerKm', `LKR ${profitPerKm.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        setText('utilizationRate', `${utilizationRate.toFixed(1)}%`);
        setText('revPerVehicleDay', `LKR ${revPerVehDay.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        setText('avgFuelEfficiency', `${avgEfficiency.toFixed(2)} Km/L`);

        setText('avgTripDistance', `${avgTripDist.toFixed(1)} km`);
        setText('waitingRevenue', `LKR ${totalWaitingRev.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        setText('jobsPerVehicle', jobsPerVeh.toFixed(1));
        setText('distPerVehicle', `${Math.round(distPerVeh).toLocaleString('en-US')} km`);


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

            [...(hRecs || []), ...(cRecs || []), ...(oRecs || [])].forEach(r => {
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
async function loadVehicleRevenuePieChart(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        let hireRecords, commitmentRecords, otherOpRecords;

        if (cachedData) {
            hireRecords = cachedData.hireRecords;
            commitmentRecords = cachedData.commitmentRecords;
            otherOpRecords = cachedData.otherOpHires;
        } else {
            // Fetch hire records with vehicle info concurrently
            const [
                { data: rHireRecords },
                { data: rCommitmentRecords },
                { data: rOtherOpRecords }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('vehicle_id, hire_amount, hire_to_pay_vehicles(lorry_number)').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('vehicle_id, distance, commitment_vehicles(vehicle_number, fixed_monthly_payment, km_limit_per_month, extra_km_charge)').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('base_lorry_number, hire_amount').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
            ]);
            hireRecords = rHireRecords;
            commitmentRecords = rCommitmentRecords;
            otherOpRecords = rOtherOpRecords;
        }

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
                            label: function (ctx) {
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
async function loadRevenueTypeSplitChart(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${monthPadded}-01`;
        const endDate = `${year}-${monthPadded}-${String(daysInMonth).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        let hireRecords, commRecords, otherOpRecords, rtsCommDayOffs, rtsCommVehicles;

        if (cachedData) {
            hireRecords = cachedData.hireRecords;
            commRecords = cachedData.commitmentRecords;
            otherOpRecords = cachedData.otherOpHires;
            rtsCommDayOffs = cachedData.dayOffs;

            // Filter commitment vehicles to only those with records this month
            const rtsCommVehicleIds = [...new Set((commRecords || []).map(r => r.vehicle_id).filter(Boolean))];
            rtsCommVehicles = cachedData.commitmentVehicles.filter(v => rtsCommVehicleIds.includes(v.id));
        } else {
            const [{ data: rHireRecords }, { data: rCommRecords }, { data: rOtherOpRecords }, { data: rRtsCommDayOffs }] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('hire_amount').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('vehicle_id, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('hire_amount').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_day_offs').select('deduction_amount').eq('user_id', currentQueryUserId).gte('day_off_date', startDate).lte('day_off_date', endDate)
            ]);
            hireRecords = rHireRecords;
            commRecords = rCommRecords;
            otherOpRecords = rOtherOpRecords;
            rtsCommDayOffs = rRtsCommDayOffs;

            // Fetch only vehicles that had records this month
            const rtsCommVehicleIds = [...new Set((commRecords || []).map(r => r.vehicle_id).filter(Boolean))];
            rtsCommVehicles = [];
            if (rtsCommVehicleIds.length > 0) {
                const { data: cvData } = await supabaseClient
                    .from('commitment_vehicles')
                    .select('id, fixed_monthly_payment, km_limit_per_month, extra_km_charge')
                    .eq('user_id', currentQueryUserId)
                    .in('id', rtsCommVehicleIds);
                rtsCommVehicles = cvData || [];
            }
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
                            label: function (ctx) {
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
async function loadTopRoutesChart(monthValue, cachedData = null) {
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

        let hireRecords, commitRecords, otherOpRecords;

        if (cachedData) {
            hireRecords = cachedData.hireRecords;
            commitRecords = cachedData.commitmentRecords;
            otherOpRecords = cachedData.otherOpHires;
        } else {
            const [
                { data: rHireRecords },
                { data: rCommitRecords },
                { data: rOtherOpRecords }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('to_location').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('to_location').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('to_location').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
            ]);
            hireRecords = rHireRecords;
            commitRecords = rCommitRecords;
            otherOpRecords = rOtherOpRecords;
        }

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
                            label: function (ctx) {
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
async function loadDailyActivityChart(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        let hireRecords, commitRecords, otherOpRecords;

        if (cachedData) {
            hireRecords = cachedData.hireRecords;
            commitRecords = cachedData.commitmentRecords;
            otherOpRecords = cachedData.otherOpHires;
        } else {
            const [
                { data: rHireRecords },
                { data: rCommitRecords },
                { data: rOtherOpRecords }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('hire_date').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('hire_date').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('hire_date').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
            ]);
            hireRecords = rHireRecords;
            commitRecords = rCommitRecords;
            otherOpRecords = rOtherOpRecords;
        }

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
                            title: function (ctx) {
                                return `Day ${ctx[0].label}, ${monthValue}`;
                            },
                            label: function (ctx) {
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
async function loadCostVsRevenueChart(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        let hireRecords, commitmentRecords, otherOpHires;

        if (cachedData) {
            hireRecords = cachedData.hireRecords;
            commitmentRecords = cachedData.commitmentRecords;
            otherOpHires = cachedData.otherOpHires;
        } else {
            // Fetch records concurrently
            const [
                { data: rHireRecords },
                { data: rCommitmentRecords },
                { data: rOtherOpHires }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('vehicle_id, hire_amount, fuel_cost, hire_to_pay_vehicles(lorry_number)').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('vehicle_id, fuel_cost, distance, commitment_vehicles(vehicle_number, fixed_monthly_payment, km_limit_per_month, extra_km_charge)').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('base_lorry_number, hire_amount, fuel_cost').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
            ]);
            hireRecords = rHireRecords;
            commitmentRecords = rCommitmentRecords;
            otherOpHires = rOtherOpHires;
        }

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
                            label: function (ctx) {
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
async function loadDailyKmChart(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        let hireRecords, commitRecords, otherOpRecords;

        if (cachedData) {
            hireRecords = cachedData.hireRecords;
            commitRecords = cachedData.commitmentRecords;
            otherOpRecords = cachedData.otherOpHires;
        } else {
            // Fetch distance data from all three sources
            const [{ data: rHireRecords }, { data: rCommitRecords }, { data: rOtherOpRecords }] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
            ]);
            hireRecords = rHireRecords;
            commitRecords = rCommitRecords;
            otherOpRecords = rOtherOpRecords;
        }

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
                            title: function (ctx) {
                                return `Day ${ctx[0].label} — ${monthValue}`;
                            },
                            label: function (ctx) {
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

// ============ CUMULATIVE DAILY KM — CURRENT vs LAST MONTH ============
async function loadCumulativeKmCompareChart(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const yr = parseInt(year);
        const mo = parseInt(month);

        // Current month boundaries
        const monthPadded = String(mo).padStart(2, '0');
        const startDate = `${yr}-${monthPadded}-01`;
        const lastDay = new Date(yr, mo, 0).getDate();
        const endDate = `${yr}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

        // Previous month boundaries
        const prevDate = new Date(yr, mo - 2, 1); // JS month is 0-indexed, so mo-2
        const prevYr = prevDate.getFullYear();
        const prevMo = prevDate.getMonth() + 1;
        const prevMoPadded = String(prevMo).padStart(2, '0');
        const prevStartDate = `${prevYr}-${prevMoPadded}-01`;
        const prevLastDay = new Date(prevYr, prevMo, 0).getDate();
        const prevEndDate = `${prevYr}-${prevMoPadded}-${String(prevLastDay).padStart(2, '0')}`;

        const currentQueryUserId = getQueryUserId();

        // ── Fetch current month data (use cached if available) ──
        let curHire, curCommit, curOther;
        if (cachedData) {
            curHire = cachedData.hireRecords;
            curCommit = cachedData.commitmentRecords;
            curOther = cachedData.otherOpHires;
        } else {
            const [{ data: rH }, { data: rC }, { data: rO }] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
            ]);
            curHire = rH;
            curCommit = rC;
            curOther = rO;
        }

        // ── Always fetch previous month data ──
        const [{ data: prevHire }, { data: prevCommit }, { data: prevOther }] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', prevStartDate).lte('hire_date', prevEndDate),
            supabaseClient.from('commitment_records').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', prevStartDate).lte('hire_date', prevEndDate),
            supabaseClient.from('other_operation_hires').select('hire_date, distance').eq('user_id', currentQueryUserId).gte('hire_date', prevStartDate).lte('hire_date', prevEndDate)
        ]);

        // ── Build daily KM arrays ──
        const maxDays = Math.max(lastDay, prevLastDay);

        // Current month daily KMs
        const curDailyKms = new Array(lastDay).fill(0);
        [...(curHire || []), ...(curCommit || []), ...(curOther || [])].forEach(r => {
            const day = parseInt((r.hire_date || '').split('-')[2]);
            if (day >= 1 && day <= lastDay) curDailyKms[day - 1] += (r.distance || 0);
        });

        // Previous month daily KMs
        const prevDailyKms = new Array(prevLastDay).fill(0);
        [...(prevHire || []), ...(prevCommit || []), ...(prevOther || [])].forEach(r => {
            const day = parseInt((r.hire_date || '').split('-')[2]);
            if (day >= 1 && day <= prevLastDay) prevDailyKms[day - 1] += (r.distance || 0);
        });

        // ── Build cumulative arrays ──
        const curCumulative = [];
        const prevCumulative = [];
        let curSum = 0, prevSum = 0;

        for (let i = 0; i < maxDays; i++) {
            if (i < lastDay) {
                curSum += curDailyKms[i];
                curCumulative.push(curSum);
            } else {
                curCumulative.push(null);
            }
            if (i < prevLastDay) {
                prevSum += prevDailyKms[i];
                prevCumulative.push(prevSum);
            } else {
                prevCumulative.push(null);
            }
        }

        // Day labels 1..maxDays
        const labels = [];
        for (let i = 1; i <= maxDays; i++) labels.push(i);

        // Month names for legend
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const curMonthName = monthNames[mo - 1] + ' ' + yr;
        const prevMonthName = monthNames[prevMo - 1] + ' ' + prevYr;

        // Totals for subtitle
        const curTotal = curCumulative.filter(v => v !== null).pop() || 0;
        const prevTotal = prevCumulative.filter(v => v !== null).pop() || 0;
        const diffPct = prevTotal > 0 ? (((curTotal - prevTotal) / prevTotal) * 100).toFixed(1) : 'N/A';
        const diffSign = typeof diffPct === 'string' ? '' : (parseFloat(diffPct) >= 0 ? '+' : '');

        // ── Render chart ──
        if (cumulativeKmCompareChart) { cumulativeKmCompareChart.destroy(); cumulativeKmCompareChart = null; }

        const ctx = document.getElementById('cumulativeKmCompareChart')?.getContext('2d');
        if (!ctx) return;

        const theme = getChartTheme();

        // Gradient for current month area
        const curGradient = ctx.createLinearGradient(0, 0, 0, 400);
        curGradient.addColorStop(0, 'rgba(0, 179, 126, 0.35)');
        curGradient.addColorStop(1, 'rgba(0, 179, 126, 0.02)');

        // Gradient for previous month area
        const prevGradient = ctx.createLinearGradient(0, 0, 0, 400);
        prevGradient.addColorStop(0, 'rgba(155, 89, 182, 0.18)');
        prevGradient.addColorStop(1, 'rgba(155, 89, 182, 0.01)');

        cumulativeKmCompareChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: curMonthName + ' (Current)',
                        data: curCumulative,
                        borderColor: '#00B37E',
                        backgroundColor: curGradient,
                        borderWidth: 3,
                        pointBackgroundColor: '#00B37E',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 7,
                        fill: true,
                        tension: 0.35,
                        spanGaps: false
                    },
                    {
                        label: prevMonthName + ' (Last Month)',
                        data: prevCumulative,
                        borderColor: '#9B59B6',
                        backgroundColor: prevGradient,
                        borderWidth: 2.5,
                        borderDash: [8, 4],
                        pointBackgroundColor: '#9B59B6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 2.5,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.35,
                        spanGaps: false
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
                        text: [
                            `Cumulative Daily KM — ${curMonthName} vs ${prevMonthName}`,
                            `Current: ${curTotal.toLocaleString()} km  |  Last: ${prevTotal.toLocaleString()} km  |  ${diffSign}${diffPct}%`
                        ],
                        color: theme.titleColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            color: theme.textColor,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 18,
                            font: { size: 12, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        titleColor: theme.tooltipText,
                        bodyColor: theme.tooltipText,
                        borderColor: theme.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 10,
                        padding: 14,
                        callbacks: {
                            title: function (items) {
                                return `Day ${items[0].label}`;
                            },
                            label: function (item) {
                                const dayIdx = item.dataIndex;
                                const isCurrent = item.datasetIndex === 0;
                                const dailyVal = isCurrent
                                    ? (dayIdx < curDailyKms.length ? curDailyKms[dayIdx] : 0)
                                    : (dayIdx < prevDailyKms.length ? prevDailyKms[dayIdx] : 0);
                                const cumVal = item.parsed.y;
                                if (cumVal === null) return null;
                                return `${item.dataset.label}: ${cumVal.toLocaleString()} km (Day: ${dailyVal.toLocaleString()} km)`;
                            },
                            afterBody: function (items) {
                                const dayIdx = items[0]?.dataIndex;
                                if (dayIdx === undefined) return '';
                                const curVal = dayIdx < curCumulative.length ? curCumulative[dayIdx] : null;
                                const prevVal = dayIdx < prevCumulative.length ? prevCumulative[dayIdx] : null;
                                if (curVal !== null && prevVal !== null && prevVal > 0) {
                                    const diff = curVal - prevVal;
                                    const pct = ((diff / prevVal) * 100).toFixed(1);
                                    const sign = diff >= 0 ? '+' : '';
                                    return `\n📈 Variance: ${sign}${diff.toLocaleString()} km (${sign}${pct}%)`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => `${v.toLocaleString()} km`,
                            color: theme.textColor,
                            font: { size: 11 }
                        },
                        grid: { color: theme.gridColor },
                        title: {
                            display: true,
                            text: 'Cumulative Distance (km)',
                            color: theme.textColor,
                            font: { size: 11 }
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 0,
                            color: theme.textColor,
                            callback: function (value, index) {
                                // Show every 5th day label + 1st and last
                                const day = labels[index];
                                if (day === 1 || day === maxDays || day % 5 === 0) return day;
                                return '';
                            }
                        },
                        grid: { color: theme.gridColor },
                        title: {
                            display: true,
                            text: 'Day of Month',
                            color: theme.textColor,
                            font: { size: 11 }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading cumulative KM compare chart:', error.message);
    }
}

// 7. Daily Fuel Usage & Cost Chart — GROUPED BAR (Per Day in Month)
async function loadDailyFuelChart(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        let hireRecords, commitRecords, otherOpRecords;

        if (cachedData) {
            hireRecords = cachedData.hireRecords;
            commitRecords = cachedData.commitmentRecords;
            otherOpRecords = cachedData.otherOpHires;
        } else {
            // Fetch fuel data from all three sources
            const [{ data: rHireRecords }, { data: rCommitRecords }, { data: rOtherOpRecords }] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('hire_date, fuel_litres, fuel_cost').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('hire_date, fuel_litres, fuel_cost').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('hire_date, fuel_litres, fuel_cost').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate)
            ]);
            hireRecords = rHireRecords;
            commitRecords = rCommitRecords;
            otherOpRecords = rOtherOpRecords;
        }

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
                            title: function (ctx) {
                                return `Day ${ctx[0].label} — ${monthValue}`;
                            },
                            label: function (ctx) {
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

// ============ WEEKLY VEHICLE KM CHART ============
async function loadWeeklyVehicleKmChart(monthValue, cachedData = null) {
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const startDate = `${year}-${monthPadded}-01`;
        const endDate   = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        const currentQueryUserId = getQueryUserId();

        // ── Fetch records ──────────────────────────────────────────────────────
        let hireRecords, commitRecords, otherOpRecords, hireVehicles, commitVehicles;

        if (cachedData) {
            hireRecords    = cachedData.hireRecords;
            commitRecords  = cachedData.commitmentRecords;
            otherOpRecords = cachedData.otherOpHires;
            hireVehicles   = cachedData.hireVehicles;
            commitVehicles = cachedData.commitmentVehicles;
        } else {
            const [
                { data: rHire },
                { data: rCommit },
                { data: rOther },
                { data: rHireV },
                { data: rCommitV }
            ] = await Promise.all([
                supabaseClient.from('hire_to_pay_records').select('hire_date, distance, vehicle_id').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('commitment_records').select('hire_date, distance, vehicle_id').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('other_operation_hires').select('hire_date, distance, base_lorry_number').eq('user_id', currentQueryUserId).gte('hire_date', startDate).lte('hire_date', endDate),
                supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number').eq('user_id', currentQueryUserId),
                supabaseClient.from('commitment_vehicles').select('id, vehicle_number').eq('user_id', currentQueryUserId)
            ]);
            hireRecords    = rHire;
            commitRecords  = rCommit;
            otherOpRecords = rOther;
            hireVehicles   = rHireV;
            commitVehicles = rCommitV;
        }

        // ── Build vehicle label maps ───────────────────────────────────────────
        const hireVehicleMap    = {};  // id → base label
        const commitVehicleMap  = {};
        (hireVehicles  || []).forEach(v => { hireVehicleMap[v.id]   = extractBaseVehicleName(v.lorry_number);  });
        (commitVehicles|| []).forEach(v => { commitVehicleMap[v.id] = extractBaseVehicleName(v.vehicle_number); });

        // ── Define 4 calendar weeks inside the month ──────────────────────────
        // Week 1: days 1–7 | Week 2: 8–14 | Week 3: 15–21 | Week 4: 22–lastDay
        const weekBounds = [
            { label: 'Week 1 (Days 1–7)',         start: 1,  end: 7          },
            { label: 'Week 2 (Days 8–14)',         start: 8,  end: 14         },
            { label: 'Week 3 (Days 15–21)',        start: 15, end: 21         },
            { label: 'Week 4 (Days 22–' + lastDay + ')', start: 22, end: lastDay }
        ];

        // Helper: which week index (0–3) does a date fall in?
        function getWeekIdx(dateStr) {
            const day = parseInt(dateStr.split('-')[2]);
            for (let i = 0; i < weekBounds.length; i++) {
                if (day >= weekBounds[i].start && day <= weekBounds[i].end) return i;
            }
            return -1;
        }

        // ── Accumulate KM per vehicle per week ────────────────────────────────
        // vehicleData[label] = [week0km, week1km, week2km, week3km]
        const vehicleData = {};

        function addKm(vehicleLabel, dateStr, km) {
            if (!vehicleLabel || !km) return;
            if (!vehicleData[vehicleLabel]) vehicleData[vehicleLabel] = [0, 0, 0, 0];
            const wIdx = getWeekIdx(dateStr);
            if (wIdx >= 0) vehicleData[vehicleLabel][wIdx] += (km || 0);
        }

        (hireRecords    || []).forEach(r => addKm(hireVehicleMap[r.vehicle_id],   r.hire_date, r.distance));
        (commitRecords  || []).forEach(r => addKm(commitVehicleMap[r.vehicle_id], r.hire_date, r.distance));
        (otherOpRecords || []).forEach(r => addKm(extractBaseVehicleName(r.base_lorry_number), r.hire_date, r.distance));

        const vehicleLabels = Object.keys(vehicleData).sort();

        if (vehicleLabels.length === 0) {
            // No data: clear chart + show message
            if (weeklyVehicleKmChart) { weeklyVehicleKmChart.destroy(); weeklyVehicleKmChart = null; }
            const tableDiv = document.getElementById('weeklyKmSummaryTable');
            if (tableDiv) tableDiv.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:16px;">No KM data available for the selected month.</p>';
            return;
        }

        // ── Palette for weeks ─────────────────────────────────────────────────
        const weekColors = [
            { bg: 'rgba(52, 152, 219, 0.78)',  border: '#2980b9' },   // Week 1 – blue
            { bg: 'rgba(46, 213, 115, 0.78)',  border: '#20bf6b' },   // Week 2 – green
            { bg: 'rgba(255, 165, 2,  0.78)',  border: '#f9a602' },   // Week 3 – amber
            { bg: 'rgba(209, 0,   31,  0.72)', border: '#c0392b' }    // Week 4 – red
        ];

        const datasets = weekBounds.map((wb, wIdx) => ({
            label: wb.label,
            data: vehicleLabels.map(v => parseFloat(vehicleData[v][wIdx].toFixed(2))),
            backgroundColor: weekColors[wIdx].bg,
            borderColor:     weekColors[wIdx].border,
            borderWidth: 1,
            borderRadius: 4
        }));

        // ── Render Chart ──────────────────────────────────────────────────────
        if (weeklyVehicleKmChart) { weeklyVehicleKmChart.destroy(); weeklyVehicleKmChart = null; }

        const ctx = document.getElementById('weeklyVehicleKmChart')?.getContext('2d');
        if (!ctx) return;

        const theme = getChartTheme();
        weeklyVehicleKmChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: vehicleLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: {
                        display: true,
                        text: `Weekly KM Runs by Vehicle — ${monthValue}`,
                        color: theme.titleColor,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        position: 'top',
                        labels: { color: theme.textColor, usePointStyle: true, pointStyle: 'rect', padding: 14 }
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
                            label: function (ctx) {
                                return `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: theme.textColor, font: { size: 11 }, maxRotation: 30 },
                        grid: { color: theme.gridColor }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => `${v.toLocaleString()} km`,
                            color: theme.textColor
                        },
                        grid: { color: theme.gridColor },
                        title: {
                            display: true,
                            text: 'Distance (km)',
                            color: theme.textColor,
                            font: { size: 11 }
                        }
                    }
                }
            }
        });

        // ── Render Summary Table ───────────────────────────────────────────────
        const tableDiv = document.getElementById('weeklyKmSummaryTable');
        if (!tableDiv) return;

        const weekLabelsShort = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        const isDark = document.body.classList.contains('dark-mode');

        let tableHtml = `
            <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:500px;">
                <thead>
                    <tr style="background:var(--surface-hover,rgba(0,0,0,0.06));text-align:left;">
                        <th style="padding:10px 14px;font-weight:700;color:var(--text-primary);border-bottom:2px solid var(--surface-border,#e0e0e0);">Vehicle</th>`;
        weekLabelsShort.forEach((wl, i) => {
            tableHtml += `<th style="padding:10px 14px;font-weight:700;color:${weekColors[i].border};border-bottom:2px solid var(--surface-border,#e0e0e0);text-align:right;">${wl}</th>`;
        });
        tableHtml += `<th style="padding:10px 14px;font-weight:700;color:var(--text-primary);border-bottom:2px solid var(--surface-border,#e0e0e0);text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>`;

        vehicleLabels.forEach((v, idx) => {
            const weeks = vehicleData[v];
            const total = weeks.reduce((a, b) => a + b, 0);
            const rowBg = idx % 2 === 0 ? 'transparent' : 'var(--surface-hover,rgba(0,0,0,0.03))';
            tableHtml += `<tr style="background:${rowBg};border-bottom:1px solid var(--surface-border,#eee);">
                <td style="padding:9px 14px;font-weight:600;color:var(--text-primary);">🚛 ${v}</td>`;
            weeks.forEach((km, wIdx) => {
                const highlight = km > 0 ? `color:${weekColors[wIdx].border};font-weight:600;` : 'color:var(--text-muted);';
                tableHtml += `<td style="padding:9px 14px;text-align:right;${highlight}">${km > 0 ? km.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km' : '—'}</td>`;
            });
            tableHtml += `<td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--text-primary);">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</td>
            </tr>`;
        });

        // Totals row
        const weekTotals = [0, 1, 2, 3].map(wIdx => vehicleLabels.reduce((s, v) => s + vehicleData[v][wIdx], 0));
        const grandTotal = weekTotals.reduce((a, b) => a + b, 0);
        tableHtml += `<tr style="background:var(--surface-hover,rgba(0,0,0,0.06));border-top:2px solid var(--surface-border,#e0e0e0);">
            <td style="padding:10px 14px;font-weight:700;color:var(--text-primary);">📊 Total</td>`;
        weekTotals.forEach((t, wIdx) => {
            tableHtml += `<td style="padding:10px 14px;text-align:right;font-weight:700;color:${weekColors[wIdx].border};">${t.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</td>`;
        });
        tableHtml += `<td style="padding:10px 14px;text-align:right;font-weight:800;color:var(--brand-red,#d1001f);">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</td>
        </tr>
                </tbody>
            </table>`;

        tableDiv.innerHTML = tableHtml;

    } catch (error) {
        console.error('Error loading weekly vehicle KM chart:', error.message);
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
    document.getElementById('driverDayOffFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });

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
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

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
        showToast('Error saving driver day off: ' + error.message, 'error');
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
            const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
            const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
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
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:38px;font-weight:900;letter-spacing:-.5px;line-height:1.05;">LKR ${grandDeduction.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style="font-size:12px;opacity:.75;margin-top:5px;">${totalDayOffs} day off record${totalDayOffs !== 1 ? 's' : ''} across ${driverCount} staff member${driverCount !== 1 ? 's' : ''}</div>
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
                    <div class="advance-card-label">${d.count} day off${d.count !== 1 ? 's' : ''} — ${monthLabel}</div>
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

        const filteredDrivers = drivers?.filter(d => {
            const nameClean = cleanDriverName(d.name).toLowerCase();
            return nameClean !== 'jaap jayasooriya' && nameClean !== 'jauk jayasooriya';
        });

        const formSelect = document.getElementById('driverDayOffDriver');
        const filterSelect = document.getElementById('driverDayOffFilter');

        // Update Filter dropdown (preserve current selection)
        if (filterSelect) {
            const currentFilter = filterSelect.value;
            filterSelect.innerHTML = '<option value="">All Staff</option>';
            filteredDrivers?.forEach(d => {
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
            filteredDrivers?.forEach(d => {
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
        document.getElementById('driverDayOffFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading day off: ' + error.message, 'error');
    }
}

// 8. Delete Function
async function deleteDriverDayOff(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this day off record?')) {
        try {
            await supabaseClient.from('driver_day_offs').delete().eq('id', id);
            loadDriverDayOffs();
        } catch (error) {
            showToast('Error deleting record: ' + error.message, 'error');
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
    document.getElementById('maintenanceFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

    const id = document.getElementById('maintenanceId').value;
    const vehicleRaw = document.getElementById('maintenanceVehicle').value;

    // We now save the base name directly.
    const data = {
        vehicle_ref: vehicleRaw,
        vehicle_type: 'merged',
        vehicle_id: 0,
        expense_type: document.getElementById('maintenanceExpense').value,
        amount: parseFloat(document.getElementById('maintenanceAmount').value) || 0,
        maintenance_date: document.getElementById('maintenanceDate').value,
        notes: document.getElementById('maintenanceNotes').value || null,
        user_id: adminUserId
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
        showToast('Error saving maintenance record: ' + error.message, 'error');
    }
});

// 4. Load Records + Widgets
async function loadMaintenanceRecords() {
    try {
        const monthEl = document.getElementById('maintenanceMonth');
        let monthValue = monthEl ? monthEl.value : '';
        if (!monthValue) {
            const now = new Date();
            monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            if (monthEl) monthEl.value = monthValue;
        }

        const vehicleFilter = document.getElementById('maintenanceVehicleFilter')?.value || '';

        const [yr, mo] = monthValue.split('-');
        const startDate = `${yr}-${mo}-01`;
        const lastDay = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const endDate = `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`;

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
        document.getElementById('maintenanceFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast('Error loading maintenance record: ' + error.message, 'error');
    }
}

// 10. Delete Record
async function deleteMaintenanceRecord(id) {
    if (!checkAdminAccess('delete')) return;
    if (await showConfirmAsync('Are you sure you want to delete this maintenance record?')) {
        try {
            await supabaseClient.from('lorry_maintenance').delete().eq('id', id);
            loadMaintenanceRecords();
        } catch (error) {
            showToast('Error deleting record: ' + error.message, 'error');
        }
    }
}

// ============================================================
//  CHEQUE STATUS MODULE
// ============================================================

// Sri Lankan bank → fallback emoji
const BANK_EMOJI_MAP = {
    'Bank of Ceylon (BOC)': '🏗️',
    "People's Bank": '🏗️',
    'Hatton National Bank (HNB)': '🏦',
    'Commercial Bank of Ceylon': '🏦',
    'Sampath Bank': '💼',
    'Seylan Bank': '💳',
    'Nations Trust Bank (NTB)': '🔷',
    'DFCC Bank': '🏗️',
    'Pan Asia Bank': '🌏',
    'Union Bank': '🤝',
};

// Sri Lankan bank → logo image URL
const BANK_LOGO_MAP = {
    'Bank of Ceylon (BOC)': 'https://i.postimg.cc/hPHVZvDK/bank-of-ceylon-seeklogo.png',
    "People's Bank": 'https://i.postimg.cc/TPywzqCZ/peoples-bank-seeklogo.png',
    'Hatton National Bank (HNB)': 'https://i.postimg.cc/Qt1MtNLf/id-EGb-VVT5z.png',
    'Commercial Bank of Ceylon': 'https://i.postimg.cc/fy3kN7zN/com-bank.png',
    'Sampath Bank': 'https://i.postimg.cc/jq65Yj4Y/Sampath-Bank-id-Er-NN75DC-1.png',
    'Seylan Bank': 'https://i.postimg.cc/xTzqpPp4/seylan.png',
    'Nations Trust Bank (NTB)': 'https://i.postimg.cc/MZcyxVrd/tile-NTB.png',
    'DFCC Bank': 'https://i.postimg.cc/pLrXjJbz/DFCC-id6b-UJt-WD6-0.png',
    'Pan Asia Bank': 'https://i.postimg.cc/13dRrVsW/500px-PAN-ASIA-BANK-LOGO-The-Truly-Sri-Lankan-ank.jpg',
    'Union Bank': 'https://i.postimg.cc/KYgGqcYX/Union-Bank-of-Colombo-id-Yqg-Xh2uk-0.png',
};

// Flat items array used by the bank logo picker (static, all banks)
const BANK_ITEMS = Object.keys(BANK_EMOJI_MAP).map(name => ({
    value: name,
    label: name,
    logoUrl: BANK_LOGO_MAP[name] || null,
    emoji: BANK_EMOJI_MAP[name] || '🏦',
}));

const CHEQUE_STATUS_META = {
    not_issued: { label: 'Not Issued', color: '#8A92A3', bg: 'rgba(138,146,163,0.12)', icon: '⚫' },
    issued: { label: 'Issued', color: '#E07B00', bg: 'rgba(224,123,0,0.12)', icon: '🟠' },
    paid: { label: 'Paid', color: '#00B37E', bg: 'rgba(0,179,126,0.12)', icon: '🟢' },
    stopped: { label: 'Stopped', color: '#0072CE', bg: 'rgba(0,114,206,0.12)', icon: '🔵' },
    returned: { label: 'Returned', color: '#D1001F', bg: 'rgba(209,0,31,0.12)', icon: '🔴' },
};

// ============================================================
//  LOGO DROPDOWN ENGINE  (fixed-position teleport build)
// ============================================================
const _lddRegistry = {};

function _lddIconHtml(item, size) {
    const sz = size || 32;
    if (item.logoUrl) {
        return `<div class="ldd-logo-wrap" style="width:${sz}px;height:${sz}px;"><img src="${item.logoUrl}" alt="" class="ldd-logo-img" loading="lazy"></div>`;
    }
    return `<div class="ldd-emoji-wrap" style="width:${sz}px;height:${sz}px;">${item.emoji || '🏦'}</div>`;
}

// Reposition a teleported dropdown to sit beneath its trigger
function _lddReposition(triggerId, dropdownEl) {
    const trigger = document.getElementById(triggerId);
    if (!trigger || !dropdownEl) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropH = Math.min(dropdownEl.scrollHeight, 380);

    dropdownEl.style.left  = rect.left + 'px';
    dropdownEl.style.width = rect.width + 'px';

    if (spaceBelow >= dropH || spaceBelow >= spaceAbove) {
        // Open downward
        dropdownEl.style.top    = (rect.bottom + 6) + 'px';
        dropdownEl.style.bottom = 'auto';
    } else {
        // Flip upward
        dropdownEl.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
        dropdownEl.style.top    = 'auto';
    }
}

function buildLogoDropdown(containerId, hiddenId, items, placeholder, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Remove any previously-teleported dropdown for this containerId
    const oldDrop = document.getElementById(`${containerId}_drop`);
    if (oldDrop && oldDrop.parentElement === document.body) oldDrop.remove();

    // Retrieve or seed hidden input value
    let existingHidden = document.getElementById(hiddenId);
    const currentVal = existingHidden ? existingHidden.value : '';
    _lddRegistry[containerId] = { hiddenId, placeholder: placeholder || 'Select…', onChange, items };

    const hasSearch = items.length > 5;

    // Build trigger inside container
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
    `;

    // Build dropdown panel — teleport to <body> so it escapes overflow:hidden ancestors
    const dropdown = document.createElement('div');
    dropdown.className = 'ldd-dropdown ldd-teleported';
    dropdown.id = `${containerId}_drop`;
    dropdown.setAttribute('data-ldd-owner', containerId);
    dropdown.innerHTML = `
        ${hasSearch ? `<div class="ldd-search-wrap"><input class="ldd-search" id="${containerId}_srch" type="text" placeholder="Search bank…" autocomplete="off"></div>` : ''}
        <div class="ldd-list" id="${containerId}_list">
            ${items.map(it => `
                <div class="ldd-item" data-value="${it.value}" data-label="${it.label}" data-logo="${it.logoUrl || ''}" data-emoji="${it.emoji || ''}"
                    role="option" tabindex="-1">
                    ${_lddIconHtml(it, 30)}
                    <span class="ldd-item-name">${it.label}</span>
                </div>`).join('')}
        </div>
    `;
    document.body.appendChild(dropdown);

    const trigger = document.getElementById(`${containerId}_trigger`);
    const selEl   = document.getElementById(`${containerId}_sel`);
    const list     = document.getElementById(`${containerId}_list`);
    const search   = document.getElementById(`${containerId}_srch`);

    // Open / close
    trigger.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('ldd-open');
        _lddCloseAll();
        if (!isOpen) {
            _lddReposition(`${containerId}_trigger`, dropdown);
            dropdown.classList.add('ldd-open');
            trigger.classList.add('ldd-active');
            search && setTimeout(() => search.focus(), 60);
        }
    });

    // Prevent clicks inside dropdown from bubbling (would close it)
    dropdown.addEventListener('click', e => e.stopPropagation());

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
    const reg = _lddRegistry[containerId];
    if (!reg) return;
    const hidden = document.getElementById(reg.hiddenId);
    const selEl  = document.getElementById(`${containerId}_sel`);
    const list   = document.getElementById(`${containerId}_list`);
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
    _lddSelect(containerId, value, true);
}

function _lddCloseAll() {
    document.querySelectorAll('.ldd-dropdown.ldd-open').forEach(d => d.classList.remove('ldd-open'));
    document.querySelectorAll('.ldd-trigger.ldd-active').forEach(t => t.classList.remove('ldd-active'));
}

// Reposition open dropdowns on scroll or resize
if (!window._lddGlobalEventsAttached) {
    window._lddGlobalEventsAttached = true;
    document.addEventListener('click', _lddCloseAll);
    // Reposition on scroll inside .pages-container
    document.addEventListener('scroll', () => {
        document.querySelectorAll('.ldd-dropdown.ldd-open').forEach(drop => {
            const ownerId = drop.getAttribute('data-ldd-owner');
            if (ownerId) _lddReposition(`${ownerId}_trigger`, drop);
        });
    }, true);
    window.addEventListener('resize', () => {
        document.querySelectorAll('.ldd-dropdown.ldd-open').forEach(drop => {
            const ownerId = drop.getAttribute('data-ldd-owner');
            if (ownerId) _lddReposition(`${ownerId}_trigger`, drop);
        });
    });
}

async function loadChequeStatus() {
    initChequeBookForm();
    await loadChequeBooks();
    initChequeLeafSelectHandlers();
}

// ---- Init: Add Cheque Book form ----
function initChequeBookForm() {
    const toggleBtn = document.getElementById('toggleAddBookFormBtn');
    const formContainer = document.getElementById('addBookFormContainer');
    const cancelBtn = document.getElementById('cancelAddBookBtn');

    // Always rebuild the bank logo picker (harmless to rebuild)
    buildLogoDropdown('bankCustomSelect', 'chequeBank', BANK_ITEMS, '🏦 Select Bank', null);

    if (toggleBtn && !toggleBtn._csInited) {
        toggleBtn._csInited = true;
        toggleBtn.addEventListener('click', () => {
            const isOpening = formContainer.style.display === 'none' || formContainer.style.display === '';
            formContainer.style.display = isOpening ? 'block' : 'none';
            if (isOpening) formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const leafTo = parseInt(document.getElementById('chequeLeafTo').value);

    if (!bankName) { showToast('Please select a bank.', 'warning'); return; }
    if (isNaN(leafFrom) || isNaN(leafTo) || leafFrom < 1 || leafTo < leafFrom) {
        showToast('Please enter valid leaf numbers (From must be ≤ To).', 'warning'); return;
    }
    const leafCount = leafTo - leafFrom + 1;
    if (leafCount > 500) { showToast('Maximum 500 leaves per book.', 'warning'); return; }

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
        showToast('Failed to save cheque book: ' + err.message, 'error');
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
                const emoji = BANK_EMOJI_MAP[book.bank_name] || '🏦';
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
            value: book.id,
            label: `${book.bank_name}  ( ${book.leaf_from}–${book.leaf_to} )`,
            logoUrl: BANK_LOGO_MAP[book.bank_name] || null,
            emoji: BANK_EMOJI_MAP[book.bank_name] || '🏦',
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
            .select('status, amount, cheque_date')
            .eq('user_id', uid);
        if (error) throw error;

        const total = data.length;
        const paid = data.filter(l => l.status === 'paid').length;
        const issued = data.filter(l => l.status === 'issued').length;
        const stopped = data.filter(l => l.status === 'stopped').length;
        const returned = data.filter(l => l.status === 'returned').length;
        const notIssued = data.filter(l => l.status === 'not_issued').length;

        document.getElementById('csTotal').textContent = total;
        document.getElementById('csPaid').textContent = paid;
        document.getElementById('csIssued').textContent = issued;
        document.getElementById('csStopped').textContent = stopped;
        document.getElementById('csReturned').textContent = returned;
        document.getElementById('csNotIssued').textContent = notIssued;

        // Financial sum calculations
        const paidAmt = data.filter(l => l.status === 'paid').reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
        const stoppedAmt = data.filter(l => l.status === 'stopped').reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
        const returnedAmt = data.filter(l => l.status === 'returned').reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const currentMonthStr = `${currentYear}-${currentMonth}`; // "YYYY-MM"

        const needToPayMonthAmt = data
            .filter(l => l.status === 'issued' && l.cheque_date && l.cheque_date.startsWith(currentMonthStr))
            .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

        const needToPayAllTimeAmt = data
            .filter(l => l.status === 'issued')
            .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

        const formatLKR = val => 'LKR ' + val.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        document.getElementById('amtPaid').textContent = formatLKR(paidAmt);
        document.getElementById('amtStopped').textContent = formatLKR(stoppedAmt);
        document.getElementById('amtReturned').textContent = formatLKR(returnedAmt);

        const amtNeedToPayMonthEl = document.getElementById('amtNeedToPayMonth');
        const amtNeedToPayAllTimeEl = document.getElementById('amtNeedToPayAllTime');
        if (amtNeedToPayMonthEl) amtNeedToPayMonthEl.textContent = formatLKR(needToPayMonthAmt);
        if (amtNeedToPayAllTimeEl) amtNeedToPayAllTimeEl.textContent = formatLKR(needToPayAllTimeAmt);
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
    const uid = getQueryUserId();
    const statusFilter = document.getElementById('chequeStatusFilter').value;
    const tbody = document.getElementById('chequeLeavesBody');
    const table = document.getElementById('chequeLeavesTable');
    const emptyState = document.getElementById('chequeLeavesEmpty');

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
                <td>${leaf.amount != null ? 'LKR ' + Number(leaf.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 }) : '<span class="text-muted">—</span>'}</td>
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

        document.getElementById('editLeafId').value = leaf.id;
        document.getElementById('editLeafNumberDisplay').textContent = leaf.leaf_number;
        document.getElementById('editChequeDate').value = leaf.cheque_date || '';
        document.getElementById('editChequeAmount').value = leaf.amount != null ? leaf.amount : '';
        document.getElementById('editChequePayee').value = leaf.payee || '';
        document.getElementById('editChequeStatus').value = leaf.status || 'not_issued';
        document.getElementById('editChequeNotes').value = leaf.notes || '';

        const container = document.getElementById('chequeLeafEditContainer');
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        showToast('Error loading leaf: ' + err.message, 'error');
    }
}

// ---- Save changes to a cheque leaf ----
async function saveChequeLeaf() {
    const id = document.getElementById('editLeafId').value;
    const updates = {
        cheque_date: document.getElementById('editChequeDate').value || null,
        amount: document.getElementById('editChequeAmount').value !== '' ? parseFloat(document.getElementById('editChequeAmount').value) : null,
        payee: document.getElementById('editChequePayee').value.trim() || null,
        status: document.getElementById('editChequeStatus').value,
        notes: document.getElementById('editChequeNotes').value.trim() || null,
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
        showToast('Error saving leaf: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Save Changes';
    }
}

// ---- Delete a cheque book (and all its leaves via cascade) ----
async function deleteChequeBook(bookId) {
    if (!checkAdminAccess('delete')) return;
    if (!await showConfirmAsync('Delete this cheque book and ALL its leaves? This cannot be undone.')) return;
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
        showToast('Error deleting cheque book: ' + err.message, 'error');
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
        const [chequeAlerts, serviceAlerts, advanceAlerts, expiryAlerts, birthdayAlerts, creditCardAlerts] = await Promise.all([
            fetchChequeAlerts(userId),
            fetchServiceAlerts(userId, allHireVehicles, allCommVehicles),
            fetchAdvanceAlerts(userId),
            fetchExpiryAlerts(userId),
            fetchBirthdayAlerts(userId),
            typeof window.fetchCreditCardAlerts === 'function' ? window.fetchCreditCardAlerts(userId) : Promise.resolve([])
        ]);

        const allAlerts = [...chequeAlerts, ...serviceAlerts, ...advanceAlerts, ...expiryAlerts, ...birthdayAlerts, ...creditCardAlerts];

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
                } else if (alert.type === 'expiry') {
                    currentPage = 'vehicle-expiry';
                    setActiveNavItem('vehicle-expiry');
                    switchPage('vehicle-expiry');
                    setTimeout(() => {
                        document.getElementById('expiryVehicleGrid')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 200);
                } else if (alert.type === 'birthday') {
                    currentPage = 'drivers';
                    setActiveNavItem('drivers');
                    switchPage('drivers');
                    setTimeout(() => {
                        const rows = document.querySelectorAll('#driversTable tbody tr');
                        rows.forEach(row => {
                            if (row.innerHTML.includes(`editDriver(${alert.driverId})`)) {
                                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                const origBg = row.style.backgroundColor;
                                row.style.backgroundColor = '#FCF3CF';
                                setTimeout(() => { row.style.backgroundColor = origBg; }, 3000);
                            }
                        });
                    }, 200);
                } else if (alert.type === 'credit-card') {
                    currentPage = 'credit-cards';
                    setActiveNavItem('credit-cards');
                    switchPage('credit-cards');
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
                const refDateStr = leaf.updated_at || leaf.cheque_date;
                if (refDateStr) {
                    const refDate = new Date(refDateStr);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const refMidnight = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
                    const diffTime = today - refMidnight;
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays > 7) {
                        return; // Only show returned cheques for 1 week after returned/maturity
                    }
                }

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
                today.setHours(0, 0, 0, 0);

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

function getDaysUntilBirthday(birthMonth, birthDay) {
    const today = new Date();
    const currentYear = today.getFullYear();
    let nextBirthday = new Date(currentYear, birthMonth - 1, birthDay);
    
    today.setHours(0,0,0,0);
    nextBirthday.setHours(0,0,0,0);
    
    if (nextBirthday < today) {
        nextBirthday.setFullYear(currentYear + 1);
    }
    
    const diffTime = nextBirthday - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

async function fetchBirthdayAlerts(userId) {
    try {
        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id, name, age')
            .eq('user_id', userId)
            .neq('terminated', true);

        const alerts = [];
        if (!drivers || drivers.length === 0) return alerts;

        drivers.forEach(d => {
            if (d.age && d.age > 19000000) {
                const birthMonth = Math.floor((d.age % 10000) / 100);
                const birthDay = d.age % 100;
                const daysLeft = getDaysUntilBirthday(birthMonth, birthDay);

                if (daysLeft <= 14) {
                    const birthdayString = `${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}`;
                    let desc = '';
                    if (daysLeft === 0) {
                        desc = `Happy Birthday! Today is ${cleanDriverName(d.name)}'s birthday! 🎉`;
                    } else if (daysLeft === 1) {
                        desc = `${cleanDriverName(d.name)}'s birthday is tomorrow! 🎂`;
                    } else {
                        desc = `${cleanDriverName(d.name)}'s birthday is in ${daysLeft} days (${birthdayString})! 🎂`;
                    }

                    alerts.push({
                        id: `bday_${d.id}_${birthMonth}_${birthDay}`,
                        title: `🎂 Upcoming Birthday`,
                        desc: desc,
                        icon: `🎂`,
                        type: 'birthday',
                        driverId: d.id,
                        date: birthdayString
                    });
                }
            }
        });

        return alerts;
    } catch (e) {
        console.error('Error fetching birthday alerts:', e);
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
        showToast('Please fill out all fields with valid data.', 'warning');
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
        showToast('Failed to save record: ' + err.message, 'error');
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
        showToast('Error: ' + err.message, 'error');
    }
}

async function deleteDriverKmRecord(id) {
    if (!checkAdminAccess('delete')) return;
    if (!await showConfirmAsync('Are you sure you want to delete this KM record?')) return;

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
        showToast('Failed to delete: ' + err.message, 'error');
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
            const totalDeductions = baseDeductions + totalDayOffDeductions;

            const nameClean = cleanDriverName(driver.name);
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
                                    <span style="font-size: 10px; display: block; margin-top: 4px; color: var(--brand-red); font-weight: 600;">
                                        ⚠️ LKR ${totalDayOffDeductions.toFixed(2)} Day-Off Deductions Applied
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
        const helpersOnly = drivers?.filter(d => (d.role || '').toLowerCase() === 'helper') || [];

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

        // Sort helpers by name
        helpersOnly.sort((a, b) => a.name.localeCompare(b.name));

        if (driversOnly.length === 0 && helpersOnly.length === 0) {
            tableDiv.innerHTML = '<div style="color: #7f8c8d; padding: 20px; text-align: center; background: var(--surface-card); border-radius: var(--radius-md); border: 1px solid var(--surface-border);">No active drivers or helpers found.</div>';
            return;
        }

        // Build per-staff data for both table rows and mobile cards
        let tableRows = '';
        let mobileCards = '';

        // Helper function to render a staff member's rows/cards
        const renderStaffRow = (driver, isHelper, rank) => {
            const totalKm = kmByDriver[driver.id] || 0;
            const nameClean = cleanDriverName(driver.name);
            const skipSalary = nameClean === 'JAUK Jayasooriya' || nameClean === 'JAAP Jayasooriya';

            let rankEmoji = '';
            let rankDisplay = '';
            if (isHelper) {
                rankEmoji = '-';
                rankDisplay = `<span style="font-weight: 600; color: var(--text-secondary); padding-left: 8px;">-</span>`;
            } else if (rank === 1) {
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
                const totalDed = baseDed + dayOffDed;

                advColor = '#e74c3c';
                dedColor = '#e67e22';
                salaryColor = 'var(--blue)';
                netColor = 'var(--green)';

                advText = `LKR ${totalAdv.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                dedTextPlain = `LKR ${totalDed.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                let dedDetails = '';
                if (dayOffDed > 0) {
                    dedDetails = ` <span title="Includes LKR ${dayOffDed.toFixed(2)} Day-Off Deductions" style="cursor:help;color:var(--brand-red);font-weight:bold;">⚠️</span>`;
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
                    const extraKm = isHelper ? 0 : Math.max(0, totalKm - kmLimit);
                    const extraKmSalary = isHelper ? 0 : (extraKm * extraKmRate);
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
            const rowHtml = `
                <tr style="border-bottom: 1px solid var(--surface-border);">
                    <td style="padding: 12px; text-align: center;">${rankDisplay}</td>
                    <td style="padding: 12px; font-weight: 600;">${driver.name}</td>
                    <td style="padding: 12px;">${salaryTypeBadge}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 600; color: var(--blue);">${isHelper ? '-' : totalKm.toFixed(2) + ' km'}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 600; color: ${salaryColor};">${fullSalaryText}</td>
                    <td style="padding: 12px; text-align: right; color: ${advColor};">${advText}</td>
                    <td style="padding: 12px; text-align: right; color: ${dedColor};">${dedText}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 700; color: ${netColor};">${netSalaryText}</td>
                </tr>
            `;

            // Mobile card
            const rankBadgeStyle = isHelper
                ? 'background: var(--surface-hover); color: var(--text-secondary);'
                : rank === 1
                    ? 'background: linear-gradient(135deg,#f1c40f,#e67e22); color:#fff;'
                    : rank === 2
                        ? 'background: linear-gradient(135deg,#95a5a6,#7f8c8d); color:#fff;'
                        : rank === 3
                            ? 'background: linear-gradient(135deg,#e67e22,#c0392b); color:#fff;'
                            : 'background: var(--surface-hover); color: var(--text-secondary);';

            const cardHtml = `
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
                            <span class="driver-perf-stat-value" style="color:var(--blue);">${isHelper ? '-' : totalKm.toFixed(2) + ' km'}</span>
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

            return { rowHtml, cardHtml };
        };

        // Render Drivers
        if (driversOnly.length > 0) {
            tableRows += `
                <tr style="background: var(--surface-hover); font-weight: bold; border-bottom: 2px solid var(--surface-border);">
                    <td colspan="8" style="padding: 10px 12px; color: var(--text-primary); font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; letter-spacing: 0.5px; text-transform: uppercase;">
                        🚗 Drivers
                    </td>
                </tr>
            `;
            mobileCards += `
                <div style="font-weight: 700; margin: 10px 0; color: var(--brand-red); font-family: 'Barlow Condensed', sans-serif; font-size: 1.2rem; letter-spacing: 0.5px; text-transform: uppercase;">
                    🚗 Drivers
                </div>
            `;
            driversOnly.forEach((driver, idx) => {
                const { rowHtml, cardHtml } = renderStaffRow(driver, false, idx + 1);
                tableRows += rowHtml;
                mobileCards += cardHtml;
            });
        }

        // Render Helpers
        if (helpersOnly.length > 0) {
            tableRows += `
                <tr style="background: var(--surface-hover); font-weight: bold; border-top: 2px solid var(--surface-border); border-bottom: 2px solid var(--surface-border);">
                    <td colspan="8" style="padding: 10px 12px; color: var(--text-primary); font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; letter-spacing: 0.5px; text-transform: uppercase;">
                        👥 Helpers
                    </td>
                </tr>
            `;
            mobileCards += `
                <div style="font-weight: 700; margin: 20px 0 10px 0; color: var(--brand-red); font-family: 'Barlow Condensed', sans-serif; font-size: 1.2rem; letter-spacing: 0.5px; text-transform: uppercase;">
                    👥 Helpers
                </div>
            `;
            helpersOnly.forEach((helper) => {
                const { rowHtml, cardHtml } = renderStaffRow(helper, true, null);
                tableRows += rowHtml;
                mobileCards += cardHtml;
            });
        }

        // Assemble: desktop table (scrollable) + mobile cards
        const html = `
            <div class="driver-perf-table-wrap table-responsive">
                <table style="width: 100%; border-collapse: collapse; min-width: 700px;">
                    <thead>
                        <tr style="background: var(--brand-red); color: white;">
                            <th style="padding: 12px; text-align: center; width: 80px; border-radius: var(--radius-sm) 0 0 var(--radius-sm);">Rank</th>
                            <th style="padding: 12px; text-align: left;">Driver / Helper</th>
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
let advanceTrendChartInstance = null;
let maintenancePieChartInstance = null;
let maintenanceVehicleBarChartInstance = null;
let driverKmDailyChartInstance = null;

// ── Utility: get today's date string YYYY-MM-DD (local) ──
function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
        el.textContent = sec < 60 ? `🟢 ${sec}s ago` : `🟡 ${Math.floor(sec / 60)}m ago`;
    }, 5000);
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
            monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        const [yr, mo] = monthValue.split('-');
        const startDate = `${yr}-${mo}-01`;
        const daysInMonth = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const endDate = `${yr}-${mo}-${String(daysInMonth).padStart(2, '0')}`;

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
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
            const dateStr = `${yr}-${mo}-${String(d).padStart(2, '0')}`;
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
    } catch (e) {
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
                <span class="rss-value" style="color:${grossProfit >= 0 ? 'var(--green)' : 'var(--brand-red)'};">${fmt(grossProfit)}</span>
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
            monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        const [yr, mo] = monthValue.split('-');
        const startDate = `${yr}-${mo}-01`;
        const lastDay = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const endDate = `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`;

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
        const COLORS = ['#DC143C', '#E67E22', '#3498DB', '#27AE60', '#9B59B6', '#F1C40F', '#1ABC9C', '#E91E63'];

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
    } catch (e) {
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
        const endDate = `${yr}-${mo}-${String(daysInMonth).padStart(2, '0')}`;

        const { data: kmRecs } = await supabaseClient.from('driver_km_records').select('record_date, km_amount').eq('user_id', uid).eq('driver_id', driverFilter).gte('record_date', startDate).lte('record_date', endDate);

        if (!kmRecs || kmRecs.length === 0) { if (chartSection) chartSection.style.display = 'none'; return; }
        if (chartSection) chartSection.style.display = '';

        const dayMap = {};
        kmRecs.forEach(r => { dayMap[r.record_date] = (dayMap[r.record_date] || 0) + (r.km_amount || 0); });

        const labels = [];
        const values = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${yr}-${mo}-${String(d).padStart(2, '0')}`;
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
    } catch (e) {
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
        const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
        const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

        const { data: advances } = await supabaseClient.from('driver_advances').select('advance_date, amount').eq('user_id', uid).gte('advance_date', startStr).lte('advance_date', endStr);

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
                scales: { y: { beginAtZero: true, ticks: { callback: v => `LKR ${(v / 1000).toFixed(0)}K` } } }
            }
        });
    } catch (e) {
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
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => { html += `<div class="dayoff-cal-head">${d}</div>`; });
    // Empty cells for first week
    for (let i = 0; i < firstDow; i++) { html += '<div class="dayoff-cal-cell dayoff-cal-empty"></div>'; }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${yr}-${mo}-${String(d).padStart(2, '0')}`;
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
    } catch (e) {
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
    } catch (e) {
        console.error('Error loading cheques due banner:', e);
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
document.getElementById('fleetUtilMonth')?.addEventListener('change', function () {
    loadFleetUtilizationHeatmap(this.value);
});

// Called when dashboard loads
async function loadDashboardExtras() {
    startLastSyncedTimer();
    _lastSyncedAt = Date.now();

    // Set fleet util to current month
    const fleetMonthEl = document.getElementById('fleetUtilMonth');
    if (fleetMonthEl && !fleetMonthEl.value) {
        const now = new Date();
        fleetMonthEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    if (fleetMonthEl?.value) loadFleetUtilizationHeatmap(fleetMonthEl.value);
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
(function () {
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
                            const mv = monthEl?.value || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
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
document.getElementById('maintenanceMonth')?.addEventListener('change', function () {
    loadMaintenancePieChart(this.value);
});

// Listen for KM log driver filter change to show daily chart
document.getElementById('driverKmDriverFilter')?.addEventListener('change', function () {
    const month = document.getElementById('driverKmMonthFilter')?.value;
    loadDriverKmDailyChart(month, this.value);
});
document.getElementById('driverKmMonthFilter')?.addEventListener('change', function () {
    const driver = document.getElementById('driverKmDriverFilter')?.value;
    loadDriverKmDailyChart(this.value, driver);
});

// Hook salary calculator to show YTD when driver and month are selected
document.getElementById('salaryDriverSelect')?.addEventListener('change', function () {
    const month = document.getElementById('salaryMonth')?.value;
    if (this.value && month) loadSalaryYtdSummary(this.value, month);
});
document.getElementById('salaryMonth')?.addEventListener('change', function () {
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
    const endDate = `${yr}-${mo}-${String(daysInMonth).padStart(2, '0')}`;
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
    window.loadDrivers = async function () {
        await _origLD.apply(this, arguments);
        // Fetch all drivers for breakdown
        try {
            const { data: allD } = await supabaseClient.from('drivers').select('id, role, terminated').eq('user_id', getQueryUserId());
            renderStaffBreakdownWidgets(allD || []);
        } catch (e) { }
    };
}

// ── Patch loadHireRecords to also render summary strip ──
if (typeof loadHireRecords === 'function') {
    const _origLHR = loadHireRecords;
    window.loadHireRecords = async function () {
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
        } catch (e) { }
    };
}

// ── Patch loadCommitmentRecords to also render summary strip ──
if (typeof loadCommitmentRecords === 'function') {
    const _origLCR = loadCommitmentRecords;
    window.loadCommitmentRecords = async function () {
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
        } catch (e) { }
    };
}

// ── Patch loadMaintenanceRecords to also load charts ──
if (typeof loadMaintenanceRecords === 'function') {
    const _origLMR = loadMaintenanceRecords;
    window.loadMaintenanceRecords = async function () {
        await _origLMR.apply(this, arguments);
        const mv = document.getElementById('maintenanceMonth')?.value;
        if (mv) loadMaintenancePieChart(mv);
    };
}

// ── Patch loadChequeStatus to also load cheques due banner ──
if (typeof loadChequeStatus === 'function') {
    const _origLCS = loadChequeStatus;
    window.loadChequeStatus = async function () {
        await _origLCS.apply(this, arguments);
        await loadChequesDueSoonBanner();
    };
}


// Initial load for dashboard page (if it's already active on load)
document.addEventListener('DOMContentLoaded', function () {
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

// ============================================================
// ============ LEASING & LOANS MANAGEMENT ====================
// ============================================================

let _leasingInitialized = false;
let _currentLeasingVehicle = null;
let _currentLeasingTab = 'leasing'; // 'leasing' | 'loan'
let _currentLeasingPaidMap = {};    // cached for calendar re-render

// ── Helpers ──────────────────────────────────────────────────
function leasingFmtLKR(n) {
    return 'LKR ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function leasingMonthKey(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function leasingMonthLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function leasingWeekLabel(dateStr, weekNum) {
    const d = new Date(dateStr + 'T00:00:00');
    return `Week ${weekNum} (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
}

function leasingFortnightLabel(dateStr, fortnightNum) {
    const d = new Date(dateStr + 'T00:00:00');
    return `Fortnight ${fortnightNum} (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
}

// Build payment keys for any entry (monthly, weekly, or fortnightly)
function leasingBuildPaymentKeys(entry) {
    const freq = entry.payment_freq || 'monthly';
    const isWeekly = freq === 'weekly';
    const isFortnightly = freq === 'fortnightly';
    const keys = [];

    if ((isWeekly || isFortnightly) && entry.start_date) {
        const stepDays = isFortnightly ? 14 : 7;
        const postponedSet = new Set(entry.postponed_dates || []);
        const d = new Date(entry.start_date + 'T00:00:00');
        const target = entry.total_installments || entry.total_months || 0;
        let activeCount = 0;
        let safety = 0;
        while (activeCount < target && safety < 500) {
            safety++;
            const dateStr = d.toISOString().split('T')[0];
            keys.push(dateStr);
            if (!postponedSet.has(dateStr)) {
                activeCount++;
            }
            d.setDate(d.getDate() + stepDays);
        }
    } else {
        // Monthly: YYYY-MM
        let y = entry.start_year;
        let m = (entry.start_month || 1) - 1; // 0-based
        const total = entry.total_months || entry.total_installments || 0;
        for (let i = 0; i < total; i++) {
            keys.push(leasingMonthKey(y, m));
            m++;
            if (m > 11) { m = 0; y++; }
        }
    }
    return keys;
}

// "Today" comparison key — monthly uses YYYY-MM, weekly/fortnightly uses YYYY-MM-DD
function leasingTodayKey(isWeeklyOrFortnightly) {
    const now = new Date();
    if (isWeeklyOrFortnightly) return now.toISOString().split('T')[0];
    return leasingMonthKey(now.getFullYear(), now.getMonth());
}

function leasingEntryLabel(entry) {
    return entry.entry_type === 'loan'
        ? (entry.lender_name || 'Unnamed Loan')
        : (entry.vehicle_number || 'Unnamed Lease');
}

function leasingPaymentLabel(key, entry, idx) {
    if (entry.payment_freq === 'weekly') return leasingWeekLabel(key, idx + 1);
    if (entry.payment_freq === 'fortnightly') return leasingFortnightLabel(key, idx + 1);
    return leasingMonthLabel(key);
}

// ── Entry point ───────────────────────────────────────────────
async function loadLeasingPage() {
    if (!_leasingInitialized) {
        initLeasingPage();
        _leasingInitialized = true;
    }
    await refreshLeasingData();
}

// ── Init all event listeners ──────────────────────────────────
function initLeasingPage() {
    // Tab switching
    document.querySelectorAll('.leasing-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.leasing-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            _currentLeasingTab = btn.dataset.tab;

            // Update panel header
            const icon = document.getElementById('leasingPanelIcon');
            const title = document.getElementById('leasingPanelTitle');
            if (icon) icon.textContent = _currentLeasingTab === 'loan' ? '💰' : '🚗';
            if (title) title.textContent = _currentLeasingTab === 'loan' ? 'Loans' : 'Vehicle Leases';

            // Close calendar if open
            document.getElementById('leasingCalendarPanel').style.display = 'none';
            _currentLeasingVehicle = null;

            refreshLeasingData();
        });
    });

    // Toggle add form
    document.getElementById('toggleAddLeaseFormBtn')?.addEventListener('click', () => {
        if (!checkAdminAccess('add')) return;
        const container = document.getElementById('addLeaseFormContainer');
        const isVisible = container.style.display !== 'none';
        if (isVisible) {
            container.style.display = 'none';
        } else {
            resetLeaseForm();
            // Pre-select the correct type based on current tab
            setLeaseFormType(_currentLeasingTab === 'loan' ? 'loan' : 'leasing');
            container.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    document.getElementById('cancelAddLeaseBtn')?.addEventListener('click', () => {
        document.getElementById('addLeaseFormContainer').style.display = 'none';
        resetLeaseForm();
    });

    // Type toggle buttons
    document.querySelectorAll('.lease-type-btn[data-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            setLeaseFormType(btn.dataset.type);
        });
    });

    // Frequency toggle buttons
    document.querySelectorAll('.lease-type-btn[data-freq]').forEach(btn => {
        btn.addEventListener('click', () => {
            setLeaseFormFreq(btn.dataset.freq);
        });
    });

    // Settle checkbox
    document.getElementById('leaseSettledCheck')?.addEventListener('change', (e) => {
        const notesWrap = document.getElementById('leaseSettledNotesWrap');
        if (notesWrap) notesWrap.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('addLeaseVehicleForm')?.addEventListener('submit', handleAddLeaseVehicle);
    document.getElementById('leasingCalendarBackBtn')?.addEventListener('click', () => {
        document.getElementById('leasingCalendarPanel').style.display = 'none';
        _currentLeasingVehicle = null;
    });
}

// ── Form Helpers ──────────────────────────────────────────────
function resetLeaseForm() {
    document.getElementById('addLeaseVehicleForm')?.reset();
    document.getElementById('leaseVehicleId').value = '';
    document.getElementById('leaseEntryType').value = 'leasing';
    document.getElementById('leasePaymentFreq').value = 'monthly';
    document.getElementById('leaseSettledNotesWrap').style.display = 'none';
    const now = new Date();
    const monthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dateVal = now.toISOString().split('T')[0];
    const smEl = document.getElementById('leaseStartMonth');
    const sdEl = document.getElementById('leaseStartDate');
    if (smEl) smEl.value = monthVal;
    if (sdEl) sdEl.value = dateVal;
}

function setLeaseFormType(type) {
    document.getElementById('leaseEntryType').value = type;

    // Update type buttons
    document.querySelectorAll('.lease-type-btn[data-type]').forEach(b => {
        b.classList.toggle('active', b.dataset.type === type);
    });

    // Show/hide leasing vs loan fields
    document.querySelectorAll('.leasing-only-field').forEach(el => {
        el.style.display = type === 'leasing' ? '' : 'none';
    });
    document.querySelectorAll('.loan-only-field').forEach(el => {
        el.style.display = type === 'loan' ? '' : 'none';
    });

    // Reset freq to monthly when switching to leasing
    if (type === 'leasing') setLeaseFormFreq('monthly');
    const totalLabel = document.getElementById('leaseTotalInstLabel');
    if (totalLabel) totalLabel.textContent = type === 'leasing' ? '📆 Total Months' : '📆 Total Installments';
}

function setLeaseFormFreq(freq) {
    document.getElementById('leasePaymentFreq').value = freq;

    // Update freq buttons
    document.querySelectorAll('.lease-type-btn[data-freq]').forEach(b => {
        b.classList.toggle('active', b.dataset.freq === freq);
    });

    const isPeriodWeeklyOrFortnightly = freq === 'weekly' || freq === 'fortnightly';

    // Show/hide weekly vs monthly start fields
    document.querySelectorAll('.monthly-only-field').forEach(el => {
        el.style.display = isPeriodWeeklyOrFortnightly ? 'none' : '';
    });
    document.querySelectorAll('.weekly-only-field').forEach(el => {
        el.style.display = isPeriodWeeklyOrFortnightly ? '' : 'none';
    });

    // Update label
    const totalLabel = document.getElementById('leaseTotalInstLabel');
    if (totalLabel) {
        const type = document.getElementById('leaseEntryType').value;
        totalLabel.textContent = freq === 'weekly' ? '📆 Total Weeks' :
            freq === 'fortnightly' ? '📆 Total Fortnights' :
            (type === 'leasing' ? '📆 Total Months' : '📆 Total Months');
    }
}

// ── Save / Edit Lease or Loan ─────────────────────────────────
async function handleAddLeaseVehicle(e) {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;

    const id = document.getElementById('leaseVehicleId').value;
    const entryType = document.getElementById('leaseEntryType').value;
    const paymentFreq = document.getElementById('leasePaymentFreq').value;
    const isWeeklyOrFortnightly = paymentFreq === 'weekly' || paymentFreq === 'fortnightly';
    const isLoan = entryType === 'loan';
    const isSettled = document.getElementById('leaseSettledCheck')?.checked || false;

    // Validate required fields
    const amount = parseFloat(document.getElementById('leaseInstallmentAmount').value);
    const totalInst = parseInt(document.getElementById('leaseTotalInstallments').value);
    if (!amount || !totalInst) { showToast('Please fill in amount and total installments.', 'warning'); return; }

    let payload = {
        user_id: getQueryUserId(),
        entry_type: entryType,
        payment_freq: paymentFreq,
        installment_amount: amount,
        settled: isSettled,
        settled_notes: isSettled ? (document.getElementById('leaseSettledNotes')?.value || '') : null,
        settled_at: isSettled ? new Date().toISOString() : null,
    };

    if (isLoan) {
        const lenderName = document.getElementById('loanLenderName').value.trim();
        if (!lenderName) { showToast('Please enter the lender / source name.', 'warning'); return; }
        payload.lender_name = lenderName;
        payload.vehicle_number = null;

        if (isWeeklyOrFortnightly) {
            const startDate = document.getElementById('leaseStartDate').value;
            if (!startDate) { showToast('Please select the first payment date.', 'warning'); return; }
            payload.start_date = startDate;
            payload.total_installments = totalInst;
            payload.total_months = null;
            payload.start_year = null;
            payload.start_month = null;
            payload.installment_day = null;
        } else {
            const startMonthVal = document.getElementById('leaseStartMonth').value;
            if (!startMonthVal) { showToast('Please select the start month.', 'warning'); return; }
            const [sy, sm] = startMonthVal.split('-').map(Number);
            payload.start_year = sy;
            payload.start_month = sm;
            payload.total_months = totalInst;
            payload.total_installments = totalInst;
            payload.installment_day = parseInt(document.getElementById('loanInstallmentDay').value) || 1;
            payload.start_date = null;
        }
    } else {
        // Leasing — always monthly
        const vehicleNumber = document.getElementById('leaseVehicleNumber').value.trim();
        if (!vehicleNumber) { showToast('Please enter the vehicle number.', 'warning'); return; }
        const startMonthVal = document.getElementById('leaseStartMonth').value;
        if (!startMonthVal) { showToast('Please select the start month.', 'warning'); return; }
        const [sy, sm] = startMonthVal.split('-').map(Number);
        payload.vehicle_number = vehicleNumber;
        payload.lender_name = null;
        payload.installment_day = parseInt(document.getElementById('leaseInstallmentDay').value) || 1;
        payload.total_months = totalInst;
        payload.total_installments = totalInst;
        payload.start_year = sy;
        payload.start_month = sm;
        payload.start_date = null;
    }

    const submitBtn = document.querySelector('#addLeaseVehicleForm [type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

    try {
        let err;
        if (id) {
            ({ error: err } = await supabaseClient.from('leasing_vehicles').update(payload).eq('id', id));
        } else {
            ({ error: err } = await supabaseClient.from('leasing_vehicles').insert([payload]));
        }
        if (err) throw err;

        document.getElementById('addLeaseFormContainer').style.display = 'none';
        resetLeaseForm();
        await refreshLeasingData();
    } catch (err) {
        console.error('Error saving entry:', err);
        showToast('Failed to save: ' + (err.message || 'Please try again.'), 'error');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '💾 Save'; }
    }
}

// ── Fetch & render ────────────────────────────────────────────
async function refreshLeasingData() {
    const uid = getQueryUserId();
    if (!uid) return;

    const widgetStrip = document.getElementById('leasingWidgetStrip');
    const listEl = document.getElementById('leasingVehiclesList');
    if (!widgetStrip || !listEl) return;

    widgetStrip.innerHTML = '<div class="leasing-widget-placeholder">Loading...</div>';
    listEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);">Loading...</div>';

    try {
        const { data: all, error: vErr } = await supabaseClient
            .from('leasing_vehicles').select('*').eq('user_id', uid)
            .order('created_at', { ascending: true });
        if (vErr) throw vErr;

        const allEntries = all || [];
        const vehicleIds = allEntries.map(v => v.id);

        // Update tab badges
        const leasingCount = allEntries.filter(v => (v.entry_type || 'leasing') === 'leasing' && !v.settled).length;
        const loanCount = allEntries.filter(v => v.entry_type === 'loan' && !v.settled).length;
        const lbEl = document.getElementById('leasingTabBadge');
        const lnEl = document.getElementById('loansTabBadge');
        if (lbEl) lbEl.textContent = leasingCount;
        if (lnEl) lnEl.textContent = loanCount;

        // Fetch all payments
        let paidMap = {};
        if (vehicleIds.length > 0) {
            const { data: payments, error: pErr } = await supabaseClient
                .from('leasing_payments').select('*').in('vehicle_id', vehicleIds);
            if (pErr) throw pErr;
            (payments || []).forEach(p => {
                if (!paidMap[p.vehicle_id]) paidMap[p.vehicle_id] = new Set();
                paidMap[p.vehicle_id].add(p.month_key);
            });
        }
        _currentLeasingPaidMap = paidMap;

        // Filter by current tab for both widget strip and list
        const filtered = allEntries.filter(v => (v.entry_type || 'leasing') === _currentLeasingTab);
        renderLeasingWidgets(filtered, paidMap);
        renderLeasingVehicleRows(filtered, paidMap);
        renderLeasingSummaryStrip(filtered, paidMap);

        // Re-open calendar if one was open
        if (_currentLeasingVehicle) {
            const updated = allEntries.find(v => v.id === _currentLeasingVehicle.id);
            if (updated) openLeasingCalendar(updated, paidMap);
        }
    } catch (err) {
        console.error('Error loading leasing/loan data:', err);
        widgetStrip.innerHTML = '<div class="leasing-empty-state" style="color:var(--brand-red);">⚠️ Error loading data. Make sure Supabase tables are set up.</div>';
        listEl.innerHTML = '';
    }
}

// ── Summary Strip (prev month due, current month due, monthly commitment) ──
function renderLeasingSummaryStrip(entries, paidMap) {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth(); // 0-based

    // Current month key (YYYY-MM)
    const currMonthKey = `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}`;

    // Previous month key
    let prevYear = thisYear, prevMonth = thisMonth - 1;
    if (prevMonth < 0) { prevMonth = 11; prevYear--; }
    const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;

    // Label helpers
    const monthName = (key) => {
        const [y, m] = key.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    let prevDueTotal = 0;
    let currDueTotal = 0;
    let monthlyCommitment = 0;

    (entries || []).forEach(v => {
        if (v.settled) return; // skip settled entries

        const isWeeklyOrFortnightly = v.payment_freq === 'weekly' || v.payment_freq === 'fortnightly';
        const paid = paidMap[v.id] || new Set();
        const keys = leasingBuildPaymentKeys(v);
        const postponed = new Set(v.postponed_dates || []);

        if (!isWeeklyOrFortnightly) {
            // Monthly entries
            // Monthly commitment = installment amount per month
            monthlyCommitment += (v.installment_amount || 0);

            // Previous month: if key exists and not paid
            if (keys.includes(prevMonthKey) && !postponed.has(prevMonthKey) && !paid.has(prevMonthKey)) {
                prevDueTotal += (v.installment_amount || 0);
            }

            // Current month: if key exists and not paid
            if (keys.includes(currMonthKey) && !postponed.has(currMonthKey) && !paid.has(currMonthKey)) {
                currDueTotal += (v.installment_amount || 0);
            }
        } else {
            // Weekly/fortnightly entries: look for keys that fall in the current/prev calendar month
            const stepDays = v.payment_freq === 'fortnightly' ? 14 : 7;

            // For monthly commitment, approximate: installment_amount * periods per month
            const periodsPerMonth = v.payment_freq === 'weekly' ? 4.33 : 2.17;
            monthlyCommitment += (v.installment_amount || 0) * periodsPerMonth;

            keys.forEach(key => {
                if (postponed.has(key) || paid.has(key)) return;
                const keyMonth = key.substring(0, 7); // YYYY-MM
                if (keyMonth === prevMonthKey) prevDueTotal += (v.installment_amount || 0);
                if (keyMonth === currMonthKey) currDueTotal += (v.installment_amount || 0);
            });
        }
    });

    const prevEl = document.getElementById('lssPrevMonthDue');
    const currEl = document.getElementById('lssCurrMonthDue');
    const commitEl = document.getElementById('lssMonthlyCommitment');
    const prevLbl = document.getElementById('lssPrevMonthLabel');
    const currLbl = document.getElementById('lssCurrMonthLabel');

    if (prevEl) prevEl.textContent = leasingFmtLKR(prevDueTotal);
    if (currEl) currEl.textContent = leasingFmtLKR(currDueTotal);
    if (commitEl) commitEl.textContent = leasingFmtLKR(monthlyCommitment);
    if (prevLbl) prevLbl.textContent = monthName(prevMonthKey);
    if (currLbl) currLbl.textContent = monthName(currMonthKey);

    // Highlight overdue state
    const prevCard = document.querySelector('.lss-card.lss-prev-due');
    if (prevCard) prevCard.classList.toggle('lss-overdue-alert', prevDueTotal > 0);
}

// ── Widget Strip ──────────────────────────────────────────────
function renderLeasingWidgets(entries, paidMap) {
    const strip = document.getElementById('leasingWidgetStrip');
    if (!strip) return;
    strip.innerHTML = '';

    if (!entries || entries.length === 0) {
        strip.innerHTML = '<div class="leasing-empty-state">No entries yet. Add a lease or loan to get started.</div>';
        return;
    }

    entries.forEach(v => {
        const isWeeklyOrFortnightly = v.payment_freq === 'weekly' || v.payment_freq === 'fortnightly';
        const todayKey = leasingTodayKey(isWeeklyOrFortnightly);
        const keys = leasingBuildPaymentKeys(v);
        const paid = paidMap[v.id] || new Set();
        const postponed = new Set(v.postponed_dates || []);
        
        const activeKeys = keys.filter(k => !postponed.has(k));
        const paidCount = activeKeys.filter(k => paid.has(k)).length;
        const total = activeKeys.length;
        const remaining = total - paidCount;
        const pct = total > 0 ? Math.round((paidCount / total) * 100) : 0;
        const amtPaid = paidCount * v.installment_amount;
        const amtRemaining = remaining * v.installment_amount;
        const overdueCount = v.settled ? 0 : activeKeys.filter(k => k < todayKey && !paid.has(k)).length;
        const isLoan = v.entry_type === 'loan';

        const r = 36, circ = 2 * Math.PI * r;
        const dash = (pct / 100) * circ;
        const ringColor = v.settled ? '#00B37E' : pct === 100 ? '#00B37E' : overdueCount > 0 ? '#E53E3E' : '#0072CE';

        let freqBadge = '';
        if (isLoan) {
            const freqLabel = v.payment_freq === 'weekly' ? '📆 Weekly' :
                             v.payment_freq === 'fortnightly' ? '🔁 Every 2 Weeks' : '📅 Monthly';
            const freqClass = v.payment_freq === 'weekly' ? 'badge-weekly' :
                             v.payment_freq === 'fortnightly' ? 'badge-fortnightly' : 'badge-monthly';
            freqBadge = `<span class="lease-freq-badge ${freqClass}">${freqLabel}</span>`;
        }

        const card = document.createElement('div');
        card.className = 'leasing-widget-card' + (v.settled ? ' lease-widget-settled' : '');
        card.innerHTML = `
            <div class="leasing-widget-top">
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;">
                    <div class="leasing-widget-vehicle" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${leasingEntryLabel(v)}</div>
                    <div style="display:flex;gap:5px;flex-wrap:wrap;">
                        <span class="lease-type-badge ${isLoan ? 'badge-loan' : 'badge-lease'}">${isLoan ? '💰 Loan' : '🚗 Lease'}</span>
                        ${freqBadge}
                        ${v.settled ? '<span class="lease-settled-badge">🏁 Settled</span>' : ''}
                    </div>
                </div>
                ${overdueCount > 0 ? `<span class="lease-overdue-badge">${overdueCount} Overdue</span>` : ''}
            </div>
            <div class="leasing-widget-body">
                <div class="leasing-progress-ring-wrap">
                    <svg viewBox="0 0 90 90" width="90" height="90">
                        <circle cx="45" cy="45" r="${r}" fill="none" stroke="var(--surface-border)" stroke-width="8"/>
                        <circle cx="45" cy="45" r="${r}" fill="none" stroke="${ringColor}" stroke-width="8"
                            stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}"
                            stroke-linecap="round" transform="rotate(-90 45 45)"
                            style="transition:stroke-dasharray 0.6s ease;"/>
                        <text x="45" y="49" text-anchor="middle" font-size="14" font-weight="700" fill="${ringColor}">${pct}%</text>
                    </svg>
                </div>
                <div class="leasing-widget-stats">
                    <div class="lw-stat"><span class="lw-label">Paid</span><span class="lw-value lw-paid">${paidCount} / ${total}</span></div>
                    <div class="lw-stat"><span class="lw-label">Remaining</span><span class="lw-value lw-rem">${remaining}</span></div>
                    <div class="lw-stat"><span class="lw-label">Amt Paid</span><span class="lw-value lw-paid-amt">${leasingFmtLKR(amtPaid)}</span></div>
                    <div class="lw-stat"><span class="lw-label">Amt Due</span><span class="lw-value lw-due-amt">${leasingFmtLKR(amtRemaining)}</span></div>
                    <div class="lw-stat"><span class="lw-label">Per ${v.payment_freq === 'weekly' ? 'Week' : v.payment_freq === 'fortnightly' ? '2 Weeks' : 'Month'}</span><span class="lw-value">${leasingFmtLKR(v.installment_amount)}</span></div>
                </div>
            </div>
        `;
        card.style.cursor = 'pointer';
        card.title = 'Click to view payment calendar';
        card.addEventListener('click', () => openLeasingCalendar(v, paidMap));
        strip.appendChild(card);
    });
}

// ── List Rows ─────────────────────────────────────────────────
function renderLeasingVehicleRows(entries, paidMap) {
    const listEl = document.getElementById('leasingVehiclesList');
    if (!listEl) return;

    if (!entries || entries.length === 0) {
        const tab = _currentLeasingTab === 'loan' ? 'loan' : 'lease';
        listEl.innerHTML = `<div class="leasing-empty-state">No ${tab}s found. Click <strong>+ Add Entry</strong> to add one.</div>`;
        return;
    }

    // Split into active and settled
    const activeEntries = entries.filter(v => !v.settled);
    const settledEntries = entries.filter(v => v.settled);

    listEl.innerHTML = '';

    // Render active entries first
    const renderRow = (v) => {
        const isWeeklyOrFortnightly = v.payment_freq === 'weekly' || v.payment_freq === 'fortnightly';
        const isLoan = v.entry_type === 'loan';
        const todayKey = leasingTodayKey(isWeeklyOrFortnightly);
        const keys = leasingBuildPaymentKeys(v);
        const paid = paidMap[v.id] || new Set();
        const postponed = new Set(v.postponed_dates || []);
        
        const activeKeys = keys.filter(k => !postponed.has(k));
        const paidCount = activeKeys.filter(k => paid.has(k)).length;
        const total = activeKeys.length;
        const overdueCount = v.settled ? 0 : activeKeys.filter(k => k < todayKey && !paid.has(k)).length;
        const pct = total > 0 ? Math.round((paidCount / total) * 100) : 0;

        // Meta info string
        let meta = '';
        if (isLoan) {
            if (v.payment_freq === 'weekly') {
                meta = `Weekly · ${leasingFmtLKR(v.installment_amount)}/wk · ${total} weeks`;
            } else if (v.payment_freq === 'fortnightly') {
                meta = `Fortnightly · ${leasingFmtLKR(v.installment_amount)}/2wks · ${total} fortnights`;
            } else {
                meta = `Day ${v.installment_day || 1} monthly · ${leasingFmtLKR(v.installment_amount)}/mo · ${total} months`;
            }
        } else {
            meta = `Day ${v.installment_day || 1} monthly · ${leasingFmtLKR(v.installment_amount)}/mo · ${total} months · Starts ${leasingMonthLabel(`${v.start_year}-${String(v.start_month || 1).padStart(2,'0')}`)}`;
        }
        if (v.settled) meta += ' · <span style="color:var(--green);font-weight:700;">🏁 Settled</span>';
        if (v.settled_notes) meta += ` · ${v.settled_notes}`;

        const row = document.createElement('div');
        row.className = 'leasing-vehicle-row' + (v.settled ? ' lvr-settled' : '');
        row.innerHTML = `
            <div class="lvr-info">
                <div class="lvr-vehicle">${leasingEntryLabel(v)}</div>
                <div class="lvr-meta">${meta}</div>
            </div>
            <div class="lvr-status">
                <div class="lvr-progress-bar">
                    <div class="lvr-progress-fill ${overdueCount > 0 ? 'lvr-overdue' : ''} ${v.settled ? 'lvr-settled-fill' : ''}" style="width:${pct}%"></div>
                </div>
                <div class="lvr-pct">${pct}% paid &nbsp;(${paidCount}/${total})</div>
                ${overdueCount > 0 ? `<div class="lvr-overdue-text">${overdueCount} overdue</div>` : ''}
            </div>
            <div class="lvr-actions">
                <button class="btn btn-primary btn-sm" onclick="window.openLeasingCalendarById('${v.id}')">📅 Calendar</button>
                <button class="btn btn-sm" style="background:var(--amber-bg);color:var(--amber);" onclick="window.editLeaseVehicle('${v.id}')">✏️ Edit</button>
                ${!v.settled && userRole !== 'viewer' ? `<button class="btn btn-sm" style="background:var(--green-bg);color:var(--green-dark);" onclick="window.settleLeaseEntry('${v.id}')">🏁 Settle</button>` : ''}
                <button class="btn btn-sm" style="background:rgba(209,0,31,0.10);color:var(--brand-red);" onclick="window.deleteLeaseVehicle('${v.id}')">🗑️</button>
            </div>
        `;
        listEl.appendChild(row);
    };

    // Render active entries
    activeEntries.forEach(renderRow);

    // Render settled section if there are any settled entries
    if (settledEntries.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'leasing-settled-section-header';
        divider.innerHTML = `
            <div class="leasing-settled-section-line"></div>
            <span class="leasing-settled-section-label">🏁 Settled (${settledEntries.length})</span>
            <div class="leasing-settled-section-line"></div>
        `;
        listEl.appendChild(divider);
        settledEntries.forEach(renderRow);
    }
}

// ── Open Calendar ─────────────────────────────────────────────
function openLeasingCalendar(vehicle, paidMap) {
    _currentLeasingVehicle = vehicle;
    const panel = document.getElementById('leasingCalendarPanel');
    const nameEl = document.getElementById('leasingCalendarVehicleName');
    const settledBadge = document.getElementById('leasingCalendarSettledBadge');
    const settledBanner = document.getElementById('leasingSettledBanner');

    if (panel) panel.style.display = 'block';
    if (nameEl) nameEl.textContent = leasingEntryLabel(vehicle);
    if (settledBadge) settledBadge.style.display = vehicle.settled ? '' : 'none';
    if (settledBanner) settledBanner.style.display = vehicle.settled ? 'flex' : 'none';

    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const paid = paidMap[vehicle.id] || new Set();
    renderLeasingMonthGrid(vehicle, paid);
}

window.openLeasingCalendarById = async function (vehicleId) {
    const uid = getQueryUserId();
    const { data: vehicles } = await supabaseClient.from('leasing_vehicles').select('*').eq('user_id', uid);
    const { data: payments } = await supabaseClient.from('leasing_payments').select('*').in('vehicle_id', [vehicleId]);
    if (!vehicles) return;
    const v = vehicles.find(x => x.id === vehicleId);
    if (!v) return;
    const paid = new Set((payments || []).map(p => p.month_key));
    openLeasingCalendar(v, { [vehicleId]: paid });
};

// ── Payment Grid ──────────────────────────────────────────────
function renderLeasingMonthGrid(vehicle, paid) {
    const grid = document.getElementById('leasingMonthGrid');
    if (!grid) return;

    const isWeeklyOrFortnightly = vehicle.payment_freq === 'weekly' || vehicle.payment_freq === 'fortnightly';
    const todayKey = leasingTodayKey(isWeeklyOrFortnightly);
    const keys = leasingBuildPaymentKeys(vehicle);
    const postponed = new Set(vehicle.postponed_dates || []);

    const activeKeys = keys.filter(k => !postponed.has(k));
    let paidCount = 0, overdueCount = 0, upcomingCount = 0;
    activeKeys.forEach(k => {
        if (paid.has(k)) paidCount++;
        else if (k < todayKey) overdueCount++;
        else upcomingCount++;
    });

    const amt = vehicle.installment_amount;
    document.getElementById('lcsStatPaid').textContent = paidCount;
    document.getElementById('lcsStatRemaining').textContent = upcomingCount;
    document.getElementById('lcsStatOverdue').textContent = overdueCount;
    document.getElementById('lcsStatAmountPaid').textContent = leasingFmtLKR(paidCount * amt);
    document.getElementById('lcsStatAmountDue').textContent = leasingFmtLKR((overdueCount + upcomingCount) * amt);

    grid.innerHTML = '';
    keys.forEach((key, idx) => {
        const isPostponed = postponed.has(key);
        const isPaid = paid.has(key);
        const isOverdue = !isPaid && !isPostponed && key < todayKey;
        const isCurrent = !isWeeklyOrFortnightly ? key === todayKey : (key <= todayKey && (idx === keys.length - 1 || keys[idx + 1] > todayKey));
        const isSettled = !!vehicle.settled;

        let statusClass = 'lease-tile-upcoming';
        let statusLabel = '⏳ Upcoming';
        if (isPostponed) {
            statusClass = 'lease-tile-postponed';
            statusLabel = '🔄 Postponed';
        } else if (isPaid) {
            statusClass = 'lease-tile-paid';
            statusLabel = '✅ Paid';
        } else if (isCurrent) {
            statusClass = 'lease-tile-current';
            statusLabel = vehicle.payment_freq === 'weekly' ? '📌 This Week' : 
                          vehicle.payment_freq === 'fortnightly' ? '📌 This Fortnight' : '📌 This Month';
        } else if (isOverdue) {
            statusClass = 'lease-tile-overdue';
            statusLabel = '🔴 Overdue';
        }
        if (isSettled && !isPaid && !isPostponed) {
            statusClass = 'lease-tile-settled-tile';
        }

        let dayInfo = '';
        if (!isWeeklyOrFortnightly && vehicle.installment_day) {
            dayInfo = `<div class="lmt-day">Day ${vehicle.installment_day}</div>`;
        }

        let actionBtn = '';
        if (!isSettled && userRole !== 'viewer') {
            if (isPostponed) {
                actionBtn = `<button class="lmt-btn" style="background:var(--surface-border);color:var(--text);margin-top:8px;" onclick="window.toggleLeaseMonthPostponed('${vehicle.id}','${key}',true)">
                    ↩️ Un-postpone
                </button>`;
            } else {
                actionBtn = `
                    <div style="display:flex;gap:4px;width:100%;margin-top:8px;">
                        <button class="lmt-btn" style="flex:2;" onclick="window.toggleLeaseMonthPaid('${vehicle.id}','${key}',${isPaid})">
                            ${isPaid ? '↩️ Unmark' : '✅ Mark Paid'}
                        </button>
                        ${!isPaid && isWeeklyOrFortnightly ? `
                            <button class="lmt-btn" style="flex:1.2;background:var(--amber-bg);color:var(--amber);" onclick="window.toggleLeaseMonthPostponed('${vehicle.id}','${key}',false)" title="Postpone payment date by 1 week/period">
                                🔄 Postpone
                            </button>
                        ` : ''}
                    </div>
                `;
            }
        }

        const tile = document.createElement('div');
        tile.className = `lease-month-tile ${statusClass}`;
        tile.innerHTML = `
            <div class="lmt-number">#${idx + 1}</div>
            <div class="lmt-month">${leasingPaymentLabel(key, vehicle, idx)}</div>
            <div class="lmt-amount">${leasingFmtLKR(amt)}</div>
            ${dayInfo}
            <div class="lmt-status">${statusLabel}</div>
            ${actionBtn}
        `;
        grid.appendChild(tile);
    });
}

// ── Toggle paid ───────────────────────────────────────────────
window.toggleLeaseMonthPaid = async function (vehicleId, monthKey, isPaid) {
    if (!checkAdminAccess('update')) return;
    const uid = getQueryUserId();
    try {
        if (isPaid) {
            const { error } = await supabaseClient.from('leasing_payments')
                .delete().eq('vehicle_id', vehicleId).eq('month_key', monthKey);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('leasing_payments')
                .insert([{ user_id: uid, vehicle_id: vehicleId, month_key: monthKey }]);
            if (error) throw error;
        }
        await refreshLeasingData();
    } catch (err) {
        console.error('Error toggling payment:', err);
        showToast('Failed to update: ' + (err.message || 'Please try again.'), 'error');
    }
};

window.toggleLeaseMonthPostponed = async function (vehicleId, dateStr, isCurrentlyPostponed) {
    if (!checkAdminAccess('update')) return;
    try {
        const { data: entry, error: fErr } = await supabaseClient.from('leasing_vehicles')
            .select('postponed_dates').eq('id', vehicleId).single();
        if (fErr) throw fErr;

        let dates = entry.postponed_dates || [];
        if (isCurrentlyPostponed) {
            dates = dates.filter(d => d !== dateStr);
        } else {
            if (!dates.includes(dateStr)) {
                dates.push(dateStr);
            }
        }

        const { error: uErr } = await supabaseClient.from('leasing_vehicles')
            .update({ postponed_dates: dates })
            .eq('id', vehicleId);
        if (uErr) throw uErr;

        await refreshLeasingData();
    } catch (err) {
        console.error('Error toggling postponement:', err);
        showToast('Failed to update postponement: ' + (err.message || 'Please try again.'), 'error');
    }
};

// ── Settle Entry ──────────────────────────────────────────────
window.settleLeaseEntry = async function (vehicleId) {
    if (!checkAdminAccess('settle')) return;
    const notes = prompt('Settlement notes (optional):', 'Fully settled');
    if (notes === null) return; // cancelled
    try {
        const { error } = await supabaseClient.from('leasing_vehicles')
            .update({ settled: true, settled_at: new Date().toISOString(), settled_notes: notes })
            .eq('id', vehicleId);
        if (error) throw error;
        await refreshLeasingData();
    } catch (err) {
        console.error('Error settling entry:', err);
        showToast('Failed to settle: ' + (err.message || 'Please try again.'), 'error');
    }
};

// ── Edit ──────────────────────────────────────────────────────
window.editLeaseVehicle = async function (vehicleId) {
    if (!checkAdminAccess('edit')) return;
    const { data, error } = await supabaseClient.from('leasing_vehicles').select('*').eq('id', vehicleId).single();
    if (error || !data) { showToast('Could not load data.', 'error'); return; }

    resetLeaseForm();
    document.getElementById('leaseVehicleId').value = data.id;

    // Switch to correct tab
    _currentLeasingTab = data.entry_type || 'leasing';
    document.querySelectorAll('.leasing-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _currentLeasingTab));

    setLeaseFormType(data.entry_type || 'leasing');
    setLeaseFormFreq(data.payment_freq || 'monthly');

    document.getElementById('leaseInstallmentAmount').value = data.installment_amount;
    document.getElementById('leaseTotalInstallments').value = data.total_installments || data.total_months;

    if (data.entry_type === 'loan') {
        document.getElementById('loanLenderName').value = data.lender_name || '';
        if (data.payment_freq === 'weekly') {
            document.getElementById('leaseStartDate').value = data.start_date || '';
        } else {
            document.getElementById('leaseStartMonth').value = data.start_year && data.start_month
                ? `${data.start_year}-${String(data.start_month).padStart(2,'0')}` : '';
            document.getElementById('loanInstallmentDay').value = data.installment_day || '';
        }
    } else {
        document.getElementById('leaseVehicleNumber').value = data.vehicle_number || '';
        document.getElementById('leaseInstallmentDay').value = data.installment_day || '';
        document.getElementById('leaseStartMonth').value = data.start_year && data.start_month
            ? `${data.start_year}-${String(data.start_month).padStart(2,'0')}` : '';
    }

    if (data.settled) {
        document.getElementById('leaseSettledCheck').checked = true;
        document.getElementById('leaseSettledNotesWrap').style.display = 'block';
        document.getElementById('leaseSettledNotes').value = data.settled_notes || '';
    }

    // Hide type toggle row when editing (type is fixed)
    document.getElementById('leaseTypeToggleRow').style.display = 'none';

    document.getElementById('addLeaseFormContainer').style.display = 'block';
    document.getElementById('addLeaseFormContainer').scrollIntoView({ behavior: 'smooth' });
};

// ── Delete ─────────────────────────────────────────────────────
window.deleteLeaseVehicle = async function (vehicleId) {
    if (!checkAdminAccess('delete')) return;
    if (!await showConfirmAsync('Delete this entry and all its payment records?')) return;
    try {
        const { error } = await supabaseClient.from('leasing_vehicles').delete().eq('id', vehicleId);
        if (error) throw error;
        if (_currentLeasingVehicle?.id === vehicleId) {
            _currentLeasingVehicle = null;
            document.getElementById('leasingCalendarPanel').style.display = 'none';
        }
        await refreshLeasingData();
    } catch (err) {
        console.error('Error deleting:', err);
        showToast('Failed to delete: ' + (err.message || 'Please try again.'), 'error');
    }
};


// ============================================================
// EXCESSING LITRES MODULE
// Supabase table: excessing_litres
// Columns: id, user_id, date, fuel_price_per_l, fuel_amount_l,
//          cost, actual_cost, created_at
//   cost        = fuel_price_per_l × fuel_amount_l
//   actual_cost = fuel_price_per_l × fuel_amount_l ÷ 100 × 82
// ============================================================

function elCalcCost(price, amount) {
    return price * amount;
}

function elCalcActualCost(price, amount) {
    return (price * amount / 100) * 82;
}

/** Async — returns the total Actual Cost for a YYYY-MM month.
 *  Called (with await) by loadDashboardData to deduct from net profit. */
async function getExcessingLitresActualCostForMonth(monthValue) {
    if (!monthValue) return 0;
    try {
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabaseClient
            .from('excessing_litres')
            .select('actual_cost')
            .eq('user_id', getQueryUserId())
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) return 0;
        return data?.reduce((sum, r) => sum + (r.actual_cost || 0), 0) || 0;
    } catch (e) {
        return 0;
    }
}

async function loadExcessingLitres() {
    const tbody = document.getElementById('elTableBody');
    const tfoot = document.getElementById('elTableFoot');
    if (!tbody || !tfoot) return;

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    try {
        const monthFilter = document.getElementById('elMonthFilter')?.value || '';

        let query = supabaseClient
            .from('excessing_litres')
            .select('*')
            .eq('user_id', getQueryUserId())
            .order('date', { ascending: false });

        if (monthFilter) {
            const [year, month] = monthFilter.split('-');
            const monthPadded = String(month).padStart(2, '0');
            const startDate = `${year}-${monthPadded}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
            query = query.gte('date', startDate).lte('date', endDate);
        }

        const { data: records, error } = await query;
        if (error) throw error;

        tbody.innerHTML = '';
        let totalLitres = 0, totalCost = 0, totalActualCost = 0;

        if (!records || records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">No records found. Click "+ Add Record" to get started.</td></tr>`;
        } else {
            records.forEach(r => {
                totalLitres    += r.fuel_amount_l  || 0;
                totalCost      += r.cost           || 0;
                totalActualCost += r.actual_cost   || 0;

                const tr = document.createElement('tr');
                const actionBtns = userRole === 'viewer' ? '' : `
                    <button class="btn btn-edit" onclick="elEdit(${r.id})">Edit</button>
                    <button class="btn btn-danger" onclick="elDelete(${r.id})">Delete</button>
                `;
                tr.innerHTML = `
                    <td>${r.date}</td>
                    <td style="text-align:right;">LKR ${parseFloat(r.fuel_price_per_l).toFixed(2)}</td>
                    <td style="text-align:right;">${parseFloat(r.fuel_amount_l).toFixed(2)} L</td>
                    <td style="text-align:right;">LKR ${parseFloat(r.cost).toFixed(2)}</td>
                    <td style="text-align:right;color:var(--brand-red);font-weight:600;">LKR ${parseFloat(r.actual_cost).toFixed(2)}</td>
                    <td class="action-buttons">${actionBtns}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Footer totals row
        tfoot.innerHTML = records && records.length > 0 ? `
            <tr style="font-weight:700;">
                <td colspan="2">Totals</td>
                <td style="text-align:right;">${totalLitres.toFixed(2)} L</td>
                <td style="text-align:right;">LKR ${totalCost.toFixed(2)}</td>
                <td style="text-align:right;color:var(--brand-red);">LKR ${totalActualCost.toFixed(2)}</td>
                <td></td>
            </tr>
        ` : '';

        // Summary strip
        setText('elTotalRecords',    records?.length || 0);
        setText('elTotalLitres',     `${totalLitres.toFixed(2)} L`);
        setText('elTotalCost',       `LKR ${totalCost.toFixed(2)}`);
        setText('elTotalActualCost', `LKR ${totalActualCost.toFixed(2)}`);

    } catch (err) {
        console.error('Error loading excessing litres:', err.message);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--brand-red);padding:20px;">Error loading data: ${err.message}</td></tr>`;
    }
}

// ── Add Record button ──────────────────────────────────────
document.getElementById('addElBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('elForm').reset();
    document.getElementById('elRecordId').value = '';
    document.getElementById('elCostPreview').style.display = 'none';
    document.getElementById('elFormContainer').style.display = 'block';
    document.getElementById('elFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('cancelElBtn')?.addEventListener('click', () => {
    document.getElementById('elFormContainer').style.display = 'none';
});

// ── Live preview ───────────────────────────────────────────
function elUpdatePreview() {
    const price  = parseFloat(document.getElementById('elFuelPrice')?.value) || 0;
    const amount = parseFloat(document.getElementById('elFuelAmount')?.value) || 0;
    const preview = document.getElementById('elCostPreview');
    if (!preview) return;
    if (price > 0 && amount > 0) {
        preview.style.display = 'flex';
        const costEl = document.getElementById('elPreviewCost');
        const actualEl = document.getElementById('elPreviewActualCost');
        if (costEl)   costEl.textContent   = `LKR ${elCalcCost(price, amount).toFixed(2)}`;
        if (actualEl) actualEl.textContent = `LKR ${elCalcActualCost(price, amount).toFixed(2)}`;
    } else {
        preview.style.display = 'none';
    }
}

document.getElementById('elFuelPrice')?.addEventListener('input', elUpdatePreview);
document.getElementById('elFuelAmount')?.addEventListener('input', elUpdatePreview);

// ── Form submit (add / edit) ───────────────────────────────
document.getElementById('elForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { showToast('Session not ready. Please wait a moment and try again.', 'warning'); return; }

    const id         = document.getElementById('elRecordId').value;
    const date       = document.getElementById('elDate').value;
    const fuelPrice  = parseFloat(document.getElementById('elFuelPrice').value);
    const fuelAmount = parseFloat(document.getElementById('elFuelAmount').value);
    const cost       = elCalcCost(fuelPrice, fuelAmount);
    const actualCost = elCalcActualCost(fuelPrice, fuelAmount);

    const payload = {
        date,
        fuel_price_per_l: fuelPrice,
        fuel_amount_l:    fuelAmount,
        cost,
        actual_cost: actualCost,
        user_id: adminUserId
    };

    try {
        if (id) {
            const { error } = await supabaseClient
                .from('excessing_litres')
                .update(payload)
                .eq('id', parseInt(id));
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('excessing_litres')
                .insert([payload]);
            if (error) throw error;
        }
        document.getElementById('elFormContainer').style.display = 'none';
        loadExcessingLitres();
    } catch (err) {
        showToast('Error saving record: ' + err.message, 'error');
    }
});

// ── Month filter ───────────────────────────────────────────
document.getElementById('elMonthFilter')?.addEventListener('change', loadExcessingLitres);

// ── Edit ───────────────────────────────────────────────────
async function elEdit(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient
            .from('excessing_litres')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;

        document.getElementById('elRecordId').value    = data.id;
        document.getElementById('elDate').value        = data.date;
        document.getElementById('elFuelPrice').value   = data.fuel_price_per_l;
        document.getElementById('elFuelAmount').value  = data.fuel_amount_l;
        elUpdatePreview();
        document.getElementById('elFormContainer').style.display = 'block';
        document.getElementById('elFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        showToast('Error loading record: ' + err.message, 'error');
    }
}

// ── Delete ─────────────────────────────────────────────────
async function elDelete(id) {
    if (!checkAdminAccess('delete')) return;
    if (!await showConfirmAsync('Are you sure you want to delete this record?')) return;
    try {
        const { error } = await supabaseClient
            .from('excessing_litres')
            .delete()
            .eq('id', id);
        if (error) throw error;
        loadExcessingLitres();
    } catch (err) {
        showToast('Error deleting record: ' + err.message, 'error');
    }
}



// ============================================================
// KEVILTON DISTRIBUTIONS MODULE
// Supabase table: kd_distributors
// Columns: id, user_id, distributor_name, town_name,
//          location_link, lat, lng, created_at
// ============================================================

let _kdMap = null;         // Leaflet map instance
let _kdMarkers = [];       // Array of L.marker instances
let _kdAllData = [];       // All loaded distributor records
let _kdMapInitialized = false;
let _kdRoutePolyline = null; // Active route polyline on the map

// ── John Keells Enderamulla — fixed starting point ─────────────
const KD_START_POINT = {
    name: 'John Keells Enderamulla',
    town: 'Enderamulla, Wattala',
    lat: 6.993777247636533,
    lng: 79.91975853540127,
    logoUrl: 'https://i.postimg.cc/QdvbXY1c/id-AYs-TFstv.png'
};

// ── Build a Google Maps link from lat/lng ─────────────────────
function kdBuildMapsLink(lat, lng) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Helper: get the maps link for a record (generated from lat/lng)
function kdGetMapsLink(r) {
    if (r.lat && r.lng) return kdBuildMapsLink(r.lat, r.lng);
    return '#';
}

// ── Custom Kevilton logo marker icon ─────────────────────────
function kdCreateMarkerIcon(isHighlighted = false) {
    const size = isHighlighted ? 46 : 38;
    const shadow = isHighlighted ? '0 4px 16px rgba(209,0,31,0.55)' : '0 3px 10px rgba(0,0,0,0.35)';
    const html = `
        <div style="
            width:${size}px; height:${size}px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:#fff;
            box-shadow:${shadow};
            border: 2.5px solid ${isHighlighted ? '#ff4757' : '#D1001F'};
            display:flex; align-items:center; justify-content:center;
            transition: all 0.2s;
        ">
            <img src="https://i.postimg.cc/pTbqBcdz/idm2DKn-i-I.png"
                 style="width:${size * 0.62}px; height:${size * 0.62}px;
                        transform:rotate(45deg); object-fit:contain;
                        border-radius:50%;" />
        </div>`;
    return L.divIcon({
        html,
        className: '',
        iconSize:   [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -(size + 4)],
    });
}

// ── John Keells / starting-point marker icon ─────────────────
function kdCreateStartMarkerIcon() {
    const size = 44;
    const html = `
        <div style="
            width:${size}px; height:${size}px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:#fff;
            box-shadow: 0 4px 14px rgba(0,72,180,0.45);
            border: 3px solid #0048B4;
            display:flex; align-items:center; justify-content:center;
        ">
            <img src="${KD_START_POINT.logoUrl}"
                 style="width:${size * 0.60}px; height:${size * 0.60}px;
                        transform:rotate(45deg); object-fit:contain;
                        border-radius:50%;" />
        </div>`;
    return L.divIcon({
        html,
        className: '',
        iconSize:   [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -(size + 4)],
    });
}

// ── Initialize or refresh the Leaflet map ────────────────────
function kdInitMap() {
    const el = document.getElementById('kdLeafletMap');
    if (!el) return;

    // Guard: Leaflet not loaded yet — retry after 200ms
    if (typeof L === 'undefined') {
        console.warn('Leaflet not loaded yet, retrying...');
        setTimeout(kdInitMap, 200);
        return;
    }

    if (!_kdMapInitialized) {
        // Destroy any leftover map on the container (safety)
        if (_kdMap) { _kdMap.remove(); _kdMap = null; }

        // Sri Lanka center
        _kdMap = L.map('kdLeafletMap', {
            center: [7.8731, 80.7718],
            zoom: 7,
            zoomControl: true,
            attributionControl: true,
        });

        // OpenStreetMap tiles (free, no API key)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18,
        }).addTo(_kdMap);

        _kdMapInitialized = true;

        // Force size recalculation after paint
        setTimeout(() => { if (_kdMap) _kdMap.invalidateSize(true); }, 100);
        setTimeout(() => { if (_kdMap) _kdMap.invalidateSize(true); }, 500);
    } else {
        // Already initialized — invalidate in case container was hidden
        setTimeout(() => { if (_kdMap) _kdMap.invalidateSize(true); }, 150);
    }
}

// ── Place markers on the map ──────────────────────────────────
function kdPlaceMarkers(records) {
    if (!_kdMap) return;

    // Clear existing distributor markers (keep start marker separate)
    _kdMarkers.forEach(m => m.remove());
    _kdMarkers = [];

    // Always add John Keells Enderamulla starting-point marker
    const startMapsLink = `https://maps.google.com/?q=${KD_START_POINT.lat},${KD_START_POINT.lng}`;
    const startPopupHtml = `
        <div class="kd-popup">
            <div class="kd-popup-name" style="color:#0048B4;">🏭 ${KD_START_POINT.name}</div>
            <div class="kd-popup-town">📍 ${KD_START_POINT.town}</div>
            <div class="kd-popup-town" style="color:#0048B4;font-weight:700;">🚦 Starting Point for all routes</div>
            <div class="kd-popup-actions" style="margin-top:10px;">
                <a class="kd-popup-open-btn" href="${startMapsLink}" target="_blank" rel="noopener">🗺️ Open in Maps</a>
            </div>
        </div>`;
    const startMarker = L.marker([KD_START_POINT.lat, KD_START_POINT.lng], {
        icon: kdCreateStartMarkerIcon(),
        zIndexOffset: 1000  // Always on top
    });
    startMarker.bindPopup(startPopupHtml, { maxWidth: 260, className: 'kd-leaflet-popup' });
    startMarker.addTo(_kdMap);
    _kdMarkers.push(startMarker);

    const placed = records.filter(r => r.lat && r.lng);

    placed.forEach(r => {
        const marker = L.marker([r.lat, r.lng], { icon: kdCreateMarkerIcon() });

        const mapsLink = kdGetMapsLink(r);
        const popupHtml = `
            <div class="kd-popup">
                <div class="kd-popup-name">${r.distributor_name}</div>
                <div class="kd-popup-town">📍 ${r.town_name}</div>
                <div class="kd-popup-coords">🌐 ${parseFloat(r.lat).toFixed(6)}, ${parseFloat(r.lng).toFixed(6)}</div>
                <div class="kd-popup-actions">
                    <button class="kd-popup-copy-btn" id="kdCopyBtn_${r.id}" onclick="kdCopyLink('${r.id}','${encodeURIComponent(mapsLink)}')">
                        📋 Copy Location Link
                    </button>
                    <a class="kd-popup-open-btn" href="${mapsLink}" target="_blank" rel="noopener">🗺️ Open Maps</a>
                </div>
            </div>`;

        marker.bindPopup(popupHtml, { maxWidth: 260, className: 'kd-leaflet-popup' });
        marker.on('mouseover', function () { this.setIcon(kdCreateMarkerIcon(true)); });
        marker.on('mouseout',  function () { this.setIcon(kdCreateMarkerIcon(false)); });
        marker.addTo(_kdMap);
        _kdMarkers.push(marker);
    });

    // Update count badge
    const countEl = document.getElementById('kdMapCount');
    if (countEl) countEl.textContent = `${placed.length} location${placed.length !== 1 ? 's' : ''}`;
}

// ── Copy link helper ──────────────────────────────────────────
window.kdCopyLink = function(recordId, encodedLink) {
    const link = decodeURIComponent(encodedLink);
    const btn = document.getElementById(`kdCopyBtn_${recordId}`);
    const doFeedback = () => {
        if (btn) {
            btn.textContent = '✅ Copied!';
            btn.style.background = '#00b37e';
            setTimeout(() => { btn.textContent = '📋 Copy Link'; btn.style.background = ''; }, 2000);
        }
    };
    navigator.clipboard.writeText(link).then(doFeedback).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = link; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        doFeedback();
    });
};

// ── Load / render distributor list ───────────────────────────
async function loadKeviltonDistributors() {
    const listBody = document.getElementById('kdListBody');
    if (listBody) listBody.innerHTML = '<div class="kd-loading">⏳ Loading...</div>';

    // Initialize map after a short delay so the page container is painted
    setTimeout(() => { kdInitMap(); }, 300);

    try {
        const uid = getQueryUserId();
        if (!uid) { renderKdList([]); return; }

        const { data, error } = await supabaseClient
            .from('kd_distributors')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });

        if (error) throw error;

        _kdAllData = data || [];
        renderKdList(_kdAllData);

        // Place markers after map is ready
        setTimeout(() => { kdPlaceMarkers(_kdAllData); }, 400);

        // Initialize Route Planner (or refresh its stop selector)
        setTimeout(() => { kdRoutePlannerInit(); }, 500);

    } catch (err) {
        console.error('KD load error:', err);
        if (listBody) listBody.innerHTML = `<div class="kd-empty-state"><div class="kd-empty-icon">⚠️</div><div class="kd-empty-text">Error loading data</div><div class="kd-empty-sub">${err.message || 'Check your connection'}</div></div>`;
    }
}

// ── Render distributor list ───────────────────────────────────
function renderKdList(records) {
    const listBody  = document.getElementById('kdListBody');
    const listCount = document.getElementById('kdListCount');
    if (!listBody) return;

    if (listCount) listCount.textContent = `${records.length} distributor${records.length !== 1 ? 's' : ''}`;

    if (!records || records.length === 0) {
        listBody.innerHTML = `
            <div class="kd-empty-state">
                <div class="kd-empty-icon">🗺️</div>
                <div class="kd-empty-text">No distributors found</div>
                <div class="kd-empty-sub">Click "Add Distributor" to get started</div>
            </div>`;
        return;
    }

    listBody.innerHTML = '';
    records.forEach((r, idx) => {
        const mapsLink = kdGetMapsLink(r);
        const card = document.createElement('div');
        card.className = 'kd-dist-card';
        card.style.animationDelay = `${idx * 0.05}s`;
        card.innerHTML = `
            <div class="kd-dist-card-top">
                <div class="kd-dist-icon">🏢</div>
                <div class="kd-dist-info">
                    <div class="kd-dist-name">${r.distributor_name}</div>
                    <div class="kd-dist-town">📍 ${r.town_name}</div>
                    <div class="kd-dist-coords">🌐 ${parseFloat(r.lat).toFixed(5)}, ${parseFloat(r.lng).toFixed(5)}</div>
                </div>
                <span class="kd-dist-badge kd-badge-mapped">📌 On Map</span>
            </div>
            <div class="kd-dist-actions">
                <button class="kd-dist-btn kd-btn-copy" id="kdCopyBtn_${r.id}" onclick="kdCopyLink('${r.id}','${encodeURIComponent(mapsLink)}')">📋 Copy Link</button>
                <a class="kd-dist-btn kd-btn-open" href="${mapsLink}" target="_blank" rel="noopener">🗺️ Maps</a>
                <button class="kd-dist-btn kd-btn-locate" onclick="kdFlyToMarker(${r.lat},${r.lng})">🎯 Locate</button>
                ${userRole !== 'viewer' ? `<button class="kd-dist-btn kd-btn-edit" onclick="kdEditRecord('${r.id}')">✏️</button>` : ''}
                ${userRole !== 'viewer' ? `<button class="kd-dist-btn kd-btn-del" onclick="kdDeleteRecord('${r.id}')">🗑️</button>` : ''}
            </div>`;
        listBody.appendChild(card);
    });
}

// ── Fly to marker on map ──────────────────────────────────────
window.kdFlyToMarker = function(lat, lng) {
    if (!_kdMap) return;
    _kdMap.flyTo([lat, lng], 13, { duration: 1.2 });
    // Open the marker popup
    _kdMarkers.forEach(m => {
        const pos = m.getLatLng();
        if (Math.abs(pos.lat - lat) < 0.001 && Math.abs(pos.lng - lng) < 0.001) {
            m.openPopup();
        }
    });
};

// ── Search filter ─────────────────────────────────────────────
document.getElementById('kdSearchInput')?.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    const clearBtn = document.getElementById('kdSearchClear');
    if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';

    const filtered = q
        ? _kdAllData.filter(r =>
            r.distributor_name.toLowerCase().includes(q) ||
            r.town_name.toLowerCase().includes(q))
        : _kdAllData;

    renderKdList(filtered);
    kdPlaceMarkers(filtered);
});

document.getElementById('kdSearchClear')?.addEventListener('click', function() {
    const input = document.getElementById('kdSearchInput');
    if (input) input.value = '';
    this.style.display = 'none';
    renderKdList(_kdAllData);
    kdPlaceMarkers(_kdAllData);
});

// ── Show / hide form ──────────────────────────────────────────
document.getElementById('kdAddBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    kdResetForm();
    document.getElementById('kdFormTitle').textContent = '➕ Add New Distributor';
    document.getElementById('kdFormContainer').style.display = 'block';
    document.getElementById('kdFormContainer').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('kdCancelBtn')?.addEventListener('click', kdHideForm);
document.getElementById('kdFormClose')?.addEventListener('click', kdHideForm);

function kdHideForm() {
    document.getElementById('kdFormContainer').style.display = 'none';
}

function kdResetForm() {
    const form = document.getElementById('kdForm');
    if (form) form.reset();
    const idField = document.getElementById('kdRecordId');
    if (idField) idField.value = '';
}


// ── Form submit ───────────────────────────────────────────────
document.getElementById('kdForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    if (!adminUserId) { showToast('Session not ready. Please wait a moment.', 'warning'); return; }

    const saveBtn = document.getElementById('kdSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving...'; }

    const recordId        = document.getElementById('kdRecordId').value;
    const distributorName = document.getElementById('kdDistributorName').value.trim();
    const townName        = document.getElementById('kdTownName').value.trim();
    const latVal          = parseFloat(document.getElementById('kdLat').value);
    const lngVal          = parseFloat(document.getElementById('kdLng').value);

    const payload = {
        user_id: adminUserId,
        distributor_name: distributorName,
        town_name: townName,
        location_link: kdBuildMapsLink(latVal, lngVal),
        lat: latVal,
        lng: lngVal,
    };

    try {
        if (recordId) {
            const { error } = await supabaseClient
                .from('kd_distributors')
                .update(payload)
                .eq('id', recordId);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('kd_distributors')
                .insert([payload]);
            if (error) throw error;
        }

        kdHideForm();
        // Refresh list and map separately — errors here won't show 'Failed to save'
        loadKeviltonDistributors().catch(e2 => console.warn('KD refresh:', e2));
    } catch (err) {
        console.error('KD save error:', err);
        showToast('Failed to save: ' + (err.message || 'Please try again.'), 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Distributor'; }
    }
});

// ── Edit ──────────────────────────────────────────────────────
window.kdEditRecord = async function(recordId) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient
            .from('kd_distributors').select('*').eq('id', recordId).single();
        if (error) throw error;

        kdResetForm();
        document.getElementById('kdRecordId').value       = data.id;
        document.getElementById('kdDistributorName').value = data.distributor_name;
        document.getElementById('kdTownName').value        = data.town_name;
        document.getElementById('kdLat').value             = data.lat;
        document.getElementById('kdLng').value             = data.lng;
        document.getElementById('kdFormTitle').textContent = '✏️ Edit Distributor';
        document.getElementById('kdFormContainer').style.display = 'block';
        document.getElementById('kdFormContainer').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        showToast('Could not load record: ' + err.message, 'error');
    }
};

// ── Delete ────────────────────────────────────────────────────
window.kdDeleteRecord = async function(recordId) {
    if (!checkAdminAccess('delete')) return;
    if (!await showConfirmAsync('Delete this distributor location?')) return;
    try {
        const { error } = await supabaseClient
            .from('kd_distributors').delete().eq('id', recordId);
        if (error) throw error;
        await loadKeviltonDistributors();
    } catch (err) {
        showToast('Failed to delete: ' + err.message, 'error');
    }
};



// ============================================================
// KD ROUTE PLANNER MODULE
// Builds a no-highway route from Enderamulla through selected
// distributor stops, draws it on the Leaflet map, and
// generates a WhatsApp/SMS message for drivers.
// ============================================================

let _kdRouteStops = [];          // Array of stop records (distributor objects)
let _kdRoutePlannerInit = false; // Guard: set up listeners once
let _kdRouteSearchHighlightIdx = -1;
let _kdRouteSearchResultsList = [];

// ── Initialize Route Planner UI ───────────────────────────────
function kdRoutePlannerInit() {
    if (_kdRoutePlannerInit) {
        kdRouteRefreshSelector();
        return;
    }
    _kdRoutePlannerInit = true;

    // ─── Populate/Reset stop selector ────────────────────────
    kdRouteRefreshSelector();

    // ─── Search input event listeners ────────────────────────
    const searchInput = document.getElementById('kdRouteStopSearchInput');
    const searchResults = document.getElementById('kdRouteStopSearchResults');
    const hiddenInput = document.getElementById('kdRouteStopSelector');

    if (searchInput && searchResults && hiddenInput) {
        searchInput.addEventListener('focus', () => {
            kdRouteRenderSearchResults(searchInput.value);
        });

        searchInput.addEventListener('input', () => {
            hiddenInput.value = '';
            kdRouteRenderSearchResults(searchInput.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (searchResults.style.display === 'none') {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    kdRouteRenderSearchResults(searchInput.value);
                    e.preventDefault();
                }
                return;
            }

            const items = searchResults.querySelectorAll('.kd-route-search-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                _kdRouteSearchHighlightIdx++;
                if (_kdRouteSearchHighlightIdx >= items.length) {
                    _kdRouteSearchHighlightIdx = 0;
                }
                kdRouteHighlightItem(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                _kdRouteSearchHighlightIdx--;
                if (_kdRouteSearchHighlightIdx < 0) {
                    _kdRouteSearchHighlightIdx = items.length - 1;
                }
                kdRouteHighlightItem(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (_kdRouteSearchHighlightIdx >= 0 && _kdRouteSearchHighlightIdx < _kdRouteSearchResultsList.length) {
                    kdRouteSelectSearchItem(_kdRouteSearchResultsList[_kdRouteSearchHighlightIdx]);
                } else if (_kdRouteSearchResultsList.length > 0) {
                    kdRouteSelectSearchItem(_kdRouteSearchResultsList[0]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                searchResults.style.display = 'none';
                _kdRouteSearchHighlightIdx = -1;
                searchInput.blur();
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.kd-route-search-wrap')) {
                searchResults.style.display = 'none';
                _kdRouteSearchHighlightIdx = -1;
            }
        });
    }

    // ─── Add Stop button ──────────────────────────────────────
    document.getElementById('kdRouteAddStopBtn')?.addEventListener('click', () => {
        const sel = document.getElementById('kdRouteStopSelector');
        if (!sel || !sel.value) { showToast('Please select a distributor to add.', 'warning'); return; }
        const record = _kdAllData.find(r => String(r.id) === String(sel.value));
        if (!record) return;

        // Prevent duplicates
        if (_kdRouteStops.some(s => s.id === record.id)) {
            showToast(`"${record.distributor_name}" is already in the route.`, 'warning');
            return;
        }

        _kdRouteStops.push(record);
        
        // Clear search inputs
        const input = document.getElementById('kdRouteStopSearchInput');
        if (input) input.value = '';
        sel.value = '';
        
        kdRouteRenderStopList();
    });

    // ─── Generate Route button ────────────────────────────────
    document.getElementById('kdRouteGenerateBtn')?.addEventListener('click', () => {
        if (_kdRouteStops.length === 0) { showToast('Add at least one stop to generate a route.', 'warning'); return; }
        kdRouteDraw();
    });

    // ─── Clear Route button ───────────────────────────────────
    document.getElementById('kdRouteClearBtn')?.addEventListener('click', () => {
        _kdRouteStops = [];
        kdRouteRenderStopList();
        if (_kdRoutePolyline) { _kdRoutePolyline.forEach(p => p.remove()); _kdRoutePolyline = null; }
        const statusEl = document.getElementById('kdRouteStatus');
        if (statusEl) statusEl.textContent = '';
    });

    // ─── Copy Driver Message button ───────────────────────────
    document.getElementById('kdRouteCopyMsgBtn')?.addEventListener('click', kdRouteCopyMessage);
}

// ── Refresh the stop selector dropdown from _kdAllData ────────
function kdRouteRefreshSelector() {
    const input = document.getElementById('kdRouteStopSearchInput');
    const hidden = document.getElementById('kdRouteStopSelector');
    const results = document.getElementById('kdRouteStopSearchResults');
    if (input) input.value = '';
    if (hidden) hidden.value = '';
    if (results) {
        results.innerHTML = '';
        results.style.display = 'none';
    }
    _kdRouteSearchHighlightIdx = -1;
    _kdRouteSearchResultsList = [];
}

// ── Render Search Results ─────────────────────────────────────
function kdRouteRenderSearchResults(queryText) {
    const searchResults = document.getElementById('kdRouteStopSearchResults');
    if (!searchResults) return;

    const query = (queryText || '').toLowerCase().trim();
    
    // Get all valid distributor stops with coordinates, sorted alphabetically
    const allStops = _kdAllData
        .filter(r => r.lat && r.lng)
        .sort((a, b) => a.distributor_name.localeCompare(b.distributor_name));

    // Filter by query if query exists
    if (query) {
        _kdRouteSearchResultsList = allStops.filter(r => 
            r.distributor_name.toLowerCase().includes(query) || 
            r.town_name.toLowerCase().includes(query)
        );
    } else {
        _kdRouteSearchResultsList = allStops;
    }

    searchResults.innerHTML = '';
    _kdRouteSearchHighlightIdx = -1;

    if (_kdRouteSearchResultsList.length === 0) {
        const noRes = document.createElement('div');
        noRes.className = 'kd-route-search-no-results';
        noRes.textContent = 'No distribution points found';
        searchResults.appendChild(noRes);
    } else {
        _kdRouteSearchResultsList.forEach((r, idx) => {
            const item = document.createElement('div');
            item.className = 'kd-route-search-item';
            item.setAttribute('data-id', r.id);
            item.innerHTML = `
                <span class="kd-route-search-name">${r.distributor_name}</span>
                <span class="kd-route-search-town">📍 ${r.town_name}</span>
            `;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                kdRouteSelectSearchItem(r);
            });
            searchResults.appendChild(item);
        });
    }

    searchResults.style.display = 'block';
}

// ── Highlight Search Item ─────────────────────────────────────
function kdRouteHighlightItem(items) {
    items.forEach((item, idx) => {
        if (idx === _kdRouteSearchHighlightIdx) {
            item.classList.add('highlighted');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// ── Select Search Item ─────────────────────────────────────────
function kdRouteSelectSearchItem(record) {
    const searchInput = document.getElementById('kdRouteStopSearchInput');
    const searchResults = document.getElementById('kdRouteStopSearchResults');
    const hiddenInput = document.getElementById('kdRouteStopSelector');

    if (searchInput) searchInput.value = `${record.distributor_name} — ${record.town_name}`;
    if (hiddenInput) {
        hiddenInput.value = record.id;
        hiddenInput.dispatchEvent(new Event('change'));
    }
    if (searchResults) {
        searchResults.style.display = 'none';
    }
    _kdRouteSearchHighlightIdx = -1;
}

// ── Render the ordered stop list ──────────────────────────────
function kdRouteRenderStopList() {
    const container = document.getElementById('kdRouteStopList');
    if (!container) return;

    if (_kdRouteStops.length === 0) {
        container.innerHTML = '<div class="kd-route-empty">No stops added yet. Use the selector above to add stops.</div>';
        return;
    }

    container.innerHTML = '';

    // Starting point (always first, non-removable)
    const startEl = document.createElement('div');
    startEl.className = 'kd-route-stop kd-route-stop-start';
    startEl.innerHTML = `
        <div class="kd-route-stop-num">🏭</div>
        <div class="kd-route-stop-info">
            <div class="kd-route-stop-name">John Keells Enderamulla</div>
            <div class="kd-route-stop-town">📍 Enderamulla, Wattala — Starting Point</div>
        </div>
        <div class="kd-route-stop-badge">START</div>`;
    container.appendChild(startEl);

    _kdRouteStops.forEach((stop, idx) => {
        const el = document.createElement('div');
        el.className = 'kd-route-stop';
        el.innerHTML = `
            <div class="kd-route-stop-num">${idx + 1}</div>
            <div class="kd-route-stop-info">
                <div class="kd-route-stop-name">${stop.distributor_name}</div>
                <div class="kd-route-stop-town">📍 ${stop.town_name}</div>
            </div>
            <div class="kd-route-stop-controls">
                ${idx > 0 ? `<button class="kd-route-ctrl-btn" onclick="kdRouteMoveStop(${idx}, -1)" title="Move Up">↑</button>` : '<span></span>'}
                ${idx < _kdRouteStops.length - 1 ? `<button class="kd-route-ctrl-btn" onclick="kdRouteMoveStop(${idx}, 1)" title="Move Down">↓</button>` : '<span></span>'}
                <button class="kd-route-ctrl-btn kd-route-ctrl-del" onclick="kdRouteRemoveStop(${idx})" title="Remove">✕</button>
            </div>`;
        container.appendChild(el);
    });
}

// ── Move stop up/down ─────────────────────────────────────────
window.kdRouteMoveStop = function(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= _kdRouteStops.length) return;
    [_kdRouteStops[idx], _kdRouteStops[target]] = [_kdRouteStops[target], _kdRouteStops[idx]];
    kdRouteRenderStopList();
};

// ── Remove stop ───────────────────────────────────────────────
window.kdRouteRemoveStop = function(idx) {
    _kdRouteStops.splice(idx, 1);
    kdRouteRenderStopList();
};

// ── Draw route on map using OSRM (free, no API key) ──────────
async function kdRouteDraw() {
    const statusEl = document.getElementById('kdRouteStatus');
    if (statusEl) {
        statusEl.textContent = '⏳ Calculating road route (no highways)…';
        statusEl.className = 'kd-route-status kd-route-status-loading';
    }

    // Clear previous route polyline(s)
    if (_kdRoutePolyline) { _kdRoutePolyline.forEach(p => p.remove()); _kdRoutePolyline = null; }

    // Build waypoints: Enderamulla → each stop
    const waypoints = [
        { lat: KD_START_POINT.lat, lng: KD_START_POINT.lng },
        ..._kdRouteStops.map(s => ({ lat: s.lat, lng: s.lng }))
    ];

    const coordStr = waypoints.map(w => `${w.lng},${w.lat}`).join(';');

    // Helper: draw polyline and fit map
    const drawLines = (coords) => {
        const outline = L.polyline(coords, {
            color: '#fff', weight: 9, opacity: 0.35,
            lineJoin: 'round', lineCap: 'round',
        }).addTo(_kdMap);
        const line = L.polyline(coords, {
            color: '#D1001F', weight: 5, opacity: 0.88,
            lineJoin: 'round', lineCap: 'round',
        }).addTo(_kdMap);
        _kdRoutePolyline = [outline, line];
        _kdMap.fitBounds(line.getBounds(), { padding: [40, 40] });
        return line;
    };

    // Strategy 1: Driving profile with motorway exclusion (preferred for lorries)
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&exclude=motorway`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`OSRM driving error ${resp.status}`);
        const data = await resp.json();
        if (!data.routes || data.routes.length === 0) throw new Error('No driving route');

        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        drawLines(coords);

        const distKm = (route.distance / 1000).toFixed(1);
        const durMin = Math.round(route.duration / 60);
        if (statusEl) {
            statusEl.textContent = `✅ Route generated — ${distKm} km · ~${durMin} min (no highways)`;
            statusEl.className = 'kd-route-status kd-route-status-ok';
        }
        return;
    } catch (drivingErr) {
        console.warn('OSRM driving (exclude motorway) failed, trying motorcycle routing:', drivingErr);
    }

    // Strategy 2: Cycling profile (motorcycles cannot use Sri Lankan expressways,
    // so cycling routing naturally avoids them while still using proper A/B roads)
    try {
        const url = `https://router.project-osrm.org/route/v1/cycling/${coordStr}?overview=full&geometries=geojson`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`OSRM cycling error ${resp.status}`);
        const data = await resp.json();
        if (!data.routes || data.routes.length === 0) throw new Error('No cycling route');

        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        drawLines(coords);

        const distKm = (route.distance / 1000).toFixed(1);
        const durMin = Math.round(route.duration / 60);
        if (statusEl) {
            statusEl.textContent = `✅ Route generated — ${distKm} km · ~${durMin} min (normal roads, no expressways)`;
            statusEl.className = 'kd-route-status kd-route-status-ok';
        }
        return;
    } catch (cyclingErr) {
        console.warn('OSRM cycling also failed, using straight-line fallback:', cyclingErr);
    }

    // Strategy 3: Straight-line fallback
    const coords = waypoints.map(w => [w.lat, w.lng]);
    const fallback = L.polyline(coords, {
        color: '#D1001F', weight: 4, opacity: 0.7, dashArray: '10, 8',
    }).addTo(_kdMap);
    _kdRoutePolyline = [fallback];
    _kdMap.fitBounds(fallback.getBounds(), { padding: [40, 40] });
    if (statusEl) {
        statusEl.textContent = '⚠️ Road data unavailable — showing straight-line route';
        statusEl.className = 'kd-route-status kd-route-status-warn';
    }
}

// ── Generate + copy driver message ────────────────────────────
function kdRouteCopyMessage() {
    if (_kdRouteStops.length === 0) { showToast('Add at least one stop first.', 'warning'); return; }

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });

    const lines = [];

    lines.push('JAYASOORIYA TRANSPORT');
    lines.push('Kevilton Distribution Route');
    lines.push('Date: ' + dateStr);
    lines.push('Note: Use normal roads. Do NOT use highways/expressways.');
    lines.push('');
    lines.push('Starting Point:');
    lines.push(KD_START_POINT.name);
    lines.push(KD_START_POINT.town);
    lines.push('https://maps.google.com/?q=' + KD_START_POINT.lat + ',' + KD_START_POINT.lng);

    _kdRouteStops.forEach((stop, idx) => {
        const directionsLink = 'https://www.google.com/maps/dir/?api=1' +
            '&origin=' + KD_START_POINT.lat + ',' + KD_START_POINT.lng +
            '&destination=' + stop.lat + ',' + stop.lng +
            '&avoid=highways&travelmode=driving';
        lines.push('');
        lines.push('Stop ' + (idx + 1) + ': ' + stop.distributor_name);
        lines.push(stop.town_name);
        lines.push(directionsLink);
    });

    lines.push('');
    lines.push('Total Stops: ' + _kdRouteStops.length);

    const message = lines.join('\n');

    const copyBtn = document.getElementById('kdRouteCopyMsgBtn');
    const doFeedback = () => {
        if (copyBtn) {
            copyBtn.textContent = '✅ Copied!';
            copyBtn.classList.add('kd-route-copied');
            setTimeout(() => {
                copyBtn.textContent = '📲 Copy Driver Message';
                copyBtn.classList.remove('kd-route-copied');
            }, 3000);
        }
    };

    navigator.clipboard.writeText(message).then(doFeedback).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = message; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        doFeedback();
    });
}




// ============================================================
//  VEHICLE EXPIRY TRACKER MODULE (Fix 7)
// ============================================================

function initVehicleExpiryPage() {
    document.getElementById('addExpiryBtn')?.addEventListener('click', () => {
        document.getElementById('expiryFormContainer').style.display = 'block';
        document.getElementById('expiryForm').reset();
        document.getElementById('expiryRecordId').value = '';
    });

    document.getElementById('cancelExpiryBtn')?.addEventListener('click', () => {
        document.getElementById('expiryFormContainer').style.display = 'none';
        document.getElementById('expiryForm').reset();
        document.getElementById('expiryRecordId').value = '';
    });

    document.getElementById('expiryForm')?.addEventListener('submit', saveVehicleExpiry);
}

async function loadVehicleExpiryPage() {
    const userId = getQueryUserId();
    if (!userId) return;

    // Show skeleton while loading
    const grid = document.getElementById('expiryVehicleGrid');
    if (grid) {
        grid.innerHTML = '<div style="color:var(--text-muted);text-align:center;grid-column:1/-1;padding:40px;"><div class="skeleton-card" style="height:150px;margin-bottom:12px;"></div><div class="skeleton-card" style="height:150px;"></div></div>';
    }

    try {
        // Fetch all vehicles from both tables to construct the unique list of base registrations
        const [{ data: hireV }, { data: commV }, { data: expiryData }] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('lorry_number, terminated').eq('user_id', userId),
            supabaseClient.from('commitment_vehicles').select('vehicle_number, terminated').eq('user_id', userId),
            supabaseClient.from('vehicle_expiry').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        ]);

        // Populate vehicle dropdown with unique active base registrations
        const baseNames = new Set();
        hireV?.filter(v => !v.terminated).forEach(v => {
            const base = extractBaseVehicleName(v.lorry_number);
            if (base) baseNames.add(base);
        });
        commV?.filter(v => !v.terminated).forEach(v => {
            const base = extractBaseVehicleName(v.vehicle_number);
            if (base) baseNames.add(base);
        });

        const selectEl = document.getElementById('expiryVehicleSelect');
        if (selectEl) {
            selectEl.innerHTML = '<option value="">Select Vehicle…</option>';
            Array.from(baseNames).sort().forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                selectEl.appendChild(opt);
            });
        }

        // Cache the list of expiry records offline
        setCachedAdminData('vehicle_expiry', expiryData || []);

        renderVehicleExpiryGrid(expiryData || []);
    } catch (err) {
        console.error('Error loading vehicle expiry page:', err);
        // Fallback to offline cache
        const cached = getCachedAdminData('vehicle_expiry');
        if (cached) {
            showToast('Offline — showing cached expiry records.', 'warning');
            renderVehicleExpiryGrid(cached);
        } else {
            showToast('Failed to load expiry data.', 'error');
        }
    }
}

function renderVehicleExpiryGrid(records) {
    const grid = document.getElementById('expiryVehicleGrid');
    const summaryBar = document.getElementById('expirySummaryBar');
    if (!grid) return;

    grid.innerHTML = '';

    if (!records || records.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted);text-align:center;grid-column:1/-1;padding:40px;">No vehicles tracked yet. Click "+ Add / Update Vehicle" above to start tracking.</div>';
        if (summaryBar) summaryBar.innerHTML = '';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expiredCount = 0;
    let warningCount = 0;
    let okCount = 0;

    records.forEach(rec => {
        const insExpiry = rec.insurance_expiry ? new Date(rec.insurance_expiry) : null;
        const revExpiry = rec.revenue_license_expiry ? new Date(rec.revenue_license_expiry) : null;

        if (insExpiry) insExpiry.setHours(0,0,0,0);
        if (revExpiry) revExpiry.setHours(0,0,0,0);

        const getStatus = (date) => {
            if (!date) return { label: 'Not Set', class: 'status-muted', days: null };
            const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
            if (diff <= 0) return { label: 'Expired', class: 'status-expired', days: diff };
            if (diff <= 30) return { label: `Due in ${diff}d`, class: 'status-due', days: diff };
            return { label: `OK (${diff}d)`, class: 'status-ok', days: diff };
        };

        const insStatus = getStatus(insExpiry);
        const revStatus = getStatus(revExpiry);

        // Determine overall card class
        let cardClass = 'ok';
        if (insStatus.class === 'status-expired' || revStatus.class === 'status-expired') {
            cardClass = 'expired';
            expiredCount++;
        } else if (insStatus.class === 'status-due' || revStatus.class === 'status-due') {
            cardClass = 'due';
            warningCount++;
        } else {
            okCount++;
        }

        const card = document.createElement('div');
        card.className = `expiry-card ${cardClass}`;
        
        const actionButtons = userRole === 'viewer' ? '' : `
            <div class="expiry-card-actions">
                <button class="btn btn-edit btn-sm" onclick="editExpiryRecord(${rec.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteExpiryRecord(${rec.id})">Delete</button>
            </div>
        `;

        card.innerHTML = `
            <div class="expiry-card-header">
                <h4>🚛 ${rec.base_registration}</h4>
                ${actionButtons}
            </div>
            <div class="expiry-card-body">
                <div class="expiry-field">
                    <span>🛡️ Insurance:</span>
                    <span class="status-badge ${insStatus.class}">${insStatus.label}</span>
                    <small>${rec.insurance_expiry || 'Not set'}</small>
                </div>
                <div class="expiry-field">
                    <span>📋 Revenue License:</span>
                    <span class="status-badge ${revStatus.class}">${revStatus.label}</span>
                    <small>${rec.revenue_license_expiry || 'Not set'}</small>
                </div>
                ${rec.notes ? `<div class="expiry-notes"><small>📝 ${rec.notes}</small></div>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });

    if (summaryBar) {
        summaryBar.innerHTML = `
            <div class="insurance-stat-card expired">
                <div class="num">${expiredCount}</div>
                <div class="lbl">Expired</div>
            </div>
            <div class="insurance-stat-card due">
                <div class="num">${warningCount}</div>
                <div class="lbl">Due Soon (≤30d)</div>
            </div>
            <div class="insurance-stat-card ok">
                <div class="num">${okCount}</div>
                <div class="lbl">Active & OK</div>
            </div>
        `;
    }
}

async function saveVehicleExpiry(e) {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;
    const userId = getQueryUserId();
    if (!userId) return;

    const id = document.getElementById('expiryRecordId').value;
    const baseRegistration = document.getElementById('expiryVehicleSelect').value;
    const insuranceExpiry = document.getElementById('expiryInsuranceDate').value || null;
    const revenueLicenseExpiry = document.getElementById('expiryRevenueLicenseDate').value || null;
    const notes = document.getElementById('expiryNotes').value || '';

    try {
        const payload = {
            user_id: userId,
            base_registration: baseRegistration,
            insurance_expiry: insuranceExpiry,
            revenue_license_expiry: revenueLicenseExpiry,
            notes: notes
        };

        let result;
        if (id) {
            result = await supabaseClient.from('vehicle_expiry').update(payload).eq('id', id);
        } else {
            result = await supabaseClient.from('vehicle_expiry').upsert(payload, { onConflict: 'user_id,base_registration' });
        }

        if (result.error) throw result.error;

        showToast('Insurance record saved successfully.', 'success');
        document.getElementById('expiryFormContainer').style.display = 'none';
        document.getElementById('expiryForm').reset();
        document.getElementById('expiryRecordId').value = '';
        loadVehicleExpiryPage();
        if (typeof loadNotifications === 'function') loadNotifications();
    } catch (err) {
        console.error('Error saving expiry record:', err);
        showToast('Failed to save expiry record: ' + err.message, 'error');
    }
}

async function editExpiryRecord(id) {
    if (!checkAdminAccess('edit')) return;
    try {
        const { data, error } = await supabaseClient.from('vehicle_expiry').select('*').eq('id', id).single();
        if (error) throw error;

        document.getElementById('expiryRecordId').value = data.id;
        document.getElementById('expiryVehicleSelect').value = data.base_registration;
        document.getElementById('expiryInsuranceDate').value = data.insurance_expiry || '';
        document.getElementById('expiryRevenueLicenseDate').value = data.revenue_license_expiry || '';
        document.getElementById('expiryNotes').value = data.notes || '';

        document.getElementById('expiryFormContainer').style.display = 'block';
        document.getElementById('expiryFormContainer').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error('Error loading record for edit:', err);
        showToast('Failed to load record details.', 'error');
    }
}

async function deleteExpiryRecord(id) {
    if (!checkAdminAccess('delete')) return;
    if (!await showConfirmAsync('Are you sure you want to stop tracking this vehicle\'s insurance and license?', {icon:'🗑️',yesLabel:'Delete',noLabel:'Cancel'})) return;

    try {
        const { error } = await supabaseClient.from('vehicle_expiry').delete().eq('id', id);
        if (error) throw error;

        showToast('Vehicle insurance tracking removed.', 'success');
        loadVehicleExpiryPage();
        if (typeof loadNotifications === 'function') loadNotifications();
    } catch (err) {
        console.error('Error deleting record:', err);
        showToast('Failed to delete tracking record.', 'error');
    }
}

async function fetchExpiryAlerts(userId) {
    try {
        const { data, error } = await supabaseClient.from('vehicle_expiry').select('*').eq('user_id', userId);
        if (error || !data) return [];
        const alerts = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        data.forEach(record => {
            const checkExpiry = (expiryDateStr, name) => {
                if (!expiryDateStr) return;
                const expiryDate = new Date(expiryDateStr);
                expiryDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                if (diffDays <= 30) {
                    let titleText = `🗓️ ${name} Expiry: ${record.base_registration}`;
                    let descText = `${name} expires in ${diffDays} days (${expiryDateStr}).`;
                    let iconText = `🟡`;
                    if (diffDays <= 0) {
                        titleText = `🚨 ${name} EXPIRED: ${record.base_registration}`;
                        descText = `${name} expired on ${expiryDateStr}!`;
                        iconText = `🔴`;
                    }
                    alerts.push({
                        id: `expiry_${record.id}_${name.toLowerCase()}`,
                        title: titleText,
                        desc: descText,
                        icon: iconText,
                        type: 'expiry',
                        date: expiryDateStr
                    });
                }
            };

            checkExpiry(record.insurance_expiry, 'Insurance');
            checkExpiry(record.revenue_license_expiry, 'Revenue License');
        });
        return alerts;
    } catch (e) {
        console.error('Error fetching expiry alerts:', e);
        return [];
    }
}

// ====== DASHBOARD INSURANCE WIDGET INTEGRATION ======
async function loadDashboardInsuranceWidget() {
    const userId = getQueryUserId();
    if (!userId) return;

    const summaryEl = document.getElementById('dashInsuranceSummary');
    const alertsEl = document.getElementById('dashInsuranceAlerts');

    if (!summaryEl || !alertsEl) return;

    try {
        const { data, error } = await supabaseClient.from('vehicle_expiry').select('*').eq('user_id', userId);
        if (error) throw error;

        setCachedAdminData('vehicle_expiry', data || []);
        renderDashboardInsuranceWidget(data || []);
    } catch (err) {
        console.error('Error loading dashboard insurance widget:', err);
        const cached = getCachedAdminData('vehicle_expiry');
        if (cached) {
            renderDashboardInsuranceWidget(cached);
        } else {
            summaryEl.innerHTML = '<div style="color:var(--brand-red);text-align:center;grid-column:1/-1;">Failed to load stats.</div>';
            alertsEl.innerHTML = '<div style="color:var(--brand-red);text-align:center;padding:10px;">Failed to load alerts.</div>';
        }
    }
}

function renderDashboardInsuranceWidget(records) {
    const summaryEl = document.getElementById('dashInsuranceSummary');
    const alertsEl = document.getElementById('dashInsuranceAlerts');
    if (!summaryEl || !alertsEl) return;

    summaryEl.innerHTML = '';
    alertsEl.innerHTML = '';

    if (!records || records.length === 0) {
        summaryEl.innerHTML = `
            <div class="insurance-stat-card ok" style="grid-column: 1/-1; padding: 20px;">
                <div class="num">0</div>
                <div class="lbl">Vehicles Tracked</div>
            </div>
        `;
        alertsEl.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No vehicles tracked yet.</div>';
        return;
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    let expiredCount = 0;
    let dueCount = 0;
    let okCount = 0;
    const vehicleListItems = [];

    records.forEach(rec => {
        const insExpiry = rec.insurance_expiry ? new Date(rec.insurance_expiry) : null;
        const revExpiry = rec.revenue_license_expiry ? new Date(rec.revenue_license_expiry) : null;

        if (insExpiry) insExpiry.setHours(0,0,0,0);
        if (revExpiry) revExpiry.setHours(0,0,0,0);

        const getStatusDetails = (date, dateStr, name) => {
            if (!date) return { type: 'not-set', label: 'Not Set', badgeClass: 'status-muted', text: `${name}: Not set`, dateStr: '-' };
            const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
            if (diff <= 0) {
                return { type: 'expired', label: 'Expired', badgeClass: 'status-expired', text: `${name} expired ${Math.abs(diff)}d ago`, dateStr };
            }
            if (diff <= 30) {
                return { type: 'due', label: `Due in ${diff}d`, badgeClass: 'status-due', text: `${name} expires in ${diff}d`, dateStr };
            }
            return { type: 'ok', label: `OK (${diff}d)`, badgeClass: 'status-ok', text: `${name} is active`, dateStr };
        };

        const insStatus = getStatusDetails(insExpiry, rec.insurance_expiry, 'Insurance');
        const revStatus = getStatusDetails(revExpiry, rec.revenue_license_expiry, 'Revenue License');

        let isExpired = false;
        let isDue = false;

        if (insStatus.type === 'expired' || revStatus.type === 'expired') {
            isExpired = true;
        }
        if (insStatus.type === 'due' || revStatus.type === 'due') {
            isDue = true;
        }

        let overallType = 'ok';
        if (isExpired) {
            expiredCount++;
            overallType = 'expired';
        } else if (isDue) {
            dueCount++;
            overallType = 'due';
        } else {
            okCount++;
        }

        vehicleListItems.push({
            plate: rec.base_registration,
            overallType,
            insStatus,
            revStatus,
            notes: rec.notes
        });
    });

    summaryEl.innerHTML = `
        <div class="insurance-stat-card expired">
            <div class="num">${expiredCount}</div>
            <div class="lbl">Expired</div>
        </div>
        <div class="insurance-stat-card due">
            <div class="num">${dueCount}</div>
            <div class="lbl">Due Soon (≤30d)</div>
        </div>
        <div class="insurance-stat-card ok">
            <div class="num">${okCount}</div>
            <div class="lbl">Active & OK</div>
        </div>
    `;

    if (vehicleListItems.length === 0) {
        alertsEl.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No vehicles tracked yet.</div>';
    } else {
        const typeOrder = { 'expired': 1, 'due': 2, 'ok': 3 };
        vehicleListItems.sort((a, b) => typeOrder[a.overallType] - typeOrder[b.overallType]);
        
        vehicleListItems.forEach(item => {
            const row = document.createElement('div');
            row.className = `insurance-alert-item ${item.overallType}`;
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '8px';
            row.style.alignItems = 'stretch';
            row.style.padding = '14px 16px';
            
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--surface-border); padding-bottom: 6px; margin-bottom: 2px;">
                    <span class="plate" style="font-size:15px; font-weight:800;">🚛 ${item.plate}</span>
                    <span class="badge" style="font-size:10px;">${item.overallType === 'expired' ? '🚨 EXPIRED' : item.overallType === 'due' ? '⚠️ DUE SOON' : '🟢 ACTIVE'}</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div style="display:flex; flex-direction:column; gap:2px; border-right: 1px solid var(--surface-border); padding-right: 6px;">
                        <span style="font-size:10px; color:var(--text-muted); font-weight:700; letter-spacing:0.5px;">🛡️ INSURANCE</span>
                        <span class="status-badge ${item.insStatus.badgeClass}" style="align-self:flex-start; font-size:10px; padding:2px 8px; margin-top:2px;">${item.insStatus.label}</span>
                        <span style="font-size:11px; color:var(--text-secondary); margin-top:2px; font-family:monospace;">Date: ${item.insStatus.dateStr}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:2px; padding-left: 6px;">
                        <span style="font-size:10px; color:var(--text-muted); font-weight:700; letter-spacing:0.5px;">📋 REVENUE LICENSE</span>
                        <span class="status-badge ${item.revStatus.badgeClass}" style="align-self:flex-start; font-size:10px; padding:2px 8px; margin-top:2px;">${item.revStatus.label}</span>
                        <span style="font-size:11px; color:var(--text-secondary); margin-top:2px; font-family:monospace;">Date: ${item.revStatus.dateStr}</span>
                    </div>
                </div>
                ${item.notes ? `<div style="font-size:11px; color:var(--text-muted); font-style:italic; margin-top:4px; padding-top:4px; border-top: 1px dashed var(--surface-border);">📝 ${item.notes}</div>` : ''}
            `;
            alertsEl.appendChild(row);
        });
    }
}

// ============================================================
//  RECORDS & HALL OF FAME WIDGET
// ============================================================
async function loadRecordsHallOfFame(monthValue) {
    const widget = document.getElementById('recordsHallOfFameWidget');
    if (!widget) return;

    // Show shimmer loading (8 cards now)
    widget.innerHTML = Array.from({ length: 8 }, () =>
        '<div class="records-hof-card hof-shimmer" data-accent="gold"></div>'
    ).join('');

    try {
        const uid = getQueryUserId();

        // Determine current month bounds
        let currentMonthValue = monthValue;
        if (!currentMonthValue) {
            const now = new Date();
            currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        const [cYear, cMonth] = currentMonthValue.split('-');
        const cmStart = `${cYear}-${cMonth}-01`;
        const cmLastDay = new Date(parseInt(cYear), parseInt(cMonth), 0).getDate();
        const cmEnd = `${cYear}-${cMonth}-${String(cmLastDay).padStart(2, '0')}`;

        // Fetch all data in parallel
        const [
            { data: allKmRecords },
            { data: currentMonthKmRecords },
            { data: drivers },
            { data: allHireRecords },
            { data: currentMonthHireRecords },
            { data: allCommitmentRecords },
            { data: currentMonthCommitmentRecords },
            { data: allOtherOps },
            { data: currentMonthOtherOps },
            { data: hireVehicles },
            { data: commitmentVehicles }
        ] = await Promise.all([
            supabaseClient.from('driver_km_records').select('driver_id, km_amount, record_date').eq('user_id', uid),
            supabaseClient.from('driver_km_records').select('driver_id, km_amount').eq('user_id', uid).gte('record_date', cmStart).lte('record_date', cmEnd),
            supabaseClient.from('drivers').select('id, name, photo_url, role, terminated').eq('user_id', uid),
            supabaseClient.from('hire_to_pay_records').select('vehicle_id, distance, hire_date').eq('user_id', uid),
            supabaseClient.from('hire_to_pay_records').select('vehicle_id, distance').eq('user_id', uid).gte('hire_date', cmStart).lte('hire_date', cmEnd),
            supabaseClient.from('commitment_records').select('vehicle_id, distance, hire_date').eq('user_id', uid),
            supabaseClient.from('commitment_records').select('vehicle_id, distance').eq('user_id', uid).gte('hire_date', cmStart).lte('hire_date', cmEnd),
            supabaseClient.from('other_operation_hires').select('base_lorry_number, distance, hire_date').eq('user_id', uid),
            supabaseClient.from('other_operation_hires').select('base_lorry_number, distance').eq('user_id', uid).gte('hire_date', cmStart).lte('hire_date', cmEnd),
            supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, vehicle_model, photo_url').eq('user_id', uid),
            supabaseClient.from('commitment_vehicles').select('id, vehicle_number, vehicle_model, photo_url').eq('user_id', uid)
        ]);

        // Build driver map
        const driverMap = {};
        (drivers || []).forEach(d => { driverMap[d.id] = d; });

        // Build mappings of ID to base vehicle number
        const hireIdToBase = {};
        (hireVehicles || []).forEach(v => {
            hireIdToBase[v.id] = extractBaseVehicleName(v.lorry_number);
        });

        const commitmentIdToBase = {};
        (commitmentVehicles || []).forEach(v => {
            commitmentIdToBase[v.id] = extractBaseVehicleName(v.vehicle_number);
        });

        // Build merged vehicle map keyed by base registration
        const mergedVehicleMap = {}; // baseReg -> { number, model, photo_url, type }
        function addOrMergeVehicle(baseReg, model, photo_url, type) {
            if (!baseReg) return;
            if (!mergedVehicleMap[baseReg]) {
                mergedVehicleMap[baseReg] = {
                    number: baseReg,
                    model: model || '',
                    photo_url: photo_url || '',
                    type: type
                };
            } else {
                const existing = mergedVehicleMap[baseReg];
                if (!existing.photo_url && photo_url) {
                    existing.photo_url = photo_url;
                }
                if (!existing.model && model) {
                    existing.model = model;
                }
                if (existing.type !== type) {
                    existing.type = 'Combined';
                }
            }
        }

        (hireVehicles || []).forEach(v => {
            addOrMergeVehicle(hireIdToBase[v.id], v.vehicle_model, v.photo_url, 'Hire-to-Pay');
        });

        (commitmentVehicles || []).forEach(v => {
            addOrMergeVehicle(commitmentIdToBase[v.id], v.vehicle_model, v.photo_url, 'Commitment');
        });

        // Helper to get or dynamically create a vehicle entry for display
        function getOrCreateVehicleEntry(baseReg, defaultType = 'Other Ops') {
            if (!baseReg) return null;
            if (!mergedVehicleMap[baseReg]) {
                mergedVehicleMap[baseReg] = {
                    number: baseReg,
                    model: '',
                    photo_url: '',
                    type: defaultType
                };
            }
            return mergedVehicleMap[baseReg];
        }

        // Helper to render driver photo
        function driverPhotoHTML(driver) {
            if (driver && driver.photo_url) {
                return `<img class="hof-photo" src="${driver.photo_url}" alt="${driver.name}" onerror="this.onerror=null; this.className='hof-photo-placeholder'; this.outerHTML='<div class=\\'hof-photo-placeholder\\'>👤</div>';">`;
            }
            return '<div class="hof-photo-placeholder">👤</div>';
        }

        // Helper to render vehicle photo
        function vehiclePhotoHTML(vehicle) {
            if (vehicle && vehicle.photo_url) {
                return `<img class="hof-photo" src="${vehicle.photo_url}" alt="${vehicle.number}" style="border-color: #0070E0; box-shadow: 0 0 0 3px rgba(0,112,224,0.15);" onerror="this.onerror=null; this.className='hof-photo-placeholder'; this.outerHTML='<div class=\\'hof-photo-placeholder\\'>🚚</div>';">`;
            }
            return '<div class="hof-photo-placeholder">🚚</div>';
        }

        // Helper to build a card
        function buildCard(accent, icon, label, subtitle, entityHTML, statValue, statUnit, metaTags, clickType) {
            const metaHTML = metaTags && metaTags.length > 0
                ? `<div class="hof-meta">${metaTags.map(t => `<span class="hof-meta-tag">${t}</span>`).join('')}</div>`
                : '';
            // Escape single quotes in subtitle and label to not break JS onclick
            const escLabel = label.replace(/'/g, "\\'");
            const escSubtitle = subtitle.replace(/'/g, "\\'");
            return `
                <div class="records-hof-card" data-accent="${accent}" onclick="showHofDetails('${accent}', '${escLabel}', '${escSubtitle}', '${clickType}')">
                    <div class="hof-card-header">
                        <div class="hof-badge" data-accent="${accent}">${icon}</div>
                        <div class="hof-card-title-wrap">
                            <div class="hof-card-label" data-accent="${accent}">${label}</div>
                            <div class="hof-card-subtitle">${subtitle}</div>
                        </div>
                    </div>
                    ${entityHTML}
                    <div style="display:flex; align-items:baseline; gap:4px;">
                        <span class="hof-stat-value" data-accent="${accent}">${statValue}</span>
                        <span class="hof-stat-unit">${statUnit}</span>
                    </div>
                    ${metaHTML}
                </div>`;
        }

        function emptyCard(accent, icon, label, subtitle) {
            return `
                <div class="records-hof-card" data-accent="${accent}">
                    <div class="hof-card-header">
                        <div class="hof-badge" data-accent="${accent}">${icon}</div>
                        <div class="hof-card-title-wrap">
                            <div class="hof-card-label" data-accent="${accent}">${label}</div>
                            <div class="hof-card-subtitle">${subtitle}</div>
                        </div>
                    </div>
                    <div class="hof-empty">
                        <div class="hof-empty-icon">📊</div>
                        <div class="hof-empty-text">No data yet</div>
                    </div>
                </div>`;
        }

        let currentMonthCards = '';
        let allTimeCards = '';
        let peakCards = '';

        // ───────── 1. HIGHEST ALL-TIME KM DRIVER ─────────
        const allTimeKmByDriver = {};
        (allKmRecords || []).forEach(r => {
            allTimeKmByDriver[r.driver_id] = (allTimeKmByDriver[r.driver_id] || 0) + parseFloat(r.km_amount || 0);
        });
        const sortedAllTimeKmDrivers = Object.keys(allTimeKmByDriver)
            .map(id => ({
                id,
                driver: driverMap[id],
                value: allTimeKmByDriver[id]
            }))
            .filter(item => item.driver)
            .sort((a, b) => b.value - a.value);
        
        const topAllTimeKmDriverId = sortedAllTimeKmDrivers[0]?.id;

        if (topAllTimeKmDriverId && driverMap[topAllTimeKmDriverId]) {
            const d = driverMap[topAllTimeKmDriverId];
            const km = allTimeKmByDriver[topAllTimeKmDriverId];
            const driverNameWithTerm = cleanDriverName(d.name) + (d.terminated ? ' <span class="terminated-badge">Terminated</span>' : '');
            allTimeCards += buildCard('gold', '🏆', 'Highest KMs – All Time', 'Driver with the most kilometers ever',
                `<div class="hof-entity">${driverPhotoHTML(d)}<div class="hof-entity-info"><div class="hof-entity-name">${driverNameWithTerm}</div><div class="hof-entity-role">${getNickname(d.name) || 'Driver'}</div></div></div>`,
                km.toLocaleString(undefined, { maximumFractionDigits: 0 }), 'km total',
                ['🥇 All-Time Champion'],
                'allTimeKmDrivers'
            );
        } else {
            allTimeCards += emptyCard('gold', '🏆', 'Highest KMs – All Time', 'No KM records yet');
        }

        // ───────── 2. HIGHEST KM DRIVER – CURRENT MONTH ─────────
        const monthKmByDriver = {};
        (currentMonthKmRecords || []).forEach(r => {
            monthKmByDriver[r.driver_id] = (monthKmByDriver[r.driver_id] || 0) + parseFloat(r.km_amount || 0);
        });
        const sortedMonthKmDrivers = Object.keys(monthKmByDriver)
            .map(id => ({
                id,
                driver: driverMap[id],
                value: monthKmByDriver[id]
            }))
            .filter(item => item.driver)
            .sort((a, b) => b.value - a.value);

        const topMonthKmDriverId = sortedMonthKmDrivers[0]?.id;

        if (topMonthKmDriverId && driverMap[topMonthKmDriverId]) {
            const d = driverMap[topMonthKmDriverId];
            const km = monthKmByDriver[topMonthKmDriverId];
            const monthLabel = new Date(parseInt(cYear), parseInt(cMonth) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
            const driverNameWithTerm = cleanDriverName(d.name) + (d.terminated ? ' <span class="terminated-badge">Terminated</span>' : '');
            currentMonthCards += buildCard('crimson', '🔥', 'Highest KMs – This Month', monthLabel,
                `<div class="hof-entity">${driverPhotoHTML(d)}<div class="hof-entity-info"><div class="hof-entity-name">${driverNameWithTerm}</div><div class="hof-entity-role">${getNickname(d.name) || 'Driver'}</div></div></div>`,
                km.toLocaleString(undefined, { maximumFractionDigits: 0 }), 'km this month',
                ['📅 Monthly Record'],
                'monthKmDrivers'
            );
        } else {
            currentMonthCards += emptyCard('crimson', '🔥', 'Highest KMs – This Month', 'No KM records this month');
        }

        // ───────── 3. HIGHEST KM DRIVER – HISTORICAL PEAK MONTH ─────────
        const driverMonthKm = {}; // "driverId_YYYY-MM" -> km
        (allKmRecords || []).forEach(r => {
            const monthKey = r.record_date ? r.record_date.substring(0, 7) : '';
            if (monthKey && r.driver_id) {
                const key = `${r.driver_id}_${monthKey}`;
                driverMonthKm[key] = (driverMonthKm[key] || 0) + parseFloat(r.km_amount || 0);
            }
        });
        const sortedDriverPeakMonths = Object.keys(driverMonthKm)
            .map(key => {
                const [driverId, monthKey] = key.split('_');
                return {
                    id: driverId,
                    driver: driverMap[driverId],
                    month: monthKey,
                    value: driverMonthKm[key]
                };
            })
            .filter(item => item.driver)
            .sort((a, b) => b.value - a.value);

        const topDriverMonthKey = sortedDriverPeakMonths[0] ? `${sortedDriverPeakMonths[0].id}_${sortedDriverPeakMonths[0].month}` : null;

        if (topDriverMonthKey) {
            const [driverId, monthKey] = topDriverMonthKey.split('_');
            const d = driverMap[driverId];
            if (d) {
                const km = driverMonthKm[topDriverMonthKey];
                const [yr, mn] = monthKey.split('-');
                const monthName = new Date(parseInt(yr), parseInt(mn) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                const driverNameWithTerm = cleanDriverName(d.name) + (d.terminated ? ' <span class="terminated-badge">Terminated</span>' : '');
                peakCards += buildCard('rose', '📈', 'Highest KMs in a Month (Driver)', 'All-time peak driver month',
                    `<div class="hof-entity">${driverPhotoHTML(d)}<div class="hof-entity-info"><div class="hof-entity-name">${driverNameWithTerm}</div><div class="hof-entity-role">${getNickname(d.name) || 'Driver'}</div></div></div>`,
                    km.toLocaleString(undefined, { maximumFractionDigits: 0 }), 'km record',
                    [`📅 ${monthName}`, '⚡ Peak Performance'],
                    'driverPeakMonths'
                );
            } else {
                peakCards += emptyCard('rose', '📈', 'Highest KMs in a Month (Driver)', 'No active driver found for peak');
            }
        } else {
            peakCards += emptyCard('rose', '📈', 'Highest KMs in a Month (Driver)', 'No driver KM records yet');
        }

        // ───────── 4. MOST ACTIVE DRIVER (ALL-TIME) ─────────
        const allTimeKmByMonth = {};
        (allKmRecords || []).forEach(r => {
            const monthKey = r.record_date ? r.record_date.substring(0, 7) : '';
            if (r.driver_id && monthKey) {
                if (!allTimeKmByMonth[r.driver_id]) allTimeKmByMonth[r.driver_id] = new Set();
                allTimeKmByMonth[r.driver_id].add(monthKey);
            }
        });
        const sortedActiveDrivers = Object.keys(allTimeKmByDriver)
            .map(id => {
                const months = allTimeKmByMonth[id] ? allTimeKmByMonth[id].size : 0;
                const totalKm = allTimeKmByDriver[id] || 0;
                return {
                    id,
                    driver: driverMap[id],
                    months,
                    totalKm,
                    score: months * 100000 + totalKm
                };
            })
            .filter(item => item.driver)
            .sort((a, b) => b.score - a.score);

        const mostSuccessAllTime = sortedActiveDrivers[0]?.id;

        if (mostSuccessAllTime && driverMap[mostSuccessAllTime]) {
            const d = driverMap[mostSuccessAllTime];
            const months = allTimeKmByMonth[mostSuccessAllTime] ? allTimeKmByMonth[mostSuccessAllTime].size : 0;
            const km = allTimeKmByDriver[mostSuccessAllTime] || 0;
            const driverNameWithTerm = cleanDriverName(d.name) + (d.terminated ? ' <span class="terminated-badge">Terminated</span>' : '');
            allTimeCards += buildCard('emerald', '⭐', 'Most Active Driver', 'All-time consistency champion',
                `<div class="hof-entity">${driverPhotoHTML(d)}<div class="hof-entity-info"><div class="hof-entity-name">${driverNameWithTerm}</div><div class="hof-entity-role">${getNickname(d.name) || 'Driver'}</div></div></div>`,
                months, 'active months',
                [`${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km total`, '🌟 Star Driver'],
                'activeDrivers'
            );
        } else {
            allTimeCards += emptyCard('emerald', '⭐', 'Most Active Driver', 'No data available');
        }

        // ───────── 5. MOST KM-RAN VEHICLE (ALL OPERATIONS) ─────────
        const allTimeVehicleKm = {};
        (allHireRecords || []).forEach(r => {
            const baseReg = hireIdToBase[r.vehicle_id];
            if (baseReg) {
                allTimeVehicleKm[baseReg] = (allTimeVehicleKm[baseReg] || 0) + parseFloat(r.distance || 0);
            }
        });
        (allCommitmentRecords || []).forEach(r => {
            const baseReg = commitmentIdToBase[r.vehicle_id];
            if (baseReg) {
                allTimeVehicleKm[baseReg] = (allTimeVehicleKm[baseReg] || 0) + parseFloat(r.distance || 0);
            }
        });
        (allOtherOps || []).forEach(r => {
            const baseReg = extractBaseVehicleName(r.base_lorry_number);
            if (baseReg) {
                allTimeVehicleKm[baseReg] = (allTimeVehicleKm[baseReg] || 0) + parseFloat(r.distance || 0);
            }
        });
        const sortedAllTimeKmVehicles = Object.keys(allTimeVehicleKm)
            .map(baseReg => ({
                baseReg,
                vehicle: getOrCreateVehicleEntry(baseReg),
                value: allTimeVehicleKm[baseReg]
            }))
            .filter(item => item.vehicle)
            .sort((a, b) => b.value - a.value);

        const topAllTimeVehicleKey = sortedAllTimeKmVehicles[0]?.baseReg;

        if (topAllTimeVehicleKey) {
            const v = getOrCreateVehicleEntry(topAllTimeVehicleKey);
            const km = allTimeVehicleKm[topAllTimeVehicleKey];
            allTimeCards += buildCard('sapphire', '🚛', 'Most KMs Ran Vehicle', 'All operations combined',
                `<div class="hof-entity">${vehiclePhotoHTML(v)}<div class="hof-entity-info"><div class="hof-entity-name">${v.number}</div><div class="hof-entity-role">${v.model || v.type}</div></div></div>`,
                km.toLocaleString(undefined, { maximumFractionDigits: 0 }), 'km total',
                [`🏷️ ${v.type}`, '🛣️ Road Warrior'],
                'allTimeKmVehicles'
            );
        } else {
            allTimeCards += emptyCard('sapphire', '🚛', 'Most KMs Ran Vehicle', 'No vehicle records yet');
        }

        // ───────── 6. CURRENT MONTH BEST VEHICLE ─────────
        const monthVehicleKm = {};
        (currentMonthHireRecords || []).forEach(r => {
            const baseReg = hireIdToBase[r.vehicle_id];
            if (baseReg) {
                monthVehicleKm[baseReg] = (monthVehicleKm[baseReg] || 0) + parseFloat(r.distance || 0);
            }
        });
        (currentMonthCommitmentRecords || []).forEach(r => {
            const baseReg = commitmentIdToBase[r.vehicle_id];
            if (baseReg) {
                monthVehicleKm[baseReg] = (monthVehicleKm[baseReg] || 0) + parseFloat(r.distance || 0);
            }
        });
        (currentMonthOtherOps || []).forEach(r => {
            const baseReg = extractBaseVehicleName(r.base_lorry_number);
            if (baseReg) {
                monthVehicleKm[baseReg] = (monthVehicleKm[baseReg] || 0) + parseFloat(r.distance || 0);
            }
        });
        const sortedMonthKmVehicles = Object.keys(monthVehicleKm)
            .map(baseReg => ({
                baseReg,
                vehicle: getOrCreateVehicleEntry(baseReg),
                value: monthVehicleKm[baseReg]
            }))
            .filter(item => item.vehicle)
            .sort((a, b) => b.value - a.value);

        const topMonthVehicleKey = sortedMonthKmVehicles[0]?.baseReg;

        if (topMonthVehicleKey) {
            const v = getOrCreateVehicleEntry(topMonthVehicleKey);
            const km = monthVehicleKm[topMonthVehicleKey];
            const monthLabel = new Date(parseInt(cYear), parseInt(cMonth) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
            currentMonthCards += buildCard('purple', '🎯', 'Best Vehicle – This Month', monthLabel,
                `<div class="hof-entity">${vehiclePhotoHTML(v)}<div class="hof-entity-info"><div class="hof-entity-name">${v.number}</div><div class="hof-entity-role">${v.model || v.type}</div></div></div>`,
                km.toLocaleString(undefined, { maximumFractionDigits: 0 }), 'km this month',
                [`🏷️ ${v.type}`, '📅 Monthly Best'],
                'monthKmVehicles'
            );
        } else {
            currentMonthCards += emptyCard('purple', '🎯', 'Best Vehicle – This Month', 'No vehicle records this month');
        }

        // ───────── 7. HIGHEST KM VEHICLE – HISTORICAL PEAK MONTH ─────────
        const vehicleMonthKm = {}; // "baseReg_YYYY-MM" -> km
        // Hire records
        (allHireRecords || []).forEach(r => {
            const baseReg = hireIdToBase[r.vehicle_id];
            const monthKey = r.hire_date ? r.hire_date.substring(0, 7) : '';
            if (baseReg && monthKey) {
                const key = `${baseReg}_${monthKey}`;
                vehicleMonthKm[key] = (vehicleMonthKm[key] || 0) + parseFloat(r.distance || 0);
            }
        });
        // Commitment records
        (allCommitmentRecords || []).forEach(r => {
            const baseReg = commitmentIdToBase[r.vehicle_id];
            const monthKey = r.hire_date ? r.hire_date.substring(0, 7) : '';
            if (baseReg && monthKey) {
                const key = `${baseReg}_${monthKey}`;
                vehicleMonthKm[key] = (vehicleMonthKm[key] || 0) + parseFloat(r.distance || 0);
            }
        });
        // Other ops
        (allOtherOps || []).forEach(r => {
            const baseReg = extractBaseVehicleName(r.base_lorry_number);
            const monthKey = r.hire_date ? r.hire_date.substring(0, 7) : '';
            if (baseReg && monthKey) {
                const key = `${baseReg}_${monthKey}`;
                vehicleMonthKm[key] = (vehicleMonthKm[key] || 0) + parseFloat(r.distance || 0);
            }
        });
        const sortedVehiclePeakMonths = Object.keys(vehicleMonthKm)
            .map(key => {
                const lastUnderscoreIdx = key.lastIndexOf('_');
                const baseReg = key.substring(0, lastUnderscoreIdx);
                const monthKey = key.substring(lastUnderscoreIdx + 1);
                return {
                    baseReg,
                    vehicle: getOrCreateVehicleEntry(baseReg),
                    month: monthKey,
                    value: vehicleMonthKm[key]
                };
            })
            .filter(item => item.vehicle)
            .sort((a, b) => b.value - a.value);

        const topVehicleMonthKey = sortedVehiclePeakMonths[0] ? `${sortedVehiclePeakMonths[0].baseReg}_${sortedVehiclePeakMonths[0].month}` : null;

        if (topVehicleMonthKey) {
            const lastUnderscoreIdx = topVehicleMonthKey.lastIndexOf('_');
            const baseReg = topVehicleMonthKey.substring(0, lastUnderscoreIdx);
            const monthKey = topVehicleMonthKey.substring(lastUnderscoreIdx + 1);

            const v = getOrCreateVehicleEntry(baseReg);
            const km = vehicleMonthKm[topVehicleMonthKey];
            const [yr, mn] = monthKey.split('-');
            const monthName = new Date(parseInt(yr), parseInt(mn) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

            peakCards += buildCard('teal', '📊', 'Highest KMs in a Month (Vehicle)', 'All-time peak vehicle month',
                `<div class="hof-entity">${vehiclePhotoHTML(v)}<div class="hof-entity-info"><div class="hof-entity-name">${v.number}</div><div class="hof-entity-role">${v.model || v.type}</div></div></div>`,
                km.toLocaleString(undefined, { maximumFractionDigits: 0 }), 'km record',
                [`📅 ${monthName}`, '⚡ Peak Performance'],
                'vehiclePeakMonths'
            );
        } else {
            peakCards += emptyCard('teal', '📊', 'Highest KMs in a Month (Vehicle)', 'No vehicle records yet');
        }

        // ───────── 8. ALL-TIME BEST VEHICLE ─────────
        const allTimeVehicleHires = {};
        (allHireRecords || []).forEach(r => {
            const baseReg = hireIdToBase[r.vehicle_id];
            if (baseReg) {
                allTimeVehicleHires[baseReg] = (allTimeVehicleHires[baseReg] || 0) + 1;
            }
        });
        (allCommitmentRecords || []).forEach(r => {
            const baseReg = commitmentIdToBase[r.vehicle_id];
            if (baseReg) {
                allTimeVehicleHires[baseReg] = (allTimeVehicleHires[baseReg] || 0) + 1;
            }
        });
        (allOtherOps || []).forEach(r => {
            const baseReg = extractBaseVehicleName(r.base_lorry_number);
            if (baseReg) {
                allTimeVehicleHires[baseReg] = (allTimeVehicleHires[baseReg] || 0) + 1;
            }
        });
        const sortedBestVehicles = Object.keys(allTimeVehicleHires)
            .map(baseReg => ({
                baseReg,
                vehicle: getOrCreateVehicleEntry(baseReg),
                value: allTimeVehicleHires[baseReg],
                km: allTimeVehicleKm[baseReg] || 0
            }))
            .filter(item => item.vehicle)
            .sort((a, b) => b.value - a.value);

        const topAllTimeBestVehicle = sortedBestVehicles[0]?.baseReg;

        if (topAllTimeBestVehicle) {
            const v = getOrCreateVehicleEntry(topAllTimeBestVehicle);
            const hires = allTimeVehicleHires[topAllTimeBestVehicle];
            const km = allTimeVehicleKm[topAllTimeBestVehicle] || 0;
            allTimeCards += buildCard('amber', '👑', 'All-Time Best Vehicle', 'Most hires completed overall',
                `<div class="hof-entity">${vehiclePhotoHTML(v)}<div class="hof-entity-info"><div class="hof-entity-name">${v.number}</div><div class="hof-entity-role">${v.model || v.type}</div></div></div>`,
                hires.toLocaleString(), 'hires completed',
                [`${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km driven`, `🏷️ ${v.type}`],
                'bestVehicles'
            );
        } else {
            allTimeCards += emptyCard('amber', '👑', 'All-Time Best Vehicle', 'No hire records yet');
        }

        // Expose top lists globally for details popup
        window.hofData = {
            allTimeKmDrivers: sortedAllTimeKmDrivers,
            monthKmDrivers: sortedMonthKmDrivers,
            driverPeakMonths: sortedDriverPeakMonths,
            activeDrivers: sortedActiveDrivers,
            allTimeKmVehicles: sortedAllTimeKmVehicles,
            monthKmVehicles: sortedMonthKmVehicles,
            vehiclePeakMonths: sortedVehiclePeakMonths,
            bestVehicles: sortedBestVehicles
        };

        widget.innerHTML = `
            <div class="records-hof-category">
                <h4 class="hof-category-title">📅 Current Month Records</h4>
                <div class="records-hof-grid">
                    ${currentMonthCards}
                </div>
            </div>
            <div class="records-hof-category">
                <h4 class="hof-category-title">🏆 All-Time Records</h4>
                <div class="records-hof-grid">
                    ${allTimeCards}
                </div>
            </div>
            <div class="records-hof-category">
                <h4 class="hof-category-title">📊 Other Records</h4>
                <div class="records-hof-grid">
                    ${peakCards}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading Records & Hall of Fame:', error);
        widget.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <div style="font-size: 32px; margin-bottom: 10px;">⚠️</div>
                <div>Failed to load records. Please refresh the page.</div>
            </div>`;
    }
}

// ====== RECORDS DETAILS MODAL CONTROLLERS ======
function showHofDetails(accent, label, subtitle, type) {
    const modal = document.getElementById('recordDetailModal');
    const titleEl = document.getElementById('recordDetailTitle');
    const subtitleEl = document.getElementById('recordDetailSubtitle');
    const listEl = document.getElementById('recordDetailList');
    if (!modal || !listEl) return;

    titleEl.textContent = label;
    subtitleEl.textContent = subtitle;
    listEl.innerHTML = '';

    const data = window.hofData ? window.hofData[type] : [];
    if (!data || data.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">No record holders found.</div>';
        modal.classList.add('active');
        return;
    }

    data.forEach((item, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';

        let itemHTML = '';
        if (type === 'allTimeKmDrivers' || type === 'monthKmDrivers' || type === 'activeDrivers') {
            const d = item.driver;
            const photo = d.photo_url 
                ? `<img class="hof-modal-photo" src="${d.photo_url}" alt="${d.name}" onerror="this.onerror=null; this.className='hof-modal-photo-placeholder'; this.outerHTML='<div class=\\'hof-modal-photo-placeholder\\'>👤</div>';">`
                : '<div class="hof-modal-photo-placeholder">👤</div>';
            
            const terminatedLabel = d.terminated ? ' <span class="terminated-badge">Terminated</span>' : '';
            
            let valDisplay = '';
            if (type === 'activeDrivers') {
                valDisplay = `<strong>${item.months}</strong> <span style="font-size:11px;color:var(--text-muted)">months</span> (${item.totalKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km)`;
            } else {
                valDisplay = `<strong>${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> <span style="font-size:11px;color:var(--text-muted)">km</span>`;
            }

            itemHTML = `
                <div class="hof-modal-item">
                    <div class="hof-modal-rank ${rankClass}">${rank}</div>
                    ${photo}
                    <div class="hof-modal-info">
                        <div class="hof-modal-name">${cleanDriverName(d.name)}${terminatedLabel}</div>
                        <div class="hof-modal-sub">${getNickname(d.name) || 'Driver'}</div>
                    </div>
                    <div class="hof-modal-value">${valDisplay}</div>
                </div>
            `;
        } else if (type === 'driverPeakMonths') {
            const d = item.driver;
            const photo = d.photo_url 
                ? `<img class="hof-modal-photo" src="${d.photo_url}" alt="${d.name}" onerror="this.onerror=null; this.className='hof-modal-photo-placeholder'; this.outerHTML='<div class=\\'hof-modal-photo-placeholder\\'>👤</div>';">`
                : '<div class="hof-modal-photo-placeholder">👤</div>';
            
            const terminatedLabel = d.terminated ? ' <span class="terminated-badge">Terminated</span>' : '';
            const [yr, mn] = item.month.split('-');
            const monthName = new Date(parseInt(yr), parseInt(mn) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });

            itemHTML = `
                <div class="hof-modal-item">
                    <div class="hof-modal-rank ${rankClass}">${rank}</div>
                    ${photo}
                    <div class="hof-modal-info">
                        <div class="hof-modal-name">${cleanDriverName(d.name)}${terminatedLabel}</div>
                        <div class="hof-modal-sub">${monthName} • ${getNickname(d.name) || 'Driver'}</div>
                    </div>
                    <div class="hof-modal-value">
                        <strong>${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> <span style="font-size:11px;color:var(--text-muted)">km</span>
                    </div>
                </div>
            `;
        } else if (type === 'allTimeKmVehicles' || type === 'monthKmVehicles') {
            const v = item.vehicle;
            const photo = v.photo_url 
                ? `<img class="hof-modal-photo" src="${v.photo_url}" alt="${v.number}" onerror="this.onerror=null; this.className='hof-modal-photo-placeholder'; this.outerHTML='<div class=\\'hof-modal-photo-placeholder\\'>🚚</div>';">`
                : '<div class="hof-modal-photo-placeholder">🚚</div>';

            itemHTML = `
                <div class="hof-modal-item">
                    <div class="hof-modal-rank ${rankClass}">${rank}</div>
                    ${photo}
                    <div class="hof-modal-info">
                        <div class="hof-modal-name">${v.number}</div>
                        <div class="hof-modal-sub">${v.model || v.type}</div>
                    </div>
                    <div class="hof-modal-value">
                        <strong>${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> <span style="font-size:11px;color:var(--text-muted)">km</span>
                    </div>
                </div>
            `;
        } else if (type === 'vehiclePeakMonths') {
            const v = item.vehicle;
            const photo = v.photo_url 
                ? `<img class="hof-modal-photo" src="${v.photo_url}" alt="${v.number}" onerror="this.onerror=null; this.className='hof-modal-photo-placeholder'; this.outerHTML='<div class=\\'hof-modal-photo-placeholder\\'>🚚</div>';">`
                : '<div class="hof-modal-photo-placeholder">🚚</div>';
            
            const [yr, mn] = item.month.split('-');
            const monthName = new Date(parseInt(yr), parseInt(mn) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });

            itemHTML = `
                <div class="hof-modal-item">
                    <div class="hof-modal-rank ${rankClass}">${rank}</div>
                    ${photo}
                    <div class="hof-modal-info">
                        <div class="hof-modal-name">${v.number}</div>
                        <div class="hof-modal-sub">${monthName} • ${v.model || v.type}</div>
                    </div>
                    <div class="hof-modal-value">
                        <strong>${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> <span style="font-size:11px;color:var(--text-muted)">km</span>
                    </div>
                </div>
            `;
        } else if (type === 'bestVehicles') {
            const v = item.vehicle;
            const photo = v.photo_url 
                ? `<img class="hof-modal-photo" src="${v.photo_url}" alt="${v.number}" onerror="this.onerror=null; this.className='hof-modal-photo-placeholder'; this.outerHTML='<div class=\\'hof-modal-photo-placeholder\\'>🚚</div>';">`
                : '<div class="hof-modal-photo-placeholder">🚚</div>';

            itemHTML = `
                <div class="hof-modal-item">
                    <div class="hof-modal-rank ${rankClass}">${rank}</div>
                    ${photo}
                    <div class="hof-modal-info">
                        <div class="hof-modal-name">${v.number}</div>
                        <div class="hof-modal-sub">${v.model || v.type} • ${item.km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</div>
                    </div>
                    <div class="hof-modal-value">
                        <strong>${item.value.toLocaleString()}</strong> <span style="font-size:11px;color:var(--text-muted)">hires</span>
                    </div>
                </div>
            `;
        }

        listEl.insertAdjacentHTML('beforeend', itemHTML);
    });

    modal.classList.add('active');
}


function closeRecordDetailModal() {
    const modal = document.getElementById('recordDetailModal');
    if (modal) {
        modal.classList.remove('active');
    }
}


// Wire up the close handlers for the Records modal
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('recordDetailModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('recordDetailModal')) {
            closeRecordDetailModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeRecordDetailModal();
        }
    });
});


// ============================================================
//  AUTO-INCREMENT JOB NUMBER & LOCATION AUTOCOMPLETE SYSTEM
// ============================================================

// --- JOB NUMBER AUTO-INCREMENT ---

/**
 * Fetches the LAST ADDED record (ordered by primary key ID descending) for the active section & selected month,
 * then returns the job_number incremented by 1.
 * @param {string} section - 'hire' or 'commitment'
 */
async function getNextJobNumber(section = 'hire') {
    try {
        const uid = getQueryUserId();
        if (!uid) { console.warn('getNextJobNumber: No user ID'); return ''; }

        const tableName = section === 'commitment' ? 'commitment_records' : 'hire_to_pay_records';
        const monthElId = section === 'commitment' ? 'commitmentRecordsMonth' : 'hireRecordsMonth';
        const monthValue = document.getElementById(monthElId)?.value;

        let query = supabaseClient
            .from(tableName)
            .select('job_number, id, hire_date')
            .eq('user_id', uid);

        // Filter by the selected month in that section if available
        if (monthValue) {
            const [year, month] = monthValue.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
            const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

            query = query.gte('hire_date', startDate).lte('hire_date', endDate);
        }

        // Fetch the LAST ADDED record (highest ID = newest inserted record)
        const { data, error } = await query.order('id', { ascending: false }).limit(1);

        let lastRecord = data && data.length > 0 ? data[0] : null;

        // If no record found for the selected month, fetch the last added record overall for this section
        if (!lastRecord && monthValue) {
            const fallbackResult = await supabaseClient
                .from(tableName)
                .select('job_number, id')
                .eq('user_id', uid)
                .order('id', { ascending: false })
                .limit(1);

            if (fallbackResult.data && fallbackResult.data.length > 0) {
                lastRecord = fallbackResult.data[0];
            }
        }

        if (!lastRecord || !lastRecord.job_number) return '';

        const jn = lastRecord.job_number.trim();
        // Match PREFIX + SEPARATOR + NUMBER (e.g., JK0000107 -> prefix: JK, sep: "", digits: 0000107)
        const match = jn.match(/^([A-Za-z]+)([-\s]?)(\d+)$/);
        if (!match) return '';

        const prefix = match[1];
        const separator = match[2];
        const numStr = match[3];
        const nextNum = parseInt(numStr, 10) + 1;
        const padLength = numStr.length;

        const nextJobNumber = prefix + separator + String(nextNum).padStart(padLength, '0');
        console.log(`getNextJobNumber (${section}): Last added record ID = ${lastRecord.id}, Job = ${jn} -> Next = ${nextJobNumber}`);
        return nextJobNumber;
    } catch (error) {
        console.error('Error fetching next job number:', error);
        return '';
    }
}

/**
 * Check if a job number already exists in a specific table/section (e.g., hire_to_pay_records or commitment_records).
 * Each section maintains its job numbers independently.
 * Optionally exclude a specific record ID when editing.
 */
async function isJobNumberDuplicate(jobNumber, targetTable = 'hire_to_pay_records', excludeId = null) {
    try {
        const uid = getQueryUserId();
        if (!uid || !jobNumber) return false;

        const table = targetTable || 'hire_to_pay_records';
        let query = supabaseClient
            .from(table)
            .select('id')
            .eq('user_id', uid)
            .eq('job_number', jobNumber);

        if (excludeId) {
            query = query.neq('id', excludeId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data && data.length > 0;
    } catch (error) {
        console.error('Error checking duplicate job number:', error);
        return false; // Fail open to not block saves
    }
}



// --- LOCATION AUTOCOMPLETE ---

/**
 * Cache of known locations, refreshed periodically.
 */
let _locationCacheData = null;
let _locationCacheTimestamp = 0;
const LOCATION_CACHE_TTL = 60000; // 1 minute

async function fetchAllLocations() {
    const now = Date.now();
    if (_locationCacheData && (now - _locationCacheTimestamp) < LOCATION_CACHE_TTL) {
        return _locationCacheData;
    }

    try {
        const uid = getQueryUserId();
        if (!uid) return [];

        const [{ data: hireData }, { data: commitData }, { data: otherData }] = await Promise.all([
            supabaseClient
                .from('hire_to_pay_records')
                .select('from_location, to_location')
                .eq('user_id', uid),
            supabaseClient
                .from('commitment_records')
                .select('from_location, to_location')
                .eq('user_id', uid),
            supabaseClient
                .from('other_operation_hires')
                .select('from_location, to_location')
                .eq('user_id', uid)
        ]);

        const locationSet = new Set();

        [hireData, commitData, otherData].forEach(dataset => {
            if (dataset) {
                dataset.forEach(r => {
                    if (r.from_location && r.from_location.trim()) locationSet.add(r.from_location.trim());
                    if (r.to_location && r.to_location.trim()) locationSet.add(r.to_location.trim());
                });
            }
        });

        _locationCacheData = Array.from(locationSet).sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase())
        );
        _locationCacheTimestamp = now;
        return _locationCacheData;
    } catch (error) {
        console.error('Error fetching locations for autocomplete:', error);
        return _locationCacheData || [];
    }
}

/**
 * Initialize autocomplete on a text input element.
 * Creates a dropdown that shows matching locations as user types.
 */
function initLocationAutocomplete(inputElement) {
    if (!inputElement || inputElement._acInitialized) return;
    inputElement._acInitialized = true;

    // Turn off browser autocomplete
    inputElement.setAttribute('autocomplete', 'off');

    // Wrap input in a relative container if not already wrapped
    let wrapper = inputElement.closest('.location-autocomplete-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'location-autocomplete-wrapper';
        inputElement.parentNode.insertBefore(wrapper, inputElement);
        wrapper.appendChild(inputElement);
    }

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'location-autocomplete-dropdown';
    wrapper.appendChild(dropdown);

    let activeIndex = -1;
    let currentMatches = [];

    function highlightText(text, query) {
        if (!query) return text;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(new RegExp(`(${escaped})`, 'gi'), '<span class="ac-match">$1</span>');
    }

    async function showSuggestions() {
        const query = inputElement.value.trim();
        if (query.length < 1) {
            dropdown.classList.remove('active');
            return;
        }

        const locations = await fetchAllLocations();
        currentMatches = locations.filter(loc =>
            loc.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 15); // Limit results

        if (currentMatches.length === 0) {
            dropdown.innerHTML = '<div class="ac-empty">No matching locations</div>';
            dropdown.classList.add('active');
            activeIndex = -1;
            return;
        }

        dropdown.innerHTML = currentMatches.map((loc, i) =>
            `<div class="ac-item" data-index="${i}">
                <span class="ac-icon">📍</span>
                <span>${highlightText(loc, query)}</span>
            </div>`
        ).join('');

        dropdown.classList.add('active');
        activeIndex = -1;

        // Click handlers
        dropdown.querySelectorAll('.ac-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent blur
                const idx = parseInt(item.dataset.index);
                inputElement.value = currentMatches[idx];
                dropdown.classList.remove('active');
                inputElement.focus();
            });
        });
    }

    function updateActiveItem() {
        dropdown.querySelectorAll('.ac-item').forEach((item, i) => {
            item.classList.toggle('ac-active', i === activeIndex);
        });

        // Scroll active item into view
        const activeEl = dropdown.querySelector('.ac-item.ac-active');
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest' });
        }
    }

    inputElement.addEventListener('input', () => {
        showSuggestions();
    });

    inputElement.addEventListener('focus', () => {
        if (inputElement.value.trim().length >= 1) {
            showSuggestions();
        }
    });

    inputElement.addEventListener('blur', () => {
        // Small delay to allow click events on dropdown items
        setTimeout(() => {
            dropdown.classList.remove('active');
        }, 150);
    });

    inputElement.addEventListener('keydown', (e) => {
        if (!dropdown.classList.contains('active')) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentMatches.length > 0) {
                activeIndex = (activeIndex + 1) % currentMatches.length;
                updateActiveItem();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentMatches.length > 0) {
                activeIndex = activeIndex <= 0 ? currentMatches.length - 1 : activeIndex - 1;
                updateActiveItem();
            }
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0 && activeIndex < currentMatches.length) {
                e.preventDefault();
                inputElement.value = currentMatches[activeIndex];
                dropdown.classList.remove('active');
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('active');
        }
    });
}

// --- INVALIDATE LOCATION CACHE ON SAVE ---
function invalidateLocationCache() {
    _locationCacheData = null;
    _locationCacheTimestamp = 0;
}


// ============================================================
//  WIRE UP: PATCH EXISTING ADD BUTTONS & SAVE HANDLERS
// ============================================================

// --- HIRE-TO-PAY RECORDS: Auto-fill job number on add ---
(function patchHireRecordAdd() {
    const addBtn = document.getElementById('addHireRecordBtn');
    if (!addBtn) return;

    // We need to wrap the existing click handler
    const origClick = addBtn.onclick;
    addBtn.addEventListener('click', async () => {
        // Wait a tick for the original handler to open the form
        await new Promise(r => setTimeout(r, 50));

        const formContainer = document.getElementById('hireRecordFormContainer');
        if (formContainer && formContainer.style.display !== 'none') {
            const recordId = document.getElementById('hireRecordId')?.value;
            // Only auto-fill for new records, not edits
            if (!recordId) {
                const nextJob = await getNextJobNumber('hire');
                const jobInput = document.getElementById('jobNumber');
                if (jobInput && nextJob) {
                    jobInput.value = nextJob;
                }
            }
        }
    });
})();

// --- COMMITMENT RECORDS: Auto-fill job number on add ---
(function patchCommitmentRecordAdd() {
    const addBtn = document.getElementById('addCommitmentRecordBtn');
    if (!addBtn) return;

    addBtn.addEventListener('click', async () => {
        await new Promise(r => setTimeout(r, 50));

        const formContainer = document.getElementById('commitmentRecordFormContainer');
        if (formContainer && formContainer.style.display !== 'none') {
            const recordId = document.getElementById('commitmentRecordId')?.value;
            if (!recordId) {
                const nextJob = await getNextJobNumber('commitment');
                const jobInput = document.getElementById('commitmentJobNumber');
                if (jobInput && nextJob) {
                    jobInput.value = nextJob;
                }
            }
        }
    });
})();


// --- INITIALIZE LOCATION AUTOCOMPLETE ON ALL FROM/TO INPUTS ---
(function initAllLocationAutocompletes() {
    // Wait for DOM to be ready
    const init = () => {
        // Hire-to-Pay Records
        initLocationAutocomplete(document.getElementById('hireFrom'));
        initLocationAutocomplete(document.getElementById('hireTo'));

        // Commitment Records
        initLocationAutocomplete(document.getElementById('commitmentFrom'));
        initLocationAutocomplete(document.getElementById('commitmentTo'));

        // Other Operation Hires
        initLocationAutocomplete(document.getElementById('otherOpFrom'));
        initLocationAutocomplete(document.getElementById('otherOpTo'));
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Close autocomplete dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.location-autocomplete-wrapper')) {
        document.querySelectorAll('.location-autocomplete-dropdown.active').forEach(d => {
            d.classList.remove('active');
        });
    }
});

