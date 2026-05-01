// salary-slip.js - Driver Salary Slip Generator with Transport Logo & Red Theme
// UPDATED: Added full CRUD operations, PDF Receipt Upload, Per-Tip Salary Support & Individual Deductions

// Global variables
let currentSalaryData = null;
let isEditMode = false;
let currentDriverSalaryType = 'fixed'; // 'fixed' or 'per_tip'
// Global variables for salary receipt upload
let currentSalaryReceiptFile = null;
let existingSalaryReceiptUrl = null;
// Deductions tracking
let currentDeductions = []; // holds deductions loaded for the current driver/month

// Initialize salary section
function initSalarySection() {
    // Existing event listeners
    document.getElementById('loadSalaryDataBtn')?.addEventListener('click', loadDriverSalaryData);
    document.getElementById('calculateSalaryBtn')?.addEventListener('click', calculateSalary);
    document.getElementById('generateSalarySlipBtn')?.addEventListener('click', generateSalarySlip);
    document.getElementById('cancelSalaryBtn')?.addEventListener('click', cancelSalaryForm);
    document.getElementById('totalKm')?.addEventListener('input', recalculateExtraKmSalary);
    document.getElementById('additionalAllowance')?.addEventListener('input', recalculateSalary);

    // Deduction management event listeners
    document.getElementById('addDeductionBtn')?.addEventListener('click', showAddDeductionForm);
    document.getElementById('saveDeductionBtn')?.addEventListener('click', saveNewDeduction);
    document.getElementById('cancelDeductionBtn')?.addEventListener('click', hideAddDeductionForm);

    // Per-tip input listeners
    document.getElementById('tipCount')?.addEventListener('input', recalculateTipSalary);
    document.getElementById('halfTipCount')?.addEventListener('input', recalculateTipSalary);

    // New: Handle salary receipt file selection
    document.getElementById('salaryReceipt')?.addEventListener('change', handleSalaryReceiptChange);

    // New: Handle remove receipt button
    document.getElementById('removeSalaryReceiptBtn')?.addEventListener('click', removeSalaryReceipt);

    // Set default month
    const now = new Date();
    const monthStr = now.toISOString().substring(0, 7);
    const salaryMonthEl = document.getElementById('salaryMonth');
    if (salaryMonthEl) salaryMonthEl.value = monthStr;

    // Wait for adminUserId before loading (checkUserRole in app.js is async)
    function waitForAdminAndLoad() {
        if (typeof adminUserId !== 'undefined' && adminUserId) {
            loadSalaryDrivers();
            loadSalaryHistory();
        } else {
            setTimeout(waitForAdminAndLoad, 150);
        }
    }
    waitForAdminAndLoad();
}

// Toggle salary form sections based on driver salary type
function toggleSalaryFormSections(salaryType) {
    currentDriverSalaryType = salaryType || 'fixed';
    const kmSection = document.getElementById('salaryKmSection');
    const tipSection = document.getElementById('salaryTipSection');
    const basicSalaryGroup = document.getElementById('basicSalaryGroup');
    const extraKmSalaryGroup = document.getElementById('extraKmSalaryGroup');

    if (currentDriverSalaryType === 'per_tip') {
        if (kmSection) kmSection.style.display = 'none';
        if (tipSection) tipSection.style.display = 'block';
        if (basicSalaryGroup) basicSalaryGroup.style.display = 'none';
        if (extraKmSalaryGroup) extraKmSalaryGroup.style.display = 'none';
    } else {
        if (kmSection) kmSection.style.display = 'block';
        if (tipSection) tipSection.style.display = 'none';
        if (basicSalaryGroup) basicSalaryGroup.style.display = 'block';
        if (extraKmSalaryGroup) extraKmSalaryGroup.style.display = 'block';
    }
}

// Recalculate tip salary
function recalculateTipSalary() {
    const tipCount = parseInt(document.getElementById('tipCount')?.value) || 0;
    const halfTipCount = parseInt(document.getElementById('halfTipCount')?.value) || 0;
    const perTipChargeText = document.getElementById('perTipChargeDisplay')?.value || 'LKR 0';
    const perTipMatch = perTipChargeText.match(/LKR ([\d.]+)/);
    const perTipCharge = perTipMatch ? parseFloat(perTipMatch[1]) : 0;

    const tipSalary = (tipCount * perTipCharge) + (halfTipCount * perTipCharge * 0.5);

    const tipSalaryEl = document.getElementById('tipSalaryDisplay');
    if (tipSalaryEl) tipSalaryEl.value = `LKR ${tipSalary.toFixed(2)}`;

    recalculateSalary();
}

// Handle salary receipt file selection
function handleSalaryReceiptChange(e) {
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
        currentSalaryReceiptFile = file;
        console.log('Salary receipt file selected:', file.name);
    }
}

// Remove existing salary receipt
function removeSalaryReceipt() {
    if (confirm('Are you sure you want to remove this receipt?')) {
        existingSalaryReceiptUrl = null;
        document.getElementById('currentSalaryReceipt').style.display = 'none';
        document.getElementById('salaryReceipt').value = '';
        currentSalaryReceiptFile = null;
    }
}

