// report-generator.js - Simplified Monthly Report Generator for Jayasooriya Transport
// Shows: Individual Lorry Performance, Leasing Deductions (>30% util only), Simple Financial Summary

/**
 * Normalise a vehicle registration number to a canonical key used for
 * cross-table matching.
 */
function normaliseVehicleKey(name) {
    if (!name) return '';
    const match = name.match(/([a-zA-Z0-9]{1,4})\s*-\s*([0-9]{1,4})/);
    if (match) {
        return `${match[1].trim().toLowerCase()} - ${match[2].trim()}`;
    }
    return name.trim().toLowerCase();
}

/**
 * Returns the canonical human-readable display name for a vehicle number.
 */
function normaliseVehicleDisplay(name) {
    if (!name) return '';
    const match = name.match(/([a-zA-Z0-9]{1,4})\s*-\s*([0-9]{1,4})/);
    if (match) {
        return `${match[1].trim().toUpperCase()} - ${match[2].trim()}`;
    }
    return name.trim().toUpperCase();
}

// Function to load and add logo to PDF
async function addLogoToReport(doc, x, y, size) {
    return new Promise((resolve, reject) => {
        const logoUrl = 'https://i.postimg.cc/QdryzTyS/Bigger-New-Logo.png';
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = function() {
            try {
                doc.setFillColor(255, 255, 255);
                doc.circle(x + size/2, y + size/2, size/2, 'F');
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

// Stylized section header helper
function drawSectionHeader(doc, title, margin, yPos) {
    doc.setFillColor(220, 20, 60);
    doc.rect(margin, yPos - 4.5, 4, 6, 'F');
    
    doc.setTextColor(44, 62, 80);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 6, yPos);
}

// Custom table-drawing function
function drawPDFTable(doc, startY, headers, colWidths, rows, rowHeight = 7.5) {
    let y = startY;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (2 * margin);

    // Draw header background
    doc.setFillColor(220, 20, 60);
    doc.rect(margin, y, contentWidth, rowHeight, 'F');

    // Header text styling
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    
    let currentX = margin + 3;
    headers.forEach((header, i) => {
        doc.text(header, currentX, y + rowHeight - 2.5);
        currentX += colWidths[i];
    });

    y += rowHeight;

    // Draw rows
    doc.setFontSize(8);
    rows.forEach((row, rowIndex) => {
        // Page break check
        if (y + rowHeight > pageHeight - 20) {
            doc.addPage();
            y = margin + 10;
            
            // Re-draw header on new page
            doc.setFillColor(220, 20, 60);
            doc.rect(margin, y, contentWidth, rowHeight, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            currentX = margin + 3;
            headers.forEach((header, i) => {
                doc.text(header, currentX, y + rowHeight - 2.5);
                currentX += colWidths[i];
            });
            y += rowHeight;
        }

        // Alternate row colors
        if (rowIndex === rows.length - 1 && row[0]?.isTotal) {
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, y, contentWidth, rowHeight, 'F');
            doc.setDrawColor(220, 20, 60);
            doc.setLineWidth(0.4);
            doc.line(margin, y, margin + contentWidth, y);
            doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
        } else {
            if (rowIndex % 2 === 0) {
                doc.setFillColor(248, 249, 250);
            } else {
                doc.setFillColor(255, 255, 255);
            }
            doc.rect(margin, y, contentWidth, rowHeight, 'F');
            
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.2);
            doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
        }

        currentX = margin + 3;
        row.forEach((cell, cellIndex) => {
            if (cell && typeof cell === 'object') {
                doc.setFont('helvetica', cell.bold ? 'bold' : 'normal');
                if (cell.color) {
                    doc.setTextColor(cell.color[0], cell.color[1], cell.color[2]);
                } else {
                    doc.setTextColor(51, 51, 51);
                }
                const alignX = cell.align === 'right' ? currentX + colWidths[cellIndex] - 6 : currentX;
                doc.text(cell.text, alignX, y + rowHeight - 2.5, { align: cell.align || 'left' });
            } else {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(51, 51, 51);
                doc.text(cell !== undefined && cell !== null ? cell.toString() : '', currentX, y + rowHeight - 2.5);
            }
            currentX += colWidths[cellIndex];
        });

        y += rowHeight;
    });

    return y;
}

async function generateMonthlyReport(monthValue) {
    try {
        showReportLoading();
        
        const [year, month] = monthValue.split('-');
        const monthPadded = String(month).padStart(2, '0');
        const startDate = `${year}-${monthPadded}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;
        
        const monthName = new Date(parseInt(year), parseInt(monthPadded) - 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        
        // Fetch and calculate report data
        const reportData = await fetchReportData(startDate, endDate);
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'mm', 'a4');
        
        let yPosition = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);
        
        // Page break validation helper
        function checkNewPage(requiredSpace = 30) {
            if (yPosition + requiredSpace > pageHeight - 20) {
                doc.addPage();
                yPosition = margin + 10;
                return true;
            }
            return false;
        }

        // Format currency helper
        function fmtLKR(val) {
            return `LKR ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        
        // ==================== HEADER ====================
        doc.setFillColor(220, 20, 60);
        doc.rect(0, 0, pageWidth, 48, 'F');
        
        await addLogoToReport(doc, 15, 9, 30);
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('JAYASOORIYA TRANSPORT', pageWidth / 2 + 15, 17, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('BUSINESS REG NO: KG/RMB/5919', pageWidth / 2 + 15, 23, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Monthly Business Report — ${monthName}`, pageWidth / 2 + 15, 33, { align: 'center' });
        
        yPosition = 58;
        
        // ==================== FINANCIAL SUMMARY CARDS ====================
        drawSectionHeader(doc, 'Financial Summary', margin, yPosition);
        yPosition += 8;
        
        const summaryData = [
            { label: 'Total Revenue', value: reportData.totalRevenue, color: [39, 174, 96] },
            { label: 'Fuel Deductions (Net after 18% VAT Refund)', value: reportData.netFuelCost, color: [231, 76, 60] },
            { label: 'Total Salary Deductions', value: reportData.totalStaffCost, color: [230, 126, 34] },
            { label: 'Total Leasing Deductions', value: reportData.totalLeasingDeducted, color: [155, 89, 182] },
            { label: 'Net Profit', value: reportData.netProfit, color: reportData.netProfit >= 0 ? [39, 174, 96] : [220, 20, 60] }
        ];
        
        // Render as 2 columns, last item (Net Profit) spans full width
        const boxWidth = (contentWidth - 6) / 2;
        const boxHeight = 22;
        let row = 0;
        
        for (let i = 0; i < summaryData.length; i++) {
            const item = summaryData[i];
            const isLastItem = (i === summaryData.length - 1);
            const isLeftCol = (i % 2 === 0);
            
            let boxX, bw;
            if (isLastItem && summaryData.length % 2 === 1) {
                // Full width for the last (odd) item
                boxX = margin;
                bw = contentWidth;
            } else {
                boxX = isLeftCol ? margin : margin + boxWidth + 6;
                bw = boxWidth;
            }
            
            if (isLeftCol) {
                row = Math.floor(i / 2);
            }
            
            const boxY = yPosition + (row * (boxHeight + 4));
            
            // Card background
            doc.setFillColor(255, 255, 255);
            doc.rect(boxX, boxY, bw, boxHeight, 'F');
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
            doc.rect(boxX, boxY, bw, boxHeight, 'D');
            
            // Colored left border accent
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.rect(boxX, boxY, 4, boxHeight, 'F');
            
            // Label
            doc.setTextColor(110, 110, 110);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.text(item.label, boxX + 8, boxY + 7);
            
            // Value
            doc.setTextColor(item.color[0], item.color[1], item.color[2]);
            doc.setFontSize(isLastItem ? 14 : 12.5);
            doc.setFont('helvetica', 'bold');
            doc.text(fmtLKR(item.value), boxX + 8, boxY + 16);
        }
        
        const totalRows = Math.ceil(summaryData.length / 2);
        yPosition += (totalRows * (boxHeight + 4)) + 12;
        
        // ==================== INDIVIDUAL LORRY PERFORMANCE ====================
        checkNewPage(60);
        drawSectionHeader(doc, 'Individual Lorry Performance', margin, yPosition);
        yPosition += 5;
        
        // Subtitle note
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text('Fuel = net 82% after 18% VAT refund. Leasing only if util > 30%. Salary: finalized or estimated (full salary - deductions).', margin + 2, yPosition + 3);
        yPosition += 8;

        if (reportData.lorryProfitBreakdown.length > 0) {
            const lpHeaders = ['Lorry', 'Driver', 'Revenue', 'Fuel 82%', 'Salary', 'Leasing', 'Util %', 'Net Profit'];
            //                   22       20       24         24         24        24         14        28  = 180mm
            const lpColWidths = [22, 20, 24, 24, 24, 24, 14, 28];

            // Extract nickname: "RH Rajapaksha (Hasala)" → "Hasala", fallback to first name
            function getShortName(fullName) {
                if (!fullName) return '-';
                const nickMatch = fullName.match(/\(([^)]+)\)/);
                if (nickMatch) return nickMatch[1].trim();
                // Fallback: return first name part only
                const parts = fullName.trim().split(/\s+/);
                return parts.length > 1 ? parts[1] : parts[0];
            }

            let lpTotRev = 0, lpTotFuel = 0, lpTotSalary = 0, lpTotLease = 0, lpTotProfit = 0;
            const lpRows = reportData.lorryProfitBreakdown.map(lp => {
                lpTotRev += lp.revenue;
                lpTotFuel += lp.netFuelCost;
                lpTotSalary += lp.driverCost;
                lpTotLease += lp.leasingDeducted;
                lpTotProfit += lp.netProfit;
                const utilStr = lp.utilizationPct.toFixed(0) + '%';
                const utilColor = lp.utilizationPct >= 30 ? [39, 174, 96] : [220, 20, 60];
                return [
                    lp.lorryNumber,
                    getShortName(lp.driverName),
                    { text: lp.revenue.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right' },
                    { text: lp.netFuelCost.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right' },
                    { text: lp.driverCost > 0 ? lp.driverCost.toLocaleString(undefined, {maximumFractionDigits:0}) : '-', align: 'right', color: lp.driverCost > 0 ? [220, 20, 60] : [150,150,150] },
                    { text: lp.leasingDeducted > 0 ? lp.leasingDeducted.toLocaleString(undefined, {maximumFractionDigits:0}) : (lp.leasingInstallment > 0 ? 'Skip' : '-'), align: 'right', color: lp.leasingDeducted > 0 ? [220, 20, 60] : [150,150,150] },
                    { text: utilStr, align: 'right', color: utilColor, bold: lp.utilizationPct < 30 },
                    { text: lp.netProfit.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', color: lp.netProfit >= 0 ? [39, 174, 96] : [220, 20, 60], bold: true }
                ];
            });

            lpRows.push([
                { text: 'Total', bold: true, isTotal: true },
                '',
                { text: lpTotRev.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                { text: lpTotFuel.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                { text: lpTotSalary.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                { text: lpTotLease.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                '',
                { text: lpTotProfit.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true, color: lpTotProfit >= 0 ? [39, 174, 96] : [220, 20, 60] }
            ]);

            yPosition = drawPDFTable(doc, yPosition, lpHeaders, lpColWidths, lpRows, 8);
        } else {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('No vehicle operation records found for this period.', margin, yPosition + 4);
            yPosition += 8;
        }

        yPosition += 12;

        // ==================== SIMPLE FINANCIAL SUMMARY TABLE ====================
        checkNewPage(60);
        drawSectionHeader(doc, 'Financial Breakdown', margin, yPosition);
        yPosition += 8;

        const finHeaders = ['Description', 'Amount (LKR)'];
        const finColWidths = [120, 60];
        const finRows = [
            ['Total Revenue', { text: fmtLKR(reportData.totalRevenue), align: 'right', color: [39, 174, 96], bold: true }],
            ['Less: Gross Fuel Cost', { text: `- ${fmtLKR(reportData.totalFuelCost)}`, align: 'right', color: [220, 20, 60] }],
            ['Add: 18% VAT Fuel Refund', { text: `+ ${fmtLKR(reportData.fuelVATRefund)}`, align: 'right', color: [39, 174, 96] }],
            ['Net Fuel Deduction (82%)', { text: `- ${fmtLKR(reportData.netFuelCost)}`, align: 'right', color: [220, 20, 60], bold: true }],
            ['Less: Salary Deductions', { text: `- ${fmtLKR(reportData.totalStaffCost)}`, align: 'right', color: [220, 20, 60] }],
            ['Less: Leasing Deductions (Util > 30% Only)', { text: `- ${fmtLKR(reportData.totalLeasingDeducted)}`, align: 'right', color: [220, 20, 60] }],
            [{ text: 'Net Profit', bold: true, isTotal: true }, { text: fmtLKR(reportData.netProfit), align: 'right', bold: true, color: reportData.netProfit >= 0 ? [39, 174, 96] : [220, 20, 60] }]
        ];

        yPosition = drawPDFTable(doc, yPosition, finHeaders, finColWidths, finRows, 9);
        yPosition += 12;
        
        // ==================== FOOTER RENDERER ====================
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
            
            doc.setFillColor(220, 20, 60);
            doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
            
            doc.setFillColor(44, 62, 80);
            doc.rect(0, pageHeight - 15, pageWidth, 1, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text('JAYASOORIYA TRANSPORT — BUSINESS LOGISTICS', margin, pageHeight - 7.5);
            
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${generatedDate}`, pageWidth / 2, pageHeight - 7.5, { align: 'center' });
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7.5, { align: 'right' });
        }
        
        // Save PDF File
        const fileName = `Jayasooriya_Transport_Monthly_Report_${monthName.replace(' ', '_')}.pdf`;
        doc.save(fileName);
        
        hideReportLoading();
        showReportSuccess();
        
    } catch (error) {
        console.error('Error generating monthly report:', error);
        hideReportLoading();
        showToast('Error generating monthly report: ' + error.message, 'error');
    }
}

// Fetch all data from Supabase - Simplified
async function fetchReportData(startDate, endDate) {
    const userId = getQueryUserId();
    const startMonth = startDate.substring(0, 7);

    // 1. Fetch hire-to-pay records
    const { data: hireRecords, error: hrErr } = await supabaseClient
        .from('hire_to_pay_records')
        .select('*, hire_to_pay_vehicles(lorry_number, ownership)')
        .eq('user_id', userId)
        .gte('hire_date', startDate)
        .lte('hire_date', endDate);
    if (hrErr) throw hrErr;
    
    // 2. Fetch commitment records
    const { data: commitmentRecords, error: crErr } = await supabaseClient
        .from('commitment_records')
        .select('*, commitment_vehicles(vehicle_number)')
        .eq('user_id', userId)
        .gte('hire_date', startDate)
        .lte('hire_date', endDate);
    if (crErr) throw crErr;
    
    // 3. Fetch day offs
    const { data: dayOffs, error: doErr } = await supabaseClient
        .from('commitment_day_offs')
        .select('*')
        .eq('user_id', userId)
        .gte('day_off_date', startDate)
        .lte('day_off_date', endDate);
    if (doErr) throw doErr;
    
    // 4. Fetch driver advances
    const { data: driverAdvances, error: daErr } = await supabaseClient
        .from('driver_advances')
        .select('*')
        .eq('user_id', userId)
        .gte('advance_date', startDate)
        .lte('advance_date', endDate);
    if (daErr) throw daErr;
    
    // 5. Fetch other operation hires
    const { data: otherOpHires, error: ooErr } = await supabaseClient
        .from('other_operation_hires')
        .select('*')
        .eq('user_id', userId)
        .gte('hire_date', startDate)
        .lte('hire_date', endDate);
    if (ooErr) throw ooErr;
    
    // 6. Fetch commitment vehicles
    const { data: commitmentVehicles, error: cvErr } = await supabaseClient
        .from('commitment_vehicles')
        .select('*')
        .eq('user_id', userId);
    if (cvErr) throw cvErr;

    // 7. Fetch driver salary records (finalized)
    const { data: salaryRecords, error: sErr } = await supabaseClient
        .from('driver_salary')
        .select('driver_id, net_salary, gross_salary')
        .eq('user_id', userId)
        .eq('salary_month', startMonth);
    if (sErr) throw sErr;

    // 8. Fetch leasing vehicles (active leases only)
    const { data: leasingVehicles, error: lvErr } = await supabaseClient
        .from('leasing_vehicles')
        .select('vehicle_number, installment_amount, final_installment_amount, total_months, total_installments, start_year, start_month, entry_type, settled')
        .eq('user_id', userId)
        .eq('entry_type', 'leasing')
        .neq('settled', true);
    if (lvErr) throw lvErr;

    // 9. Fetch staff lorry assignments
    const { data: staffAssignments, error: saErr } = await supabaseClient
        .from('staff_lorry_assignments')
        .select('driver_id, lorry_number, driver_role')
        .eq('user_id', userId);
    if (saErr) throw saErr;

    // 10. Fetch all drivers (with salary fields for estimation)
    const { data: allDrivers, error: drErr } = await supabaseClient
        .from('drivers')
        .select('id, name, terminated, basic_salary, km_limit, extra_km_rate, salary_type, per_tip_charge, role')
        .eq('user_id', userId);
    if (drErr) throw drErr;

    // 11. Fetch driver KM records for salary estimation
    const { data: driverKmRecords, error: kmErr } = await supabaseClient
        .from('driver_km_records')
        .select('driver_id, km_amount')
        .eq('user_id', userId)
        .gte('record_date', startDate)
        .lte('record_date', endDate);
    if (kmErr) throw kmErr;

    // 12. Fetch staff deductions for salary estimation
    const { data: staffDeductions, error: sdErr } = await supabaseClient
        .from('staff_deductions')
        .select('driver_id, amount')
        .eq('user_id', userId)
        .eq('salary_month', startMonth);
    if (sdErr) throw sdErr;

    // 13. Fetch driver day-off deductions for salary estimation
    const { data: driverDayOffs, error: ddErr } = await supabaseClient
        .from('driver_day_offs')
        .select('driver_id, deduction_amount')
        .eq('user_id', userId)
        .gte('day_off_date', startDate)
        .lte('day_off_date', endDate);
    if (ddErr) throw ddErr;

    // === Calculate Revenue ===
    
    // Commitment vehicles that ran
    const ranCommitmentVehicleIds = new Set(commitmentRecords?.map(r => r.vehicle_id));
    const ranCommitmentVehicles = (commitmentVehicles || []).filter(v => ranCommitmentVehicleIds.has(v.id));

    // Hire-to-pay revenue & fuel
    let hireRevenue = 0, hireFuelCost = 0;
    hireRecords?.forEach(record => {
        hireRevenue += record.hire_amount || 0;
        hireFuelCost += record.fuel_cost || 0;
    });

    // Commitment revenue & fuel
    let commitmentBaseRevenue = 0, commitmentFuelCost = 0;
    let dayOffDeductions = 0, extraKmCharges = 0;
    
    const commitmentVehicleMap = new Map();
    ranCommitmentVehicles.forEach(vehicle => {
        commitmentBaseRevenue += vehicle.fixed_monthly_payment || 0;
        commitmentVehicleMap.set(vehicle.id, {
            number: vehicle.vehicle_number,
            totalKm: 0,
            revenue: vehicle.fixed_monthly_payment || 0,
            kmLimit: vehicle.km_limit_per_month || 0,
            extraKmRate: vehicle.extra_km_charge || 0
        });
    });

    dayOffs?.forEach(dayOff => {
        if (commitmentVehicleMap.has(dayOff.vehicle_id)) {
            dayOffDeductions += dayOff.deduction_amount || 0;
            const vData = commitmentVehicleMap.get(dayOff.vehicle_id);
            vData.revenue -= dayOff.deduction_amount || 0;
        }
    });

    commitmentRecords?.forEach(record => {
        commitmentFuelCost += record.fuel_cost || 0;
        if (commitmentVehicleMap.has(record.vehicle_id)) {
            const vData = commitmentVehicleMap.get(record.vehicle_id);
            vData.totalKm += record.distance || 0;
        }
    });

    // Extra KM charges
    ranCommitmentVehicles.forEach(vehicle => {
        if (commitmentVehicleMap.has(vehicle.id)) {
            const vData = commitmentVehicleMap.get(vehicle.id);
            const excKm = Math.max(0, vData.totalKm - vData.kmLimit);
            const extraChg = excKm * vData.extraKmRate;
            extraKmCharges += extraChg;
            vData.revenue += extraChg;
        }
    });

    // Other operations revenue & fuel
    let otherOpRevenue = 0, otherOpFuelCost = 0;
    otherOpHires?.forEach(record => {
        otherOpRevenue += record.hire_amount || 0;
        otherOpFuelCost += record.fuel_cost || 0;
    });

    // === Total Revenue & Fuel ===
    const totalRevenue = hireRevenue + commitmentBaseRevenue - dayOffDeductions + extraKmCharges + otherOpRevenue;
    const totalFuelCost = hireFuelCost + commitmentFuelCost + otherOpFuelCost;
    const fuelVATRefund = totalFuelCost * 0.18;  // 18% VAT refund on fuel
    const netFuelCost = totalFuelCost * 0.82;    // Effective fuel cost after 18% VAT refund

    // === Salary Calculations ===
    // Build finalized salary map: driver_id -> gross_salary
    const finalizedSalaryMap = new Map();
    (salaryRecords || []).forEach(s => {
        finalizedSalaryMap.set(s.driver_id, s.gross_salary || 0);
    });

    // Build driver info map: driver_id -> driver object
    const driverInfoMap = new Map();
    (allDrivers || []).forEach(d => {
        driverInfoMap.set(d.id, d);
    });

    // Build KM per driver map for salary estimation
    const kmByDriverMap = new Map();
    (driverKmRecords || []).forEach(r => {
        const prev = kmByDriverMap.get(r.driver_id) || 0;
        kmByDriverMap.set(r.driver_id, prev + parseFloat(r.km_amount || 0));
    });

    // Build staff deductions per driver map
    const staffDedByDriver = new Map();
    (staffDeductions || []).forEach(d => {
        const prev = staffDedByDriver.get(d.driver_id) || 0;
        staffDedByDriver.set(d.driver_id, prev + (d.amount || 0));
    });

    // Build day-off deductions per driver map
    const dayOffDedByDriver = new Map();
    (driverDayOffs || []).forEach(d => {
        const prev = dayOffDedByDriver.get(d.driver_id) || 0;
        dayOffDedByDriver.set(d.driver_id, prev + (d.deduction_amount || 0));
    });

    /**
     * Get salary cost for a driver:
     * - If finalized salary exists: use gross_salary
     * - If not finalized: estimate as (basic_salary + extra_km_salary) - staff_deductions - day_off_deductions
     *   NO advances deducted.
     */
    function getDriverSalaryCost(driverId) {
        // Check if salary is finalized
        if (finalizedSalaryMap.has(driverId)) {
            return finalizedSalaryMap.get(driverId);
        }

        // Not finalized - estimate
        const driver = driverInfoMap.get(driverId);
        if (!driver) return 0;

        const isHelper = (driver.role || '').toLowerCase() === 'helper';
        const isPerTip = driver.salary_type === 'per_tip';

        let grossSalary = 0;
        if (isPerTip) {
            // Per-tip drivers can't be estimated without tip count, skip
            return 0;
        } else {
            const basicSalary = driver.basic_salary || 0;
            const kmLimit = driver.km_limit || 0;
            const extraKmRate = driver.extra_km_rate || 0;
            const totalKm = kmByDriverMap.get(driverId) || 0;

            let extraKmSalary = 0;
            if (!isHelper && totalKm > kmLimit) {
                extraKmSalary = (totalKm - kmLimit) * extraKmRate;
            }
            grossSalary = basicSalary + extraKmSalary;
        }

        // Deduct staff deductions and day-off deductions (NOT advances)
        const deductions = (staffDedByDriver.get(driverId) || 0) + (dayOffDedByDriver.get(driverId) || 0);
        return Math.max(0, grossSalary - deductions);
    }

    // Calculate total staff cost across ALL assigned drivers
    // We'll compute per-lorry costs in the lorry loop and also compute a global total
    const allAssignedDriverIds = new Set();
    (staffAssignments || []).forEach(a => {
        if (a.driver_id) allAssignedDriverIds.add(a.driver_id);
    });

    let totalStaffCost = 0;
    allAssignedDriverIds.forEach(driverId => {
        totalStaffCost += getDriverSalaryCost(driverId);
    });

    // === Lorry-by-Lorry Breakdown with Leasing ===
    
    // Build leasing map
    const leasingMap = new Map();
    (leasingVehicles || []).forEach(lv => {
        if (lv.vehicle_number) {
            let monthAmt = lv.installment_amount || 0;
            const finalAmt = parseFloat(lv.final_installment_amount);
            if (!isNaN(finalAmt) && finalAmt > 0 && lv.start_year && lv.start_month) {
                const totalMonths = lv.total_months || lv.total_installments || 0;
                const startYr = parseInt(lv.start_year);
                const startMo = parseInt(lv.start_month) - 1;
                const [rYr, rMo] = startMonth.split('-').map(Number);
                const monthDiff = (rYr - startYr) * 12 + ((rMo - 1) - startMo);
                if (monthDiff === totalMonths - 1) {
                    monthAmt = finalAmt;
                }
            }
            leasingMap.set(normaliseVehicleKey(lv.vehicle_number), monthAmt);
        }
    });

    // Build driver assignment map: lorry key -> driver_id (role = 'driver' only)
    const lorryDriverMap = new Map();
    (staffAssignments || []).forEach(a => {
        if ((a.driver_role || '').toLowerCase() === 'driver' && a.lorry_number) {
            lorryDriverMap.set(normaliseVehicleKey(a.lorry_number), a.driver_id);
        }
    });

    // Total days in month
    const totalDaysInMonth = new Date(
        parseInt(startDate.substring(0, 4)),
        parseInt(startDate.substring(5, 7)),
        0
    ).getDate();

    // Aggregate all lorry data
    const lorryAggMap = new Map();

    function getOrCreateLorryAgg(lorryNumber) {
        const key = normaliseVehicleKey(lorryNumber);
        const cleanDisplay = normaliseVehicleDisplay(lorryNumber);
        if (!lorryAggMap.has(key)) {
            lorryAggMap.set(key, {
                lorryNumber: cleanDisplay,
                revenue: 0,
                fuelCost: 0,
                hireDates: new Set()
            });
        } else {
            const existing = lorryAggMap.get(key);
            if (cleanDisplay.length < existing.lorryNumber.length) {
                existing.lorryNumber = cleanDisplay;
            }
        }
        return lorryAggMap.get(key);
    }

    // Aggregate hire-to-pay
    hireRecords?.forEach(record => {
        const lorryNum = record.hire_to_pay_vehicles?.lorry_number || 'Unknown';
        const agg = getOrCreateLorryAgg(lorryNum);
        agg.revenue += record.hire_amount || 0;
        agg.fuelCost += record.fuel_cost || 0;
        if (record.hire_date) agg.hireDates.add(record.hire_date);
    });

    // Aggregate commitment
    commitmentRecords?.forEach(record => {
        const lorryNum = record.commitment_vehicles?.vehicle_number || 'Unknown';
        const agg = getOrCreateLorryAgg(lorryNum);
        agg.fuelCost += record.fuel_cost || 0;
        if (record.hire_date) agg.hireDates.add(record.hire_date);
    });

    // Patch commitment vehicle revenue
    commitmentVehicleMap.forEach((vData) => {
        const agg = getOrCreateLorryAgg(vData.number);
        agg.revenue += vData.revenue;
    });

    // Aggregate other operations
    otherOpHires?.forEach(record => {
        const lorryNum = record.base_lorry_number || 'Other';
        const agg = getOrCreateLorryAgg(lorryNum);
        agg.revenue += record.hire_amount || 0;
        agg.fuelCost += record.fuel_cost || 0;
        if (record.hire_date) agg.hireDates.add(record.hire_date);
    });

    // Compute per-lorry profit
    const lorryProfitBreakdown = [];
    let totalLeasingDeducted = 0;

    lorryAggMap.forEach((agg, normKey) => {
        const utilizationPct = totalDaysInMonth > 0 ? (agg.hireDates.size / totalDaysInMonth) * 100 : 0;
        const highUtilization = utilizationPct > 30;

        // Leasing: only deduct if utilization > 30%
        const leasingInstallment = leasingMap.get(normKey) || 0;
        const leasingDeducted = highUtilization ? leasingInstallment : 0;
        totalLeasingDeducted += leasingDeducted;

        // Driver salary (finalized or estimated)
        const assignedDriverId = lorryDriverMap.get(normKey);
        const driverCost = assignedDriverId ? getDriverSalaryCost(assignedDriverId) : 0;
        
        // Driver name lookup
        const assignedDriver = assignedDriverId ? driverInfoMap.get(assignedDriverId) : null;
        const driverName = assignedDriver ? assignedDriver.name : '';

        // Effective fuel cost = 82% (after 18% VAT refund)
        const lorryNetFuel = agg.fuelCost * 0.82;
        const netProfit = agg.revenue - lorryNetFuel - driverCost - leasingDeducted;

        lorryProfitBreakdown.push({
            lorryNumber: agg.lorryNumber,
            driverName,
            revenue: agg.revenue,
            fuelCost: agg.fuelCost,
            netFuelCost: lorryNetFuel,
            driverCost,
            leasingInstallment,
            leasingDeducted,
            utilizationPct,
            utilizationDays: agg.hireDates.size,
            totalDays: totalDaysInMonth,
            netProfit
        });
    });

    // Sort by net profit descending
    lorryProfitBreakdown.sort((a, b) => b.netProfit - a.netProfit);

    // === Net Profit (Revenue - Net Fuel 82% - Salary - Leasing) ===
    const netProfit = totalRevenue - netFuelCost - totalStaffCost - totalLeasingDeducted;

    return {
        totalRevenue,
        totalFuelCost,
        fuelVATRefund,
        netFuelCost,
        totalStaffCost,
        totalLeasingDeducted,
        netProfit,
        lorryProfitBreakdown
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

// UI Helper Functions for Audit Report
function showAuditReportLoading() {
    const btn = document.getElementById('generateAuditReportConfirmBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner">⏳</span> Generating Audit PDF...';
    }
}

function hideAuditReportLoading() {
    const btn = document.getElementById('generateAuditReportConfirmBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>📄</span> Generate Audit PDF Report';
    }
}

/**
 * =========================================================================
 * AUDIT & PROFIT/LOSS REPORT GENERATOR (Single Month & Month Range)
 * =========================================================================
 */

// Helper to strip spaces, hyphens, and non-alphanumeric chars for robust vehicle matching
function cleanVehicleStr(str) {
    if (!str) return '';
    return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Audit Vehicle & Loan Filtering Helpers
function isSoldVehicle(lorryNum) {
    if (!lorryNum) return false;
    const clean = cleanVehicleStr(lorryNum);
    return clean.includes('gb5157');
}

function isNonRunningLeasedVehicle(lorryNum) {
    if (!lorryNum) return false;
    const clean = cleanVehicleStr(lorryNum);
    return clean.includes('la7436');
}

function isExcludedLoan(lv) {
    if (!lv) return false;
    const text = [
        lv.vehicle_number,
        lv.lender_name,
        lv.lender,
        lv.bank_name,
        lv.notes,
        lv.settled_notes,
        lv.title,
        lv.entry_type
    ].filter(Boolean).join(' ').toLowerCase();

    const cleanText = text.replace(/[^a-z0-9]/g, '');

    if (cleanText.includes('ucworld') || cleanText.includes('nbsl')) {
        return true;
    }
    return false;
}

async function generateAuditReport(type, startMonthVal, endMonthVal) {
    try {
        showAuditReportLoading();
        
        let startMonth = startMonthVal;
        let endMonth = endMonthVal || startMonthVal;

        if (type === 'single') {
            endMonth = startMonth;
        }

        if (!startMonth || !endMonth) {
            showToast('Please select valid month(s) for the audit report', 'warning');
            hideAuditReportLoading();
            return;
        }

        if (startMonth > endMonth) {
            // Swap if start is after end
            const temp = startMonth;
            startMonth = endMonth;
            endMonth = temp;
        }

        // Calculate Date Bounds
        const [sYr, sMo] = startMonth.split('-').map(Number);
        const [eYr, eMo] = endMonth.split('-').map(Number);

        const startDate = `${startMonth}-01`;
        const lastDayOfEnd = new Date(eYr, eMo, 0).getDate();
        const endDate = `${endMonth}-${String(lastDayOfEnd).padStart(2, '0')}`;

        // Format Period Label
        const startMonthName = new Date(sYr, sMo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const endMonthName = new Date(eYr, eMo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        let periodLabel = startMonthName;
        let totalMonths = 1;
        if (startMonth !== endMonth) {
            totalMonths = (eYr - sYr) * 12 + (eMo - sMo) + 1;
            periodLabel = `${startMonthName} – ${endMonthName} (${totalMonths} Month${totalMonths > 1 ? 's' : ''})`;
        }

        // Fetch Audit Data from Supabase
        const auditData = await fetchAuditReportData(startDate, endDate, startMonth, endMonth);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'mm', 'a4');

        let yPosition = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);

        // Page break validation helper
        function checkNewPage(requiredSpace = 30) {
            if (yPosition + requiredSpace > pageHeight - 20) {
                doc.addPage();
                yPosition = margin + 10;
                return true;
            }
            return false;
        }

        // Format currency helper
        function fmtLKR(val) {
            return `LKR ${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // ==================== HEADER BAND (Crimson Red Theme) ====================
        doc.setFillColor(220, 20, 60); // Jayasooriya Crimson Red
        doc.rect(0, 0, pageWidth, 48, 'F');

        await addLogoToReport(doc, 15, 9, 30);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('JAYASOORIYA TRANSPORT', pageWidth / 2 + 15, 17, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('BUSINESS REG NO: KG/RMB/5919', pageWidth / 2 + 15, 23, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`AUDIT & PROFIT/LOSS REPORT`, pageWidth / 2 + 15, 33, { align: 'center' });

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`Period: ${periodLabel}`, pageWidth / 2 + 15, 40, { align: 'center' });

        yPosition = 56;

        // ==================== AUDIT METADATA BAR ====================
        doc.setFillColor(252, 243, 245);
        doc.rect(margin, yPosition, contentWidth, 12, 'F');
        doc.setDrawColor(220, 20, 60);
        doc.setLineWidth(0.3);
        doc.rect(margin, yPosition, contentWidth, 12, 'D');

        const auditRefId = `AUD-${startMonth.replace('-', '')}-${endMonth.replace('-', '')}`;
        const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 20, 60);
        doc.text(`AUDIT REF: ${auditRefId}`, margin + 5, yPosition + 7.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(`Reg No: KG/RMB/5919`, margin + 65, yPosition + 7.5);
        doc.text(`Generated: ${todayStr}`, margin + 115, yPosition + 7.5);

        yPosition += 18;

        // ==================== FINANCIAL SUMMARY KPI CARDS ====================
        drawSectionHeader(doc, 'Executive Financial Summary', margin, yPosition);
        yPosition += 8;

        const summaryData = [
            { label: 'Total Gross Revenue', value: auditData.totalRevenue, color: [39, 174, 96] },
            { label: 'Net Fuel Expense (82% after 18% VAT)', value: auditData.netFuelCost, color: [231, 76, 60] },
            { label: 'Staff & Driver Salaries', value: auditData.totalStaffCost, color: [230, 126, 34] },
            { label: 'Routine Maintenance & Service', value: auditData.totalMaintenanceCost, color: [155, 89, 182] },
            { label: 'Leasing & Loan Installments', value: auditData.totalLeasingAndLoans, color: [41, 128, 185] },
            { label: 'Net Audit Profit / Loss', value: auditData.netProfit, color: auditData.netProfit >= 0 ? [39, 174, 96] : [220, 20, 60] }
        ];

        const boxWidth = (contentWidth - 6) / 2;
        const boxHeight = 20;

        for (let i = 0; i < summaryData.length; i++) {
            const item = summaryData[i];
            const isLastItem = (i === summaryData.length - 1);
            const isLeftCol = (i % 2 === 0);

            let boxX, bw;
            if (isLastItem && summaryData.length % 2 === 1) {
                boxX = margin;
                bw = contentWidth;
            } else {
                boxX = isLeftCol ? margin : margin + boxWidth + 6;
                bw = boxWidth;
            }

            const row = Math.floor(i / 2);
            const boxY = yPosition + (row * (boxHeight + 4));

            doc.setFillColor(255, 255, 255);
            doc.rect(boxX, boxY, bw, boxHeight, 'F');
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
            doc.rect(boxX, boxY, bw, boxHeight, 'D');

            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.rect(boxX, boxY, 4, boxHeight, 'F');

            doc.setTextColor(110, 110, 110);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(item.label, boxX + 8, boxY + 6.5);

            doc.setTextColor(item.color[0], item.color[1], item.color[2]);
            doc.setFontSize(isLastItem ? 13 : 11.5);
            doc.setFont('helvetica', 'bold');
            doc.text(fmtLKR(item.value), boxX + 8, boxY + 15);
        }

        const totalRows = Math.ceil(summaryData.length / 2);
        yPosition += (totalRows * (boxHeight + 4)) + 10;

        // ==================== FULL P&L AUDIT STATEMENT ====================
        checkNewPage(65);
        drawSectionHeader(doc, 'Comprehensive Profit & Loss Audit Statement', margin, yPosition);
        yPosition += 8;

        const pnlHeaders = ['Financial Item / Ledger Category', 'Amount (LKR)'];
        const pnlColWidths = [120, 60];

        const pnlRows = [
            // Revenue section
            [{ text: 'REVENUE & OPERATIONAL INCOME', bold: true, color: [44, 62, 80] }, ''],
            ['Hire-to-Pay Hires Revenue', fmtLKR(auditData.revenueBreakdown.hireRevenue)],
            ['Commitment Fixed Revenue', fmtLKR(auditData.revenueBreakdown.commitmentBase)],
            ['Commitment Extra KM Revenue', `+ ${fmtLKR(auditData.revenueBreakdown.extraKmCharges)}`],
            ['Commitment Day-Off Deductions', `- ${fmtLKR(auditData.revenueBreakdown.dayOffDeductions)}`],
            ['Other Operation Hires Revenue', `+ ${fmtLKR(auditData.revenueBreakdown.otherOpRevenue)}`],
            [{ text: 'TOTAL GROSS REVENUE', bold: true, isTotal: true }, { text: fmtLKR(auditData.totalRevenue), align: 'right', bold: true, color: [39, 174, 96] }],
            
            // Expenses section
            [{ text: 'OPERATING & CAPITAL EXPENSES', bold: true, color: [44, 62, 80] }, ''],
            ['Gross Fuel Cost', `- ${fmtLKR(auditData.totalFuelCost)}`],
            ['18% VAT Fuel Refund Credit', `+ ${fmtLKR(auditData.fuelVATRefund)}`],
            ['Net Fuel Expense (82%)', { text: `- ${fmtLKR(auditData.netFuelCost)}`, align: 'right', color: [220, 20, 60], bold: true }],
            ['Staff & Driver Salary Expenses', `- ${fmtLKR(auditData.totalStaffCost)}`],
            ['Routine Maintenance (AdBlue, Oil, Tyres, Service)', `- ${fmtLKR(auditData.totalMaintenanceCost)}`],
            ['Vehicle Leasing Installments', `- ${fmtLKR(auditData.totalLeasingInstallments)}`],
            ['Vehicle Loan Installments', `- ${fmtLKR(auditData.totalLoanInstallments)}`],
            [{ text: 'TOTAL OPERATING EXPENSES', bold: true, isTotal: true }, { text: `- ${fmtLKR(auditData.totalExpenses)}`, align: 'right', bold: true, color: [220, 20, 60] }],
            
            // Net Audit Result
            [{ text: 'NET AUDIT PROFIT / (LOSS)', bold: true, isTotal: true }, { text: fmtLKR(auditData.netProfit), align: 'right', bold: true, color: auditData.netProfit >= 0 ? [39, 174, 96] : [220, 20, 60] }]
        ];

        yPosition = drawPDFTable(doc, yPosition, pnlHeaders, pnlColWidths, pnlRows, 8);
        yPosition += 12;

        // ==================== MONTH-OVER-MONTH TREND (IF RANGE > 1 MONTH) ====================
        if (auditData.monthTrends && auditData.monthTrends.length > 1) {
            checkNewPage(60);
            drawSectionHeader(doc, 'Month-over-Month Audit Trend', margin, yPosition);
            yPosition += 8;

            const trendHeaders = ['Month', 'Revenue', 'Net Fuel 82%', 'Salaries', 'Maintenance', 'Lease/Loans', 'Net Profit'];
            const trendColWidths = [22, 26, 26, 26, 26, 26, 28];

            const trendRows = auditData.monthTrends.map(t => [
                t.monthLabel,
                { text: t.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right' },
                { text: t.netFuel.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right' },
                { text: t.salaries.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right' },
                { text: t.maintenance.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right' },
                { text: t.leasingLoans.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right' },
                { text: t.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true, color: t.netProfit >= 0 ? [39, 174, 96] : [220, 20, 60] }
            ]);

            trendRows.push([
                { text: 'Total', bold: true, isTotal: true },
                { text: auditData.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true },
                { text: auditData.netFuelCost.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true },
                { text: auditData.totalStaffCost.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true },
                { text: auditData.totalMaintenanceCost.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true },
                { text: auditData.totalLeasingAndLoans.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true },
                { text: auditData.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true, color: auditData.netProfit >= 0 ? [39, 174, 96] : [220, 20, 60] }
            ]);

            yPosition = drawPDFTable(doc, yPosition, trendHeaders, trendColWidths, trendRows, 8);
            yPosition += 12;
        }

        // ==================== PER-LORRY AUDIT BREAKDOWN ====================
        checkNewPage(60);
        drawSectionHeader(doc, 'Individual Lorry Audit Breakdown', margin, yPosition);
        yPosition += 8;

        if (auditData.lorryAuditBreakdown.length > 0) {
            const lorryHeaders = ['Lorry', 'Revenue', 'Net Fuel 82%', 'Maintenance', 'Lease/Loans', 'Net Profit'];
            const lorryColWidths = [30, 30, 30, 30, 30, 30];

            let lTotRev = 0, lTotFuel = 0, lTotMaint = 0, lTotLease = 0, lTotProfit = 0;

            const lorryRows = auditData.lorryAuditBreakdown.map(l => {
                lTotRev += l.revenue;
                lTotFuel += l.netFuelCost;
                lTotMaint += l.maintenanceCost;
                lTotLease += l.leasingLoanCost;
                lTotProfit += l.netProfit;

                return [
                    l.lorryNumber,
                    { text: l.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right' },
                    { text: l.netFuelCost.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right' },
                    { text: l.maintenanceCost > 0 ? l.maintenanceCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-', align: 'right', color: l.maintenanceCost > 0 ? [155, 89, 182] : [150,150,150] },
                    { text: l.leasingLoanCost > 0 ? l.leasingLoanCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-', align: 'right' },
                    { text: l.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true, color: l.netProfit >= 0 ? [39, 174, 96] : [220, 20, 60] }
                ];
            });

            lorryRows.push([
                { text: 'Total', bold: true, isTotal: true },
                { text: lTotRev.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true },
                { text: lTotFuel.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true },
                { text: lTotMaint.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true },
                { text: lTotLease.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true },
                { text: lTotProfit.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: 'right', bold: true, color: lTotProfit >= 0 ? [39, 174, 96] : [220, 20, 60] }
            ]);

            yPosition = drawPDFTable(doc, yPosition, lorryHeaders, lorryColWidths, lorryRows, 8);
        } else {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('No vehicle operations recorded during this audit period.', margin, yPosition + 4);
            yPosition += 8;
        }

        yPosition += 12;

        // ==================== FORMAL AUDIT VERIFICATION & SIGN-OFF BLOCK ====================
        checkNewPage(48);
        
        const signOffBoxHeight = 42;
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, yPosition, contentWidth, signOffBoxHeight, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.rect(margin, yPosition, contentWidth, signOffBoxHeight, 'D');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 20, 60); // Crimson Red
        doc.text('AUDIT VERIFICATION & AUTHORIZATION SIGN-OFF', margin + 6, yPosition + 7);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);

        // Fix text overflow with maxWidth constraint
        doc.text(
            'This document represents the official verified audit statement of income, operational costs, routine maintenance expenses, and capital financing liabilities.',
            margin + 6,
            yPosition + 12,
            { maxWidth: contentWidth - 12 }
        );

        // Signatures columns
        const sigY = yPosition + 32;
        const colW = contentWidth / 3;

        // Signature 1: Prepared By
        doc.setDrawColor(150, 150, 150);
        doc.line(margin + 6, sigY, margin + colW - 10, sigY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('Prepared By (Accounts)', margin + 6, sigY + 4);

        // Signature 2: Audited By
        doc.line(margin + colW + 6, sigY, margin + (colW * 2) - 10, sigY);
        doc.text('Audited By (Internal Audit)', margin + colW + 6, sigY + 4);

        // Signature 3: Authorized Signatory
        doc.line(margin + (colW * 2) + 6, sigY, margin + contentWidth - 6, sigY);
        doc.text('Authorized Signatory & Seal', margin + (colW * 2) + 6, sigY + 4);

        yPosition += signOffBoxHeight + 10;

        // ==================== FOOTER RENDERER (Clean Fixed Margins) ====================
        const totalPages = doc.internal.getNumberOfPages();
        const generatedDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);

            // Red Bottom Band
            doc.setFillColor(220, 20, 60);
            doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');

            // Dark Top Border Accent
            doc.setFillColor(44, 62, 80);
            doc.rect(0, pageHeight - 15, pageWidth, 1, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text('JAYASOORIYA TRANSPORT — AUDIT REPORT', margin, pageHeight - 7.5);

            doc.setFont('helvetica', 'normal');
            doc.text(`Gen: ${generatedDate}`, pageWidth / 2 + 10, pageHeight - 7.5, { align: 'center' });
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7.5, { align: 'right' });
        }

        // Save PDF File
        const cleanPeriodStr = periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `Jayasooriya_Transport_Audit_Report_${cleanPeriodStr}.pdf`;
        doc.save(fileName);

        hideAuditReportLoading();
        showReportSuccess();
        if (typeof closeAuditReportModal === 'function') closeAuditReportModal();

    } catch (error) {
        console.error('Error generating audit report:', error);
        hideAuditReportLoading();
        showToast('Error generating audit report: ' + error.message, 'error');
    }
}

/**
 * Fetch and process all audit data across the specified month / month range.
 */
async function fetchAuditReportData(startDate, endDate, startMonthKey, endMonthKey) {
    const rawUserId = typeof getQueryUserId === 'function' ? getQueryUserId() : null;
    const userId = rawUserId || (typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null);

    const [sYr, sMo] = startMonthKey.split('-').map(Number);
    const [eYr, eMo] = endMonthKey.split('-').map(Number);

    const monthKeys = [];
    let curY = sYr, curM = sMo;
    while (curY < eYr || (curY === eYr && curM <= eMo)) {
        monthKeys.push(`${curY}-${String(curM).padStart(2, '0')}`);
        curM++;
        if (curM > 12) {
            curM = 1;
            curY++;
        }
    }

    const monthKeysSet = new Set(monthKeys);

    function buildQuery(table) {
        let q = supabaseClient.from(table).select('*');
        if (userId) q = q.eq('user_id', userId);
        return q;
    }

    const [
        { data: hireRecords, error: hrErr },
        { data: commitmentRecords, error: crErr },
        { data: dayOffs, error: doErr },
        { data: otherOpHires, error: ooErr },
        { data: commitmentVehicles, error: cvErr },
        { data: maintenanceRecords, error: mErr },
        { data: allLeasingVehicles, error: lvErr },
        { data: salaryRecords, error: sErr },
        { data: staffAssignments, error: saErr },
        { data: allDrivers, error: drErr },
        { data: driverKmRecords, error: kmErr },
        { data: staffDeductions, error: sdErr },
        { data: driverDayOffs, error: ddErr }
    ] = await Promise.all([
        (userId ? supabaseClient.from('hire_to_pay_records').select('*, hire_to_pay_vehicles(lorry_number)').eq('user_id', userId) : supabaseClient.from('hire_to_pay_records').select('*, hire_to_pay_vehicles(lorry_number)')).gte('hire_date', startDate).lte('hire_date', endDate),
        (userId ? supabaseClient.from('commitment_records').select('*, commitment_vehicles(vehicle_number)').eq('user_id', userId) : supabaseClient.from('commitment_records').select('*, commitment_vehicles(vehicle_number)')).gte('hire_date', startDate).lte('hire_date', endDate),
        buildQuery('commitment_day_offs').gte('day_off_date', startDate).lte('day_off_date', endDate),
        buildQuery('other_operation_hires').gte('hire_date', startDate).lte('hire_date', endDate),
        buildQuery('commitment_vehicles'),
        buildQuery('lorry_maintenance').gte('maintenance_date', startDate).lte('maintenance_date', endDate),
        buildQuery('leasing_vehicles'),
        buildQuery('driver_salary').in('salary_month', monthKeys),
        buildQuery('staff_lorry_assignments'),
        buildQuery('drivers'),
        buildQuery('driver_km_records').gte('record_date', startDate).lte('record_date', endDate),
        buildQuery('staff_deductions').in('salary_month', monthKeys),
        buildQuery('driver_day_offs').gte('day_off_date', startDate).lte('day_off_date', endDate)
    ]);

    if (hrErr) console.warn('hireRecords fetch:', hrErr);
    if (crErr) console.warn('commitmentRecords fetch:', crErr);
    if (mErr) console.warn('maintenanceRecords fetch:', mErr);
    if (lvErr) console.warn('allLeasingVehicles fetch:', lvErr);

    // === Filter Out Sold Lorry GB 5157 From All Operating Records ===
    const filteredHireRecords = (hireRecords || []).filter(r => !isSoldVehicle(r.hire_to_pay_vehicles?.lorry_number));
    const filteredCommitmentRecords = (commitmentRecords || []).filter(r => !isSoldVehicle(r.commitment_vehicles?.vehicle_number));
    const filteredOtherOpHires = (otherOpHires || []).filter(r => !isSoldVehicle(r.base_lorry_number));

    // === Revenue Calculations ===

    let hireRevenue = 0, hireFuelCost = 0;
    filteredHireRecords.forEach(r => {
        hireRevenue += (r.hire_amount || 0);
        hireFuelCost += (r.fuel_cost || 0);
    });

    let otherOpRevenue = 0, otherOpFuelCost = 0;
    filteredOtherOpHires.forEach(r => {
        otherOpRevenue += (r.hire_amount || 0);
        otherOpFuelCost += (r.fuel_cost || 0);
    });

    // Commitment Revenue & Extra KM across the range (excluding sold lorry GB 5157)
    let commitmentBaseRevenue = 0, commitmentFuelCost = 0, dayOffDeductions = 0, extraKmCharges = 0;

    const commitmentVehicleMap = new Map();
    (commitmentVehicles || []).forEach(v => {
        if (!isSoldVehicle(v.vehicle_number)) {
            commitmentVehicleMap.set(v.id, {
                number: v.vehicle_number,
                fixedMonthly: v.fixed_monthly_payment || 0,
                kmLimit: v.km_limit_per_month || 0,
                extraKmRate: v.extra_km_charge || 0
            });
        }
    });

    // Group commitment records by month and vehicle
    const commitKmPerMonthVehicle = new Map(); // "monthKey_vId" -> km
    filteredCommitmentRecords.forEach(r => {
        commitmentFuelCost += (r.fuel_cost || 0);
        if (r.hire_date && r.vehicle_id) {
            const mKey = r.hire_date.substring(0, 7);
            const key = `${mKey}_${r.vehicle_id}`;
            commitKmPerMonthVehicle.set(key, (commitKmPerMonthVehicle.get(key) || 0) + (r.distance || 0));
        }
    });

    (dayOffs || []).forEach(d => {
        dayOffDeductions += (d.deduction_amount || 0);
    });

    // Calculate fixed base payment and extra KM for each active month
    monthKeys.forEach(mKey => {
        commitmentVehicleMap.forEach((vInfo, vId) => {
            const monthKm = commitKmPerMonthVehicle.get(`${mKey}_${vId}`) || 0;
            if (monthKm > 0 || filteredCommitmentRecords.some(r => r.vehicle_id === vId && r.hire_date?.startsWith(mKey))) {
                commitmentBaseRevenue += vInfo.fixedMonthly;
                if (monthKm > vInfo.kmLimit) {
                    extraKmCharges += (monthKm - vInfo.kmLimit) * vInfo.extraKmRate;
                }
            }
        });
    });

    const totalRevenue = hireRevenue + commitmentBaseRevenue - dayOffDeductions + extraKmCharges + otherOpRevenue;
    const totalFuelCost = hireFuelCost + commitmentFuelCost + otherOpFuelCost;
    const fuelVATRefund = totalFuelCost * 0.18;
    const netFuelCost = totalFuelCost * 0.82;

    // === Routine Maintenance Calculations (AdBlue, Engine Oil, Tyres, Service — Excluding GB 5157 & mega repairs) ===
    let totalMaintenanceCost = 0;
    const maintenanceByVehicleMap = new Map(); // vehicleKey -> amount

    const regularKeywords = [
        'adblue', 'ad blue', 'ad-blue',
        'engine oil', 'oil', 'lubricant',
        'tyre', 'tire',
        'service', 'grease', 'greasing', 'wash', 'washing', 'filter', 'coolant'
    ];

    const regularMaintenanceRecords = (maintenanceRecords || []).filter(m => {
        if (isSoldVehicle(m.vehicle_ref)) return false;
        const typeStr = (m.expense_type || '').toLowerCase();
        const notesStr = (m.notes || '').toLowerCase();
        const combined = `${typeStr} ${notesStr}`;
        return regularKeywords.some(keyword => combined.includes(keyword));
    });

    regularMaintenanceRecords.forEach(m => {
        const amt = m.amount || 0;
        totalMaintenanceCost += amt;

        // Vehicle breakdown
        if (m.vehicle_ref) {
            const normV = normaliseVehicleKey(m.vehicle_ref);
            maintenanceByVehicleMap.set(normV, (maintenanceByVehicleMap.get(normV) || 0) + amt);
        }
    });

    // === Leasing & Loan Calculations ===
    let totalLeasingInstallments = 0;
    let totalLoanInstallments = 0;
    const leasingLoansByVehicleMap = new Map(); // vehicleKey -> amount

    (allLeasingVehicles || []).forEach(lv => {
        const vNum = lv.vehicle_number || '';
        // Skip settled entries, sold vehicle GB 5157, and short term loans (UC World, NBSL)
        if (lv.settled || isSoldVehicle(vNum) || isExcludedLoan(lv)) {
            return;
        }

        const vKey = normaliseVehicleKey(vNum);
        const entryType = (lv.entry_type || 'leasing').toLowerCase();
        
        let vehicleTotal = 0;

        // Use standard app leasing key generator for exact accuracy across monthly/weekly/fortnightly loans
        const paymentKeys = typeof leasingBuildPaymentKeys === 'function' ? leasingBuildPaymentKeys(lv) : [];

        if (paymentKeys && paymentKeys.length > 0) {
            paymentKeys.forEach((pKey, idx) => {
                const mKey = pKey.length === 10 ? pKey.substring(0, 7) : pKey;
                if (monthKeysSet.has(mKey)) {
                    const amt = typeof leasingGetInstallmentAmount === 'function'
                        ? leasingGetInstallmentAmount(lv, idx, paymentKeys.length)
                        : parseFloat(lv.installment_amount || 0);

                    if (entryType === 'loan') {
                        totalLoanInstallments += amt;
                    } else {
                        totalLeasingInstallments += amt;
                    }
                    vehicleTotal += amt;
                }
            });
        } else {
            // Fallback for monthly if paymentKeys not available
            monthKeys.forEach(mKey => {
                const [rYr, rMo] = mKey.split('-').map(Number);
                let monthAmt = parseFloat(lv.installment_amount || 0);
                const finalAmt = parseFloat(lv.final_installment_amount || 0);

                if (lv.start_year && lv.start_month) {
                    const startYr = parseInt(lv.start_year);
                    const startMo = parseInt(lv.start_month);
                    const totalMonths = lv.total_months || lv.total_installments || 0;
                    const monthDiff = (rYr - startYr) * 12 + (rMo - startMo);

                    if (monthDiff >= 0 && (totalMonths === 0 || monthDiff < totalMonths)) {
                        if (finalAmt > 0 && totalMonths > 0 && monthDiff === totalMonths - 1) {
                            monthAmt = finalAmt;
                        }
                        if (entryType === 'loan') {
                            totalLoanInstallments += monthAmt;
                        } else {
                            totalLeasingInstallments += monthAmt;
                        }
                        vehicleTotal += monthAmt;
                    }
                } else {
                    if (entryType === 'loan') {
                        totalLoanInstallments += monthAmt;
                    } else {
                        totalLeasingInstallments += monthAmt;
                    }
                    vehicleTotal += monthAmt;
                }
            });
        }

        if (vehicleTotal > 0 && vKey) {
            leasingLoansByVehicleMap.set(vKey, (leasingLoansByVehicleMap.get(vKey) || 0) + vehicleTotal);
        }
    });

    const totalLeasingAndLoans = totalLeasingInstallments + totalLoanInstallments;

    // === Salary Calculations (Directly from Staff Salary Section — Gross Salaries) ===
    const driverInfoMap = new Map();
    (allDrivers || []).forEach(d => driverInfoMap.set(d.id, d));

    function isFamilyDriver(driverObj) {
        if (!driverObj) return false;
        const nameClean = (driverObj.name || '').replace(/\s*\(.*?\)\s*$/, '').trim().toUpperCase();
        return nameClean.includes('JAUK') || nameClean.includes('JAAP');
    }

    // Helper: calculate gross staff salary for a specific month directly from driver_salary records
    function getMonthStaffGrossSalaries(mKey) {
        let monthGrossTotal = 0;
        (salaryRecords || []).forEach(s => {
            if (s.salary_month === mKey) {
                const dObj = driverInfoMap.get(s.driver_id);
                if (!isFamilyDriver(dObj)) {
                    const grossVal = parseFloat(s.gross_salary || s.gross || s.total_salary || 0);
                    monthGrossTotal += grossVal;
                }
            }
        });
        return monthGrossTotal;
    }

    // Total staff gross salary cost across all requested audit monthKeys
    let totalStaffCost = 0;
    monthKeys.forEach(mKey => {
        totalStaffCost += getMonthStaffGrossSalaries(mKey);
    });

    // === Per-Lorry Audit Breakdown (Excludes: GB 5157 sold AND LA 7436 non-running) ===
    // Per user request: Lorry breakdown table focuses on vehicle operational numbers (Revenue, Net Fuel, Maintenance, Lease/Loans, Net Profit)
    // Driver name and individual salary columns are omitted for clean clarity.
    const lorryAggMap = new Map();

    function getOrCreateLorry(lorryNum) {
        if (isSoldVehicle(lorryNum) || isNonRunningLeasedVehicle(lorryNum)) return null;
        const key = normaliseVehicleKey(lorryNum);
        const display = normaliseVehicleDisplay(lorryNum);
        if (!lorryAggMap.has(key)) {
            lorryAggMap.set(key, {
                lorryNumber: display,
                revenue: 0,
                fuelCost: 0
            });
        }
        return lorryAggMap.get(key);
    }

    filteredHireRecords.forEach(r => {
        const lNum = r.hire_to_pay_vehicles?.lorry_number || 'Unknown';
        const agg = getOrCreateLorry(lNum);
        if (agg) {
            agg.revenue += (r.hire_amount || 0);
            agg.fuelCost += (r.fuel_cost || 0);
        }
    });

    filteredCommitmentRecords.forEach(r => {
        const lNum = r.commitment_vehicles?.vehicle_number || 'Unknown';
        const agg = getOrCreateLorry(lNum);
        if (agg) {
            agg.fuelCost += (r.fuel_cost || 0);
        }
    });

    commitmentVehicleMap.forEach((vInfo, vId) => {
        const agg = getOrCreateLorry(vInfo.number);
        if (agg) {
            monthKeys.forEach(mKey => {
                const monthKm = commitKmPerMonthVehicle.get(`${mKey}_${vId}`) || 0;
                if (monthKm > 0 || filteredCommitmentRecords.some(r => r.vehicle_id === vId && r.hire_date?.startsWith(mKey))) {
                    agg.revenue += vInfo.fixedMonthly;
                    if (monthKm > vInfo.kmLimit) {
                        agg.revenue += (monthKm - vInfo.kmLimit) * vInfo.extraKmRate;
                    }
                }
            });
        }
    });

    filteredOtherOpHires.forEach(r => {
        const lNum = r.base_lorry_number || 'Other';
        const agg = getOrCreateLorry(lNum);
        if (agg) {
            agg.revenue += (r.hire_amount || 0);
            agg.fuelCost += (r.fuel_cost || 0);
        }
    });

    const lorryAuditBreakdown = [];

    lorryAggMap.forEach((agg, normKey) => {
        const cKey = cleanVehicleStr(agg.lorryNumber);
        if (isSoldVehicle(cKey) || isNonRunningLeasedVehicle(cKey)) return;

        const netFuel = agg.fuelCost * 0.82;
        const maintenanceCost = maintenanceByVehicleMap.get(normKey) || maintenanceByVehicleMap.get(cKey) || 0;
        const leasingLoanCost = leasingLoansByVehicleMap.get(normKey) || leasingLoansByVehicleMap.get(cKey) || 0;

        const netProfit = agg.revenue - netFuel - maintenanceCost - leasingLoanCost;

        lorryAuditBreakdown.push({
            lorryNumber: agg.lorryNumber,
            revenue: agg.revenue,
            fuelCost: agg.fuelCost,
            netFuelCost: netFuel,
            maintenanceCost,
            leasingLoanCost,
            netProfit
        });
    });

    lorryAuditBreakdown.sort((a, b) => b.netProfit - a.netProfit);

    // === Month-over-Month Audit Trend (if range > 1 month) ===
    const monthTrends = [];
    if (monthKeys.length > 1) {
        monthKeys.forEach(mKey => {
            const [y, m] = mKey.split('-').map(Number);
            const mLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

            let mRev = 0, mFuel = 0, mMaint = 0, mLease = 0;

            filteredHireRecords.forEach(r => {
                if (r.hire_date?.startsWith(mKey)) {
                    mRev += (r.hire_amount || 0);
                    mFuel += (r.fuel_cost || 0);
                }
            });

            filteredOtherOpHires.forEach(r => {
                if (r.hire_date?.startsWith(mKey)) {
                    mRev += (r.hire_amount || 0);
                    mFuel += (r.fuel_cost || 0);
                }
            });

            filteredCommitmentRecords.forEach(r => {
                if (r.hire_date?.startsWith(mKey)) {
                    mFuel += (r.fuel_cost || 0);
                }
            });

            (dayOffs || []).forEach(d => {
                if (d.day_off_date?.startsWith(mKey)) {
                    mRev -= (d.deduction_amount || 0);
                }
            });

            commitmentVehicleMap.forEach((vInfo, vId) => {
                const monthKm = commitKmPerMonthVehicle.get(`${mKey}_${vId}`) || 0;
                if (monthKm > 0 || filteredCommitmentRecords.some(r => r.vehicle_id === vId && r.hire_date?.startsWith(mKey))) {
                    mRev += vInfo.fixedMonthly;
                    if (monthKm > vInfo.kmLimit) {
                        mRev += (monthKm - vInfo.kmLimit) * vInfo.extraKmRate;
                    }
                }
            });

            const mNetFuel = mFuel * 0.82;

            regularMaintenanceRecords.forEach(r => {
                if (r.maintenance_date?.startsWith(mKey)) {
                    mMaint += (r.amount || 0);
                }
            });

            // Gross Staff Salaries for this month mKey
            const mSal = getMonthStaffGrossSalaries(mKey);

            // Leasing & loans for this month
            (allLeasingVehicles || []).forEach(lv => {
                const vNum = lv.vehicle_number || '';
                if (lv.settled || isSoldVehicle(vNum) || isExcludedLoan(lv)) return;

                const paymentKeys = typeof leasingBuildPaymentKeys === 'function' ? leasingBuildPaymentKeys(lv) : [];

                if (paymentKeys && paymentKeys.length > 0) {
                    paymentKeys.forEach((pKey, idx) => {
                        const targetMKey = pKey.length === 10 ? pKey.substring(0, 7) : pKey;
                        if (targetMKey === mKey) {
                            const amt = typeof leasingGetInstallmentAmount === 'function'
                                ? leasingGetInstallmentAmount(lv, idx, paymentKeys.length)
                                : parseFloat(lv.installment_amount || 0);
                            mLease += amt;
                        }
                    });
                }
            });

            const mProfit = mRev - mNetFuel - mSal - mMaint - mLease;

            monthTrends.push({
                monthKey: mKey,
                monthLabel: mLabel,
                revenue: mRev,
                fuel: mFuel,
                netFuel: mNetFuel,
                salaries: mSal,
                maintenance: mMaint,
                leasingLoans: mLease,
                netProfit: mProfit
            });
        });
    }

    const totalExpenses = netFuelCost + totalStaffCost + totalMaintenanceCost + totalLeasingAndLoans;
    const netProfit = totalRevenue - totalExpenses;

    return {
        totalRevenue,
        totalFuelCost,
        fuelVATRefund,
        netFuelCost,
        totalStaffCost,
        totalMaintenanceCost,
        totalMaintenanceCount: regularMaintenanceRecords.length,
        totalLeasingInstallments,
        totalLoanInstallments,
        totalLeasingAndLoans,
        totalExpenses,
        netProfit,
        revenueBreakdown: {
            hireRevenue,
            commitmentBase: commitmentBaseRevenue,
            extraKmCharges,
            dayOffDeductions,
            otherOpRevenue
        },
        monthTrends,
        lorryAuditBreakdown
    };
}
