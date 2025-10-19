// Supabase Configuration
const SUPABASE_URL = 'https://slmqjqkpgdhrdcoempdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbXFqcWtwZ2RocmRjb2VtcGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3OTg4NzUsImV4cCI6MjA3NjM3NDg3NX0.mXDMuhn0K5sOKhwykhf9OcomUzSVkCGnN5jr60A-TSw';

let supabase = null;
let currentUser = null;
let currentPage = 'dashboard';

// Initialize Supabase
function initSupabase() {
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
}

// Initialize App
async function initializeApp() {
    initSupabase();
    
    if (!supabase) {
        console.error('Supabase not initialized');
        showLogin();
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            showApp();
            loadDashboard();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Auth error:', error);
        showLogin();
    }
}

// Wait for DOM and Supabase script to load
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
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) throw error;
            
            currentUser = data.user;
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
        await supabase.auth.signOut();
        currentUser = null;
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
        'dayOffMonth'
    ];
    
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = monthStr;
    });
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        currentPage = item.dataset.page;
        switchPage(currentPage);
    });
});

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(page);
    if (pageEl) pageEl.classList.add('active');
    
    const titles = {
        'dashboard': 'Dashboard',
        'drivers': 'Manage Drivers',
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
    if (page === 'hire-vehicles') loadHireVehicles();
    if (page === 'hire-records') loadHireRecords();
    if (page === 'commitment-vehicles') loadCommitmentVehicles();
    if (page === 'commitment-records') loadCommitmentRecords();
    if (page === 'commitment-dayoffs') loadDayOffs();
}

// ============ DRIVERS ============
document.getElementById('addDriverBtn')?.addEventListener('click', () => {
    document.getElementById('driverForm').reset();
    document.getElementById('driverId').value = '';
    document.getElementById('driverFormContainer').style.display = 'block';
});

document.getElementById('cancelDriverBtn')?.addEventListener('click', () => {
    document.getElementById('driverFormContainer').style.display = 'none';
});

document.getElementById('driverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('driverId').value;
    const data = {
        name: document.getElementById('driverName').value,
        contact: document.getElementById('driverContact').value,
        license_number: document.getElementById('driverLicense').value,
        age: parseInt(document.getElementById('driverAge').value),
        address: document.getElementById('driverAddress').value,
        user_id: currentUser.id
    };

    try {
        if (id) {
            await supabase.from('drivers').update(data).eq('id', id);
        } else {
            await supabase.from('drivers').insert([data]);
        }
        loadDrivers();
        document.getElementById('driverFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving driver: ' + error.message);
    }
});