// Upload salary receipt to Supabase Storage
async function uploadSalaryReceipt(file, salaryId) {
    if (!file) return null;

    try {
        const progressDiv = document.getElementById('salaryUploadProgress');
        const progressBar = document.getElementById('salaryUploadProgressBar');
        const progressText = document.getElementById('salaryUploadProgressText');

        progressDiv.style.display = 'block';
        progressBar.style.width = '30%';
        progressText.textContent = 'Uploading salary receipt...';

        const timestamp = Date.now();
        const filename = `${getQueryUserId()}/salary/${salaryId}_${timestamp}_${file.name}`;

        progressBar.style.width = '60%';

        const { data, error } = await supabaseClient.storage
            .from('salary-receipts')
            .upload(filename, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        progressBar.style.width = '90%';

        const { data: urlData } = supabaseClient.storage
            .from('salary-receipts')
            .getPublicUrl(filename);

        progressBar.style.width = '100%';
        progressText.textContent = 'Upload complete!';

        setTimeout(() => {
            progressDiv.style.display = 'none';
            progressBar.style.width = '0%';
        }, 1000);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Error uploading salary receipt:', error);
        document.getElementById('salaryUploadProgress').style.display = 'none';
        alert('Failed to upload salary receipt: ' + error.message);
        return null;
    }
}

// Delete salary receipt from storage
async function deleteSalaryReceipt(receiptUrl) {
    if (!receiptUrl) return;

    try {
        const urlParts = receiptUrl.split('/');
        const bucketIndex = urlParts.findIndex(part => part === 'salary-receipts');
        if (bucketIndex === -1) return;

        const filename = urlParts.slice(bucketIndex + 1).join('/');

        await supabaseClient.storage
            .from('salary-receipts')
            .remove([filename]);
    } catch (error) {
        console.error('Error deleting salary receipt:', error);
    }
}

// Load drivers for salary calculation
async function loadSalaryDrivers() {
    try {
        const { data: drivers, error } = await supabaseClient
            .from('drivers')
            .select('id, name, basic_salary, km_limit, extra_km_rate, salary_type, per_tip_charge')
            .eq('user_id', getQueryUserId())
            .neq('terminated', true)
            .order('name');

        if (error) throw error;

        const select = document.getElementById('salaryDriverSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Select Driver</option>';

        drivers.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.id;
            const isPerTip = driver.salary_type === 'per_tip';
            if (isPerTip) {
                option.textContent = `${driver.name} (Per Tip: LKR ${driver.per_tip_charge || 0})`;
            } else {
                option.textContent = `${driver.name} (${driver.basic_salary ? 'LKR ' + driver.basic_salary : 'No salary set'})`;
            }
            option.dataset.basicSalary = driver.basic_salary || 0;
            option.dataset.kmLimit = driver.km_limit || 0;
            option.dataset.extraKmRate = driver.extra_km_rate || 0;
            option.dataset.salaryType = driver.salary_type || 'fixed';
            option.dataset.perTipCharge = driver.per_tip_charge || 0;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading drivers for salary:', error.message);
    }
}

// Load driver salary data (Updated to handle receipt display)
async function loadDriverSalaryData() {
    const driverId = document.getElementById('salaryDriverSelect').value;
    const monthValue = document.getElementById('salaryMonth').value;

    if (!driverId || !monthValue) {
        alert('Please select both driver and month');
        return;
    }

    try {
        // Get driver details
        const { data: driver, error: driverError } = await supabaseClient
            .from('drivers')
            .select('*')
            .eq('id', driverId)
            .eq('user_id', getQueryUserId())
            .single();

        if (driverError) throw driverError;

        // Get advances for this driver and month
        const [year, month] = monthValue.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        const { data: advances, error: advancesError } = await supabaseClient
            .from('driver_advances')
            .select('*')
            .eq('driver_id', driverId)
            .gte('advance_date', startDate)
            .lte('advance_date', endDate);

        if (advancesError) throw advancesError;

        // Check if salary already exists for this month
        const { data: existingSalary, error: salaryError } = await supabaseClient
            .from('driver_salary')
            .select('*')
            .eq('driver_id', driverId)
            .eq('salary_month', monthValue)
            .eq('user_id', getQueryUserId())
            .maybeSingle();

        // Populate form
        document.getElementById('driverNameDisplay').value = driver.name;
        document.getElementById('salaryMonthDisplay').value = monthValue;
        document.getElementById('basicSalaryDisplay').value = driver.basic_salary || 0;
        document.getElementById('kmLimitDisplay').value = driver.km_limit || 0;
        document.getElementById('extraKmRateDisplay').value = driver.extra_km_rate ? `LKR ${driver.extra_km_rate}/km` : 'LKR 0.00/km';

        // Toggle form sections based on salary type
        const driverSalaryType = driver.salary_type || 'fixed';
        toggleSalaryFormSections(driverSalaryType);

        // Populate per-tip fields
        if (driverSalaryType === 'per_tip') {
            document.getElementById('perTipChargeDisplay').value = driver.per_tip_charge ? `LKR ${driver.per_tip_charge}` : 'LKR 0';
        }

        // Display advances
        displayAdvances(advances);

        // Load deductions for this driver/month
        currentDeductions = await loadStaffDeductions(driverId, monthValue);
        displayDeductions(currentDeductions);

        // Reset receipt upload
        resetSalaryReceiptUpload();

        // If existing salary found, populate the form and receipt
        if (existingSalary) {
            isEditMode = true;
            document.getElementById('salaryId').value = existingSalary.id;
            document.getElementById('totalKm').value = existingSalary.total_km || 0;
            document.getElementById('additionalAllowance').value = existingSalary.additional_allowance || 0;
            // otherDeductions is now computed from individual deductions, set the hidden field
            document.getElementById('otherDeductions').value = currentDeductions.reduce((s, d) => s + (d.amount || 0), 0);

            // Populate tip fields if per-tip
            if (driverSalaryType === 'per_tip') {
                document.getElementById('tipCount').value = existingSalary.tip_count || 0;
                document.getElementById('halfTipCount').value = existingSalary.half_tip_count || 0;
                recalculateTipSalary();
            }

            // Display existing receipt if any
            if (existingSalary.receipt_url) {
                existingSalaryReceiptUrl = existingSalary.receipt_url;
                document.getElementById('currentSalaryReceipt').style.display = 'block';
                document.getElementById('currentSalaryReceiptLink').href = existingSalary.receipt_url;
                document.getElementById('currentSalaryReceiptLink').textContent = 'View Receipt';
            }

            // Update button text for edit mode
            const generateBtn = document.getElementById('generateSalarySlipBtn');
            if (generateBtn) {
                generateBtn.textContent = '📄 Update Salary Slip';
            }

            recalculateSalary();
        } else {
            isEditMode = false;
            // Clear form for new salary
            document.getElementById('salaryId').value = '';
            document.getElementById('totalKm').value = '';
            document.getElementById('additionalAllowance').value = 0;
            document.getElementById('otherDeductions').value = currentDeductions.reduce((s, d) => s + (d.amount || 0), 0);
            document.getElementById('tipCount').value = 0;
            document.getElementById('halfTipCount').value = 0;
            if (document.getElementById('tipSalaryDisplay')) document.getElementById('tipSalaryDisplay').value = 'LKR 0.00';

            // Reset button text
            const generateBtn = document.getElementById('generateSalarySlipBtn');
            if (generateBtn) {
                generateBtn.textContent = '📄 Generate Salary Slip';
            }

            resetSalarySummary();
        }

        // Show form
        document.getElementById('salaryFormContainer').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('Error loading salary data:', error.message);
        alert('Error loading salary data: ' + error.message);
    }
}

// Reset salary receipt upload UI
function resetSalaryReceiptUpload() {
    document.getElementById('salaryReceipt').value = '';
    document.getElementById('salaryUploadProgress').style.display = 'none';
    document.getElementById('currentSalaryReceipt').style.display = 'none';
    currentSalaryReceiptFile = null;
    existingSalaryReceiptUrl = null;
}

// Display advances in the form
function displayAdvances(advances) {
    const advancesDetails = document.getElementById('advancesDetails');
    const totalAdvancesDisplay = document.getElementById('totalAdvancesDisplay');

    if (!advances || advances.length === 0) {
        advancesDetails.innerHTML = '<p style="color: var(--text-muted, #666); font-style: italic;">No advances for this month</p>';
        totalAdvancesDisplay.textContent = 'LKR 0.00';
        return;
    }

    let totalAdvances = 0;
    let html = '<table style="width:100%; font-size: 14px;">';
    html += '<tr style="background: #DC143C; color: white;">';
    html += '<th style="padding: 8px;">Date</th>';
    html += '<th style="padding: 8px;">Amount</th>';
    html += '<th style="padding: 8px;">Notes</th>';
    html += '</tr>';

    advances.forEach(advance => {
        totalAdvances += advance.amount;
        html += '<tr style="border-bottom: 1px solid var(--surface-border, #eee);">';
        html += `<td style="padding: 8px;">${advance.advance_date}</td>`;
        html += `<td style="padding: 8px;">LKR ${advance.amount.toFixed(2)}</td>`;
        html += `<td style="padding: 8px;">${advance.notes || '-'}</td>`;
        html += '</tr>';
    });

    html += '</table>';
    html += `<div style="margin-top: 10px; text-align: right; font-weight: bold; color: #DC143C;">`;
    html += `Total Advances: LKR ${totalAdvances.toFixed(2)}`;
    html += `</div>`;

    advancesDetails.innerHTML = html;
    totalAdvancesDisplay.textContent = `LKR ${totalAdvances.toFixed(2)}`;
}

// ============ STAFF DEDUCTIONS CRUD ============

// Load deductions from Supabase
// Loads all deductions for this driver that are tagged to this salary month,
// regardless of what date the deduction actually occurred on.
async function loadStaffDeductions(driverId, salaryMonth) {
    try {
        const userId = getQueryUserId();

        const { data, error } = await supabaseClient
            .from('staff_deductions')
            .select('*')
            .eq('driver_id', parseInt(driverId))
            .eq('user_id', userId)
            .eq('salary_month', salaryMonth)
            .order('deduction_date', { ascending: true });

        if (error) {
            console.error('[Deductions] Supabase error:', error);
            throw error;
        }
        return data || [];
    } catch (error) {
        console.error('[Deductions] Error loading deductions:', error.message);
        return [];
    }
}

// Display deductions in the salary form
function displayDeductions(deductions) {
    const detailsEl = document.getElementById('deductionsDetails');
    if (!detailsEl) return;

    if (!deductions || deductions.length === 0) {
        detailsEl.innerHTML = '<p style="color: var(--text-muted, #999); font-style: italic; font-size: 13px;">No deductions for this month</p>';
        updateDeductionTotal(0);
        return;
    }

    let totalDeductions = 0;
    let html = '<table style="width:100%; font-size: 14px; border-collapse: collapse;">';
    html += '<tr style="background: #E67E22; color: white;">';
    html += '<th style="padding: 8px; text-align: left;">Date</th>';
    html += '<th style="padding: 8px; text-align: left;">Reason</th>';
    html += '<th style="padding: 8px; text-align: right;">Amount</th>';
    html += '<th style="padding: 8px; text-align: center; width: 60px;">Action</th>';
    html += '</tr>';

    deductions.forEach(ded => {
        totalDeductions += ded.amount || 0;
        html += '<tr style="border-bottom: 1px solid var(--surface-border, #eee);">';
        html += `<td style="padding: 8px;">${ded.deduction_date}</td>`;
        html += `<td style="padding: 8px;">${ded.reason || '-'}</td>`;
        html += `<td style="padding: 8px; text-align: right;">LKR ${(ded.amount || 0).toFixed(2)}</td>`;
        html += `<td style="padding: 8px; text-align: center;">`;
        html += `<button type="button" onclick="deleteStaffDeduction(${ded.id})" style="background: #E74C3C; color: white; border: none; padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;" title="Delete Deduction">🗑️</button>`;
        html += `</td>`;
        html += '</tr>';
    });

    html += '</table>';
    html += `<div style="margin-top: 10px; text-align: right; font-weight: bold; color: #E67E22;">`;
    html += `Total Deductions: LKR ${totalDeductions.toFixed(2)}`;
    html += `</div>`;

    detailsEl.innerHTML = html;
    updateDeductionTotal(totalDeductions);
}

// Update the hidden otherDeductions field and trigger recalculation
function updateDeductionTotal(total) {
    const hiddenField = document.getElementById('otherDeductions');
    if (hiddenField) hiddenField.value = total;
    recalculateSalary();
}

// Show the inline add-deduction form
function showAddDeductionForm() {
    const formRow = document.getElementById('addDeductionFormRow');
    if (formRow) {
        formRow.style.display = 'block';
        // Set default date to today
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        document.getElementById('deductionDate').value = dateStr;
        document.getElementById('deductionReason').value = '';
        document.getElementById('deductionAmount').value = '';
        document.getElementById('deductionReason').focus();
    }
}

// Hide the inline add-deduction form
function hideAddDeductionForm() {
    const formRow = document.getElementById('addDeductionFormRow');
    if (formRow) formRow.style.display = 'none';
}

// Save a new deduction to Supabase
async function saveNewDeduction() {
    const driverId = document.getElementById('salaryDriverSelect')?.value;
    const deductionDate = document.getElementById('deductionDate')?.value;
    const reason = document.getElementById('deductionReason')?.value?.trim();
    const amount = parseFloat(document.getElementById('deductionAmount')?.value);

    if (!driverId) { alert('Please select a driver first'); return; }
    if (!deductionDate) { alert('Please select a date for the deduction'); return; }
    if (!reason) { alert('Please enter a reason for the deduction'); return; }
    if (!amount || amount <= 0) { alert('Please enter a valid amount'); return; }

    const userId = getQueryUserId();
    console.log('[Deductions] Saving deduction:', { driver_id: parseInt(driverId), deduction_date: deductionDate, reason, amount, user_id: userId });

    try {
        const monthValue = document.getElementById('salaryMonth')?.value;
        if (!monthValue) { alert('Please select a salary month first'); return; }

        const { data, error } = await supabaseClient
            .from('staff_deductions')
            .insert([{
                driver_id: parseInt(driverId),
                deduction_date: deductionDate,
                salary_month: monthValue,
                reason: reason,
                amount: amount,
                user_id: userId
            }])
            .select();

        if (error) throw error;

        // Reload deductions for the current month
        currentDeductions = await loadStaffDeductions(driverId, monthValue);
        displayDeductions(currentDeductions);

        hideAddDeductionForm();
    } catch (error) {
        console.error('[Deductions] Error saving deduction:', error);
        alert('Error saving deduction: ' + error.message);
    }
}

// Delete a deduction from Supabase
async function deleteStaffDeduction(deductionId) {
    if (!confirm('Are you sure you want to delete this deduction?')) return;

    try {
        console.log('[Deductions] Deleting deduction id:', deductionId);
        const { error } = await supabaseClient
            .from('staff_deductions')
            .delete()
            .eq('id', deductionId)
            .eq('user_id', getQueryUserId());

        if (error) throw error;
        console.log('[Deductions] Deleted successfully');

        // Reload deductions
        const driverId = document.getElementById('salaryDriverSelect')?.value;
        const monthValue = document.getElementById('salaryMonth')?.value;
        if (driverId && monthValue) {
            currentDeductions = await loadStaffDeductions(driverId, monthValue);
            displayDeductions(currentDeductions);
        }
    } catch (error) {
        console.error('[Deductions] Error deleting deduction:', error.message);
        alert('Error deleting deduction: ' + error.message);
    }
}

// Recalculate extra KM salary
function recalculateExtraKmSalary() {
    const totalKm = parseFloat(document.getElementById('totalKm').value) || 0;
    const kmLimit = parseFloat(document.getElementById('kmLimitDisplay').value) || 0;
    const extraKmRateText = document.getElementById('extraKmRateDisplay').value;

    // Extract extra KM rate from text
    const extraKmRateMatch = extraKmRateText.match(/LKR (\d+(\.\d+)?)/);
    const extraKmRate = extraKmRateMatch ? parseFloat(extraKmRateMatch[1]) : 0;

    let extraKmSalary = 0;
    if (totalKm > kmLimit) {
        extraKmSalary = (totalKm - kmLimit) * extraKmRate;
    }

    document.getElementById('extraKmSalary').value = extraKmSalary.toFixed(2);

    // Trigger full salary recalculation
    recalculateSalary();
}

// Recalculate entire salary
function recalculateSalary() {
    const additionalAllowance = parseFloat(document.getElementById('additionalAllowance').value) || 0;
    const otherDeductions = parseFloat(document.getElementById('otherDeductions').value) || 0;
    const totalAdvancesText = document.getElementById('totalAdvancesDisplay').textContent;

    // Extract total advances from text
    const totalAdvancesMatch = totalAdvancesText.match(/LKR (\d+(\.\d+)?)/);
    const totalAdvances = totalAdvancesMatch ? parseFloat(totalAdvancesMatch[1]) : 0;

    let grossSalary = 0;

    if (currentDriverSalaryType === 'per_tip') {
        // Per-tip: gross = tip salary + allowance
        const tipSalaryText = document.getElementById('tipSalaryDisplay')?.value || 'LKR 0';
        const tipSalaryMatch = tipSalaryText.match(/LKR ([\d.]+)/);
        const tipSalary = tipSalaryMatch ? parseFloat(tipSalaryMatch[1]) : 0;
        grossSalary = tipSalary + additionalAllowance;
    } else {
        // Fixed: gross = basic + extra km + allowance
        const basicSalary = parseFloat(document.getElementById('basicSalaryDisplay').value) || 0;
        const extraKmSalary = parseFloat(document.getElementById('extraKmSalary').value) || 0;
        grossSalary = basicSalary + extraKmSalary + additionalAllowance;
    }

    const netSalary = grossSalary - totalAdvances - otherDeductions;

    document.getElementById('grossSalaryDisplay').textContent = `LKR ${grossSalary.toFixed(2)}`;
    document.getElementById('otherDeductionsDisplay').textContent = `LKR ${otherDeductions.toFixed(2)}`;
    document.getElementById('netSalaryDisplay').textContent = `LKR ${netSalary.toFixed(2)}`;
}

// Reset salary summary
function resetSalarySummary() {
    document.getElementById('grossSalaryDisplay').textContent = 'LKR 0.00';
    document.getElementById('otherDeductionsDisplay').textContent = 'LKR 0.00';
    document.getElementById('netSalaryDisplay').textContent = 'LKR 0.00';
}

// Calculate salary
async function calculateSalary() {
    const driverId = document.getElementById('salaryDriverSelect').value;
    const monthValue = document.getElementById('salaryMonth').value;

    if (!driverId || !monthValue) {
        alert('Please select both driver and month');
        return;
    }

    if (currentDriverSalaryType === 'fixed') {
        const totalKm = parseFloat(document.getElementById('totalKm').value) || 0;
        if (!totalKm || totalKm <= 0) {
            alert('Please enter valid total KM');
            return;
        }
    } else {
        const tipCount = parseInt(document.getElementById('tipCount').value) || 0;
        const halfTipCount = parseInt(document.getElementById('halfTipCount').value) || 0;
        if (tipCount <= 0 && halfTipCount <= 0) {
            alert('Please enter at least one tip count');
            return;
        }
        recalculateTipSalary();
    }

    recalculateSalary();
    alert('Salary calculated successfully! Click "Generate Salary Slip" to create/update PDF.');
}

// Generate salary slip PDF (Updated to handle receipt upload & per-tip)
async function generateSalarySlip() {
    const driverId = document.getElementById('salaryDriverSelect').value;
    const monthValue = document.getElementById('salaryMonth').value;
    const totalKm = parseFloat(document.getElementById('totalKm').value) || 0;

    if (!driverId || !monthValue) {
        alert('Please calculate salary first');
        return;
    }

    // Validate based on salary type
    if (currentDriverSalaryType === 'fixed' && !totalKm) {
        alert('Please enter total KM and calculate salary first');
        return;
    }

    try {
        // Get driver details
        const { data: driver, error: driverError } = await supabaseClient
            .from('drivers')
            .select('*')
            .eq('id', driverId)
            .eq('user_id', getQueryUserId())
            .single();

        if (driverError) throw driverError;

        // Get advances for this month
        const [year, month] = monthValue.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        const { data: advances, error: advancesError } = await supabaseClient
            .from('driver_advances')
            .select('*')
            .eq('driver_id', driverId)
            .gte('advance_date', startDate)
            .lte('advance_date', endDate);

        if (advancesError) throw advancesError;

        const additionalAllowance = parseFloat(document.getElementById('additionalAllowance').value) || 0;
        const otherDeductions = currentDeductions.reduce((sum, d) => sum + (d.amount || 0), 0);
        const totalAdvances = advances?.reduce((sum, adv) => sum + adv.amount, 0) || 0;

        let grossSalary = 0;
        let salaryType = driver.salary_type || 'fixed';

        // Per-tip specific values
        let tipCount = 0, halfTipCount = 0, perTipCharge = 0, tipSalary = 0;
        // Fixed specific values
        let basicSalary = 0, kmLimit = 0, extraKmRate = 0, extraKm = 0, extraKmSalary = 0;

        if (salaryType === 'per_tip') {
            tipCount = parseInt(document.getElementById('tipCount').value) || 0;
            halfTipCount = parseInt(document.getElementById('halfTipCount').value) || 0;
            perTipCharge = driver.per_tip_charge || 0;
            tipSalary = (tipCount * perTipCharge) + (halfTipCount * perTipCharge * 0.5);
            grossSalary = tipSalary + additionalAllowance;
        } else {
            basicSalary = parseFloat(document.getElementById('basicSalaryDisplay').value) || 0;
            kmLimit = parseFloat(document.getElementById('kmLimitDisplay').value) || 0;
            const extraKmRateText = document.getElementById('extraKmRateDisplay').value;
            const extraKmRateMatch = extraKmRateText.match(/LKR (\d+(\.\d+)?)/);
            extraKmRate = extraKmRateMatch ? parseFloat(extraKmRateMatch[1]) : 0;
            extraKm = Math.max(0, totalKm - kmLimit);
            extraKmSalary = extraKm * extraKmRate;
            grossSalary = basicSalary + extraKmSalary + additionalAllowance;
        }

        const netSalary = grossSalary - totalAdvances - otherDeductions;

        // Prepare salary data for PDF
        currentSalaryData = {
            driver: {
                name: driver.name,
                contact: driver.contact,
                license: driver.license_number || '-',
                address: driver.address
            },
            salaryType: salaryType,
            salaryMonth: monthValue,
            // Fixed salary fields
            basicSalary: basicSalary,
            totalKm: totalKm,
            kmLimit: kmLimit,
            extraKm: extraKm,
            extraKmRate: extraKmRate,
            extraKmSalary: extraKmSalary,
            // Per-tip fields
            perTipCharge: perTipCharge,
            tipCount: tipCount,
            halfTipCount: halfTipCount,
            tipSalary: tipSalary,
            // Common fields
            additionalAllowance: additionalAllowance,
            advances: advances || [],
            totalAdvances: totalAdvances,
            otherDeductions: otherDeductions,
            deductions: currentDeductions || [],
            grossSalary: grossSalary,
            netSalary: netSalary,
            generatedDate: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        };

        // Create PDF
        createSalarySlipPDF();

        // Save/update salary record to database with receipt
        const salaryId = await saveSalaryRecordWithReceipt(driverId, monthValue, currentSalaryData);

        // Show success message
        alert(isEditMode ? 'Salary slip updated successfully!' : 'Salary slip generated successfully!');

        // Reload salary history
        loadSalaryHistory();

        // Reset form
        cancelSalaryForm();

    } catch (error) {
        console.error('Error generating salary slip:', error.message);
        alert('Error generating salary slip: ' + error.message);
    }
}

// Save salary record with receipt URL (Replaces old saveSalaryRecord)
async function saveSalaryRecordWithReceipt(driverId, monthValue, salaryData) {
    try {
        const existingId = document.getElementById('salaryId').value;

        let receiptUrl = existingSalaryReceiptUrl;

        // If editing and removing old receipt, delete it
        if (existingId && existingSalaryReceiptUrl && !currentSalaryReceiptFile) {
            await deleteSalaryReceipt(existingSalaryReceiptUrl);
            receiptUrl = null;
        }

        let savedSalaryId = existingId;

        const salaryRecord = {
            driver_id: driverId,
            salary_month: monthValue,
            salary_type: salaryData.salaryType || 'fixed',
            total_km: salaryData.totalKm,
            basic_salary: salaryData.basicSalary,
            extra_km_salary: salaryData.extraKmSalary,
            per_tip_charge: salaryData.perTipCharge || 0,
            tip_count: salaryData.tipCount || 0,
            half_tip_count: salaryData.halfTipCount || 0,
            tip_salary: salaryData.tipSalary || 0,
            additional_allowance: salaryData.additionalAllowance,
            total_advances: salaryData.totalAdvances,
            other_deductions: salaryData.otherDeductions,
            gross_salary: salaryData.grossSalary,
            net_salary: salaryData.netSalary,
            salary_data: salaryData, // Store full data as JSON
            user_id: getQueryUserId(),
            updated_at: new Date().toISOString()
        };

        // Upload new receipt if selected
        if (currentSalaryReceiptFile) {
            if (existingSalaryReceiptUrl) {
                await deleteSalaryReceipt(existingSalaryReceiptUrl);
            }

            // If no salary ID yet (new record), create it first
            if (!existingId) {
                const { data: newSalary, error: insertError } = await supabaseClient
                    .from('driver_salary')
                    .insert([salaryRecord])
                    .select()
                    .single();

                if (insertError) throw insertError;
                savedSalaryId = newSalary.id;
            }

            receiptUrl = await uploadSalaryReceipt(currentSalaryReceiptFile, savedSalaryId);
        }

        // Add receipt URL to record
        if (receiptUrl) {
            salaryRecord.receipt_url = receiptUrl;
        }

        // Update or insert record
        if (existingId) {
            await supabaseClient
                .from('driver_salary')
                .update(salaryRecord)
                .eq('id', existingId);
        } else if (!currentSalaryReceiptFile) {
            // Insert without receipt (only if not already created above in file upload step)
            await supabaseClient
                .from('driver_salary')
                .insert([salaryRecord]);
        }

        return savedSalaryId;

    } catch (error) {
        console.error('Error saving salary record:', error.message);
        throw error;
    }
}

// Load salary history (Updated with Receipt Column)
async function loadSalaryHistory() {
    try {
        const { data: salaryRecords, error } = await supabaseClient
            .from('driver_salary')
            .select('*, drivers(name)')
            .eq('user_id', getQueryUserId())
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const tbody = document.querySelector('#salaryHistoryTable tbody');
        if (!tbody) return;

        // Update table header to include receipt column if not present
        const table = document.querySelector('#salaryHistoryTable');
        if (table) {
            const headerRow = table.querySelector('thead tr');
            if (headerRow && !headerRow.innerHTML.includes('Receipt')) {
                const receiptHeader = document.createElement('th');
                receiptHeader.textContent = 'Receipt';
                // Insert before the actions column (last child)
                headerRow.insertBefore(receiptHeader, headerRow.lastElementChild);
            }
        }

        tbody.innerHTML = '';

        if (!salaryRecords || salaryRecords.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 30px; color: #7F8C8D;">
                        No salary records found. Generate salary slips to see them here.
                    </td>
                </tr>
            `;
            return;
        }

        salaryRecords.forEach(record => {
            const row = document.createElement('tr');

            // Format date for display
            const generatedDate = new Date(record.created_at);
            const formattedDate = generatedDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            // Receipt column
            const receiptColumn = record.receipt_url
                ? `<a href="${record.receipt_url}" target="_blank" class="receipt-link" title="View Receipt">
                    📄 PDF
                   </a>`
                : '<span style="color: #95A5A6;">No receipt</span>';

            // KM or Tip info column
            const isPerTip = record.salary_type === 'per_tip';
            const kmOrTipInfo = isPerTip
                ? `${(record.tip_count || 0)} tips${(record.half_tip_count || 0) > 0 ? ' + ' + record.half_tip_count + ' (0.5×)' : ''}`
                : `${(record.total_km || 0).toFixed(2)} km`;

            row.innerHTML = `
                <td>${record.drivers.name}</td>
                <td>${record.salary_month}</td>
                <td>${kmOrTipInfo}</td>
                <td>LKR ${record.gross_salary.toFixed(2)}</td>
                <td>LKR ${record.total_advances.toFixed(2)}</td>
                <td style="font-weight: bold; color: #27AE60;">LKR ${record.net_salary.toFixed(2)}</td>
                <td>${formattedDate}</td>
                <td>${receiptColumn}</td>
                <td>
                    <button class="btn btn-sm btn-view" onclick="viewSalarySlip(${record.id})" title="View Salary Slip">
                        \u{1F441}\uFE0F View
                    </button>
                    <button class="btn btn-sm btn-edit" onclick="editSalaryRecord(${record.id})" title="Edit Record">
                        \u270F\uFE0F Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSalaryRecord(${record.id})" title="Delete Record">
                        \u{1F5D1}\uFE0F Delete
                    </button>
                    <button class="btn-copy-sms btn-sm" title="Copy salary SMS">
                        \u{1F4CB} SMS
                    </button>
                </td>
            `;
            // Wire copy SMS button safely via addEventListener
            row.querySelector('.btn-copy-sms').addEventListener('click', function () {
                const msg = buildSalarySmsMessage(
                    record.drivers.name,
                    record.salary_month,
                    record.basic_salary || 0,
                    record.extra_km_salary || 0,
                    record.additional_allowance || 0,
                    record.total_km || 0,
                    record.total_advances || 0,
                    record.other_deductions || 0,
                    record.gross_salary || 0,
                    record.net_salary || 0,
                    record.salary_type || 'fixed',
                    record.tip_count || 0,
                    record.half_tip_count || 0,
                    record.per_tip_charge || 0,
                    record.tip_salary || 0
                );
                copyTextToClipboard(msg, this);
            });
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading salary history:', error.message);
    }
}

// Edit salary record (Updated to handle receipts & per-tip)
async function editSalaryRecord(salaryId) {
    try {
        const { data: salaryRecord, error } = await supabaseClient
            .from('driver_salary')
            .select('*, drivers(name, contact, license_number, address, basic_salary, km_limit, extra_km_rate, salary_type, per_tip_charge)')
            .eq('id', salaryId)
            .eq('user_id', getQueryUserId())
            .single();

        if (error) throw error;

        // Get advances for this month
        const [year, month] = salaryRecord.salary_month.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        const { data: advances } = await supabaseClient
            .from('driver_advances')
            .select('*')
            .eq('driver_id', salaryRecord.driver_id)
            .gte('advance_date', startDate)
            .lte('advance_date', endDate);

        // Determine salary type
        const salaryType = salaryRecord.salary_type || salaryRecord.drivers.salary_type || 'fixed';
        toggleSalaryFormSections(salaryType);

        // Populate form with existing data
        document.getElementById('salaryDriverSelect').value = salaryRecord.driver_id;
        document.getElementById('salaryMonth').value = salaryRecord.salary_month;
        document.getElementById('driverNameDisplay').value = salaryRecord.drivers.name;
        document.getElementById('salaryMonthDisplay').value = salaryRecord.salary_month;
        document.getElementById('basicSalaryDisplay').value = salaryRecord.basic_salary || 0;
        document.getElementById('kmLimitDisplay').value = salaryRecord.drivers.km_limit || 0;
        document.getElementById('extraKmRateDisplay').value = salaryRecord.drivers.extra_km_rate ? `LKR ${salaryRecord.drivers.extra_km_rate}/km` : 'LKR 0.00/km';
        document.getElementById('salaryId').value = salaryRecord.id;
        document.getElementById('totalKm').value = salaryRecord.total_km || 0;
        document.getElementById('additionalAllowance').value = salaryRecord.additional_allowance || 0;
        // otherDeductions is now computed from individual deductions
        document.getElementById('otherDeductions').value = 0; // will be updated by displayDeductions

        // Populate per-tip fields
        if (salaryType === 'per_tip') {
            document.getElementById('perTipChargeDisplay').value = salaryRecord.drivers.per_tip_charge ? `LKR ${salaryRecord.drivers.per_tip_charge}` : 'LKR 0';
            document.getElementById('tipCount').value = salaryRecord.tip_count || 0;
            document.getElementById('halfTipCount').value = salaryRecord.half_tip_count || 0;
            recalculateTipSalary();
        }

        // Display existing receipt if any
        if (salaryRecord.receipt_url) {
            existingSalaryReceiptUrl = salaryRecord.receipt_url;
            document.getElementById('currentSalaryReceipt').style.display = 'block';
            document.getElementById('currentSalaryReceiptLink').href = salaryRecord.receipt_url;
            document.getElementById('currentSalaryReceiptLink').textContent = 'View Receipt';
        } else {
            resetSalaryReceiptUpload();
        }

        // Display advances
        displayAdvances(advances);

        // Load deductions for this month
        currentDeductions = await loadStaffDeductions(salaryRecord.driver_id, salaryRecord.salary_month);
        displayDeductions(currentDeductions);

        // Set edit mode
        isEditMode = true;
        const generateBtn = document.getElementById('generateSalarySlipBtn');
        if (generateBtn) {
            generateBtn.textContent = '📄 Update Salary Slip';
        }

        // Calculate and display summary
        if (salaryType === 'fixed') {
            recalculateExtraKmSalary();
        }
        recalculateSalary();

        // Show form
        document.getElementById('salaryFormContainer').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('Error loading salary record for editing:', error.message);
        alert('Error loading salary record: ' + error.message);
    }
}

// Delete salary record (Updated to delete receipt)
async function deleteSalaryRecord(salaryId) {
    if (!confirm('Are you sure you want to delete this salary record? This action cannot be undone.')) {
        return;
    }

    try {
        // Check admin access
        if (typeof userRole !== 'undefined' && userRole === 'viewer') {
            alert('You do not have permission to delete salary records.');
            return;
        }

        // Get the record first to check for receipt
        const { data: salaryRecord, error: fetchError } = await supabaseClient
            .from('driver_salary')
            .select('receipt_url')
            .eq('id', salaryId)
            .eq('user_id', getQueryUserId())
            .single();

        if (fetchError) throw fetchError;

        // Delete receipt if exists
        if (salaryRecord?.receipt_url) {
            await deleteSalaryReceipt(salaryRecord.receipt_url);
        }

        // Delete salary record
        const { error } = await supabaseClient
            .from('driver_salary')
            .delete()
            .eq('id', salaryId)
            .eq('user_id', getQueryUserId());

        if (error) throw error;

        // Show success message
        alert('Salary record deleted successfully!');

        // Reload salary history
        loadSalaryHistory();

        // If the deleted record was being edited, reset the form
        const currentId = document.getElementById('salaryId').value;
        if (currentId && currentId == salaryId) {
            cancelSalaryForm();
        }

    } catch (error) {
        console.error('Error deleting salary record:', error.message);
        alert('Error deleting salary record: ' + error.message);
    }
}

// View existing salary slip (Updated to include receipt data)
async function viewSalarySlip(salaryId) {
    try {
        const { data: salaryRecord, error } = await supabaseClient
            .from('driver_salary')
            .select('*')
            .eq('id', salaryId)
            .eq('user_id', getQueryUserId())
            .single();

        if (error) throw error;

        // Set current salary data and generate PDF
        currentSalaryData = salaryRecord.salary_data;

        // Add receipt URL to data if exists
        if (salaryRecord.receipt_url) {
            currentSalaryData.receipt_url = salaryRecord.receipt_url;
        }

        createSalarySlipPDF();

    } catch (error) {
        console.error('Error viewing salary slip:', error.message);
        alert('Error loading salary slip: ' + error.message);
    }
}

// Reprint salary slip
async function reprintSalarySlip(salaryId) {
    await viewSalarySlip(salaryId);
}

// Cancel salary form (Updated to reset receipt)
function cancelSalaryForm() {
    document.getElementById('salaryFormContainer').style.display = 'none';
    document.getElementById('salaryForm').reset();
    document.getElementById('salaryId').value = '';
    currentSalaryData = null;
    isEditMode = false;

    // Reset deductions
    currentDeductions = [];
    const deductionsDetailsEl = document.getElementById('deductionsDetails');
    if (deductionsDetailsEl) deductionsDetailsEl.innerHTML = '';
    hideAddDeductionForm();

    // Reset receipt upload
    resetSalaryReceiptUpload();

    // Reset button text
    const generateBtn = document.getElementById('generateSalarySlipBtn');
    if (generateBtn) {
        generateBtn.textContent = '📄 Generate Salary Slip';
    }
}

// Create Salary Slip PDF with red theme
function createSalarySlipPDF() {
    if (!currentSalaryData) {
        alert('No salary data available');
        return;
    }

    try {
        // Create PDF document
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', 'a4');

        // Colors - Red Theme
        const primaryColor = [220, 20, 60]; // Crimson Red
        const secondaryColor = [245, 245, 245]; // Light Gray
        const textColor = [51, 51, 51]; // Dark Gray
        const accentColor = [39, 174, 96]; // Green for positive amounts

        // Page dimensions
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);

        // Add header with red background
        pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.rect(0, 0, pageWidth, 40, 'F');

        // Add company name
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text('JAYASOORIYA TRANSPORT', pageWidth / 2, 20, { align: 'center' });

        pdf.setFontSize(14);
        pdf.text('DRIVER SALARY SLIP', pageWidth / 2, 30, { align: 'center' });

        // Reset text color
        pdf.setTextColor(textColor[0], textColor[1], textColor[2]);

        // Add generation date
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Generated on: ${currentSalaryData.generatedDate}`, pageWidth - margin, 50, { align: 'right' });

        // Driver Information Section
        let yPos = 60;

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DRIVER INFORMATION', margin, yPos);

        yPos += 10;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);

        pdf.text(`Name: ${currentSalaryData.driver.name}`, margin, yPos);
        pdf.text(`Contact: ${currentSalaryData.driver.contact}`, margin + 70, yPos);
        yPos += 6;

        pdf.text(`License: ${currentSalaryData.driver.license}`, margin, yPos);
        pdf.text(`Salary Month: ${currentSalaryData.salaryMonth}`, margin + 70, yPos);
        yPos += 6;

        pdf.text(`Address: ${currentSalaryData.driver.address}`, margin, yPos);
        yPos += 15;

        // Salary Details Section
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SALARY DETAILS', margin, yPos);

        yPos += 10;

        // Create salary details table based on salary type
        let salaryDetails = [];
        const isPerTipPDF = currentSalaryData.salaryType === 'per_tip';

        if (isPerTipPDF) {
            salaryDetails = [
                ['Description', 'Details', 'Amount (LKR)'],
                ['Per Tip Charge', `LKR ${(currentSalaryData.perTipCharge || 0).toFixed(2)} / tip`, '-'],
                ['Normal Tips (1×)', `${currentSalaryData.tipCount || 0} tips`, ((currentSalaryData.tipCount || 0) * (currentSalaryData.perTipCharge || 0)).toFixed(2)],
                ['0.5× Tips (Half Tip)', `${currentSalaryData.halfTipCount || 0} tips @ 0.5×`, ((currentSalaryData.halfTipCount || 0) * (currentSalaryData.perTipCharge || 0) * 0.5).toFixed(2)],
                ['Tip Salary', `Total: ${(currentSalaryData.tipCount || 0) + (currentSalaryData.halfTipCount || 0)} tips`, (currentSalaryData.tipSalary || 0).toFixed(2)],
                ['Additional Allowance', 'Bonus', currentSalaryData.additionalAllowance.toFixed(2)],
                ['', '', ''],
                ['GROSS SALARY', '', currentSalaryData.grossSalary.toFixed(2)]
            ];
        } else {
            salaryDetails = [
                ['Description', 'Details', 'Amount (LKR)'],
                ['Basic Salary', '-', currentSalaryData.basicSalary.toFixed(2)],
                ['Total KM Driven', `${currentSalaryData.totalKm.toFixed(2)} km`, '-'],
                ['KM Limit in Salary', `${currentSalaryData.kmLimit.toFixed(2)} km`, '-'],
                ['Extra KM', `${currentSalaryData.extraKm.toFixed(2)} km @ LKR ${currentSalaryData.extraKmRate}/km`, currentSalaryData.extraKmSalary.toFixed(2)],
                ['Additional Allowance', 'Bonus', currentSalaryData.additionalAllowance.toFixed(2)],
                ['', '', ''],
                ['GROSS SALARY', '', currentSalaryData.grossSalary.toFixed(2)]
            ];
        }

        // Draw salary details table
        pdf.setFontSize(10);
        salaryDetails.forEach((row, rowIndex) => {
            const isHeader = rowIndex === 0;
            const isTotal = row[0] === 'GROSS SALARY';

            pdf.setFont('helvetica', isHeader || isTotal ? 'bold' : 'normal');

            if (isHeader) {
                pdf.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
                pdf.rect(margin, yPos, contentWidth, 8, 'F');
                pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
            } else if (isTotal) {
                pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2], 0.1);
                pdf.rect(margin, yPos, contentWidth, 8, 'F');
                pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            } else {
                pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
            }

            pdf.text(row[0], margin + 2, yPos + 5);
            pdf.text(row[1], margin + 60, yPos + 5);
            pdf.text(row[2], pageWidth - margin - 2, yPos + 5, { align: 'right' });

            yPos += 8;
        });

        yPos += 5;

        // Advances Section
        if (currentSalaryData.advances.length > 0) {
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
            pdf.text('ADVANCES & DEDUCTIONS', margin, yPos);

            yPos += 10;

            // Advances header
            pdf.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            pdf.rect(margin, yPos, contentWidth, 8, 'F');
            pdf.setFontSize(10);
            pdf.text('Date', margin + 2, yPos + 5);
            pdf.text('Description', margin + 40, yPos + 5);
            pdf.text('Amount (LKR)', pageWidth - margin - 2, yPos + 5, { align: 'right' });

            yPos += 8;

            // Advances rows
            pdf.setFont('helvetica', 'normal');
            currentSalaryData.advances.forEach(advance => {
                pdf.text(advance.advance_date, margin + 2, yPos + 5);
                pdf.text(advance.notes || 'Advance', margin + 40, yPos + 5);
                pdf.text(advance.amount.toFixed(2), pageWidth - margin - 2, yPos + 5, { align: 'right' });
                yPos += 6;
            });

            // Total advances
            yPos += 2;
            pdf.setFont('helvetica', 'bold');
            pdf.text('Total Advances:', pageWidth - margin - 60, yPos + 5);
            pdf.text(currentSalaryData.totalAdvances.toFixed(2), pageWidth - margin - 2, yPos + 5, { align: 'right' });
            yPos += 8;

            // Other deductions
            if (currentSalaryData.otherDeductions > 0) {
                pdf.setFont('helvetica', 'normal');
                pdf.text('Other Deductions:', pageWidth - margin - 60, yPos + 5);
                pdf.text(currentSalaryData.otherDeductions.toFixed(2), pageWidth - margin - 2, yPos + 5, { align: 'right' });
                yPos += 8;
            }

            yPos += 5;
        }

        // Net Salary Section
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2], 0.2);
        pdf.rect(margin, yPos, contentWidth, 12, 'F');

        pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        pdf.text('NET SALARY PAYABLE:', margin + 2, yPos + 8);
        pdf.text(`LKR ${currentSalaryData.netSalary.toFixed(2)}`, pageWidth - margin - 2, yPos + 8, { align: 'right' });

        yPos += 20;

        // Footer notes
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);

        const notes = [
            'Note:',
            '1. This is a computer generated salary slip.',
            '2. Please report any discrepancies within 7 days.',
            '3. Advances are deducted from the monthly salary.',
            `4. Salary calculated for ${currentSalaryData.salaryMonth}.`,
            '5. KM details are based on records provided.'
        ];

        notes.forEach(note => {
            if (yPos > 270) {
                pdf.addPage();
                yPos = 20;
            }
            pdf.text(note, margin, yPos);
            yPos += 5;
        });

        // Signature line
        yPos = 270;
        pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.line(margin + 100, yPos, pageWidth - margin, yPos);
        pdf.setFontSize(10);
        pdf.text('Authorized Signature', margin + 100, yPos + 8, { align: 'center' });

        // New: Add Receipt Note if URL exists
        if (currentSalaryData.receipt_url) {
            yPos += 15;
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            pdf.text('Payment Receipt: Available online', margin, yPos);
        }

        // Save PDF with appropriate name
        const fileName = `Salary_Slip_${currentSalaryData.driver.name.replace(/\s+/g, '_')}_${currentSalaryData.salaryMonth}.pdf`;
        pdf.save(fileName);

    } catch (error) {
        console.error('Error creating PDF:', error);
        alert('Error generating PDF: ' + error.message);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSalarySection);
} else {
    initSalarySection();
}

