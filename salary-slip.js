// salary-slip.js - Driver Salary Slip Generator with Transport Logo & Red Theme
// UPDATED: Added full CRUD operations (Edit & Delete)

// Global variable to store salary data for PDF generation
let currentSalaryData = null;
let isEditMode = false;

// Initialize salary section
function initSalarySection() {
    document.getElementById('loadSalaryDataBtn')?.addEventListener('click', loadDriverSalaryData);
    document.getElementById('calculateSalaryBtn')?.addEventListener('click', calculateSalary);
    document.getElementById('generateSalarySlipBtn')?.addEventListener('click', generateSalarySlip);
    document.getElementById('cancelSalaryBtn')?.addEventListener('click', cancelSalaryForm);
    document.getElementById('totalKm')?.addEventListener('input', recalculateExtraKmSalary);
    document.getElementById('additionalAllowance')?.addEventListener('input', recalculateSalary);
    document.getElementById('otherDeductions')?.addEventListener('input', recalculateSalary);
    
    // Set default month
    const now = new Date();
    const monthStr = now.toISOString().substring(0, 7);
    const salaryMonthEl = document.getElementById('salaryMonth');
    if (salaryMonthEl) salaryMonthEl.value = monthStr;
    
    // Load drivers for selection
    loadSalaryDrivers();
    // Load salary history
    loadSalaryHistory();
}

