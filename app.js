// app.js - FIXED: Renamed 'supabase' to 'supabaseClient' to fix SyntaxError
// Includes: Admin ID, Role-Based Access, Photo Features, Vehicle Models, Receipt Uploads, New Dashboard Stats & Vehicle Termination Logic

// Supabase Configuration
const SUPABASE_URL = 'https://slmqjqkpgdhrdcoempdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbXFqcWtwZ2RocmRjb2VtcGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3OTg4NzUsImV4cCI6MjA3NjM3NDg3NX0.mXDMuhn0K5sOKhwykhf9OcomUzSVkCGnN5jr60A-TSw';

let supabaseClient = null; // Renamed variable to avoid conflict
let currentUser = null;
let userRole = null; // 'admin' or 'viewer'
let adminUserId = null; // Store the admin user ID for data filtering
let currentPage = 'dashboard';

// Initialize Supabase
function initSupabase() {
    if (window.supabase) {
        // Use the global window.supabase to create our client
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
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
            loadDashboard();
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
            loadDashboard();
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
        showLogin();
    });
}

// Set Default Months
function setDefaultMonths() {
    const now = new Date();
    const monthStr = now.toISOString().substring(0, 7);
    
    const elements = [
        'dashboardMonth',
        'hireRecordsMonth',
        'commitmentRecordsMonth',
        'dayOffMonth',
        'advanceMonth'
    ];
    
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = monthStr;
    });
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

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        currentPage = item.dataset.page;
        switchPage(currentPage);
        closeMobileMenu();
    });
});

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(page);
    if (pageEl) pageEl.classList.add('active');
    
    const titles = {
        'dashboard': 'Dashboard',
        'drivers': 'Manage Drivers',
        'driver-advances': 'Driver Salary Advances',
        'hire-vehicles': 'Hire-to-Pay Vehicles',
        'hire-records': 'Hire-to-Pay Records',
        'commitment-vehicles': 'Commitment Vehicles',
        'commitment-records': 'Commitment Vehicle Hires',
        'commitment-dayoffs': 'Day Offs'
    };
    
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';
    
    if (page === 'dashboard') loadDashboard();
    if (page === 'drivers') loadDrivers();
    if (page === 'driver-advances') loadDriverAdvances();
    if (page === 'hire-vehicles') loadHireVehicles();
    if (page === 'hire-records') loadHireRecords();
    if (page === 'commitment-vehicles') loadCommitmentVehicles();
    if (page === 'commitment-records') loadCommitmentRecords();
    if (page === 'commitment-dayoffs') loadDayOffs();
}

// ============ DASHBOARD ============
async function loadDashboard() {
    try {
        let monthValue = document.getElementById('dashboardMonth')?.value;
        if (!monthValue) {
            const now = new Date();
            monthValue = now.toISOString().substring(0, 7);
            const dashboardMonthEl = document.getElementById('dashboardMonth');
            if (dashboardMonthEl) dashboardMonthEl.value = monthValue;
        }

        await loadDashboardData(monthValue);
        await loadVehiclePerformance(monthValue); 
        await loadDashboardCharts();
        
        // NEW DASHBOARD FUNCTIONS
        await loadAllTimeStatistics();
        await loadFleetOverview();
        await loadTopPerformingVehicles();
    } catch (error) {
        console.error('Error loading dashboard:', error.message);
    }
}

document.getElementById('dashboardMonth')?.addEventListener('change', loadDashboard);

let revenueChart = null;
let profitChart = null;
let fuelCostChart = null;
let revenueBreakdownChart = null;
let vehicleRevenueChart = null;

// ============ DRIVERS ============
document.getElementById('addDriverBtn')?.addEventListener('click', () => {
    if (!checkAdminAccess('add')) return;
    document.getElementById('driverForm').reset();
    document.getElementById('driverId').value = '';
    document.getElementById('driverFormContainer').style.display = 'block';
});

document.getElementById('cancelDriverBtn')?.addEventListener('click', () => {
    document.getElementById('driverFormContainer').style.display = 'none';
});