// NOTE: switchPage is defined in app.js — this file does NOT override it.
// Salary section hooks are handled via the driver-salary case in app.js switchPage.

// ============ SALARY SMS COPY UTILITIES ============

function buildSalarySmsMessage(driverName, salaryMonth, basicSalary, extraKmSalary, additionalAllowance, totalKm, totalAdvances, otherDeductions, grossSalary, netSalary, salaryType, tipCount, halfTipCount, perTipCharge, tipSalary) {
    // Format month label e.g. "2025-05" -> "May 2025"
    let monthLabel = salaryMonth;
    if (salaryMonth && salaryMonth.includes('-')) {
        const [yr, mo] = salaryMonth.split('-');
        try { monthLabel = new Date(yr, mo - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' }); } catch (e) { }
    }

    const lines = [];
    lines.push('Jayasooriya Transport');
    lines.push('Dear ' + driverName + ',');
    lines.push('');
    lines.push('Salary Summary - ' + monthLabel);
    lines.push('');
    lines.push('-- Earnings --');

    if (salaryType === 'per_tip') {
        lines.push('Per Tip Charge:    LKR ' + Number(perTipCharge || 0).toFixed(2));
        lines.push('Normal Tips (1x):  ' + Number(tipCount || 0));
        if (Number(halfTipCount) > 0) {
            lines.push('0.5x Tips:         ' + Number(halfTipCount));
        }
        lines.push('Tip Salary:        LKR ' + Number(tipSalary || 0).toFixed(2));
    } else {
        lines.push('Basic Salary:      LKR ' + Number(basicSalary).toFixed(2));
        if (Number(extraKmSalary) > 0) {
            lines.push('Extra KM Salary:   LKR ' + Number(extraKmSalary).toFixed(2));
        }
    }

    if (Number(additionalAllowance) > 0) {
        lines.push('Allowance:         LKR ' + Number(additionalAllowance).toFixed(2));
    }
    lines.push('Gross Salary:      LKR ' + Number(grossSalary).toFixed(2));
    lines.push('');
    lines.push('-- Deductions --');
    lines.push('Advances:          LKR ' + Number(totalAdvances).toFixed(2));
    if (Number(otherDeductions) > 0) {
        lines.push('Other Deductions:  LKR ' + Number(otherDeductions).toFixed(2));
    }
    lines.push('');
    lines.push('Net Salary:        LKR ' + Number(netSalary).toFixed(2));
    lines.push('');
    lines.push('Thank you.');

    return lines.join('\n');
}

function copyTextToClipboard(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText && location.protocol !== 'file:') {
        navigator.clipboard.writeText(text).then(() => {
            showCopySmsSuccess(btn);
        }).catch(() => {
            fallbackCopyText(text, btn);
        });
    } else {
        fallbackCopyText(text, btn);
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
    try { ta.setSelectionRange(0, 99999); } catch (e) { }
    let success = false;
    try { success = document.execCommand('copy'); } catch (e) { }
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