// Load drivers for salary calculation
async function loadSalaryDrivers() {
    try {
        const { data: drivers, error } = await supabaseClient
            .from('drivers')
            .select('id, name, basic_salary, km_limit, extra_km_rate')
            .eq('user_id', getQueryUserId())
            .order('name');
        
        if (error) throw error;
        
        const select = document.getElementById('salaryDriverSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Driver</option>';
        
        drivers.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.id;
            option.textContent = `${driver.name} (${driver.basic_salary ? 'LKR ' + driver.basic_salary : 'No salary set'})`;
            option.dataset.basicSalary = driver.basic_salary || 0;
            option.dataset.kmLimit = driver.km_limit || 0;
            option.dataset.extraKmRate = driver.extra_km_rate || 0;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading drivers for salary:', error.message);
    }
}

// Load driver salary data
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
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
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
        
        // Display advances
        displayAdvances(advances);
        
        // If existing salary found, populate the form
        if (existingSalary) {
            isEditMode = true;
            document.getElementById('salaryId').value = existingSalary.id;
            document.getElementById('totalKm').value = existingSalary.total_km || 0;
            document.getElementById('additionalAllowance').value = existingSalary.additional_allowance || 0;
            document.getElementById('otherDeductions').value = existingSalary.other_deductions || 0;
            
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
            document.getElementById('otherDeductions').value = 0;
            
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

// Display advances in the form
function displayAdvances(advances) {
    const advancesDetails = document.getElementById('advancesDetails');
    const totalAdvancesDisplay = document.getElementById('totalAdvancesDisplay');
    
    if (!advances || advances.length === 0) {
        advancesDetails.innerHTML = '<p style="color: #666; font-style: italic;">No advances for this month</p>';
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
        html += '<tr style="border-bottom: 1px solid #eee;">';
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
    const basicSalary = parseFloat(document.getElementById('basicSalaryDisplay').value) || 0;
    const extraKmSalary = parseFloat(document.getElementById('extraKmSalary').value) || 0;
    const additionalAllowance = parseFloat(document.getElementById('additionalAllowance').value) || 0;
    const otherDeductions = parseFloat(document.getElementById('otherDeductions').value) || 0;
    const totalAdvancesText = document.getElementById('totalAdvancesDisplay').textContent;
    
    // Extract total advances from text
    const totalAdvancesMatch = totalAdvancesText.match(/LKR (\d+(\.\d+)?)/);
    const totalAdvances = totalAdvancesMatch ? parseFloat(totalAdvancesMatch[1]) : 0;
    
    const grossSalary = basicSalary + extraKmSalary + additionalAllowance;
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
    const totalKm = parseFloat(document.getElementById('totalKm').value) || 0;
    
    if (!driverId || !monthValue) {
        alert('Please select both driver and month');
        return;
    }
    
    if (!totalKm || totalKm <= 0) {
        alert('Please enter valid total KM');
        return;
    }
    
    recalculateSalary();
    alert('Salary calculated successfully! Click "Generate Salary Slip" to create/update PDF.');
}

// Generate salary slip PDF
async function generateSalarySlip() {
    const driverId = document.getElementById('salaryDriverSelect').value;
    const monthValue = document.getElementById('salaryMonth').value;
    const totalKm = parseFloat(document.getElementById('totalKm').value) || 0;
    
    if (!driverId || !monthValue || !totalKm) {
        alert('Please calculate salary first');
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
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const { data: advances, error: advancesError } = await supabaseClient
            .from('driver_advances')
            .select('*')
            .eq('driver_id', driverId)
            .gte('advance_date', startDate)
            .lte('advance_date', endDate);
        
        if (advancesError) throw advancesError;
        
        // Calculate values
        const basicSalary = parseFloat(document.getElementById('basicSalaryDisplay').value) || 0;
        const kmLimit = parseFloat(document.getElementById('kmLimitDisplay').value) || 0;
        const extraKmRateText = document.getElementById('extraKmRateDisplay').value;
        const extraKmRateMatch = extraKmRateText.match(/LKR (\d+(\.\d+)?)/);
        const extraKmRate = extraKmRateMatch ? parseFloat(extraKmRateMatch[1]) : 0;
        
        const extraKm = Math.max(0, totalKm - kmLimit);
        const extraKmSalary = extraKm * extraKmRate;
        const additionalAllowance = parseFloat(document.getElementById('additionalAllowance').value) || 0;
        const otherDeductions = parseFloat(document.getElementById('otherDeductions').value) || 0;
        const totalAdvances = advances?.reduce((sum, adv) => sum + adv.amount, 0) || 0;
        
        const grossSalary = basicSalary + extraKmSalary + additionalAllowance;
        const netSalary = grossSalary - totalAdvances - otherDeductions;
        
        // Prepare salary data for PDF
        currentSalaryData = {
            driver: {
                name: driver.name,
                contact: driver.contact,
                license: driver.license_number,
                address: driver.address
            },
            salaryMonth: monthValue,
            basicSalary: basicSalary,
            totalKm: totalKm,
            kmLimit: kmLimit,
            extraKm: extraKm,
            extraKmRate: extraKmRate,
            extraKmSalary: extraKmSalary,
            additionalAllowance: additionalAllowance,
            advances: advances || [],
            totalAdvances: totalAdvances,
            otherDeductions: otherDeductions,
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
        
        // Save/update salary record to database
        await saveSalaryRecord(driverId, monthValue, currentSalaryData);
        
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

// Save salary record to database
async function saveSalaryRecord(driverId, monthValue, salaryData) {
    try {
        const salaryRecord = {
            driver_id: driverId,
            salary_month: monthValue,
            total_km: salaryData.totalKm,
            basic_salary: salaryData.basicSalary,
            extra_km_salary: salaryData.extraKmSalary,
            additional_allowance: salaryData.additionalAllowance,
            total_advances: salaryData.totalAdvances,
            other_deductions: salaryData.otherDeductions,
            gross_salary: salaryData.grossSalary,
            net_salary: salaryData.netSalary,
            salary_data: salaryData, // Store full data as JSON
            user_id: getQueryUserId(),
            updated_at: new Date().toISOString()
        };
        
        const existingId = document.getElementById('salaryId').value;
        
        if (existingId) {
            await supabaseClient
                .from('driver_salary')
                .update(salaryRecord)
                .eq('id', existingId);
        } else {
            await supabaseClient
                .from('driver_salary')
                .insert([salaryRecord]);
        }
        
    } catch (error) {
        console.error('Error saving salary record:', error.message);
        throw error;
    }
}

// Load salary history
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
        tbody.innerHTML = '';
        
        if (!salaryRecords || salaryRecords.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 30px; color: #7F8C8D;">
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
            
            row.innerHTML = `
                <td>${record.drivers.name}</td>
                <td>${record.salary_month}</td>
                <td>${record.total_km.toFixed(2)} km</td>
                <td>LKR ${record.gross_salary.toFixed(2)}</td>
                <td>LKR ${record.total_advances.toFixed(2)}</td>
                <td style="font-weight: bold; color: #27AE60;">LKR ${record.net_salary.toFixed(2)}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="btn btn-sm btn-view" onclick="viewSalarySlip(${record.id})" title="View Salary Slip">
                        👁️ View
                    </button>
                    <button class="btn btn-sm btn-edit" onclick="editSalaryRecord(${record.id})" title="Edit Record">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSalaryRecord(${record.id})" title="Delete Record">
                        🗑️ Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading salary history:', error.message);
    }
}

// Edit salary record
async function editSalaryRecord(salaryId) {
    try {
        const { data: salaryRecord, error } = await supabaseClient
            .from('driver_salary')
            .select('*, drivers(name, contact, license_number, address, basic_salary, km_limit, extra_km_rate)')
            .eq('id', salaryId)
            .eq('user_id', getQueryUserId())
            .single();
        
        if (error) throw error;
        
        // Get advances for this month
        const [year, month] = salaryRecord.salary_month.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const { data: advances } = await supabaseClient
            .from('driver_advances')
            .select('*')
            .eq('driver_id', salaryRecord.driver_id)
            .gte('advance_date', startDate)
            .lte('advance_date', endDate);
        
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
        document.getElementById('otherDeductions').value = salaryRecord.other_deductions || 0;
        
        // Display advances
        displayAdvances(advances);
        
        // Set edit mode
        isEditMode = true;
        const generateBtn = document.getElementById('generateSalarySlipBtn');
        if (generateBtn) {
            generateBtn.textContent = '📄 Update Salary Slip';
        }
        
        // Calculate and display summary
        recalculateExtraKmSalary();
        recalculateSalary();
        
        // Show form
        document.getElementById('salaryFormContainer').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error loading salary record for editing:', error.message);
        alert('Error loading salary record: ' + error.message);
    }
}

// Delete salary record
async function deleteSalaryRecord(salaryId) {
    if (!confirm('Are you sure you want to delete this salary record? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Check admin access
        if (userRole === 'viewer') {
            alert('You do not have permission to delete salary records.');
            return;
        }
        
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

// View existing salary slip
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

// Cancel salary form
function cancelSalaryForm() {
    document.getElementById('salaryFormContainer').style.display = 'none';
    document.getElementById('salaryForm').reset();
    document.getElementById('salaryId').value = '';
    currentSalaryData = null;
    isEditMode = false;
    
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
        
        // Create salary details table
        const salaryDetails = [
            ['Description', 'Details', 'Amount (LKR)'],
            ['Basic Salary', '-', currentSalaryData.basicSalary.toFixed(2)],
            ['Total KM Driven', `${currentSalaryData.totalKm.toFixed(2)} km`, '-'],
            ['KM Limit in Salary', `${currentSalaryData.kmLimit.toFixed(2)} km`, '-'],
            ['Extra KM', `${currentSalaryData.extraKm.toFixed(2)} km @ LKR ${currentSalaryData.extraKmRate}/km`, currentSalaryData.extraKmSalary.toFixed(2)],
            ['Additional Allowance', 'Bonus', currentSalaryData.additionalAllowance.toFixed(2)],
            ['', '', ''],
            ['GROSS SALARY', '', currentSalaryData.grossSalary.toFixed(2)]
        ];
        
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

// Add to page switching
function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(page);
    if (pageEl) pageEl.classList.add('active');
    
    const titles = {
        'dashboard': 'Dashboard',
        'drivers': 'Manage Drivers',
        'driver-advances': 'Driver Salary Advances',
        'driver-salary': 'Driver Salary Calculator & Salary Slips',
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
    if (page === 'driver-salary') {
        loadSalaryDrivers();
        loadSalaryHistory();
    }
    if (page === 'hire-vehicles') loadHireVehicles();
    if (page === 'hire-records') loadHireRecords();
    if (page === 'commitment-vehicles') loadCommitmentVehicles();
    if (page === 'commitment-records') loadCommitmentRecords();
    if (page === 'commitment-dayoffs') loadDayOffs();
}