async function loadDrivers() {
    try {
        const { data, error } = await supabase
            .from('drivers')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.querySelector('#driversTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        data.forEach(driver => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${driver.name}</td>
                <td>${driver.contact}</td>
                <td>${driver.license_number}</td>
                <td>${driver.age}</td>
                <td>${driver.address}</td>
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editDriver(${driver.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteDriver(${driver.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading drivers:', error.message);
    }
}

async function editDriver(id) {
    try {
        const { data, error } = await supabase.from('drivers').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('driverId').value = data.id;
        document.getElementById('driverName').value = data.name;
        document.getElementById('driverContact').value = data.contact;
        document.getElementById('driverLicense').value = data.license_number;
        document.getElementById('driverAge').value = data.age;
        document.getElementById('driverAddress').value = data.address;
        document.getElementById('driverFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading driver: ' + error.message);
    }
}

async function deleteDriver(id) {
    if (confirm('Are you sure you want to delete this driver?')) {
        try {
            await supabase.from('drivers').delete().eq('id', id);
            loadDrivers();
        } catch (error) {
            alert('Error deleting driver: ' + error.message);
        }
    }
}

// ============ HIRE-TO-PAY VEHICLES ============
document.getElementById('addHireVehicleBtn')?.addEventListener('click', () => {
    document.getElementById('hireVehicleForm').reset();
    document.getElementById('hireVehicleId').value = '';
    document.getElementById('hireVehicleFormContainer').style.display = 'block';
});

document.getElementById('cancelHireVehicleBtn')?.addEventListener('click', () => {
    document.getElementById('hireVehicleFormContainer').style.display = 'none';
});

document.getElementById('hireVehicleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('hireVehicleId').value;
    const data = {
        lorry_number: document.getElementById('lorryNumber').value,
        length: parseFloat(document.getElementById('lorryLength').value),
        price_0_100km: parseFloat(document.getElementById('price0To100').value),
        price_100_250km: parseFloat(document.getElementById('price100To250').value),
        price_250km_plus: parseFloat(document.getElementById('price250Plus').value),
        loading_charge: parseFloat(document.getElementById('loadingCharge').value),
        waiting_charge_24hrs: parseFloat(document.getElementById('waitingCharge24').value),
        waiting_charge_extra: parseFloat(document.getElementById('waitingChargeExtra').value),
        minimum_hire_amount: parseFloat(document.getElementById('minimumHireAmount').value),
        ownership: document.getElementById('ownership').value,
        user_id: currentUser.id
    };

    try {
        if (id) {
            await supabase.from('hire_to_pay_vehicles').update(data).eq('id', id);
        } else {
            await supabase.from('hire_to_pay_vehicles').insert([data]);
        }
        loadHireVehicles();
        document.getElementById('hireVehicleFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving vehicle: ' + error.message);
    }
});

async function loadHireVehicles() {
    try {
        const { data, error } = await supabase
            .from('hire_to_pay_vehicles')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.querySelector('#hireVehiclesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        data.forEach(vehicle => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${vehicle.lorry_number}</td>
                <td>${vehicle.length}</td>
                <td>LKR ${vehicle.price_0_100km}</td>
                <td>LKR ${vehicle.price_100_250km}</td>
                <td>LKR ${vehicle.price_250km_plus}</td>
                <td>LKR ${vehicle.loading_charge}</td>
                <td>LKR ${vehicle.waiting_charge_24hrs}</td>
                <td>LKR ${vehicle.waiting_charge_extra}</td>
                <td>LKR ${vehicle.minimum_hire_amount}</td>
                <td>${vehicle.ownership}</td>
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editHireVehicle(${vehicle.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteHireVehicle(${vehicle.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        updateVehicleSelectors();
    } catch (error) {
        console.error('Error loading vehicles:', error.message);
    }
}

async function editHireVehicle(id) {
    try {
        const { data, error } = await supabase.from('hire_to_pay_vehicles').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('hireVehicleId').value = data.id;
        document.getElementById('lorryNumber').value = data.lorry_number;
        document.getElementById('lorryLength').value = data.length;
        document.getElementById('price0To100').value = data.price_0_100km;
        document.getElementById('price100To250').value = data.price_100_250km;
        document.getElementById('price250Plus').value = data.price_250km_plus;
        document.getElementById('loadingCharge').value = data.loading_charge;
        document.getElementById('waitingCharge24').value = data.waiting_charge_24hrs;
        document.getElementById('waitingChargeExtra').value = data.waiting_charge_extra;
        document.getElementById('minimumHireAmount').value = data.minimum_hire_amount;
        document.getElementById('ownership').value = data.ownership;
        document.getElementById('hireVehicleFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading vehicle: ' + error.message);
    }
}

async function deleteHireVehicle(id) {
    if (confirm('Are you sure you want to delete this vehicle?')) {
        try {
            await supabase.from('hire_to_pay_vehicles').delete().eq('id', id);
            loadHireVehicles();
        } catch (error) {
            alert('Error deleting vehicle: ' + error.message);
        }
    }
}

// ============ HIRE-TO-PAY RECORDS ============
document.getElementById('addHireRecordBtn')?.addEventListener('click', () => {
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
    const id = document.getElementById('hireRecordId').value;
    const distance = parseFloat(document.getElementById('hireDistance').value);
    const vehicleId = parseInt(document.getElementById('hireToPayVehicle').value);
    const waitingHours = parseFloat(document.getElementById('hireWaitingHours').value) || 0;
    const fuelLitres = parseFloat(document.getElementById('hireFuel').value);
    const fuelPrice = parseFloat(document.getElementById('hireFuelPrice').value);
    const hasLoading = document.getElementById('hireLoading').checked;
    const otherCharges = parseFloat(document.getElementById('hireOtherCharges').value) || 0;

    try {
        const { data: vehicleData, error: vehicleError } = await supabase
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
            hireAmount = vehicleData.minimum_hire_amount + waitingCharge;
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
            user_id: currentUser.id
        };

        if (id) {
            await supabase.from('hire_to_pay_records').update(recordData).eq('id', id);
        } else {
            await supabase.from('hire_to_pay_records').insert([recordData]);
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
        
        let query = supabase
            .from('hire_to_pay_records')
            .select('*, hire_to_pay_vehicles(lorry_number, price_0_100km, price_100_250km, price_250km_plus, minimum_hire_amount)')
            .eq('user_id', currentUser.id);
        
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
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editHireRecord(${record.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteHireRecord(${record.id})">Delete</button>
                </td>
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
        const { data: hireVehicles } = await supabase
            .from('hire_to_pay_vehicles')
            .select('id, lorry_number, ownership')
            .eq('user_id', currentUser.id);

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
    try {
        const { data, error } = await supabase.from('hire_to_pay_records').select('*').eq('id', id).single();
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
    if (confirm('Are you sure you want to delete this hire record?')) {
        try {
            await supabase.from('hire_to_pay_records').delete().eq('id', id);
            loadHireRecords();
        } catch (error) {
            alert('Error deleting hire record: ' + error.message);
        }
    }
}

// ============ COMMITMENT VEHICLES ============
document.getElementById('addCommitmentVehicleBtn')?.addEventListener('click', () => {
    document.getElementById('commitmentVehicleForm').reset();
    document.getElementById('commitmentVehicleId').value = '';
    document.getElementById('commitmentVehicleFormContainer').style.display = 'block';
});

document.getElementById('cancelCommitmentVehicleBtn')?.addEventListener('click', () => {
    document.getElementById('commitmentVehicleFormContainer').style.display = 'none';
});

document.getElementById('commitmentVehicleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('commitmentVehicleId').value;
    const data = {
        vehicle_number: document.getElementById('commitmentVehicleNumber').value,
        fixed_monthly_payment: parseFloat(document.getElementById('fixedPayment').value),
        km_limit_per_month: parseFloat(document.getElementById('kmLimit').value),
        extra_km_charge: parseFloat(document.getElementById('extraKmCharge').value),
        loading_charge: parseFloat(document.getElementById('commitmentLoadingCharge').value),
        user_id: currentUser.id
    };

    try {
        if (id) {
            await supabase.from('commitment_vehicles').update(data).eq('id', id);
        } else {
            await supabase.from('commitment_vehicles').insert([data]);
        }
        loadCommitmentVehicles();
        document.getElementById('commitmentVehicleFormContainer').style.display = 'none';
    } catch (error) {
        alert('Error saving commitment vehicle: ' + error.message);
    }
});

async function loadCommitmentVehicles() {
    try {
        const { data, error } = await supabase
            .from('commitment_vehicles')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.querySelector('#commitmentVehiclesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        data.forEach(vehicle => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${vehicle.vehicle_number}</td>
                <td>LKR ${vehicle.fixed_monthly_payment}</td>
                <td>${vehicle.km_limit_per_month} km</td>
                <td>LKR ${vehicle.extra_km_charge}/km</td>
                <td>LKR ${vehicle.loading_charge}</td>
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editCommitmentVehicle(${vehicle.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteCommitmentVehicle(${vehicle.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        updateVehicleSelectors();
    } catch (error) {
        console.error('Error loading commitment vehicles:', error.message);
    }
}

async function editCommitmentVehicle(id) {
    try {
        const { data, error } = await supabase.from('commitment_vehicles').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('commitmentVehicleId').value = data.id;
        document.getElementById('commitmentVehicleNumber').value = data.vehicle_number;
        document.getElementById('fixedPayment').value = data.fixed_monthly_payment;
        document.getElementById('kmLimit').value = data.km_limit_per_month;
        document.getElementById('extraKmCharge').value = data.extra_km_charge;
        document.getElementById('commitmentLoadingCharge').value = data.loading_charge;
        document.getElementById('commitmentVehicleFormContainer').style.display = 'block';
        window.scrollTo(0, 0);
    } catch (error) {
        alert('Error loading commitment vehicle: ' + error.message);
    }
}

async function deleteCommitmentVehicle(id) {
    if (confirm('Are you sure you want to delete this vehicle?')) {
        try {
            await supabase.from('commitment_vehicles').delete().eq('id', id);
            loadCommitmentVehicles();
        } catch (error) {
            alert('Error deleting commitment vehicle: ' + error.message);
        }
    }
}

// ============ COMMITMENT RECORDS ============
document.getElementById('addCommitmentRecordBtn')?.addEventListener('click', () => {
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
    const id = document.getElementById('commitmentRecordId').value;
    const fuelLitres = parseFloat(document.getElementById('commitmentFuel').value);
    const fuelPrice = parseFloat(document.getElementById('commitmentFuelPrice').value);
    const fuelCost = fuelLitres * fuelPrice;
    const distance = parseFloat(document.getElementById('commitmentDistance').value);
    const vehicleId = parseInt(document.getElementById('commitmentVehicleSelect').value);
    const hireDate = document.getElementById('commitmentDate').value;
    const extraChargesInput = parseFloat(document.getElementById('commitmentExtraCharges').value) || 0;

    try {
        const { data: vehicleData, error: vehicleError } = await supabase
            .from('commitment_vehicles')
            .select('*')
            .eq('id', vehicleId)
            .single();
        
        if (vehicleError) throw vehicleError;

        const [year, month] = hireDate.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        let query = supabase
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
            user_id: currentUser.id
        };

        if (id) {
            await supabase.from('commitment_records').update(recordData).eq('id', id);
        } else {
            await supabase.from('commitment_records').insert([recordData]);
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
        
        let query = supabase
            .from('commitment_records')
            .select('*, commitment_vehicles(vehicle_number, km_limit_per_month, extra_km_charge)')
            .eq('user_id', currentUser.id);
        
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

            row.innerHTML = `
                <td>${record.job_number}</td>
                <td>${record.hire_date}</td>
                <td>${record.commitment_vehicles.vehicle_number}</td>
                <td>${record.from_location}</td>
                <td>${record.to_location}</td>
                <td>${record.distance} km</td>
                <td>LKR ${record.fuel_cost.toFixed(2)}</td>
                <td><small>Monthly KM: ${totalMonthlyKm} / ${record.commitment_vehicles.km_limit_per_month}<br>Extra KM: ${(totalMonthlyKm > record.commitment_vehicles.km_limit_per_month ? totalMonthlyKm - record.commitment_vehicles.km_limit_per_month : 0).toFixed(2)}<br>Extra Charge: LKR ${record.extra_charges.toFixed(2)}</small></td>
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editCommitmentRecord(${record.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteCommitmentRecord(${record.id})">Delete</button>
                </td>
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
        const { data: commitmentVehicles } = await supabase
            .from('commitment_vehicles')
            .select('id, vehicle_number')
            .eq('user_id', currentUser.id);

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
    try {
        const { data, error } = await supabase.from('commitment_records').select('*').eq('id', id).single();
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
    if (confirm('Are you sure you want to delete this commitment record?')) {
        try {
            await supabase.from('commitment_records').delete().eq('id', id);
            loadCommitmentRecords();
        } catch (error) {
            alert('Error deleting commitment record: ' + error.message);
        }
    }
}

// ============ DAY OFFS ============
document.getElementById('addDayOffBtn')?.addEventListener('click', () => {
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
    const id = document.getElementById('dayOffId').value;
    const vehicleId = parseInt(document.getElementById('dayOffVehicle').value);
    const dayOffDate = document.getElementById('dayOffDate').value;

    try {
        const { data: vehicleData } = await supabase
            .from('commitment_vehicles')
            .select('fixed_monthly_payment')
            .eq('id', vehicleId)
            .single();

        const deductionAmount = vehicleData.fixed_monthly_payment / 30;

        const dayOffData = {
            vehicle_id: vehicleId,
            day_off_date: dayOffDate,
            deduction_amount: deductionAmount,
            user_id: currentUser.id
        };

        if (id) {
            await supabase.from('commitment_day_offs').update(dayOffData).eq('id', id);
        } else {
            await supabase.from('commitment_day_offs').insert([dayOffData]);
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
        
        let query = supabase
            .from('commitment_day_offs')
            .select('*, commitment_vehicles(vehicle_number)')
            .eq('user_id', currentUser.id);
        
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
            row.innerHTML = `
                <td>${dayOff.commitment_vehicles.vehicle_number}</td>
                <td>${dayOff.day_off_date}</td>
                <td>LKR ${dayOff.deduction_amount.toFixed(2)}</td>
                <td class="action-buttons">
                    <button class="btn btn-edit" onclick="editDayOff(${dayOff.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteDayOff(${dayOff.id})">Delete</button>
                </td>
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
        const { data: commitmentVehicles } = await supabase
            .from('commitment_vehicles')
            .select('id, vehicle_number')
            .eq('user_id', currentUser.id);

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
    try {
        const { data, error } = await supabase.from('commitment_day_offs').select('*').eq('id', id).single();
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
    if (confirm('Are you sure you want to delete this day off?')) {
        try {
            await supabase.from('commitment_day_offs').delete().eq('id', id);
            loadDayOffs();
        } catch (error) {
            alert('Error deleting day off: ' + error.message);
        }
    }
}

// ============ DASHBOARD ============
document.getElementById('dashboardMonth')?.addEventListener('change', loadDashboard);

async function loadDashboard() {
    try {
        const monthValue = document.getElementById('dashboardMonth')?.value || new Date().toISOString().substring(0, 7);
        const el = document.getElementById('dashboardMonth');
        if (el) el.value = monthValue;
        
        const [year, month] = monthValue.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data: hireRecords } = await supabase
            .from('hire_to_pay_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .gte('hire_date', startDate)
            .lte('hire_date', endDate);

        const { data: commitmentRecords } = await supabase
            .from('commitment_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .gte('hire_date', startDate)
            .lte('hire_date', endDate);

        const { data: dayOffs } = await supabase
            .from('commitment_day_offs')
            .select('*')
            .eq('user_id', currentUser.id)
            .gte('day_off_date', startDate)
            .lte('day_off_date', endDate);

        const commitmentVehicleIds = new Set();
        commitmentRecords?.forEach(record => {
            commitmentVehicleIds.add(record.vehicle_id);
        });

        const { data: commitmentVehicles } = await supabase
            .from('commitment_vehicles')
            .select('*')
            .eq('user_id', currentUser.id)
            .in('id', Array.from(commitmentVehicleIds).length > 0 ? Array.from(commitmentVehicleIds) : [0]);

        let totalRevenue = 0;
        let totalFuelCost = 0;
        let totalHires = 0;

        hireRecords?.forEach(record => {
            totalRevenue += record.hire_amount;
            totalFuelCost += record.fuel_cost;
            totalHires++;
        });

        const commitmentPayment = commitmentVehicles?.reduce((sum, v) => sum + v.fixed_monthly_payment, 0) || 0;
        const dayOffDeductions = dayOffs?.reduce((sum, d) => sum + d.deduction_amount, 0) || 0;
        const commitmentFuelCost = commitmentRecords?.reduce((sum, r) => sum + r.fuel_cost, 0) || 0;
        const extraKmCharges = commitmentRecords?.reduce((sum, r) => sum + r.extra_charges, 0) || 0;

        totalRevenue += (commitmentPayment - dayOffDeductions + extraKmCharges);
        totalFuelCost += commitmentFuelCost;
        totalHires += (commitmentRecords?.length || 0);

        const netProfit = totalRevenue - totalFuelCost;

        const revEl = document.getElementById('totalRevenue');
        const fuelEl = document.getElementById('fuelCost');
        const hiresEl = document.getElementById('totalHires');
        const profitEl = document.getElementById('netProfit');

        if (revEl) revEl.textContent = `LKR ${totalRevenue.toFixed(2)}`;
        if (fuelEl) fuelEl.textContent = `LKR ${totalFuelCost.toFixed(2)}`;
        if (hiresEl) hiresEl.textContent = totalHires;
        if (profitEl) profitEl.textContent = `LKR ${netProfit.toFixed(2)}`;

        loadVehiclePerformance(monthValue);
    } catch (error) {
        console.error('Error loading dashboard:', error.message);
    }
}

async function loadVehiclePerformance(monthValue) {
    try {
        const [year, month] = monthValue.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data: hireVehicles } = await supabase
            .from('hire_to_pay_vehicles')
            .select('*')
            .eq('user_id', currentUser.id);

        const { data: commitmentRecordsMonth } = await supabase
            .from('commitment_records')
            .select('vehicle_id')
            .eq('user_id', currentUser.id)
            .gte('hire_date', startDate)
            .lte('hire_date', endDate);

        const commitmentVehicleIdsWithHires = new Set();
        commitmentRecordsMonth?.forEach(record => {
            commitmentVehicleIdsWithHires.add(record.vehicle_id);
        });

        let commitmentVehicles = [];
        if (commitmentVehicleIdsWithHires.size > 0) {
            const { data: vehicles } = await supabase
                .from('commitment_vehicles')
                .select('*')
                .eq('user_id', currentUser.id)
                .in('id', Array.from(commitmentVehicleIdsWithHires));
            commitmentVehicles = vehicles || [];
        }

        let performanceHtml = '<table style="width:100%; border-collapse: collapse;"><thead><tr style="background: #DC143C; color: white;"><th style="padding: 10px; text-align: left;">Vehicle</th><th style="padding: 10px; text-align: left;">Type</th><th style="padding: 10px; text-align: left;">Ownership</th><th style="padding: 10px; text-align: left;">Total KM</th><th style="padding: 10px; text-align: left;">Total Revenue</th><th style="padding: 10px; text-align: left;">Fuel Cost</th><th style="padding: 10px; text-align: left;">Profit</th></tr></thead><tbody>';

        for (const vehicle of hireVehicles) {
            const { data: records } = await supabase
                .from('hire_to_pay_records')
                .select('*')
                .eq('vehicle_id', vehicle.id)
                .gte('hire_date', startDate)
                .lte('hire_date', endDate);

            const totalKm = records?.reduce((sum, r) => sum + r.distance, 0) || 0;
            const totalRevenue = records?.reduce((sum, r) => sum + r.hire_amount, 0) || 0;
            const totalFuel = records?.reduce((sum, r) => sum + r.fuel_cost, 0) || 0;
            const profit = totalRevenue - totalFuel;
            const ownershipLabel = vehicle.ownership === 'company' ? '🏢 Company' : '🚗 Rented';

            performanceHtml += `<tr style="border-bottom: 1px solid #ECF0F1;"><td style="padding: 10px;">${vehicle.lorry_number}</td><td style="padding: 10px;">Hire-to-Pay</td><td style="padding: 10px;"><strong>${ownershipLabel}</strong></td><td style="padding: 10px;">${totalKm}</td><td style="padding: 10px;">LKR ${totalRevenue.toFixed(2)}</td><td style="padding: 10px;">LKR ${totalFuel.toFixed(2)}</td><td style="padding: 10px; color: #27AE60; font-weight: bold;">LKR ${profit.toFixed(2)}</td></tr>`;
        }

        for (const vehicle of commitmentVehicles) {
            const { data: records } = await supabase
                .from('commitment_records')
                .select('*')
                .eq('vehicle_id', vehicle.id)
                .gte('hire_date', startDate)
                .lte('hire_date', endDate);

            const { data: dayOffs } = await supabase
                .from('commitment_day_offs')
                .select('*')
                .eq('vehicle_id', vehicle.id)
                .gte('day_off_date', startDate)
                .lte('day_off_date', endDate);

            const totalKm = records?.reduce((sum, r) => sum + r.distance, 0) || 0;
            const basePay = vehicle.fixed_monthly_payment;
            const dayOffDeductions = dayOffs?.reduce((sum, d) => sum + d.deduction_amount, 0) || 0;
            const extraKmCharges = records?.reduce((sum, r) => sum + r.extra_charges, 0) || 0;
            const totalRevenue = basePay - dayOffDeductions + extraKmCharges;
            const totalFuel = records?.reduce((sum, r) => sum + r.fuel_cost, 0) || 0;
            const profit = totalRevenue - totalFuel;

            performanceHtml += `<tr style="border-bottom: 1px solid #ECF0F1;"><td style="padding: 10px;">${vehicle.vehicle_number}</td><td style="padding: 10px;">Commitment</td><td style="padding: 10px;">-</td><td style="padding: 10px;">${totalKm}</td><td style="padding: 10px;">LKR ${totalRevenue.toFixed(2)}</td><td style="padding: 10px;">LKR ${totalFuel.toFixed(2)}</td><td style="padding: 10px; color: #27AE60; font-weight: bold;">LKR ${profit.toFixed(2)}</td></tr>`;
        }

        performanceHtml += '</tbody></table>';
        const perfEl = document.getElementById('vehiclePerformance');
        if (perfEl) perfEl.innerHTML = performanceHtml;
    } catch (error) {
        console.error('Error loading vehicle performance:', error.message);
    }
}

async function updateVehicleSelectors() {
    try {
        const { data: hireVehicles } = await supabase
            .from('hire_to_pay_vehicles')
            .select('id, lorry_number')
            .eq('user_id', currentUser.id);

        const { data: commitmentVehicles } = await supabase
            .from('commitment_vehicles')
            .select('id, vehicle_number')
            .eq('user_id', currentUser.id);

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