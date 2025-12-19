// report-generator.js - PDF Report Generator for Jayasooriya Transport
// Updated with proper Supabase client references and enhanced sections

// Function to load and add logo to PDF
async function addLogoToReport(doc, x, y, size) {
    return new Promise((resolve, reject) => {
        const logoUrl = 'https://i.postimg.cc/x19FXbdR/New-Transport-Logo.png';
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = function() {
            try {
                // Draw white circle background
                doc.setFillColor(255, 255, 255);
                doc.circle(x + size/2, y + size/2, size/2, 'F');
                
                // Add logo image
                doc.addImage(img, 'PNG', x + 2, y + 2, size - 4, size - 4);
                resolve();
            } catch (error) {
                console.error('Error adding logo:', error);
                resolve();
            }
        };
        
        img.onerror = function() {
            console.error('Failed to load logo');
            resolve();
        };
        
        img.src = logoUrl;
    });
}

async function generateMonthlyReport(monthValue) {
    try {
        showReportLoading();
        
        const [year, month] = monthValue.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const monthName = new Date(year, month - 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        
        // Fetch all data
        const reportData = await fetchReportData(startDate, endDate);
        
        // Generate PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        let yPosition = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);
        
        // Helper function to check if we need a new page
        function checkNewPage(requiredSpace = 30) {
            if (yPosition + requiredSpace > pageHeight - 25) {
                doc.addPage();
                yPosition = margin;
                return true;
            }
            return false;
        }
        
        // ==================== HEADER ====================
        doc.setFillColor(220, 20, 60);
        doc.rect(0, 0, pageWidth, 45, 'F');
        
        // Add logo
        await addLogoToReport(doc, 15, 10, 25);
        
        // Company name and title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('JAYASOORIYA TRANSPORT', pageWidth / 2, 18, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Monthly Business Report', pageWidth / 2, 26, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(monthName, pageWidth / 2, 35, { align: 'center' });
        
        yPosition = 55;
        
        // ==================== EXECUTIVE SUMMARY ====================
        doc.setTextColor(220, 20, 60);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Financial Summary', margin, yPosition);
        
        yPosition += 8;
        
        // Summary boxes in a clean grid
        const summaryData = [
            { label: 'Total Revenue', value: reportData.totalRevenue, color: [220, 20, 60] },
            { label: 'Fuel Cost', value: reportData.totalFuelCost, color: [231, 76, 60] },
            { label: 'Net Profit', value: reportData.netProfit, color: [39, 174, 96] },
            { label: 'Profit Margin', value: reportData.profitMargin.toFixed(1) + '%', color: [52, 152, 219] }
        ];
        
        const boxWidth = (contentWidth - 5) / 2;
        const boxHeight = 18;
        let xPos = margin;
        let row = 0;
        
        summaryData.forEach((item, index) => {
            if (index % 2 === 0 && index > 0) {
                row++;
                xPos = margin;
            }
            
            const boxY = yPosition + (row * (boxHeight + 3));
            
            // Simple colored box
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.roundedRect(xPos, boxY, boxWidth, boxHeight, 2, 2, 'F');
            
            // Text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(item.label, xPos + 4, boxY + 6);
            
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            const valueText = typeof item.value === 'number' && item.label !== 'Profit Margin' 
                ? `LKR ${item.value.toFixed(2)}` 
                : item.value;
            doc.text(valueText, xPos + 4, boxY + 14);
            
            xPos += boxWidth + 5;
        });
        
        yPosition += (Math.ceil(summaryData.length / 2) * (boxHeight + 3)) + 12;
        
        // ==================== REVENUE BREAKDOWN ====================
        checkNewPage(40);
        
        doc.setTextColor(220, 20, 60);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Revenue Breakdown', margin, yPosition);
        
        yPosition += 8;
        
        const breakdownData = [
            { label: 'Hire-to-Pay Revenue', value: reportData.hireRevenue },
            { label: 'Commitment Base Payment', value: reportData.commitmentBaseRevenue },
            { label: 'Extra KM Charges', value: reportData.extraKmCharges },
            { label: 'Day Off Deductions', value: -reportData.dayOffDeductions, negative: true }
        ];
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        breakdownData.forEach(item => {
            doc.setTextColor(60, 60, 60);
            doc.text(item.label, margin + 2, yPosition);
            
            doc.setFont('helvetica', 'bold');
            const color = item.negative ? [220, 20, 60] : [0, 0, 0];
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(
                `LKR ${Math.abs(item.value).toFixed(2)}${item.negative ? ' (-)' : ''}`, 
                pageWidth - margin - 2, 
                yPosition, 
                { align: 'right' }
            );
            
            doc.setFont('helvetica', 'normal');
            yPosition += 7;
        });
        
        // Total line
        doc.setDrawColor(220, 20, 60);
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 6;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Total Revenue', margin + 2, yPosition);
        doc.setTextColor(39, 174, 96);
        doc.text(`LKR ${reportData.totalRevenue.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
        
        yPosition += 12;
        
        // ==================== HIRE-TO-PAY PERFORMANCE ====================
        checkNewPage(45);
        
        doc.setTextColor(220, 20, 60);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Hire-to-Pay Vehicles', margin, yPosition);
        
        yPosition += 8;
        
        if (reportData.hireVehiclePerformance.length > 0) {
            // Table header
            doc.setFillColor(220, 20, 60);
            doc.rect(margin, yPosition, contentWidth, 7, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            
            const colWidths = [30, 25, 25, 30, 30, 30];
            let colX = margin + 2;
            const headers = ['Vehicle', 'Ownership', 'KM', 'Revenue', 'Fuel', 'Profit'];
            
            headers.forEach((header, i) => {
                doc.text(header, colX, yPosition + 5);
                colX += colWidths[i];
            });
            
            yPosition += 7;
            
            // Table rows
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            
            reportData.hireVehiclePerformance.forEach((vehicle, index) => {
                checkNewPage(7);
                
                // Alternate row color
                if (index % 2 === 0) {
                    doc.setFillColor(248, 248, 248);
                    doc.rect(margin, yPosition, contentWidth, 7, 'F');
                }
                
                colX = margin + 2;
                doc.text(vehicle.number, colX, yPosition + 5);
                colX += colWidths[0];
                doc.text(vehicle.ownership, colX, yPosition + 5);
                colX += colWidths[1];
                doc.text(vehicle.totalKm.toFixed(0), colX, yPosition + 5);
                colX += colWidths[2];
                doc.text(vehicle.revenue.toFixed(0), colX, yPosition + 5);
                colX += colWidths[3];
                doc.text(vehicle.fuelCost.toFixed(0), colX, yPosition + 5);
                colX += colWidths[4];
                
                // Profit in green/red
                const profitColor = vehicle.profit >= 0 ? [39, 174, 96] : [231, 76, 60];
                doc.setTextColor(profitColor[0], profitColor[1], profitColor[2]);
                doc.setFont('helvetica', 'bold');
                doc.text(vehicle.profit.toFixed(0), colX, yPosition + 5);
                
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                yPosition += 7;
            });
        } else {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('No hire-to-pay records this month', margin, yPosition + 5);
            yPosition += 10;
        }
        
        yPosition += 8;
        
        // ==================== COMMITMENT VEHICLES ====================
        checkNewPage(45);
        
        doc.setTextColor(220, 20, 60);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Commitment Vehicles', margin, yPosition);
        
        yPosition += 8;
        
        if (reportData.commitmentVehiclePerformance.length > 0) {
            // Table header
            doc.setFillColor(220, 20, 60);
            doc.rect(margin, yPosition, contentWidth, 7, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            
            const colWidths = [35, 30, 35, 35, 35];
            let colX = margin + 2;
            const headers = ['Vehicle', 'KM', 'Revenue', 'Fuel', 'Profit'];
            
            headers.forEach((header, i) => {
                doc.text(header, colX, yPosition + 5);
                colX += colWidths[i];
            });
            
            yPosition += 7;
            
            // Table rows
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            
            reportData.commitmentVehiclePerformance.forEach((vehicle, index) => {
                checkNewPage(7);
                
                if (index % 2 === 0) {
                    doc.setFillColor(248, 248, 248);
                    doc.rect(margin, yPosition, contentWidth, 7, 'F');
                }
                
                colX = margin + 2;
                doc.text(vehicle.number, colX, yPosition + 5);
                colX += colWidths[0];
                doc.text(vehicle.totalKm.toFixed(0), colX, yPosition + 5);
                colX += colWidths[1];
                doc.text(vehicle.revenue.toFixed(0), colX, yPosition + 5);
                colX += colWidths[2];
                doc.text(vehicle.fuelCost.toFixed(0), colX, yPosition + 5);
                colX += colWidths[3];
                
                const profitColor = vehicle.profit >= 0 ? [39, 174, 96] : [231, 76, 60];
                doc.setTextColor(profitColor[0], profitColor[1], profitColor[2]);
                doc.setFont('helvetica', 'bold');
                doc.text(vehicle.profit.toFixed(0), colX, yPosition + 5);
                
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                yPosition += 7;
            });
        } else {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('No commitment vehicle records this month', margin, yPosition + 5);
            yPosition += 10;
        }
        
        yPosition += 8;
        
        // ==================== OPERATIONAL STATISTICS ====================
        checkNewPage(50);
        
        doc.setTextColor(220, 20, 60);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Operational Statistics', margin, yPosition);
        
        yPosition += 8;
        
        const stats = [
            { label: 'Total Hire-to-Pay Hires', value: reportData.hireToPayCount },
            { label: 'Total Commitment Hires', value: reportData.commitmentCount },
            { label: 'Total Day Offs', value: reportData.dayOffCount },
            { label: 'Total Distance Covered', value: `${reportData.totalDistance.toFixed(0)} km` },
            { label: 'Average Revenue per Hire', value: `LKR ${reportData.avgRevenuePerHire.toFixed(2)}` },
            { label: 'Driver Advances Paid', value: `LKR ${reportData.totalDriverAdvances.toFixed(2)}` }
        ];
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        stats.forEach(item => {
            doc.setTextColor(60, 60, 60);
            doc.text(item.label, margin + 2, yPosition);
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(item.value.toString(), pageWidth - margin - 2, yPosition, { align: 'right' });
            
            doc.setFont('helvetica', 'normal');
            yPosition += 7;
        });
        
        // ==================== FOOTER ON EVERY PAGE ====================
        const totalPages = doc.internal.getNumberOfPages();
        const generatedDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            
            // Footer background
            doc.setFillColor(220, 20, 60);
            doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
            
            // Footer text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            
            doc.text('Jayasooriya Transport', margin, pageHeight - 8);
            doc.text(`Generated: ${generatedDate}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
            doc.text(`Page ${i}/${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
        }
        
        // Save PDF
        const fileName = `Jayasooriya_Report_${monthName.replace(' ', '_')}.pdf`;
        doc.save(fileName);
        
        hideReportLoading();
        showReportSuccess();
        
    } catch (error) {
        console.error('Error generating report:', error);
        hideReportLoading();
        alert('Error generating report: ' + error.message);
    }
}

// Fetch all data from Supabase
async function fetchReportData(startDate, endDate) {
    // Fetch hire-to-pay records
    const { data: hireRecords } = await supabaseClient
        .from('hire_to_pay_records')
        .select('*, hire_to_pay_vehicles(lorry_number, ownership)')
        .eq('user_id', getQueryUserId())
        .gte('hire_date', startDate)
        .lte('hire_date', endDate);
    
    // Fetch commitment records
    const { data: commitmentRecords } = await supabaseClient
        .from('commitment_records')
        .select('*, commitment_vehicles(vehicle_number)')
        .eq('user_id', getQueryUserId())
        .gte('hire_date', startDate)
        .lte('hire_date', endDate);
    
    // Fetch day offs
    const { data: dayOffs } = await supabaseClient
        .from('commitment_day_offs')
        .select('*')
        .eq('user_id', getQueryUserId())
        .gte('day_off_date', startDate)
        .lte('day_off_date', endDate);
    
    // Fetch driver advances
    const { data: driverAdvances } = await supabaseClient
        .from('driver_advances')
        .select('*')
        .eq('user_id', getQueryUserId())
        .gte('advance_date', startDate)
        .lte('advance_date', endDate);
    
    // Get commitment vehicles
    const commitmentVehicleIds = new Set();
    commitmentRecords?.forEach(record => {
        commitmentVehicleIds.add(record.vehicle_id);
    });
    
    const { data: commitmentVehicles } = await supabaseClient
        .from('commitment_vehicles')
        .select('*')
        .eq('user_id', getQueryUserId())
        .in('id', Array.from(commitmentVehicleIds).length > 0 ? Array.from(commitmentVehicleIds) : [0]);
    
    // Calculate hire-to-pay metrics
    let hireRevenue = 0;
    let hireFuelCost = 0;
    let hireDistance = 0;
    const hireVehicleMap = new Map();
    
    hireRecords?.forEach(record => {
        hireRevenue += record.hire_amount || 0;
        hireFuelCost += record.fuel_cost || 0;
        hireDistance += record.distance || 0;
        
        const vehicleId = record.vehicle_id;
        if (!hireVehicleMap.has(vehicleId)) {
            hireVehicleMap.set(vehicleId, {
                number: record.hire_to_pay_vehicles.lorry_number,
                ownership: record.hire_to_pay_vehicles.ownership === 'company' ? 'Company' : 'Rented',
                totalKm: 0,
                revenue: 0,
                fuelCost: 0,
                profit: 0
            });
        }
        
        const vehicle = hireVehicleMap.get(vehicleId);
        vehicle.totalKm += record.distance || 0;
        vehicle.revenue += record.hire_amount || 0;
        vehicle.fuelCost += record.fuel_cost || 0;
        vehicle.profit = vehicle.revenue - vehicle.fuelCost;
    });
    
    // Calculate commitment metrics
    let commitmentBaseRevenue = 0;
    let commitmentFuelCost = 0;
    let commitmentDistance = 0;
    let extraKmCharges = 0;
    let dayOffDeductions = 0;
    const commitmentVehicleMap = new Map();
    
    commitmentVehicles?.forEach(vehicle => {
        commitmentBaseRevenue += vehicle.fixed_monthly_payment || 0;
    });
    
    dayOffs?.forEach(dayOff => {
        dayOffDeductions += dayOff.deduction_amount || 0;
    });
    
    commitmentRecords?.forEach(record => {
        commitmentFuelCost += record.fuel_cost || 0;
        commitmentDistance += record.distance || 0;
        extraKmCharges += record.extra_charges || 0;
        
        const vehicleId = record.vehicle_id;
        if (!commitmentVehicleMap.has(vehicleId)) {
            commitmentVehicleMap.set(vehicleId, {
                number: record.commitment_vehicles.vehicle_number,
                totalKm: 0,
                revenue: 0,
                fuelCost: 0,
                profit: 0
            });
        }
        
        const vehicle = commitmentVehicleMap.get(vehicleId);
        vehicle.totalKm += record.distance || 0;
        vehicle.fuelCost += record.fuel_cost || 0;
    });
    
    // Calculate revenue for each commitment vehicle
    commitmentVehicles?.forEach(vehicle => {
        if (commitmentVehicleMap.has(vehicle.id)) {
            const vData = commitmentVehicleMap.get(vehicle.id);
            
            const vehicleDayOffs = dayOffs?.filter(d => d.vehicle_id === vehicle.id) || [];
            const vehicleDayOffDeduction = vehicleDayOffs.reduce((sum, d) => sum + d.deduction_amount, 0);
            
            const vehicleRecords = commitmentRecords?.filter(r => r.vehicle_id === vehicle.id) || [];
            const vehicleExtraCharges = vehicleRecords.reduce((sum, r) => sum + r.extra_charges, 0);
            
            vData.revenue = vehicle.fixed_monthly_payment - vehicleDayOffDeduction + vehicleExtraCharges;
            vData.profit = vData.revenue - vData.fuelCost;
        }
    });
    
    // Calculate driver advances total
    const totalDriverAdvances = driverAdvances?.reduce((sum, adv) => sum + adv.amount, 0) || 0;
    
    // Calculate totals
    const totalRevenue = hireRevenue + commitmentBaseRevenue - dayOffDeductions + extraKmCharges;
    const totalFuelCost = hireFuelCost + commitmentFuelCost;
    const netProfit = totalRevenue - totalFuelCost;
    const totalHires = (hireRecords?.length || 0) + (commitmentRecords?.length || 0);
    const totalDistance = hireDistance + commitmentDistance;
    const avgRevenuePerHire = totalHires > 0 ? totalRevenue / totalHires : 0;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    return {
        totalRevenue,
        totalFuelCost,
        netProfit,
        totalHires,
        hireRevenue,
        commitmentBaseRevenue,
        extraKmCharges,
        dayOffDeductions,
        hireToPayCount: hireRecords?.length || 0,
        commitmentCount: commitmentRecords?.length || 0,
        dayOffCount: dayOffs?.length || 0,
        totalDistance,
        avgRevenuePerHire,
        profitMargin,
        totalDriverAdvances,
        hireVehiclePerformance: Array.from(hireVehicleMap.values()),
        commitmentVehiclePerformance: Array.from(commitmentVehicleMap.values())
    };
}

// UI Helper Functions
function showReportLoading() {
    const btn = document.getElementById('generateReportBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner">⏳</span> Generating Report...';
    }
}

function hideReportLoading() {
    const btn = document.getElementById('generateReportBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '📄 Generate Monthly Report';
    }
}

function showReportSuccess() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #27AE60;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: bold;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = '✓ Report generated successfully!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}
