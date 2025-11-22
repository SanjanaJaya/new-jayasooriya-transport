// report-generator.js - PDF Report Generator for Jayasooriya Transport

// Function to load and add logo to PDF
async function addLogoToReport(doc, x, y, size) {
    return new Promise((resolve, reject) => {
        const logoUrl = 'https://i.postimg.cc/x19FXbdR/New-Transport-Logo.png';
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = function() {
            try {
                // Draw white circle background with subtle shadow effect
                doc.setFillColor(240, 240, 240);
                doc.circle(x + size/2 + 1, y + size/2 + 1, size/2, 'F'); // Shadow
                
                doc.setFillColor(255, 255, 255);
                doc.circle(x + size/2, y + size/2, size/2, 'F');
                
                // Add subtle border
                doc.setDrawColor(220, 20, 60);
                doc.setLineWidth(1);
                doc.circle(x + size/2, y + size/2, size/2, 'S');
                
                // Add logo image inside the circle
                doc.addImage(img, 'PNG', x + 3, y + 3, size - 6, size - 6);
                
                resolve();
            } catch (error) {
                console.error('Error adding logo:', error);
                resolve(); // Continue even if logo fails
            }
        };
        
        img.onerror = function() {
            console.error('Failed to load logo');
            resolve(); // Continue even if logo fails to load
        };
        
        img.src = logoUrl;
    });
}