// Driver Form Submit
document.getElementById('driverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;

    const id = document.getElementById('driverId').value;
    const data = {
        name: document.getElementById('driverName').value,
        contact: document.getElementById('driverContact').value,
        license_number: document.getElementById('driverLicense').value,
        age: parseInt(document.getElementById('driverAge').value),
        address: document.getElementById('driverAddress').value,
        photo_url: document.getElementById('driverPhoto').value || null,
        basic_salary: parseFloat(document.getElementById('driverBasicSalary').value) || null,
        km_limit: parseFloat(document.getElementById('driverKmLimit').value) || null,
        extra_km_rate: parseFloat(document.getElementById('driverExtraKmRate').value) || null,
        user_id: adminUserId
    };

    try {
        if (id) {
            await supabaseClient.from('drivers').update(data).eq('id', id);
        } else {
            await supabaseClient.from('drivers').insert([data]);
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
        const { data, error } = await supabaseClient
            .from('drivers')
            .select('*')
            .eq('user_id', getQueryUserId())
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.querySelector('#driversTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
             tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #7F8C8D;">No drivers found</td></tr>';
             return;
        }

        data.forEach(driver => {
            const row = document.createElement('tr');
            const actionButtons = userRole === 'viewer' ? '' : `
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editDriver(${driver.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteDriver(${driver.id})">Delete</button>
                </td>
            `;

            const photoHTML = driver.photo_url ? 
                `<img src="${driver.photo_url}" 
                      alt="${driver.name}" 
                      class="profile-photo" 
                      onclick="openPhotoLightbox('${driver.photo_url}')"
                      onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'no-photo\\'>📷</div>';">` : 
                `<div class="no-photo">📷</div>`;

            row.innerHTML = `
                <td>${photoHTML}</td>
                <td>${driver.name}</td>
                <td>${driver.contact}</td>
                <td>${driver.license_number}</td>
                <td>${driver.age}</td>
                <td>${driver.address}</td>
                <td>${driver.basic_salary ? 'LKR ' + driver.basic_salary.toFixed(2) : '-'}</td>
                <td>${driver.km_limit ? driver.km_limit + ' km' : '-'}</td>
                <td>${driver.extra_km_rate ? 'LKR ' + driver.extra_km_rate.toFixed(2) : '-'}</td>
                ${actionButtons}
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading drivers:', error.message);
    }
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
        document.getElementById('driverLicense').value = data.license_number;
        document.getElementById('driverAge').value = data.age;
        document.getElementById('driverAddress').value = data.address;
        document.getElementById('driverPhoto').value = data.photo_url || '';
        document.getElementById('driverBasicSalary').value = data.basic_salary || '';
        document.getElementById('driverKmLimit').value = data.km_limit || '';
        document.getElementById('driverExtraKmRate').value = data.extra_km_rate || '';
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

    const id = document.getElementById('hireVehicleId').value;
    const data = {
        lorry_number: document.getElementById('lorryNumber').value,
        vehicle_model: document.getElementById('hireVehicleModel').value,
        length: parseFloat(document.getElementById('lorryLength').value),
        photo_url: document.getElementById('hireVehiclePhoto').value || null,
        price_0_100km: parseFloat(document.getElementById('price0To100').value),
        price_100_250km: parseFloat(document.getElementById('price100To250').value),
        price_250km_plus: parseFloat(document.getElementById('price250Plus').value),
        loading_charge: parseFloat(document.getElementById('loadingCharge').value),
        waiting_charge_24hrs: parseFloat(document.getElementById('waitingCharge24').value),
        waiting_charge_extra: parseFloat(document.getElementById('waitingChargeExtra').value),
        minimum_hire_amount: parseFloat(document.getElementById('minimumHireAmount').value),
        ownership: document.getElementById('ownership').value,
        terminated: document.getElementById('hireVehicleTerminated') ? document.getElementById('hireVehicleTerminated').checked : false, // NEW
        user_id: adminUserId
    };

    try {
        if (id) {
            await supabaseClient.from('hire_to_pay_vehicles').update(data).eq('id', id);
        } else {
            await supabaseClient.from('hire_to_pay_vehicles').insert([data]);
        }
        loadHireVehicles();
        document.getElementById('hireVehicleFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving vehicle: ' + error.message);
    }
});

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

        data.forEach(vehicle => {
            const row = document.createElement('tr');
            
            // Add visual styling for terminated vehicles
            if (vehicle.terminated) {
                row.style.backgroundColor = '#FADBD8';
                row.style.opacity = '0.7';
            }

            const actionButtons = userRole === 'viewer' ? '' : `
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editHireVehicle(${vehicle.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteHireVehicle(${vehicle.id})">Delete</button>
                </td>
            `;

            const photoHTML = vehicle.photo_url ? 
                `<img src="${vehicle.photo_url}" 
                      alt="${vehicle.lorry_number}" 
                      class="vehicle-photo" 
                      onclick="openPhotoLightbox('${vehicle.photo_url}')"
                      onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'no-vehicle-photo\\'>🚚</div>';">` : 
                `<div class="no-vehicle-photo">🚚</div>`;

            const statusBadge = vehicle.terminated
                ? `<span style="background: #E74C3C; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">TERMINATED</span>`
                : `<span style="background: #27AE60; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">ACTIVE</span>`;

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
            tbody.appendChild(row);
        });
        
        updateVehicleSelectors();
    } catch (error) {
        console.error('Error loading vehicles:', error.message);
    }
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
        document.getElementById('price0To100').value = data.price_0_100km;
        document.getElementById('price100To250').value = data.price_100_250km;
        document.getElementById('price250Plus').value = data.price_250km_plus;
        document.getElementById('loadingCharge').value = data.loading_charge;
        document.getElementById('waitingCharge24').value = data.waiting_charge_24hrs;
        document.getElementById('waitingChargeExtra').value = data.waiting_charge_extra;
        document.getElementById('minimumHireAmount').value = data.minimum_hire_amount;
        document.getElementById('ownership').value = data.ownership;
        if(document.getElementById('hireVehicleTerminated')) {
            document.getElementById('hireVehicleTerminated').checked = data.terminated || false; // NEW
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
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
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
        const { data: hireVehicles } = await supabaseClient
            .from('hire_to_pay_vehicles')
            .select('id, lorry_number, ownership')
            .eq('user_id', getQueryUserId());

        const filterSelect = document.getElementById('hireRecordsVehicleFilter');
        if (!filterSelect) return;
        
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Vehicles</option>';
        
        hireVehicles?.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = `${v.lorry_number} (${v.ownership})`;
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

    const id = document.getElementById('commitmentVehicleId').value;
    const data = {
        vehicle_number: document.getElementById('commitmentVehicleNumber').value,
        vehicle_model: document.getElementById('commitmentVehicleModel').value,
        fixed_monthly_payment: parseFloat(document.getElementById('fixedPayment').value),
        photo_url: document.getElementById('commitmentVehiclePhoto').value || null,
        km_limit_per_month: parseFloat(document.getElementById('kmLimit').value),
        extra_km_charge: parseFloat(document.getElementById('extraKmCharge').value),
        loading_charge: parseFloat(document.getElementById('commitmentLoadingCharge').value),
        terminated: document.getElementById('commitmentVehicleTerminated') ? document.getElementById('commitmentVehicleTerminated').checked : false, // NEW
        user_id: adminUserId
    };

    try {
        if (id) {
            await supabaseClient.from('commitment_vehicles').update(data).eq('id', id);
        } else {
            await supabaseClient.from('commitment_vehicles').insert([data]);
        }
        loadCommitmentVehicles();
        document.getElementById('commitmentVehicleFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving commitment vehicle: ' + error.message);
    }
});

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
        
        data.forEach(vehicle => {
            const row = document.createElement('tr');
            
            // Add visual styling for terminated vehicles
            if (vehicle.terminated) {
                row.style.backgroundColor = '#FADBD8';
                row.style.opacity = '0.7';
            }

            const actionButtons = userRole === 'viewer' ? '' : `
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editCommitmentVehicle(${vehicle.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteCommitmentVehicle(${vehicle.id})">Delete</button>
                </td>
            `;

            const photoHTML = vehicle.photo_url ? 
                `<img src="${vehicle.photo_url}" 
                      alt="${vehicle.vehicle_number}" 
                      class="vehicle-photo" 
                      onclick="openPhotoLightbox('${vehicle.photo_url}')"
                      onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'no-vehicle-photo\\'>🚛</div>';">` : 
                `<div class="no-vehicle-photo">🚛</div>`;
            
            const statusBadge = vehicle.terminated
                ? `<span style="background: #E74C3C; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">TERMINATED</span>`
                : `<span style="background: #27AE60; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">ACTIVE</span>`;

            row.innerHTML = `
                <td>${photoHTML}</td>
                <td>${vehicle.vehicle_number}<br>${statusBadge}</td>
                <td>${vehicle.vehicle_model || '-'}</td>
                <td>LKR ${vehicle.fixed_monthly_payment}</td>
                <td>${vehicle.km_limit_per_month} km</td>
                <td>LKR ${vehicle.extra_km_charge}/km</td>
                <td>LKR ${vehicle.loading_charge}</td>
                ${actionButtons}
            `;
            tbody.appendChild(row);
        });
        
        updateVehicleSelectors();
    } catch (error) {
        console.error('Error loading commitment vehicles:', error.message);
    }
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
        document.getElementById('kmLimit').value = data.km_limit_per_month;
        document.getElementById('extraKmCharge').value = data.extra_km_charge;
        document.getElementById('commitmentLoadingCharge').value = data.loading_charge;
        if(document.getElementById('commitmentVehicleTerminated')) {
            document.getElementById('commitmentVehicleTerminated').checked = data.terminated || false; // NEW
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

    const id = document.getElementById('commitmentRecordId').value;
    const fuelLitres = parseFloat(document.getElementById('commitmentFuel').value);
    const fuelPrice = parseFloat(document.getElementById('commitmentFuelPrice').value);
    const fuelCost = fuelLitres * fuelPrice;
    const distance = parseFloat(document.getElementById('commitmentDistance').value);
    const vehicleId = parseInt(document.getElementById('commitmentVehicleSelect').value);
    const hireDate = document.getElementById('commitmentDate').value;
    const extraChargesInput = parseFloat(document.getElementById('commitmentExtraCharges').value) || 0;

    try {
        const { data: vehicleData, error: vehicleError } = await supabaseClient
            .from('commitment_vehicles')
            .select('*')
            .eq('id', vehicleId)
            .single();
        
        if (vehicleError) throw vehicleError;

        const [year, month] = hireDate.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        let query = supabaseClient
            .from('commitment_records')
            .select('distance')
            .eq('vehicle_id', vehicleId)
            .gte('hire_date', startDate)
            .lte('hire_date', endDate);
        
        if (id) {
            query = query.neq('id', id);
        }

        const { data: existingRecords } = await query;

        let totalMonthlyKm = distance;
        if (existingRecords) {
            totalMonthlyKm += existingRecords.reduce((sum, r) => sum + r.distance, 0);
        }

        let extraKmCharge = 0;
        if (totalMonthlyKm > vehicleData.km_limit_per_month) {
            const extraKm = totalMonthlyKm - vehicleData.km_limit_per_month;
            extraKmCharge = extraKm * vehicleData.extra_km_charge;
        }

        const totalExtraCharges = extraChargesInput + extraKmCharge;

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
            extra_charges: totalExtraCharges,
            user_id: adminUserId
        };

        if (id) {
            await supabaseClient.from('commitment_records').update(recordData).eq('id', id);
        } else {
            await supabaseClient.from('commitment_records').insert([recordData]);
        }
        
        loadCommitmentRecords();
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
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
            query = query.gte('hire_date', startDate).lte('hire_date', endDate);
        }

        if (vehicleFilter) {
            query = query.eq('vehicle_id', vehicleFilter);
        }

        const { data, error } = await query.order('hire_date', { ascending: true });
        if (error) throw error;

        const tbody = document.querySelector('#commitmentRecordsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const vehicleGroups = {};
        if (monthValue) {
            data.forEach(record => {
                if (!vehicleGroups[record.vehicle_id]) {
                    vehicleGroups[record.vehicle_id] = [];
                }
                vehicleGroups[record.vehicle_id].push(record);
            });
        }

        data.forEach(record => {
            const row = document.createElement('tr');
            
            let totalMonthlyKm = record.distance;
            let extraKmCharge = 0;
            
            if (vehicleGroups[record.vehicle_id]) {
                totalMonthlyKm = vehicleGroups[record.vehicle_id].reduce((sum, r) => sum + r.distance, 0);
                if (totalMonthlyKm > record.commitment_vehicles.km_limit_per_month) {
                    const extraKm = totalMonthlyKm - record.commitment_vehicles.km_limit_per_month;
                    extraKmCharge = extraKm * record.commitment_vehicles.extra_km_charge;
                }
            }

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
                <td><small>Monthly KM: ${totalMonthlyKm} / ${record.commitment_vehicles.km_limit_per_month}<br>Extra KM: ${(totalMonthlyKm > record.commitment_vehicles.km_limit_per_month ? totalMonthlyKm - record.commitment_vehicles.km_limit_per_month : 0).toFixed(2)}<br>Extra Charge: LKR ${record.extra_charges.toFixed(2)}</small></td>
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
        const { data: commitmentVehicles } = await supabaseClient
            .from('commitment_vehicles')
            .select('id, vehicle_number')
            .eq('user_id', getQueryUserId());

        const filterSelect = document.getElementById('commitmentRecordsVehicleFilter');
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
        document.getElementById('commitmentExtraCharges').value = data.extra_charges;
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
            await supabaseClient.from('commitment_day_offs').update(dayOffData).eq('id', id);
        } else {
            await supabaseClient.from('commitment_day_offs').insert([dayOffData]);
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
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
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
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        const currentQueryUserId = getQueryUserId();

        const { data: hireRecords } = await supabaseClient
            .from('hire_to_pay_records')
            .select('*')
            .eq('user_id', currentQueryUserId)
            .gte('hire_date', startDate)
            .lte('hire_date', endDate);

        const { data: commitmentRecords } = await supabaseClient
            .from('commitment_records')
            .select('*')
            .eq('user_id', currentQueryUserId)
            .gte('hire_date', startDate)
            .lte('hire_date', endDate);

        const { data: dayOffs } = await supabaseClient
            .from('commitment_day_offs')
            .select('*')
            .eq('user_id', currentQueryUserId)
            .gte('day_off_date', startDate)
            .lte('day_off_date', endDate);

        const commitmentVehicleIds = new Set();
        commitmentRecords?.forEach(record => {
            commitmentVehicleIds.add(record.vehicle_id);
        });

        const { data: commitmentVehicles } = await supabaseClient
            .from('commitment_vehicles')
            .select('*')
            .eq('user_id', currentQueryUserId)
            .in(
                'id',
                Array.from(commitmentVehicleIds).length > 0
                    ? Array.from(commitmentVehicleIds)
                    : [0]
            );

        let totalRevenue = 0;
        let totalFuelCost = 0;
        let totalHires = 0;

        hireRecords?.forEach(record => {
            totalRevenue += record.hire_amount || 0;
            totalFuelCost += record.fuel_cost || 0;
            totalHires++;
        });

        const commitmentPayment =
            commitmentVehicles?.reduce((sum, v) => sum + (v.fixed_monthly_payment || 0), 0) || 0;
        const dayOffDeductions =
            dayOffs?.reduce((sum, d) => sum + (d.deduction_amount || 0), 0) || 0;
        const commitmentFuelCost =
            commitmentRecords?.reduce((sum, r) => sum + (r.fuel_cost || 0), 0) || 0;
        const extraKmCharges =
            commitmentRecords?.reduce((sum, r) => sum + (r.extra_charges || 0), 0) || 0;

        totalRevenue += commitmentPayment - dayOffDeductions + extraKmCharges;
        totalFuelCost += commitmentFuelCost;
        totalHires += commitmentRecords?.length || 0;

        const netProfit = totalRevenue - totalFuelCost;

        const revEl = document.getElementById('totalRevenue');
        const fuelEl = document.getElementById('fuelCost');
        const hiresEl = document.getElementById('totalHires');
        const profitEl = document.getElementById('netProfit');

        if (revEl) revEl.textContent = `LKR ${totalRevenue.toFixed(2)}`;
        if (fuelEl) fuelEl.textContent = `LKR ${totalFuelCost.toFixed(2)}`;
        if (hiresEl) hiresEl.textContent = totalHires;
        if (profitEl) profitEl.textContent = `LKR ${netProfit.toFixed(2)}`;

        if (typeof loadVehicleRevenueChart === 'function') {
             await loadVehicleRevenueChart(monthValue);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error.message);
    }
}

// ============ DASHBOARD FUNCTIONS ============
async function loadVehiclePerformance(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        const currentQueryUserId = getQueryUserId();

        const { data: hireVehicles } = await supabaseClient
            .from('hire_to_pay_vehicles')
            .select('*')
            .eq('user_id', currentQueryUserId);

        const { data: commitmentRecordsMonth } = await supabaseClient
            .from('commitment_records')
            .select('vehicle_id')
            .eq('user_id', currentQueryUserId)
            .gte('hire_date', startDate)
            .lte('hire_date', endDate);

        // Get hire vehicles with at least one record this month
        const vehiclesWithData = [];

        // Check hire-to-pay vehicles
        for (const vehicle of hireVehicles) {
            const { data: records } = await supabaseClient
                .from('hire_to_pay_records')
                .select('*')
                .eq('vehicle_id', vehicle.id)
                .gte('hire_date', startDate)
                .lte('hire_date', endDate);

            // Only include if there's at least one hire record
            if (records && records.length > 0) {
                const totalKm = records.reduce((sum, r) => sum + r.distance, 0);
                const totalRevenue = records.reduce((sum, r) => sum + r.hire_amount, 0);
                const totalFuel = records.reduce((sum, r) => sum + r.fuel_cost, 0);
                const profit = totalRevenue - totalFuel;
                const ownershipLabel = vehicle.ownership === 'company' ? '🏢 Company' : '🚛 Rented';

                vehiclesWithData.push({
                    type: 'Hire-to-Pay',
                    number: vehicle.lorry_number,
                    model: vehicle.vehicle_model || '-',
                    ownership: ownershipLabel,
                    totalKm,
                    totalRevenue,
                    totalFuel,
                    profit,
                    recordsCount: records.length
                });
            }
        }

        // Check commitment vehicles with hires this month
        const commitmentVehicleIdsWithHires = new Set();
        commitmentRecordsMonth?.forEach(record => {
            commitmentVehicleIdsWithHires.add(record.vehicle_id);
        });

        if (commitmentVehicleIdsWithHires.size > 0) {
            const { data: commitmentVehicles } = await supabaseClient
                .from('commitment_vehicles')
                .select('*')
                .eq('user_id', currentQueryUserId)
                .in('id', Array.from(commitmentVehicleIdsWithHires));

            for (const vehicle of commitmentVehicles || []) {
                const { data: records } = await supabaseClient
                    .from('commitment_records')
                    .select('*')
                    .eq('vehicle_id', vehicle.id)
                    .gte('hire_date', startDate)
                    .lte('hire_date', endDate);

                const { data: dayOffs } = await supabaseClient
                    .from('commitment_day_offs')
                    .select('*')
                    .eq('vehicle_id', vehicle.id)
                    .gte('day_off_date', startDate)
                    .lte('day_off_date', endDate);

                // Only include if there's at least one commitment record
                if (records && records.length > 0) {
                    const totalKm = records.reduce((sum, r) => sum + r.distance, 0) || 0;
                    const basePay = vehicle.fixed_monthly_payment;
                    const dayOffDeductions = dayOffs?.reduce((sum, d) => sum + d.deduction_amount, 0) || 0;
                    const extraKmCharges = records.reduce((sum, r) => sum + r.extra_charges, 0) || 0;
                    const totalRevenue = basePay - dayOffDeductions + extraKmCharges;
                    const totalFuel = records.reduce((sum, r) => sum + r.fuel_cost, 0) || 0;
                    const profit = totalRevenue - totalFuel;

                    vehiclesWithData.push({
                        type: 'Commitment',
                        number: vehicle.vehicle_number,
                        model: vehicle.vehicle_model || '-',
                        ownership: '-',
                        totalKm,
                        totalRevenue,
                        totalFuel,
                        profit,
                        recordsCount: records.length
                    });
                }
            }
        }

        // Sort by profit (highest first)
        vehiclesWithData.sort((a, b) => b.profit - a.profit);

        // Generate HTML
        let performanceHtml = '';
        
        if (vehiclesWithData.length === 0) {
            performanceHtml = `
                <div style="text-align: center; padding: 40px; color: #7F8C8D; background: #F8F9FA; border-radius: 10px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
                    <h3 style="margin-bottom: 10px;">No Vehicle Activity This Month</h3>
                    <p>No hires recorded for any vehicle in ${monthValue}.</p>
                </div>
            `;
        } else {
            performanceHtml = `
                <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background: #DC143C; color: white;">
                            <th style="padding: 12px; text-align: left;">Vehicle</th>
                            <th style="padding: 12px; text-align: left;">Type</th>
                            <th style="padding: 12px; text-align: left;">Model</th>
                            <th style="padding: 12px; text-align: left;">Ownership</th>
                            <th style="padding: 12px; text-align: left;">Total KM</th>
                            <th style="padding: 12px; text-align: left;">Hires</th>
                            <th style="padding: 12px; text-align: left;">Total Revenue</th>
                            <th style="padding: 12px; text-align: left;">Fuel Cost</th>
                            <th style="padding: 12px; text-align: left;">Profit</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            vehiclesWithData.forEach(vehicle => {
                const profitColor = vehicle.profit >= 0 ? '#27AE60' : '#E74C3C';
                
                performanceHtml += `
                    <tr style="border-bottom: 1px solid #ECF0F1; background: ${vehicle.recordsCount > 0 ? '#FFF' : '#F9F9F9'};">
                        <td style="padding: 12px; font-weight: bold;">${vehicle.number}</td>
                        <td style="padding: 12px;">${vehicle.type}</td>
                        <td style="padding: 12px;">${vehicle.model}</td>
                        <td style="padding: 12px;">${vehicle.ownership}</td>
                        <td style="padding: 12px; text-align: right;">${vehicle.totalKm.toFixed(0)} km</td>
                        <td style="padding: 12px; text-align: center;">
                            <span style="background: #3498db; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                ${vehicle.recordsCount}
                            </span>
                        </td>
                        <td style="padding: 12px; text-align: right;">LKR ${vehicle.totalRevenue.toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right;">LKR ${vehicle.totalFuel.toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; color: ${profitColor}; font-weight: bold;">
                            LKR ${vehicle.profit.toFixed(2)}
                        </td>
                    </tr>
                `;
            });

            performanceHtml += `
                    </tbody>
                </table>
                <div style="margin-top: 15px; font-size: 12px; color: #7F8C8D; text-align: center;">
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
            <div style="text-align: center; padding: 20px; color: #E74C3C;">
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
            .eq('terminated', false); // NEW: Only show active vehicles

        const { data: commitmentVehicles } = await supabaseClient
            .from('commitment_vehicles')
            .select('id, vehicle_number, terminated')
            .eq('user_id', currentQueryUserId)
            .eq('terminated', false); // NEW: Only show active vehicles

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
        const fuelCosts = [];
        let totalRevenue6M = 0;
        let totalProfit6M = 0;
        let totalHires6M = 0;

        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            
            const startDate = `${year}-${month}-01`;
            const endDate = new Date(year, date.getMonth() + 1, 0).toISOString().split('T')[0];

            const { data: hireRecords } = await supabaseClient
                .from('hire_to_pay_records')
                .select('*')
                .eq('user_id', currentQueryUserId)
                .gte('hire_date', startDate)
                .lte('hire_date', endDate);

            const { data: commitmentRecords } = await supabaseClient
                .from('commitment_records')
                .select('*')
                .eq('user_id', currentQueryUserId)
                .gte('hire_date', startDate)
                .lte('hire_date', endDate);

            const { data: dayOffs } = await supabaseClient
                .from('commitment_day_offs')
                .select('*')
                .eq('user_id', currentQueryUserId)
                .gte('day_off_date', startDate)
                .lte('day_off_date', endDate);

            const commitmentVehicleIds = new Set();
            commitmentRecords?.forEach(record => {
                commitmentVehicleIds.add(record.vehicle_id);
            });

            const { data: commitmentVehicles } = await supabaseClient
                .from('commitment_vehicles')
                .select('*')
                .eq('user_id', currentQueryUserId)
                .in('id', Array.from(commitmentVehicleIds).length > 0 ? Array.from(commitmentVehicleIds) : [0]);

            let monthRevenue = 0;
            let monthFuelCost = 0;

            hireRecords?.forEach(record => {
                monthRevenue += record.hire_amount;
                monthFuelCost += record.fuel_cost;
            });

            const commitmentPayment = commitmentVehicles?.reduce((sum, v) => sum + v.fixed_monthly_payment, 0) || 0;
            const dayOffDeductions = dayOffs?.reduce((sum, d) => sum + d.deduction_amount, 0) || 0;
            const commitmentFuelCost = commitmentRecords?.reduce((sum, r) => sum + r.fuel_cost, 0) || 0;
            const extraKmCharges = commitmentRecords?.reduce((sum, r) => sum + r.extra_charges, 0) || 0;

            monthRevenue += (commitmentPayment - dayOffDeductions + extraKmCharges);
            monthFuelCost += commitmentFuelCost;

            const monthProfit = monthRevenue - monthFuelCost;

            months.push(monthLabel);
            revenues.push(monthRevenue);
            profits.push(monthProfit);
            fuelCosts.push(monthFuelCost);
            totalRevenue6M += monthRevenue;
            totalProfit6M += monthProfit;
            totalHires6M += (hireRecords?.length || 0) + (commitmentRecords?.length || 0);
        }

        const avgRevenue = totalRevenue6M / 6;
        const avgProfit = totalProfit6M / 6;
        const profitMargin = totalRevenue6M > 0 ? ((totalProfit6M / totalRevenue6M) * 100) : 0;

        document.getElementById('avgRevenue').textContent = `LKR ${avgRevenue.toFixed(2)}`;
        document.getElementById('avgProfit').textContent = `LKR ${avgProfit.toFixed(2)}`;
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
                        backgroundColor: 'rgba(220, 20, 60, 0.1)',
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
                    maintainAspectRatio: true,
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
                        label: 'Monthly Profit',
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
                    maintainAspectRatio: true,
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
                    maintainAspectRatio: true,
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
            const currentRevenue = revenues[revenues.length - 1];
            const currentFuel = fuelCosts[fuelCosts.length - 1];
            const currentProfit = profits[profits.length - 1];

            revenueBreakdownChart = new Chart(breakdownCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Profit', 'Fuel Cost'],
                    datasets: [{
                        data: [currentProfit, currentFuel],
                        backgroundColor: ['#27AE60', '#E67E22'],
                        borderColor: ['#fff', '#fff'],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'bottom' }
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
        
        const { data: allHireRecords } = await supabaseClient
            .from('hire_to_pay_records')
            .select('*')
            .eq('user_id', currentQueryUserId);

        const { data: allCommitmentRecords } = await supabaseClient
            .from('commitment_records')
            .select('*')
            .eq('user_id', currentQueryUserId);

        const { data: allCommitmentVehicles } = await supabaseClient
            .from('commitment_vehicles')
            .select('*')
            .eq('user_id', currentQueryUserId);

        const { data: allDayOffs } = await supabaseClient
            .from('commitment_day_offs')
            .select('*')
            .eq('user_id', currentQueryUserId);

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

        // Add extra KM charges
        const extraKmCharges = allCommitmentRecords?.reduce((sum, r) => sum + (r.extra_charges || 0), 0) || 0;
        totalRevenue += extraKmCharges;

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

        const { data: hireVehicles } = await supabaseClient
            .from('hire_to_pay_vehicles')
            .select('id')
            .eq('user_id', currentQueryUserId);

        const { data: commitmentVehicles } = await supabaseClient
            .from('commitment_vehicles')
            .select('id')
            .eq('user_id', currentQueryUserId);

        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id')
            .eq('user_id', currentQueryUserId);

        const hireCount = hireVehicles?.length || 0;
        const commitmentCount = commitmentVehicles?.length || 0;
        const totalVehicles = hireCount + commitmentCount;
        const driverCount = drivers?.length || 0;

        document.getElementById('totalVehicles').textContent = totalVehicles;
        document.getElementById('hireVehicleCount').textContent = hireCount;
        document.getElementById('commitmentVehicleCount').textContent = commitmentCount;
        document.getElementById('totalDrivers').textContent = driverCount;
    } catch (error) {
        console.error('Error loading fleet overview:', error.message);
    }
}

// ============ TOP PERFORMING VEHICLES ============
async function loadTopPerformingVehicles() {
    try {
        const currentQueryUserId = getQueryUserId();
        
        // Get last 6 months date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Get all vehicles
        const { data: hireVehicles } = await supabaseClient
            .from('hire_to_pay_vehicles')
            .select('*')
            .eq('user_id', currentQueryUserId);

        const { data: commitmentVehicles } = await supabaseClient
            .from('commitment_vehicles')
            .select('*')
            .eq('user_id', currentQueryUserId);

        const vehiclePerformance = [];

        // Calculate performance for hire vehicles
        for (const vehicle of hireVehicles || []) {
            const { data: records } = await supabaseClient
                .from('hire_to_pay_records')
                .select('*')
                .eq('vehicle_id', vehicle.id)
                .gte('hire_date', startDateStr)
                .lte('hire_date', endDateStr);

            const totalRevenue = records?.reduce((sum, r) => sum + (r.hire_amount || 0), 0) || 0;
            const totalFuel = records?.reduce((sum, r) => sum + (r.fuel_cost || 0), 0) || 0;
            const profit = totalRevenue - totalFuel;
            const totalKm = records?.reduce((sum, r) => sum + (r.distance || 0), 0) || 0;
            const hireCount = records?.length || 0;

            if (totalRevenue > 0) {
                vehiclePerformance.push({
                    name: vehicle.lorry_number,
                    type: 'Hire-to-Pay',
                    revenue: totalRevenue,
                    profit: profit,
                    km: totalKm,
                    hires: hireCount,
                    profitMargin: totalRevenue > 0 ? (profit / totalRevenue * 100) : 0
                });
            }
        }

        // Calculate performance for commitment vehicles
        for (const vehicle of commitmentVehicles || []) {
            const { data: records } = await supabaseClient
                .from('commitment_records')
                .select('*')
                .eq('vehicle_id', vehicle.id)
                .gte('hire_date', startDateStr)
                .lte('hire_date', endDateStr);

            // Count unique months
            const months = new Set();
            records?.forEach(r => {
                months.add(r.hire_date.substring(0, 7));
            });

            const monthCount = months.size;
            const baseRevenue = vehicle.fixed_monthly_payment * monthCount;
            const extraCharges = records?.reduce((sum, r) => sum + (r.extra_charges || 0), 0) || 0;
            const totalFuel = records?.reduce((sum, r) => sum + (r.fuel_cost || 0), 0) || 0;
            const totalRevenue = baseRevenue + extraCharges;
            const profit = totalRevenue - totalFuel;
            const totalKm = records?.reduce((sum, r) => sum + (r.distance || 0), 0) || 0;
            const hireCount = records?.length || 0;

            if (totalRevenue > 0) {
                vehiclePerformance.push({
                    name: vehicle.vehicle_number,
                    type: 'Commitment',
                    revenue: totalRevenue,
                    profit: profit,
                    km: totalKm,
                    hires: hireCount,
                    profitMargin: totalRevenue > 0 ? (profit / totalRevenue * 100) : 0
                });
            }
        }

        // Sort by profit (highest first) and take top 5
        vehiclePerformance.sort((a, b) => b.profit - a.profit);
        const topVehicles = vehiclePerformance.slice(0, 5);

        const container = document.getElementById('topVehicles');
        if (!container) return;

        if (topVehicles.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7F8C8D; padding: 20px;">No vehicle data available for the last 6 months</p>';
            return;
        }

        container.innerHTML = topVehicles.map((vehicle, index) => {
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const typeIcon = vehicle.type === 'Hire-to-Pay' ? '🚚' : '🚛';
            
            return `
                <div class="top-vehicle-card">
                    <div class="rank-badge">${rankEmoji}</div>
                    <div class="vehicle-info">
                        <div class="vehicle-name">${typeIcon} ${vehicle.name}</div>
                        <div class="vehicle-type">${vehicle.type}</div>
                    </div>
                    <div class="vehicle-stats">
                        <div class="stat-item">
                            <span class="stat-label">Profit</span>
                            <span class="stat-value profit">LKR ${vehicle.profit.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Revenue</span>
                            <span class="stat-value">LKR ${vehicle.revenue.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Total KM</span>
                            <span class="stat-value">${vehicle.km.toFixed(0)} km</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Hires</span>
                            <span class="stat-value">${vehicle.hires}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Margin</span>
                            <span class="stat-value">${vehicle.profitMargin.toFixed(1)}%</span>
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
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
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
    } catch (error) {
        console.error('Error loading advances:', error.message);
    }
}

async function loadAdvanceSummary() {
    try {
        const currentQueryUserId = getQueryUserId();

        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id, name')
            .eq('user_id', currentQueryUserId);

        const { data: advances } = await supabaseClient
            .from('driver_advances')
            .select('driver_id, amount')
            .eq('user_id', currentQueryUserId);

        const advancesByDriver = {};
        advances?.forEach(adv => {
            if (!advancesByDriver[adv.driver_id]) {
                advancesByDriver[adv.driver_id] = 0;
            }
            advancesByDriver[adv.driver_id] += adv.amount;
        });

        const summaryEl = document.getElementById('advanceSummary');
        if (!summaryEl) return;
        summaryEl.innerHTML = '';

        if (drivers && drivers.length > 0) {
            drivers.forEach(driver => {
                const totalAdvance = advancesByDriver[driver.id] || 0;
                const card = document.createElement('div');
                card.className = 'advance-card';
                card.innerHTML = `
                    <div class="advance-card-icon">💰</div>
                    <div class="advance-card-content">
                        <div class="advance-card-name">${driver.name}</div>
                        <div class="advance-card-amount">LKR ${totalAdvance.toFixed(2)}</div>
                        <div class="advance-card-label">Total Advances</div>
                    </div>
                `;
                summaryEl.appendChild(card);
            });
        } else {
            summaryEl.innerHTML = '<p style="text-align: center; color: #7F8C8D; padding: 20px;">No drivers found. Add drivers first.</p>';
        }
    } catch (error) {
        console.error('Error loading advance summary:', error.message);
    }
}

async function updateAdvanceDriverSelectors() {
    try {
        const { data: drivers } = await supabaseClient
            .from('drivers')
            .select('id, name')
            .eq('user_id', getQueryUserId());

        const advanceDriverSelect = document.getElementById('advanceDriver');
        const filterSelect = document.getElementById('advanceDriverFilter');

        if (advanceDriverSelect) {
            advanceDriverSelect.innerHTML = '<option value="">Select Driver</option>';
            drivers?.forEach(d => {
                const option = document.createElement('option');
                option.value = d.id;
                option.textContent = d.name;
                advanceDriverSelect.appendChild(option);
            });
        }

        if (filterSelect) {
            const currentValue = filterSelect.value;
            filterSelect.innerHTML = '<option value="">All Drivers</option>';
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