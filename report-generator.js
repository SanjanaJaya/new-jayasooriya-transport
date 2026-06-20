// report-generator.js - PDF Report Generator for Jayasooriya Transport
// Enhanced with premium styling, data-fetching fixes, and comprehensive operations breakdown

// Function to load and add logo to PDF
async function addLogoToReport(doc, x, y, size) {
    return new Promise((resolve, reject) => {
        const logoUrl = 'https://i.postimg.cc/QdryzTyS/Bigger-New-Logo.png';
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

// Stylized section header helper
function drawSectionHeader(doc, title, margin, yPos) {
    doc.setFillColor(220, 20, 60); // Crimson Red accent bar
    doc.rect(margin, yPos - 4.5, 4, 6, 'F');
    
    doc.setTextColor(44, 62, 80); // Dark slate charcoal
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 6, yPos);
}

// Custom table-drawing function to render professional data layouts
function drawPDFTable(doc, startY, headers, colWidths, rows, rowHeight = 7.5) {
    let y = startY;
    const pageWidth = doc.internal.pageSize.getWidth();
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
        // Alternate row colors for enhanced readability
        if (rowIndex === rows.length - 1 && row[0]?.isTotal) {
            // Total/Grand Summary Row
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
            
            // Soft cell divider
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
        
        // Fetch and calculate fixed report data
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
        
        // ==================== HEADER ====================
        doc.setFillColor(220, 20, 60);
        doc.rect(0, 0, pageWidth, 48, 'F');
        
        // Add logo
        await addLogoToReport(doc, 15, 9, 30);
        
        // Title block
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('JAYASOORIYA TRANSPORT', pageWidth / 2 + 15, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('PREMIUM TRANSPORT & LOGISTICS MANAGEMENT SYSTEM', pageWidth / 2 + 15, 27, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Monthly Business Report — ${monthName}`, pageWidth / 2 + 15, 38, { align: 'center' });
        
        yPosition = 58;
        
        // ==================== FINANCIAL EXECUTIVE SUMMARY ====================
        drawSectionHeader(doc, 'Executive Financial Summary', margin, yPosition);
        yPosition += 8;
        
        // Stylized summary grid (Premium Left-Border Accent Cards)
        const summaryData = [
            { label: 'Total Revenue (inc. Fuel Allowance)', value: reportData.totalRevenue + reportData.fuelAllowance, color: [39, 174, 96] }, // Green
            { label: 'Total Expenses (Fuel + Staff Cost)', value: reportData.totalExpenses, color: [231, 76, 60] }, // Red
            { label: 'Final Net Profit', value: reportData.netProfit, color: [142, 68, 173] }, // Purple
            { label: 'Net Profit Margin', value: reportData.profitMargin.toFixed(1) + '%', color: [52, 152, 219] } // Blue
        ];
        
        const boxWidth = (contentWidth - 6) / 2;
        const boxHeight = 22;
        let xPos = margin;
        let row = 0;
        
        summaryData.forEach((item, index) => {
            if (index % 2 === 0 && index > 0) {
                row++;
                xPos = margin;
            }
            
            const boxY = yPosition + (row * (boxHeight + 4));
            
            // Draw clean white card background with soft border
            doc.setFillColor(255, 255, 255);
            doc.rect(xPos, boxY, boxWidth, boxHeight, 'F');
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
            doc.rect(xPos, boxY, boxWidth, boxHeight, 'D');
            
            // Colored left border accent
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.rect(xPos, boxY, 4, boxHeight, 'F');
            
            // Label
            doc.setTextColor(110, 110, 110);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.text(item.label, xPos + 8, boxY + 7);
            
            // Value
            doc.setTextColor(30, 30, 30);
            doc.setFontSize(12.5);
            doc.setFont('helvetica', 'bold');
            const valueText = typeof item.value === 'number' && item.label !== 'Net Profit Margin' 
                ? `LKR ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                : item.value;
            doc.text(valueText, xPos + 8, boxY + 16);
            
            xPos += boxWidth + 6;
        });
        
        yPosition += (Math.ceil(summaryData.length / 2) * (boxHeight + 4)) + 12;
        
        // ==================== REVENUE SEGMENTS DETAIL ====================
        checkNewPage(50);
        drawSectionHeader(doc, 'Revenue Streams Detail', margin, yPosition);
        yPosition += 8;
        
        const breakdownHeaders = ['Revenue Segment', 'Amount (LKR)'];
        const breakdownColWidths = [120, 60];
        const breakdownRows = [
            ['Hire-to-Pay Revenue', { text: `LKR ${reportData.hireToPayRevenue.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right' }],
            ['Commitment Revenue (Ran Lorries Only)', { text: `LKR ${reportData.commitmentRevenue.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right' }],
            ['Other Operations (Ad-hoc Hires)', { text: `LKR ${reportData.otherOperationRevenue.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right' }],
            ['Add: Fuel Allowance (16.00% Fuel Refund)', { text: `LKR ${reportData.fuelAllowance.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right', color: [39, 174, 96] }],
            ['Less: Day Off Deductions (Ran Lorries Only)', { text: `- LKR ${reportData.dayOffDeductions.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right', color: [220, 20, 60] }],
            [{ text: 'Total Net Income (Revenue + Fuel Allowance)', bold: true, isTotal: true }, { text: `LKR ${(reportData.totalRevenue + reportData.fuelAllowance).toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right', bold: true, color: [39, 174, 96] }]
        ];
        
        yPosition = drawPDFTable(doc, yPosition, breakdownHeaders, breakdownColWidths, breakdownRows, 8);
        yPosition += 12;

        // ==================== OPERATING EXPENSES DETAIL ====================
        checkNewPage(50);
        doc.setFillColor(240, 240, 240);
        drawSectionHeader(doc, 'Operating Expenses Detail', margin, yPosition);
        yPosition += 8;
        
        const expenseHeaders = ['Expense Category', 'Amount (LKR)'];
        const expenseColWidths = [120, 60];
        const expenseRows = [
            ['Total Fuel Cost (All Operations)', { text: `LKR ${reportData.totalFuelCost.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right' }],
            ['Staff Salaries (Gross - Paid Drivers / Helpers)', { text: `LKR ${reportData.totalGrossSalaries.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right' }],
            ['Unpaid Driver/Helper Advances (Not yet calculated in salary)', { text: `LKR ${reportData.totalUnpaidAdvances.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right' }],
            ['Excessing Litres Actual Cost Deduction', { text: `- LKR ${reportData.excessingLitresActualCost.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right', color: [220, 20, 60] }],
            [{ text: 'Total Operating Expenses', bold: true, isTotal: true }, { text: `LKR ${reportData.totalExpenses.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right', bold: true, color: [220, 20, 60] }]
        ];
        
        yPosition = drawPDFTable(doc, yPosition, expenseHeaders, expenseColWidths, expenseRows, 8);
        yPosition += 12;
        
        // ==================== HIRE-TO-PAY VEHICLES ====================
        checkNewPage(50);
        drawSectionHeader(doc, 'Hire-to-Pay Fleet Performance', margin, yPosition);
        yPosition += 8;
        
        if (reportData.hireVehiclePerformance.length > 0) {
            const hireHeaders = ['Vehicle No', 'Ownership', 'Distance', 'Revenue (LKR)', 'Fuel Cost (LKR)', 'Net Profit (LKR)'];
            const hireColWidths = [30, 25, 25, 33, 33, 34];
            
            let tKm = 0, tRev = 0, tFuel = 0, tProf = 0;
            const hireTableRows = reportData.hireVehiclePerformance.map(v => {
                tKm += v.totalKm; tRev += v.revenue; tFuel += v.fuelCost; tProf += v.profit;
                return [
                    v.number,
                    v.ownership,
                    { text: `${v.totalKm.toFixed(0)} km`, align: 'right' },
                    { text: v.revenue.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right' },
                    { text: v.fuelCost.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right' },
                    { text: v.profit.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', color: v.profit >= 0 ? [39, 174, 96] : [220, 20, 60], bold: true }
                ];
            });
            
            hireTableRows.push([
                { text: 'Total', bold: true, isTotal: true },
                '',
                { text: `${tKm.toFixed(0)} km`, align: 'right', bold: true },
                { text: tRev.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                { text: tFuel.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                { text: tProf.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true, color: tProf >= 0 ? [39, 174, 96] : [220, 20, 60] }
            ]);
            
            yPosition = drawPDFTable(doc, yPosition, hireHeaders, hireColWidths, hireTableRows, 8);
        } else {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('No hire-to-pay vehicle records found for this period.', margin, yPosition + 4);
            yPosition += 8;
        }
        
        yPosition += 12;
        
        // ==================== COMMITMENT VEHICLES ====================
        checkNewPage(50);
        drawSectionHeader(doc, 'Commitment Fleet Performance (Ran Lorries Only)', margin, yPosition);
        yPosition += 8;
        
        if (reportData.commitmentVehiclePerformance.length > 0) {
            const commitHeaders = ['Vehicle No', 'Distance', 'Revenue (LKR)', 'Fuel Cost (LKR)', 'Net Profit (LKR)'];
            const commitColWidths = [45, 30, 35, 35, 35];
            
            let tKm = 0, tRev = 0, tFuel = 0, tProf = 0;
            const commitTableRows = reportData.commitmentVehiclePerformance.map(v => {
                tKm += v.totalKm; tRev += v.revenue; tFuel += v.fuelCost; tProf += v.profit;
                return [
                    v.number,
                    { text: `${v.totalKm.toFixed(0)} km`, align: 'right' },
                    { text: v.revenue.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right' },
                    { text: v.fuelCost.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right' },
                    { text: v.profit.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', color: v.profit >= 0 ? [39, 174, 96] : [220, 20, 60], bold: true }
                ];
            });
            
            commitTableRows.push([
                { text: 'Total', bold: true, isTotal: true },
                { text: `${tKm.toFixed(0)} km`, align: 'right', bold: true },
                { text: tRev.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                { text: tFuel.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                { text: tProf.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true, color: tProf >= 0 ? [39, 174, 96] : [220, 20, 60] }
            ]);
            
            yPosition = drawPDFTable(doc, yPosition, commitHeaders, commitColWidths, commitTableRows, 8);
        } else {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('No active commitment vehicle records found for this period.', margin, yPosition + 4);
            yPosition += 8;
        }
        
        yPosition += 12;

        // ==================== IDLE / DID NOT RUN COMMITMENT VEHICLES ====================
        checkNewPage(45);
        drawSectionHeader(doc, 'Idle Commitment Vehicles (Did Not Run)', margin, yPosition);
        yPosition += 8;
        
        if (reportData.idleCommitmentVehicles.length > 0) {
            const idleHeaders = ['Vehicle No', 'Standard Fixed payment (LKR)', 'Monthly Status'];
            const idleColWidths = [60, 60, 60];
            const idleTableRows = reportData.idleCommitmentVehicles.map(v => [
                v.vehicle_number,
                { text: (v.fixed_monthly_payment || 0).toLocaleString(), align: 'right' },
                { text: 'IDLE (0 Hires Recorded)', color: [220, 20, 60], bold: true }
            ]);
            
            // Add note that no revenue was added for these vehicles
            idleTableRows.push([
                { text: 'Note: These vehicles did not run, so fixed monthly payments were excluded from revenue.', bold: true, isTotal: true },
                '', ''
            ]);

            yPosition = drawPDFTable(doc, yPosition, idleHeaders, idleColWidths, idleTableRows, 8);
        } else {
            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(39, 174, 96);
            doc.text('✓ All active commitment vehicles were operational (ran hires) this month.', margin + 2, yPosition + 4);
            yPosition += 10;
        }
        
        yPosition += 12;
        
        // ==================== OTHER OPERATIONS VEHICLES ====================
        checkNewPage(50);
        drawSectionHeader(doc, 'Other Operations Fleet Performance', margin, yPosition);
        yPosition += 8;
        
        if (reportData.otherVehiclePerformance.length > 0) {
            const otherHeaders = ['Vehicle No', 'Distance', 'Revenue (LKR)', 'Fuel Cost (LKR)', 'Net Profit (LKR)'];
            const otherColWidths = [45, 30, 35, 35, 35];
            
            let tKm = 0, tRev = 0, tFuel = 0, tProf = 0;
            const otherTableRows = reportData.otherVehiclePerformance.map(v => {
                tKm += v.totalKm; tRev += v.revenue; tFuel += v.fuelCost; tProf += v.profit;
                return [
                    v.number,
                    { text: `${v.totalKm.toFixed(0)} km`, align: 'right' },
                    { text: v.revenue.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right' },
                    { text: v.fuelCost.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right' },
                    { text: v.profit.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', color: v.profit >= 0 ? [39, 174, 96] : [220, 20, 60], bold: true }
                ];
            });
            
            otherTableRows.push([
                { text: 'Total', bold: true, isTotal: true },
                { text: `${tKm.toFixed(0)} km`, align: 'right', bold: true },
                { text: tRev.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                { text: tFuel.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true },
                { text: tProf.toLocaleString(undefined, {maximumFractionDigits:0}), align: 'right', bold: true, color: tProf >= 0 ? [39, 174, 96] : [220, 20, 60] }
            ]);
            
            yPosition = drawPDFTable(doc, yPosition, otherHeaders, otherColWidths, otherTableRows, 8);
        } else {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('No other operation hires found for this period.', margin, yPosition + 4);
            yPosition += 8;
        }
        
        yPosition += 12;

        // ==================== EXCESSING LITRES DEDUCTION ====================
        checkNewPage(50);
        drawSectionHeader(doc, 'Excessing Litres Deduction', margin, yPosition);
        yPosition += 8;

        if (reportData.excessingLitresRecords.length > 0) {
            const elHeaders = ['Date', 'Fuel Price/L (LKR)', 'Fuel Amount (L)', 'Cost (LKR)', 'Actual Cost Deducted (LKR)'];
            const elColWidths = [30, 40, 35, 40, 35];

            const elRows = reportData.excessingLitresRecords.map(r => [
                r.date,
                { text: parseFloat(r.fuel_price_per_l).toLocaleString(undefined, {minimumFractionDigits:2}), align: 'right' },
                { text: parseFloat(r.fuel_amount_l).toFixed(2) + ' L', align: 'right' },
                { text: parseFloat(r.cost).toLocaleString(undefined, {minimumFractionDigits:2}), align: 'right' },
                { text: parseFloat(r.actual_cost).toLocaleString(undefined, {minimumFractionDigits:2}), align: 'right', color: [220, 20, 60], bold: true }
            ]);

            elRows.push([
                { text: 'Total Deduction', bold: true, isTotal: true },
                '',
                '',
                { text: `LKR ${reportData.excessingLitresCost.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right', bold: true },
                { text: `- LKR ${reportData.excessingLitresActualCost.toLocaleString(undefined, {minimumFractionDigits:2})}`, align: 'right', bold: true, color: [220, 20, 60] }
            ]);

            yPosition = drawPDFTable(doc, yPosition, elHeaders, elColWidths, elRows, 8);
        } else {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('No excessing litres records found for this period.', margin, yPosition + 4);
            yPosition += 8;
        }

        yPosition += 12;
        
        // ==================== OPERATIONAL STATISTICS ====================
        checkNewPage(50);
        drawSectionHeader(doc, 'Operational Summary Statistics', margin, yPosition);
        yPosition += 8;
        
        const stats = [
            { label: 'Total Hire-to-Pay Jobs Completed', value: reportData.hireToPayCount },
            { label: 'Total Commitment Trips Completed', value: reportData.commitmentCount },
            { label: 'Total Day-Off Deductions Registered', value: reportData.dayOffCount },
            { label: 'Total Operational Distance Covered', value: `${reportData.totalDistance.toLocaleString()} km` },
            { label: 'Average Revenue per Transport Hire', value: `LKR ${reportData.avgRevenuePerHire.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
            { label: 'Driver Salary Advances Paid Out (Total)', value: `LKR ${reportData.driverAdvancesTotalSum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
            { label: 'Total Driver Salaries Paid Out (Gross)', value: `LKR ${reportData.totalGrossSalaries.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` }
        ];
        
        doc.setFillColor(255, 255, 255);
        doc.rect(margin, yPosition, contentWidth, stats.length * 7.5, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.rect(margin, yPosition, contentWidth, stats.length * 7.5, 'D');
        
        stats.forEach((item, index) => {
            const statY = yPosition + (index * 7.5);
            if (index > 0) {
                doc.setDrawColor(240, 240, 240);
                doc.line(margin, statY, margin + contentWidth, statY);
            }
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text(item.label, margin + 4, statY + 5);
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 30, 30);
            doc.text(item.value.toString(), pageWidth - margin - 4, statY + 5, { align: 'right' });
        });
        
        yPosition += (stats.length * 7.5) + 12;
        
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
            
            // Footer bottom background bar
            doc.setFillColor(220, 20, 60); // Brand Crimson
            doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
            
            // Thin boundary accent line above the bottom bar
            doc.setFillColor(44, 62, 80); // Secondary Slate Accent
            doc.rect(0, pageHeight - 15, pageWidth, 1, 'F');
            
            // Footer text
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

// Fetch all data from Supabase
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
    
    // 3. Fetch day offs (Commitment vehicle day offs)
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

    // 7. Fetch driver salary records for the selected month to deduct
    const { data: salaryRecords, error: sErr } = await supabaseClient
        .from('driver_salary')
        .select('driver_id, net_salary, gross_salary')
        .eq('user_id', userId)
        .eq('salary_month', startMonth);
    if (sErr) throw sErr;

    // 8. Fetch excessing litres actual cost for the month
    const { data: elRecords, error: elErr } = await supabaseClient
        .from('excessing_litres')
        .select('actual_cost, fuel_price_per_l, fuel_amount_l, cost, date')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);
    if (elErr) throw elErr;

    const excessingLitresActualCost = elRecords?.reduce((sum, r) => sum + (r.actual_cost || 0), 0) || 0;
    const excessingLitresCost = elRecords?.reduce((sum, r) => sum + (r.cost || 0), 0) || 0;
    const excessingLitresCount = elRecords?.length || 0;
    
    // Filtering commitment vehicles that actually ran during the month
    const ranCommitmentVehicleIds = new Set(commitmentRecords?.map(r => r.vehicle_id));
    
    // Commitment vehicles that actually ran during the month
    const ranCommitmentVehicles = (commitmentVehicles || []).filter(v => ranCommitmentVehicleIds.has(v.id));

    // Commitment vehicles that are active but did NOT run
    const idleCommitmentVehicles = (commitmentVehicles || []).filter(v => !v.terminated && !ranCommitmentVehicleIds.has(v.id));
    
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
                number: record.hire_to_pay_vehicles?.lorry_number || 'Unknown',
                ownership: record.hire_to_pay_vehicles?.ownership === 'company' ? 'Company' : 'Rented',
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
    
    // Calculate commitment metrics (using only ran commitment vehicles)
    let commitmentBaseRevenue = 0;
    let commitmentFuelCost = 0;
    let commitmentDistance = 0;
    let extraKmCharges = 0;
    let dayOffDeductions = 0;
    const commitmentVehicleMap = new Map();
    
    ranCommitmentVehicles.forEach(vehicle => {
        commitmentBaseRevenue += vehicle.fixed_monthly_payment || 0;
        
        commitmentVehicleMap.set(vehicle.id, {
            number: vehicle.vehicle_number,
            totalKm: 0,
            revenue: vehicle.fixed_monthly_payment || 0,
            fuelCost: 0,
            profit: vehicle.fixed_monthly_payment || 0,
            fixedPayment: vehicle.fixed_monthly_payment || 0,
            kmLimit: vehicle.km_limit_per_month || 0,
            extraKmRate: vehicle.extra_km_charge || 0
        });
    });
    
    dayOffs?.forEach(dayOff => {
        if (commitmentVehicleMap.has(dayOff.vehicle_id)) {
            dayOffDeductions += dayOff.deduction_amount || 0;
            const vData = commitmentVehicleMap.get(dayOff.vehicle_id);
            vData.revenue -= dayOff.deduction_amount || 0;
            vData.profit -= dayOff.deduction_amount || 0;
        }
    });
    
    commitmentRecords?.forEach(record => {
        commitmentFuelCost += record.fuel_cost || 0;
        commitmentDistance += record.distance || 0;
        
        if (commitmentVehicleMap.has(record.vehicle_id)) {
            const vData = commitmentVehicleMap.get(record.vehicle_id);
            vData.totalKm += record.distance || 0;
            vData.fuelCost += record.fuel_cost || 0;
        }
    });

    // Compute extra KM charges at the vehicle level and add to revenue/extraKmCharges
    ranCommitmentVehicles.forEach(vehicle => {
        if (commitmentVehicleMap.has(vehicle.id)) {
            const vData = commitmentVehicleMap.get(vehicle.id);
            const excKm = Math.max(0, vData.totalKm - vData.kmLimit);
            const extraChg = excKm * vData.extraKmRate;
            extraKmCharges += extraChg;
            vData.revenue += extraChg;
            vData.profit = vData.revenue - vData.fuelCost;
        }
    });
    
    // Calculate other operation metrics & vehicle map
    let otherOpRevenue = 0;
    let otherOpFuelCost = 0;
    let otherOpDistance = 0;
    const otherVehicleMap = new Map();
    
    otherOpHires?.forEach(record => {
        otherOpRevenue += record.hire_amount || 0;
        otherOpFuelCost += record.fuel_cost || 0;
        otherOpDistance += record.distance || 0;
        
        const baseName = record.base_lorry_number || 'Other';
        if (!otherVehicleMap.has(baseName)) {
            otherVehicleMap.set(baseName, {
                number: baseName,
                totalKm: 0,
                revenue: 0,
                fuelCost: 0,
                profit: 0
            });
        }
        
        const vData = otherVehicleMap.get(baseName);
        vData.totalKm += record.distance || 0;
        vData.revenue += record.hire_amount || 0;
        vData.fuelCost += record.fuel_cost || 0;
        vData.profit = vData.revenue - vData.fuelCost;
    });

    // Business Expenses & Salaries Rules:
    // If a driver's salary is calculated, advances are already deducted inside their Net Salary.
    // Outlay for paid driver = Gross Salary = Net Salary + Advances + Other Deductions
    // Outlay for unpaid driver = Advances given during the month.
    const salaryDriverIds = new Set(salaryRecords?.map(r => r.driver_id) || []);
    
    const totalGrossSalaries = salaryRecords?.reduce((sum, r) => sum + (r.gross_salary || 0), 0) || 0;
    
    // We sum advances only for drivers who do NOT have salary records
    const totalUnpaidAdvances = driverAdvances?.filter(a => !salaryDriverIds.has(a.driver_id)).reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
    
    const totalStaffCost = totalGrossSalaries + totalUnpaidAdvances;
    
    // Fetch total sum of all advances given in the month (for display statistics only)
    const driverAdvancesTotalSum = driverAdvances?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;

    const totalRevenue = hireRevenue + commitmentBaseRevenue - dayOffDeductions + extraKmCharges + otherOpRevenue;
    const totalFuelCost = hireFuelCost + commitmentFuelCost + otherOpFuelCost;
    
    // Fuel Allowance = 16% of total Fuel Cost
    const fuelAllowance = totalFuelCost * 0.1600;

    // Total Expenses includes Fuel Cost + total staff costs + excessing litres actual cost
    const totalExpenses = totalFuelCost + totalStaffCost + excessingLitresActualCost;

    // Net Profit = Revenue + Fuel Allowance - Expenses (which now includes EL deduction)
    const netProfit = (totalRevenue + fuelAllowance) - totalExpenses;
    
    const totalHires = (hireRecords?.length || 0) + (commitmentRecords?.length || 0) + (otherOpHires?.length || 0);
    const totalDistance = hireDistance + commitmentDistance + otherOpDistance;
    const avgRevenuePerHire = totalHires > 0 ? totalRevenue / totalHires : 0;
    const profitMargin = (totalRevenue + fuelAllowance) > 0 ? (netProfit / (totalRevenue + fuelAllowance)) * 100 : 0;
    
    return {
        totalRevenue,
        totalFuelCost,
        totalGrossSalaries,
        totalUnpaidAdvances,
        totalStaffCost,
        driverAdvancesTotalSum,
        totalExpenses,
        fuelAllowance,
        netProfit,
        totalHires,
        hireRevenue,
        commitmentBaseRevenue,
        extraKmCharges,
        dayOffDeductions,
        excessingLitresActualCost,
        excessingLitresCost,
        excessingLitresCount,
        excessingLitresRecords: elRecords || [],
        hireToPayCount: hireRecords?.length || 0,
        commitmentCount: commitmentRecords?.length || 0,
        dayOffCount: dayOffs?.length || 0,
        totalDistance,
        avgRevenuePerHire,
        profitMargin,
        hireToPayRevenue: hireRevenue,
        commitmentRevenue: commitmentBaseRevenue - dayOffDeductions + extraKmCharges,
        otherOperationRevenue: otherOpRevenue,
        hireVehiclePerformance: Array.from(hireVehicleMap.values()),
        commitmentVehiclePerformance: Array.from(commitmentVehicleMap.values()),
        otherVehiclePerformance: Array.from(otherVehicleMap.values()),
        idleCommitmentVehicles
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