async function generateMonthlyReport(monthValue) {
    try {
        // Show loading indicator
        showReportLoading();

        const [year, month] = monthValue.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        // Format month name for display
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
        const margin = 20;
        const contentWidth = pageWidth - (2 * margin);

        // Helper function to check if we need a new page
        function checkNewPage(requiredSpace = 30) {
            if (yPosition + requiredSpace > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
                return true;
            }
            return false;
        }

        // Header with Logo and Company Name
        doc.setFillColor(220, 20, 60); // Crimson Red
        doc.rect(0, 0, pageWidth, 60, 'F');
        
        // Add logo in white circle (left side)
        await addLogoToReport(doc, 15, 15, 30);
        
        // Company Name (center aligned)
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('JAYASOORIYA TRANSPORT', pageWidth / 2, 25, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Monthly Management Report', pageWidth / 2, 35, { align: 'center' });
        
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(monthName, pageWidth / 2, 45, { align: 'center' });
        
        // Add a subtle line separator
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        doc.line(margin, 52, pageWidth - margin, 52);

        yPosition = 70;

        // Executive Summary
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Executive Summary', margin, yPosition);
        
        // Add decorative line
        doc.setDrawColor(220, 20, 60);
        doc.setLineWidth(2);
        doc.line(margin, yPosition + 2, margin + 60, yPosition + 2);
        
        yPosition += 12;

        // Summary boxes
        const summaryData = [
            { label: 'Total Revenue', value: `LKR ${reportData.totalRevenue.toFixed(2)}`, color: [220, 20, 60] },
            { label: 'Fuel Cost', value: `LKR ${reportData.totalFuelCost.toFixed(2)}`, color: [230, 126, 34] },
            { label: 'Net Profit', value: `LKR ${reportData.netProfit.toFixed(2)}`, color: [39, 174, 96] },
            { label: 'Total Hires', value: reportData.totalHires.toString(), color: [52, 152, 219] }
        ];

        const boxWidth = (contentWidth - 10) / 2;
        const boxHeight = 25;
        let xPos = margin;
        let row = 0;

        summaryData.forEach((item, index) => {
            if (index % 2 === 0 && index > 0) {
                row++;
                xPos = margin;
            }
            
            const boxY = yPosition + (row * (boxHeight + 5));
            
            // Box shadow
            doc.setFillColor(200, 200, 200);
            doc.roundedRect(xPos + 1, boxY + 1, boxWidth, boxHeight, 3, 3, 'F');
            
            // Box background with gradient effect
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.roundedRect(xPos, boxY, boxWidth, boxHeight, 3, 3, 'F');
            
            // Add lighter overlay for depth
            doc.setFillColor(255, 255, 255);
            doc.setGState(new doc.GState({ opacity: 0.1 }));
            doc.roundedRect(xPos, boxY, boxWidth, boxHeight / 2, 3, 3, 'F');
            doc.setGState(new doc.GState({ opacity: 1 }));
            
            // Text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(item.label, xPos + 5, boxY + 9);
            
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(item.value, xPos + 5, boxY + 20);
            
            xPos += boxWidth + 5;
        });

        yPosition += (Math.ceil(summaryData.length / 2) * (boxHeight + 5)) + 15;

        // Hire-to-Pay Vehicles Performance
        checkNewPage(40);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Hire-to-Pay Vehicles Performance', margin, yPosition);
        
        // Add decorative line
        doc.setDrawColor(220, 20, 60);
        doc.setLineWidth(1.5);
        doc.line(margin, yPosition + 2, margin + 85, yPosition + 2);
        
        yPosition += 10;

        if (reportData.hireVehiclePerformance.length > 0) {
            // Table header
            doc.setFillColor(220, 20, 60);
            doc.rect(margin, yPosition, contentWidth, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            
            const colWidths = [35, 25, 30, 30, 30, 30];
            let colX = margin + 2;
            const headers = ['Vehicle', 'Ownership', 'Total KM', 'Revenue', 'Fuel Cost', 'Profit'];
            
            headers.forEach((header, i) => {
                doc.text(header, colX, yPosition + 6);
                colX += colWidths[i];
            });
            
            yPosition += 8;
            
            // Table rows
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            
            reportData.hireVehiclePerformance.forEach((vehicle, index) => {
                checkNewPage(10);
                
                if (index % 2 === 0) {
                    doc.setFillColor(245, 245, 245);
                    doc.rect(margin, yPosition, contentWidth, 8, 'F');
                }
                
                colX = margin + 2;
                doc.text(vehicle.number, colX, yPosition + 6);
                colX += colWidths[0];
                
                doc.text(vehicle.ownership, colX, yPosition + 6);
                colX += colWidths[1];
                
                doc.text(vehicle.totalKm.toFixed(0), colX, yPosition + 6);
                colX += colWidths[2];
                
                doc.text(vehicle.revenue.toFixed(0), colX, yPosition + 6);
                colX += colWidths[3];
                
                doc.text(vehicle.fuelCost.toFixed(0), colX, yPosition + 6);
                colX += colWidths[4];
                
                doc.setTextColor(39, 174, 96);
                doc.setFont('helvetica', 'bold');
                doc.text(vehicle.profit.toFixed(0), colX, yPosition + 6);
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                
                yPosition += 8;
            });
        } else {
            doc.setFontSize(10);
            doc.text('No hire-to-pay vehicle records for this month', margin, yPosition + 10);
            yPosition += 15;
        }

        yPosition += 10;

        // Commitment Vehicles Performance
        checkNewPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Commitment Vehicles Performance', margin, yPosition);
        
        // Add decorative line
        doc.setDrawColor(220, 20, 60);
        doc.setLineWidth(1.5);
        doc.line(margin, yPosition + 2, margin + 85, yPosition + 2);
        
        yPosition += 10;

        if (reportData.commitmentVehiclePerformance.length > 0) {
            // Table header
            doc.setFillColor(220, 20, 60);
            doc.rect(margin, yPosition, contentWidth, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            
            const colWidths = [40, 30, 30, 30, 30];
            let colX = margin + 2;
            const headers = ['Vehicle', 'Total KM', 'Revenue', 'Fuel Cost', 'Profit'];
            
            headers.forEach((header, i) => {
                doc.text(header, colX, yPosition + 6);
                colX += colWidths[i];
            });
            
            yPosition += 8;
            
            // Table rows
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            
            reportData.commitmentVehiclePerformance.forEach((vehicle, index) => {
                checkNewPage(10);
                
                if (index % 2 === 0) {
                    doc.setFillColor(245, 245, 245);
                    doc.rect(margin, yPosition, contentWidth, 8, 'F');
                }
                
                colX = margin + 2;
                doc.text(vehicle.number, colX, yPosition + 6);
                colX += colWidths[0];
                
                doc.text(vehicle.totalKm.toFixed(0), colX, yPosition + 6);
                colX += colWidths[1];
                
                doc.text(vehicle.revenue.toFixed(0), colX, yPosition + 6);
                colX += colWidths[2];
                
                doc.text(vehicle.fuelCost.toFixed(0), colX, yPosition + 6);
                colX += colWidths[3];
                
                doc.setTextColor(39, 174, 96);
                doc.setFont('helvetica', 'bold');
                doc.text(vehicle.profit.toFixed(0), colX, yPosition + 6);
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                
                yPosition += 8;
            });
        } else {
            doc.setFontSize(10);
            doc.text('No commitment vehicle records for this month', margin, yPosition + 10);
            yPosition += 15;
        }

        yPosition += 10;

        // Revenue Breakdown
        checkNewPage(50);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Revenue Breakdown', margin, yPosition);
        
        // Add decorative line
        doc.setDrawColor(220, 20, 60);
        doc.setLineWidth(1.5);
        doc.line(margin, yPosition + 2, margin + 55, yPosition + 2);
        
        yPosition += 12;
        
        // Add a light background box for the breakdown
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(margin, yPosition - 2, contentWidth, 50, 3, 3, 'F');

        const breakdownData = [
            { label: 'Hire-to-Pay Revenue', value: reportData.hireRevenue },
            { label: 'Commitment Base Payment', value: reportData.commitmentBaseRevenue },
            { label: 'Extra KM Charges', value: reportData.extraKmCharges },
            { label: 'Day Off Deductions', value: -reportData.dayOffDeductions }
        ];

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        breakdownData.forEach(item => {
            checkNewPage(10);
            doc.setTextColor(80, 80, 80);
            doc.text(item.label, margin + 8, yPosition);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(item.value >= 0 ? 0 : 220, item.value >= 0 ? 0 : 20, item.value >= 0 ? 0 : 60);
            doc.text(`LKR ${Math.abs(item.value).toFixed(2)}${item.value < 0 ? ' (-)' : ''}`, pageWidth - margin - 5, yPosition, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            yPosition += 10;
        });

        yPosition += 2;
        doc.setDrawColor(220, 20, 60);
        doc.setLineWidth(1);
        doc.line(margin + 5, yPosition, pageWidth - margin - 5, yPosition);
        yPosition += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Total Revenue', margin + 8, yPosition);
        doc.setTextColor(39, 174, 96);
        doc.text(`LKR ${reportData.totalRevenue.toFixed(2)}`, pageWidth - margin - 5, yPosition, { align: 'right' });

        yPosition += 15;

        // Operational Statistics
        checkNewPage(50);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Operational Statistics', margin, yPosition);
        
        // Add decorative line
        doc.setDrawColor(220, 20, 60);
        doc.setLineWidth(1.5);
        doc.line(margin, yPosition + 2, margin + 65, yPosition + 2);
        
        yPosition += 12;
        
        // Add background box
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(margin, yPosition - 2, contentWidth, 55, 3, 3, 'F');

        const stats = [
            { label: 'Total Hire-to-Pay Hires', value: reportData.hireToPayCount },
            { label: 'Total Commitment Hires', value: reportData.commitmentCount },
            { label: 'Total Day Offs', value: reportData.dayOffCount },
            { label: 'Total Distance Covered', value: `${reportData.totalDistance.toFixed(0)} km` },
            { label: 'Average Revenue per Hire', value: `LKR ${reportData.avgRevenuePerHire.toFixed(2)}` },
            { label: 'Profit Margin', value: `${reportData.profitMargin.toFixed(1)}%` }
        ];

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        stats.forEach(item => {
            checkNewPage(10);
            doc.setTextColor(80, 80, 80);
            doc.text(item.label, margin + 8, yPosition);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(item.value.toString(), pageWidth - margin - 5, yPosition, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            yPosition += 9;
        });

        // Footer on every page
        const totalPages = doc.internal.getNumberOfPages();
        const generatedDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            
            // Footer background
            doc.setFillColor(220, 20, 60);
            doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
            
            // Footer text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(
                'Jayasooriya Transport Management System',
                margin,
                pageHeight - 11
            );
            doc.text(
                `Generated: ${generatedDate}`,
                pageWidth / 2,
                pageHeight - 11,
                { align: 'center' }
            );
            doc.text(
                `Page ${i} of ${totalPages}`,
                pageWidth - margin,
                pageHeight - 11,
                { align: 'right' }
            );
        }

        // Save the PDF
        const fileName = `Jayasooriya_Transport_Report_${monthName.replace(' ', '_')}.pdf`;
        doc.save(fileName);

        hideReportLoading();
        showReportSuccess();

    } catch (error) {
        console.error('Error generating report:', error);
        hideReportLoading();
        alert('Error generating report: ' + error.message);
    }
}

async function fetchReportData(startDate, endDate) {
    // Fetch hire-to-pay records
    const { data: hireRecords } = await supabase
        .from('hire_to_pay_records')
        .select('*, hire_to_pay_vehicles(lorry_number, ownership)')
        .eq('user_id', currentUser.id)
        .gte('hire_date', startDate)
        .lte('hire_date', endDate);

    // Fetch commitment records
    const { data: commitmentRecords } = await supabase
        .from('commitment_records')
        .select('*, commitment_vehicles(vehicle_number)')
        .eq('user_id', currentUser.id)
        .gte('hire_date', startDate)
        .lte('hire_date', endDate);

    // Fetch day offs
    const { data: dayOffs } = await supabase
        .from('commitment_day_offs')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('day_off_date', startDate)
        .lte('day_off_date', endDate);

    // Get commitment vehicles with records in this month
    const commitmentVehicleIds = new Set();
    commitmentRecords?.forEach(record => {
        commitmentVehicleIds.add(record.vehicle_id);
    });

    const { data: commitmentVehicles } = await supabase
        .from('commitment_vehicles')
        .select('*')
        .eq('user_id', currentUser.id)
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
            
            // Get day offs for this vehicle
            const vehicleDayOffs = dayOffs?.filter(d => d.vehicle_id === vehicle.id) || [];
            const vehicleDayOffDeduction = vehicleDayOffs.reduce((sum, d) => sum + d.deduction_amount, 0);
            
            // Get extra charges for this vehicle
            const vehicleRecords = commitmentRecords?.filter(r => r.vehicle_id === vehicle.id) || [];
            const vehicleExtraCharges = vehicleRecords.reduce((sum, r) => sum + r.extra_charges, 0);
            
            vData.revenue = vehicle.fixed_monthly_payment - vehicleDayOffDeduction + vehicleExtraCharges;
            vData.profit = vData.revenue - vData.fuelCost;
        }
    });

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
        hireVehiclePerformance: Array.from(hireVehicleMap.values()),
        commitmentVehiclePerformance: Array.from(commitmentVehicleMap.values())
    };
}

function showReportLoading() {
    const btn = document.getElementById('generateReportBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Generating Report...';
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
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'report-notification';
    notification.innerHTML = '✓ Report generated successfully!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}