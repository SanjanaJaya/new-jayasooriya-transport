// ============================================================
// excel-export.js — Revenue Summary Excel Export
// Jayasooriya Transport Management System
// Depends on: SheetJS (xlsx) loaded in index.html
// ============================================================

// Helper: format date range label
function formatDateRangeLabel(startDate, endDate) {
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  const s = new Date(startDate).toLocaleDateString('en-US', opts);
  const e = new Date(endDate).toLocaleDateString('en-US', opts);
  return `${s} → ${e}`;
}

// Main Export Function
async function exportRevenueSummaryExcel(startDate, endDate) {
  if (!startDate || !endDate) {
    alert('Please select both a Start Date and End Date.');
    return;
  }
  if (startDate > endDate) {
    alert('Start Date cannot be after End Date.');
    return;
  }

  try {
    const userId = getQueryUserId(); // from app.js
    showExportLoading(true);

    // 1. Fetch Hire-to-Pay Records
    const { data: hireRecords, error: hErr } = await supabaseClient
      .from('hire_to_pay_records')
      .select(`*, hire_to_pay_vehicles(lorry_number, ownership)`)
      .eq('user_id', userId)
      .gte('hire_date', startDate)
      .lte('hire_date', endDate)
      .order('hire_date', { ascending: true });
    if (hErr) throw hErr;

    // 2. Fetch Commitment Records
    const { data: commitmentRecords, error: cErr } = await supabaseClient
      .from('commitment_records')
      .select(`*, commitment_vehicles(vehicle_number, ownership, fixed_monthly_payment, km_limit_per_month, extra_km_charge)`)
      .eq('user_id', userId)
      .gte('hire_date', startDate)
      .lte('hire_date', endDate)
      .order('hire_date', { ascending: true });
    if (cErr) throw cErr;

    // 3. Fetch Day Offs in range
    const { data: dayOffs, error: dErr } = await supabaseClient
      .from('commitment_day_offs')
      .select(`*, commitment_vehicles(vehicle_number)`)
      .eq('user_id', userId)
      .gte('day_off_date', startDate)
      .lte('day_off_date', endDate);
    if (dErr) throw dErr;

    // 3b. Fetch Maintenance Records
    const { data: maintenanceRecords, error: mErr } = await supabaseClient
      .from('lorry_maintenance')
      .select('*')
      .eq('user_id', userId)
      .gte('maintenance_date', startDate)
      .lte('maintenance_date', endDate)
      .order('maintenance_date', { ascending: true });
    if (mErr) throw mErr;

    // 3c. Fetch Driver Salary Records
    const startMonth = startDate.substring(0, 7);
    const endMonth = endDate.substring(0, 7);
    const { data: salaryRecords, error: sErr } = await supabaseClient
      .from('driver_salary')
      .select('*, drivers(name)')
      .eq('user_id', userId)
      .gte('salary_month', startMonth)
      .lte('salary_month', endMonth)
      .order('salary_month', { ascending: true });
    if (sErr) throw sErr;

    // 3d. Fetch Other Operation Hires
    const { data: otherOpHires, error: ooErr } = await supabaseClient
      .from('other_operation_hires')
      .select('*')
      .eq('user_id', userId)
      .gte('hire_date', startDate)
      .lte('hire_date', endDate)
      .order('hire_date', { ascending: true });
    if (ooErr) throw ooErr;

    // 3e. Fetch all commitment vehicles to get standard rates/limits
    const { data: allCommitmentVehicles, error: cvErr } = await supabaseClient
      .from('commitment_vehicles')
      .select('*')
      .eq('user_id', userId);
    if (cvErr) throw cvErr;
    
    const commitVehicleRateMap = {};
    (allCommitmentVehicles || []).forEach(v => {
      commitVehicleRateMap[v.id] = {
        vehicleNumber: v.vehicle_number,
        fixedPayment: v.fixed_monthly_payment || 0,
        kmLimit: v.km_limit_per_month || 0,
        extraKmRate: v.extra_km_charge || 0
      };
    });

    // 4. Build unique months list from records (FIXED: snake_case hire_date)
    const monthSet = new Set();
    [...(hireRecords || []), ...(commitmentRecords || []), ...(otherOpHires || [])].forEach(r => {
      if (r.hire_date) monthSet.add(r.hire_date.substring(0, 7));
    });
    const months = Array.from(monthSet).sort();

    // 5. Pre-group commitment vehicles per month
    // Map: vehicle_id-YYYY-MM → fixed_monthly_payment
    const commitVehicleMonthRevenue = {};
    (commitmentRecords || []).forEach(r => {
      if (!r.hire_date) return;
      const month = r.hire_date.substring(0, 7);
      const key = `${r.vehicle_id}-${month}`;
      if (!commitVehicleMonthRevenue[key]) {
        const rateData = commitVehicleRateMap[r.vehicle_id];
        commitVehicleMonthRevenue[key] = {
          vehicleNumber: rateData?.vehicleNumber || r.commitment_vehicles?.vehicle_number || 'Unknown',
          fixedPayment: rateData?.fixedPayment || r.commitment_vehicles?.fixed_monthly_payment || 0,
        };
      }
    });

    // Day-off deductions per vehicle_id-month (FIXED: snake_case)
    const dayOffByVehicleMonth = {};
    (dayOffs || []).forEach(d => {
      if (!d.day_off_date) return;
      const month = d.day_off_date.substring(0, 7);
      const key = `${d.vehicle_id}-${month}`;
      dayOffByVehicleMonth[key] = (dayOffByVehicleMonth[key] || 0) + (d.deduction_amount || 0);
    });

    // Calculate extra KM charges dynamically per vehicle per month
    const commitmentVehicleKmByMonth = {};
    (commitmentRecords || []).forEach(r => {
      if (!r.hire_date || !r.vehicle_id) return;
      const month = r.hire_date.substring(0, 7);
      const key = `${r.vehicle_id}-${month}`;
      if (!commitmentVehicleKmByMonth[key]) {
        commitmentVehicleKmByMonth[key] = 0;
      }
      commitmentVehicleKmByMonth[key] += r.distance || 0;
    });

    const extraKmByVehicleMonth = {};
    Object.keys(commitmentVehicleKmByMonth).forEach(key => {
      const [vehicleId, month] = key.split('-');
      const totalKm = commitmentVehicleKmByMonth[key];
      const rateData = commitVehicleRateMap[vehicleId];
      if (rateData) {
        const exceeding = Math.max(0, totalKm - rateData.kmLimit);
        extraKmByVehicleMonth[key] = exceeding * rateData.extraKmRate;
      } else {
        extraKmByVehicleMonth[key] = 0;
      }
    });

    // 6. Build workbook
    const wb = XLSX.utils.book_new();

    // =========================================================
    // =========================================================
    // SHEET 1 — Revenue Summary with inline hire + commitment job details
    // =========================================================
    // Column layout (11 cols):
    // A: Job No / Label   B: Date      C: Vehicle / Type    D: From
    // E: To               F: Hire Amt  G: Fuel Cost         H: Net (Hire-Fuel)
    // I: Distance (km)    J: Waiting / Extra Chg            K: Fixed Pay (commit)

    const summaryRows = [
      ['JAYASOORIYA TRANSPORT — REVENUE SUMMARY'],
      [`Date Range: ${formatDateRangeLabel(startDate, endDate)}`],
      [`Generated: ${new Date().toLocaleString('en-US')}`],
      [],
      [
        'Month',
        'Hire-to-Pay Revenue (LKR)',
        'Commitment Revenue (LKR)',
        'Total Revenue (LKR)',
        'Total Fuel Cost (LKR)',
        'Net Profit (LKR)',
        'Total Hires',
        'Total Distance (km)',
        '', '', '',
      ],
    ];

    // Sub-headers for job detail rows
    const hireJobHeader = [
      'Job No', 'Date', 'Vehicle', 'From',
      'To', 'Hire Amt (LKR)', 'Fuel Cost (LKR)', 'Net (LKR)',
      'Distance (km)', 'Waiting Chg (LKR)'
    ];
    const commitJobHeader = [
      'Job No', 'Date', 'Vehicle', 'From',
      'To', 'Fixed Pay (LKR)', 'Fuel Cost (LKR)', 'Net (LKR)',
      'Distance (km)', 'Extra Chg (LKR)'
    ];
    const otherJobHeader = [
      'Job No', 'Date', 'Vehicle', 'From',
      'To', 'Hire Amt (LKR)', 'Fuel Cost (LKR)', 'Net (LKR)',
      'Distance (km)', 'Description'
    ];

    let grandTotalRevenue       = 0;
    let grandTotalFuel          = 0;
    let grandTotalAllowance     = 0;
    let grandTotalProfit        = 0;
    let grandTotalHires         = 0;
    let grandTotalDistance      = 0;
    let grandTotalHireRevenue   = 0;
    let grandTotalCommitRevenue = 0;
    let grandTotalOtherRevenue  = 0;

    months.forEach(month => {
      const monthHire   = (hireRecords || []).filter(r => r.hire_date && r.hire_date.startsWith(month));
      const hireRevenue = monthHire.reduce((s, r) => s + (r.hire_amount || 0), 0);
      const hireFuel    = monthHire.reduce((s, r) => s + (r.fuel_cost || 0), 0);
      const hireHires   = monthHire.length;
      const hireDist    = monthHire.reduce((s, r) => s + (r.distance || 0), 0);

      const seenVehicleMonths = new Set();
      let commitRevenue = 0;
      Object.keys(commitVehicleMonthRevenue).forEach(key => {
        if (key.endsWith(`-${month}`)) {
          const vehicleId = key.split(`-${month}`)[0];
          if (!seenVehicleMonths.has(vehicleId)) {
            seenVehicleMonths.add(vehicleId);
            const vm        = commitVehicleMonthRevenue[key];
            const dayOffDed = dayOffByVehicleMonth[`${vehicleId}-${month}`] || 0;
            const extraKm   = extraKmByVehicleMonth[`${vehicleId}-${month}`] || 0;
            commitRevenue  += vm.fixedPayment - dayOffDed + extraKm;
          }
        }
      });

      const commitMonthRecords = (commitmentRecords || []).filter(r => r.hire_date && r.hire_date.startsWith(month));
      const commitFuel  = commitMonthRecords.reduce((s, r) => s + (r.fuel_cost || 0), 0);
      const commitHires = commitMonthRecords.length;
      const commitDist  = commitMonthRecords.reduce((s, r) => s + (r.distance || 0), 0);

      // Other operations
      const monthOther = (otherOpHires || []).filter(r => r.hire_date && r.hire_date.startsWith(month));
      const otherRevenue = monthOther.reduce((s, r) => s + (r.hire_amount || 0), 0);
      const otherFuel    = monthOther.reduce((s, r) => s + (r.fuel_cost || 0), 0);
      const otherHires   = monthOther.length;
      const otherDist    = monthOther.reduce((s, r) => s + (r.distance || 0), 0);

      const totalRevenue = hireRevenue + commitRevenue + otherRevenue;
      const totalFuel    = hireFuel + commitFuel + otherFuel;
      const fuelAllowance = totalFuel * 0.1600;
      const netProfit    = totalRevenue - totalFuel + fuelAllowance;
      const totalHires   = hireHires + commitHires + otherHires;
      const totalDist    = hireDist + commitDist + otherDist;

      // ── Month summary row ──────────────────────────────────
      summaryRows.push([
        month,
        +hireRevenue.toFixed(2),
        +commitRevenue.toFixed(2),
        +otherRevenue.toFixed(2),
        +totalRevenue.toFixed(2),
        +totalFuel.toFixed(2),
        +fuelAllowance.toFixed(2),
        +netProfit.toFixed(2),
        totalHires,
        +totalDist.toFixed(2),
      ]);

      // ── SECTION A: Hire-to-Pay jobs ────────────────────────
      if (monthHire.length > 0) {
        summaryRows.push(['--- HIRE-TO-PAY JOBS ---', '', '', '', '', '', '', '', '', '']);
        summaryRows.push(hireJobHeader);

        const sortedHire = [...monthHire].sort((a, b) => {
          const d = (a.hire_date || '').localeCompare(b.hire_date || '');
          if (d !== 0) return d;
          return (a.hire_to_pay_vehicles?.lorry_number || '')
            .localeCompare(b.hire_to_pay_vehicles?.lorry_number || '');
        });

        sortedHire.forEach(r => {
          const hireAmt  = r.hire_amount || 0;
          const fuelCost = r.fuel_cost   || 0;
          summaryRows.push([
            r.job_number                         || '',
            r.hire_date                          || '',
            r.hire_to_pay_vehicles?.lorry_number || '',
            r.from_location                      || '',
            r.to_location                        || '',
            +hireAmt.toFixed(2),
            +fuelCost.toFixed(2),
            +(hireAmt - fuelCost).toFixed(2),
            +(r.distance      || 0).toFixed(2),
            +(r.waiting_charge|| 0).toFixed(2),
          ]);
        });

        // Hire subtotal
        summaryRows.push([
          `Hire Subtotal (${monthHire.length} jobs)`,
          '', '', '', '',
          +hireRevenue.toFixed(2),
          +hireFuel.toFixed(2),
          +(hireRevenue - hireFuel).toFixed(2),
          +hireDist.toFixed(2),
          '',
        ]);
      }

      // ── SECTION B: Commitment jobs ─────────────────────────
      if (commitMonthRecords.length > 0) {
        summaryRows.push(['--- COMMITMENT JOBS ---', '', '', '', '', '', '', '', '', '']);
        summaryRows.push(commitJobHeader);

        const sortedCommit = [...commitMonthRecords].sort((a, b) => {
          const d = (a.hire_date || '').localeCompare(b.hire_date || '');
          if (d !== 0) return d;
          return (a.commitment_vehicles?.vehicle_number || '')
            .localeCompare(b.commitment_vehicles?.vehicle_number || '');
        });

        const seenVehiclesThisMonth = new Set();
        sortedCommit.forEach(r => {
          const vId = r.vehicle_id;
          const isFirstJob = !seenVehiclesThisMonth.has(vId);
          if (isFirstJob) {
            seenVehiclesThisMonth.add(vId);
          }
          
          const fixedPay = isFirstJob ? (r.commitment_vehicles?.fixed_monthly_payment || 0) : 0;
          const dayOffDed = isFirstJob ? (dayOffByVehicleMonth[`${vId}-${month}`] || 0) : 0;
          const finalFixedPay = Math.max(0, fixedPay - dayOffDed);
          const extraChg = isFirstJob ? (extraKmByVehicleMonth[`${vId}-${month}`] || 0) : 0;
          
          const fuelCost  = r.fuel_cost    || 0;
          summaryRows.push([
            r.job_number                          || '',
            r.hire_date                           || '',
            r.commitment_vehicles?.vehicle_number || '',
            r.from_location                       || '',
            r.to_location                         || '',
            +finalFixedPay.toFixed(2),
            +fuelCost.toFixed(2),
            +(finalFixedPay - fuelCost + extraChg).toFixed(2),
            +(r.distance   || 0).toFixed(2),
            +extraChg.toFixed(2),
          ]);
        });

        // Commitment subtotal
        summaryRows.push([
          `Commitment Subtotal (${commitMonthRecords.length} jobs)`,
          '', '', '', '',
          +commitRevenue.toFixed(2),
          +commitFuel.toFixed(2),
          +(commitRevenue - commitFuel).toFixed(2),
          +commitDist.toFixed(2),
          '',
        ]);
      }

      // ── SECTION C: Other Operations jobs ───────────────────
      if (monthOther.length > 0) {
        summaryRows.push(['--- OTHER OPERATIONS JOBS ---', '', '', '', '', '', '', '', '', '']);
        summaryRows.push(otherJobHeader);

        const sortedOther = [...monthOther].sort((a, b) => {
          const d = (a.hire_date || '').localeCompare(b.hire_date || '');
          if (d !== 0) return d;
          return (a.base_lorry_number || '').localeCompare(b.base_lorry_number || '');
        });

        sortedOther.forEach(r => {
          const hireAmt  = r.hire_amount || 0;
          const fuelCost = r.fuel_cost   || 0;
          summaryRows.push([
            r.job_number         || '',
            r.hire_date          || '',
            r.base_lorry_number  || '',
            r.from_location      || '',
            r.to_location        || '',
            +hireAmt.toFixed(2),
            +fuelCost.toFixed(2),
            +(hireAmt - fuelCost).toFixed(2),
            +(r.distance || 0).toFixed(2),
            r.description        || '',
          ]);
        });

        // Other subtotal
        summaryRows.push([
          `Other Operations Subtotal (${monthOther.length} jobs)`,
          '', '', '', '',
          +otherRevenue.toFixed(2),
          +otherFuel.toFixed(2),
          +(otherRevenue - otherFuel).toFixed(2),
          +otherDist.toFixed(2),
          '',
        ]);
      }

      summaryRows.push([]); // spacer between months

      grandTotalHireRevenue   += hireRevenue;
      grandTotalCommitRevenue += commitRevenue;
      grandTotalOtherRevenue  += otherRevenue;
      grandTotalRevenue       += totalRevenue;
      grandTotalFuel          += totalFuel;
      grandTotalAllowance     += fuelAllowance;
      grandTotalProfit        += netProfit;
      grandTotalHires         += totalHires;
      grandTotalDistance      += totalDist;
    });

    summaryRows.push([
      'GRAND TOTAL',
      +grandTotalHireRevenue.toFixed(2),
      +grandTotalCommitRevenue.toFixed(2),
      +grandTotalOtherRevenue.toFixed(2),
      +grandTotalRevenue.toFixed(2),
      +grandTotalFuel.toFixed(2),
      +grandTotalAllowance.toFixed(2),
      +grandTotalProfit.toFixed(2),
      grandTotalHires,
      +grandTotalDistance.toFixed(2),
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1['!cols'] = [
      { wch: 22 }, { wch: 26 }, { wch: 26 }, { wch: 26 },
      { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 14 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Revenue Summary');

    // =========================================================
    // SHEET 2 — Hire-to-Pay Records Detail
    // =========================================================
    const hireDetailRows = [
      ['HIRE-TO-PAY RECORDS DETAIL'],
      [`Date Range: ${formatDateRangeLabel(startDate, endDate)}`],
      [],
      [
        'Job No', 'Date', 'Vehicle', 'Ownership',
        'From', 'To', 'Distance (km)',
        'Fuel (L)', 'Fuel Price/L', 'Fuel Cost (LKR)',
        'Waiting Hours', 'Waiting Charge (LKR)',
        'Loading', 'Other Charges (LKR)', 'Hire Amount (LKR)',
      ],
    ];

    // Sort by vehicle name then date for a clean grouped view
    const sortedHireRecords = [...(hireRecords || [])].sort((a, b) => {
      const vA = a.hire_to_pay_vehicles?.lorry_number || '';
      const vB = b.hire_to_pay_vehicles?.lorry_number || '';
      if (vA !== vB) return vA.localeCompare(vB);
      return (a.hire_date || '').localeCompare(b.hire_date || '');
    });

    let detailSubVehicle = null;
    let detailSubHire = 0, detailSubFuel = 0, detailSubDist = 0, detailSubJobs = 0;

    sortedHireRecords.forEach((r, idx) => {
      const lorryNum = r.hire_to_pay_vehicles?.lorry_number || 'Unknown';

      // Insert a subtotal row whenever the vehicle changes
      if (detailSubVehicle !== null && detailSubVehicle !== lorryNum) {
        hireDetailRows.push([
          `Subtotal — ${detailSubVehicle} (${detailSubJobs} job${detailSubJobs !== 1 ? 's' : ''})`,
          '', '', '', '', '',
          +detailSubDist.toFixed(2),
          '', '',
          +detailSubFuel.toFixed(2),
          '', '', '', '',
          +detailSubHire.toFixed(2),
        ]);
        hireDetailRows.push([]); // spacer row
        detailSubHire = 0; detailSubFuel = 0; detailSubDist = 0; detailSubJobs = 0;
      }
      detailSubVehicle  = lorryNum;
      detailSubHire    += r.hire_amount || 0;
      detailSubFuel    += r.fuel_cost   || 0;
      detailSubDist    += r.distance    || 0;
      detailSubJobs    += 1;

      hireDetailRows.push([
        r.job_number                         || '',
        r.hire_date                          || '',
        lorryNum,
        r.hire_to_pay_vehicles?.ownership    || '',
        r.from_location                      || '',
        r.to_location                        || '',
        r.distance                           || 0,
        r.fuel_litres                        || 0,
        r.fuel_price_per_litre               || 0,
        +(r.fuel_cost                        || 0).toFixed(2),
        r.waiting_hours                      || 0,
        +(r.waiting_charge                   || 0).toFixed(2),
        r.loading_applied ? 'Yes' : 'No',
        +(r.other_charges                    || 0).toFixed(2),
        +(r.hire_amount                      || 0).toFixed(2),
      ]);

      // Insert the last vehicle’s subtotal after the final record
      if (idx === sortedHireRecords.length - 1 && detailSubVehicle) {
        hireDetailRows.push([
          `Subtotal — ${detailSubVehicle} (${detailSubJobs} job${detailSubJobs !== 1 ? 's' : ''})`,
          '', '', '', '', '',
          +detailSubDist.toFixed(2),
          '', '',
          +detailSubFuel.toFixed(2),
          '', '', '', '',
          +detailSubHire.toFixed(2),
        ]);
      }
    });

    const ws2 = XLSX.utils.aoa_to_sheet(hireDetailRows);
    ws2['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 10 },
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
      { wch: 10 }, { wch: 18 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Hire-to-Pay Detail');

    // =========================================================
    // SHEET 3 — Commitment Records Detail
    // =========================================================
    const commitDetailRows = [
      ['COMMITMENT VEHICLE RECORDS DETAIL'],
      [`Date Range: ${formatDateRangeLabel(startDate, endDate)}`],
      [],
      [
        'Job No', 'Date', 'Vehicle', 'Ownership',
        'From', 'To', 'Distance (km)',
        'Fuel (L)', 'Fuel Price/L', 'Fuel Cost (LKR)',
        'Extra Charges (LKR)',
      ],
    ];

    (commitmentRecords || []).forEach(r => {
      commitDetailRows.push([
        r.job_number                          || '',
        r.hire_date                           || '',
        r.commitment_vehicles?.vehicle_number || '',
        r.commitment_vehicles?.ownership      || '',
        r.from_location                       || '',
        r.to_location                         || '',
        r.distance                            || 0,
        r.fuel_litres                         || 0,
        r.fuel_price_per_litre                || 0,
        +(r.fuel_cost                         || 0).toFixed(2),
        +(r.extra_charges                     || 0).toFixed(2),
      ]);
    });

    const ws3 = XLSX.utils.aoa_to_sheet(commitDetailRows);
    ws3['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
      { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 10 },
      { wch: 14 }, { wch: 16 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws3, 'Commitment Detail');

    // =========================================================
    // SHEET 4 — Day Offs in Range
    // =========================================================
    const dayOffRows = [
      ['COMMITMENT VEHICLE DAY OFFS'],
      [`Date Range: ${formatDateRangeLabel(startDate, endDate)}`],
      [],
      ['Date', 'Vehicle', 'Deduction Amount (LKR)'],
    ];

    (dayOffs || []).forEach(d => {
      dayOffRows.push([
        d.day_off_date                        || '',
        d.commitment_vehicles?.vehicle_number || '',
        +(d.deduction_amount                  || 0).toFixed(2),
      ]);
    });

    const ws4 = XLSX.utils.aoa_to_sheet(dayOffRows);
    ws4['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Day Offs');

    // =========================================================
    // SHEET 5 — Hire-to-Pay Vehicle Job Summary
    // Groups every job under its vehicle with a subtotal row
    // =========================================================
    const vehicleJobRows = [
      ['HIRE-TO-PAY — VEHICLE JOB SUMMARY'],
      [`Date Range: ${formatDateRangeLabel(startDate, endDate)}`],
      [`Generated: ${new Date().toLocaleString('en-US')}`],
      [],
    ];

    // Group hire records by vehicle_id
    const vehicleGroups = {};
    (hireRecords || []).forEach(r => {
      const vid    = r.vehicle_id || 'unknown';
      const vLabel = r.hire_to_pay_vehicles?.lorry_number || 'Unknown Vehicle';
      const vOwn   = r.hire_to_pay_vehicles?.ownership    || '';
      if (!vehicleGroups[vid]) {
        vehicleGroups[vid] = { label: vLabel, ownership: vOwn, jobs: [] };
      }
      vehicleGroups[vid].jobs.push(r);
    });

    const jobHeader = [
      'Job No', 'Date', 'From', 'To',
      'Distance (km)', 'Fuel (L)', 'Fuel Price/L', 'Fuel Cost (LKR)',
      'Waiting Hrs', 'Waiting Charge (LKR)',
      'Loading', 'Other Charges (LKR)', 'Hire Amount (LKR)',
    ];

    let grandHireTotal      = 0;
    let grandFuelCostTotal  = 0;
    let grandWaitTotal      = 0;
    let grandOtherTotal     = 0;
    let grandNetTotal       = 0;

    Object.values(vehicleGroups).forEach(vg => {
      // Vehicle header block
      vehicleJobRows.push([
        `🚚 Vehicle: ${vg.label}`,
        `Ownership: ${vg.ownership}`,
        '', '', '', '', '', '', '', '', '', '', '',
      ]);
      vehicleJobRows.push(jobHeader);

      let vHireTotal     = 0;
      let vFuelTotal     = 0;
      let vWaitTotal     = 0;
      let vOtherTotal    = 0;
      let vDistTotal     = 0;

      vg.jobs.forEach(r => {
        const hireAmt  = r.hire_amount   || 0;
        const fuelCost = r.fuel_cost     || 0;
        const waitChg  = r.waiting_charge|| 0;
        const otherChg = r.other_charges || 0;
        const dist     = r.distance      || 0;

        vHireTotal  += hireAmt;
        vFuelTotal  += fuelCost;
        vWaitTotal  += waitChg;
        vOtherTotal += otherChg;
        vDistTotal  += dist;

        vehicleJobRows.push([
          r.job_number           || '',
          r.hire_date            || '',
          r.from_location        || '',
          r.to_location          || '',
          +dist.toFixed(2),
          r.fuel_litres          || 0,
          r.fuel_price_per_litre || 0,
          +fuelCost.toFixed(2),
          r.waiting_hours        || 0,
          +waitChg.toFixed(2),
          r.loading_applied ? 'Yes' : 'No',
          +otherChg.toFixed(2),
          +hireAmt.toFixed(2),
        ]);
      });

      // Vehicle subtotal row
      const vNet = vHireTotal - vFuelTotal;
      vehicleJobRows.push([
        `SUBTOTAL — ${vg.label} (${vg.jobs.length} job${vg.jobs.length !== 1 ? 's' : ''})`,
        '', '', '',
        +vDistTotal.toFixed(2),
        '', '',
        +vFuelTotal.toFixed(2),
        '',
        +vWaitTotal.toFixed(2),
        '',
        +vOtherTotal.toFixed(2),
        +vHireTotal.toFixed(2),
      ]);
      vehicleJobRows.push([
        `  Net Profit (Hire − Fuel): LKR ${vNet.toFixed(2)}`,
        '', '', '', '', '', '', '', '', '', '', '', '',
      ]);
      vehicleJobRows.push([]); // spacer between vehicles

      grandHireTotal     += vHireTotal;
      grandFuelCostTotal += vFuelTotal;
      grandWaitTotal     += vWaitTotal;
      grandOtherTotal    += vOtherTotal;
      grandNetTotal      += vNet;
    });

    // Grand total block
    vehicleJobRows.push([
      '══ GRAND TOTAL — ALL HIRE-TO-PAY VEHICLES ══',
      '', '', '', '', '', '',
      +grandFuelCostTotal.toFixed(2),
      '',
      +grandWaitTotal.toFixed(2),
      '',
      +grandOtherTotal.toFixed(2),
      +grandHireTotal.toFixed(2),
    ]);
    vehicleJobRows.push([
      `  Net Profit (Hire − Fuel): LKR ${grandNetTotal.toFixed(2)}`,
      '', '', '', '', '', '', '', '', '', '', '', '',
    ]);

    const ws5 = XLSX.utils.aoa_to_sheet(vehicleJobRows);
    ws5['!cols'] = [
      { wch: 38 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
      { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
      { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws5, 'Hire Vehicle Job Summary');

    // =========================================================
    // SHEET 6 — Maintenance Detail
    // =========================================================
    const labelMap = {};
    try {
      const [{ data: hireVehicles }, { data: commitmentVehicles }] = await Promise.all([
        supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number').eq('user_id', userId),
        supabaseClient.from('commitment_vehicles').select('id, vehicle_number').eq('user_id', userId)
      ]);
      hireVehicles?.forEach(v => { labelMap[`hire_${v.id}`] = v.lorry_number; });
      commitmentVehicles?.forEach(v => { labelMap[`commitment_${v.id}`] = v.vehicle_number; });
    } catch(e) {
      console.error("Error loading vehicle map for export:", e);
    }

    const maintenanceRows = [
      ['JAYASOORIYA TRANSPORT — MAINTENANCE EXPENSES DETAIL'],
      [`Date Range: ${formatDateRangeLabel(startDate, endDate)}`],
      [`Generated: ${new Date().toLocaleString('en-US')}`],
      [],
      ['Date', 'Vehicle', 'Expense Type', 'Amount (LKR)', 'Description'],
    ];

    let totalMaintenance = 0;
    (maintenanceRecords || []).forEach(r => {
      const vehicleName = labelMap[r.vehicle_ref] || r.vehicle_ref || 'Unknown';
      maintenanceRows.push([
        r.maintenance_date || '',
        vehicleName,
        r.expense_type || '',
        +(r.amount || 0).toFixed(2),
        r.description || '',
      ]);
      totalMaintenance += (r.amount || 0);
    });

    maintenanceRows.push([]);
    maintenanceRows.push([
      'GRAND TOTAL', '', '',
      +totalMaintenance.toFixed(2),
      '',
    ]);

    const wsMaint = XLSX.utils.aoa_to_sheet(maintenanceRows);
    wsMaint['!cols'] = [
      { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(wb, wsMaint, 'Maintenance Detail');

    // =========================================================
    // SHEET 7 — Driver Salaries Summary
    // =========================================================
    const salarySummaryRows = [
      ['JAYASOORIYA TRANSPORT — DRIVER SALARIES SUMMARY'],
      [`Month Range: ${startMonth} → ${endMonth}`],
      [`Generated: ${new Date().toLocaleString('en-US')}`],
      [],
      [
        'Month', 'Driver Name', 'Salary Type', 'KM / Tips Info',
        'Basic Salary (LKR)', 'Extra KM/Tip Salary (LKR)', 'Additional Allowance (LKR)',
        'Total Advances (LKR)', 'Other Deductions (LKR)', 'Gross Salary (LKR)', 'Net Salary (LKR)',
        'Payment Date'
      ],
    ];

    let totalGrossSal = 0, totalNetSal = 0, totalBasicSal = 0, totalExtraSal = 0;
    let totalAllowances = 0, totalAdvancesSal = 0, totalDeductionsSal = 0;

    (salaryRecords || []).forEach(r => {
      const isPerTip = r.salary_type === 'per_tip';
      const kmOrTipInfo = isPerTip
        ? `${r.tip_count || 0} tips${r.half_tip_count > 0 ? ' + ' + r.half_tip_count + ' (0.5x)' : ''}`
        : `${(r.total_km || 0).toFixed(2)} km`;

      salarySummaryRows.push([
        r.salary_month || '',
        r.drivers?.name || 'Unknown',
        r.salary_type || 'fixed',
        kmOrTipInfo,
        +(r.basic_salary || 0).toFixed(2),
        +(isPerTip ? (r.tip_salary || 0) : (r.extra_km_salary || 0)).toFixed(2),
        +(r.additional_allowance || 0).toFixed(2),
        +(r.total_advances || 0).toFixed(2),
        +(r.other_deductions || 0).toFixed(2),
        +(r.gross_salary || 0).toFixed(2),
        +(r.net_salary || 0).toFixed(2),
        r.created_at ? new Date(r.created_at).toLocaleDateString('en-US') : ''
      ]);

      totalBasicSal += (r.basic_salary || 0);
      totalExtraSal += (isPerTip ? (r.tip_salary || 0) : (r.extra_km_salary || 0));
      totalAllowances += (r.additional_allowance || 0);
      totalAdvancesSal += (r.total_advances || 0);
      totalDeductionsSal += (r.other_deductions || 0);
      totalGrossSal += (r.gross_salary || 0);
      totalNetSal += (r.net_salary || 0);
    });

    salarySummaryRows.push([]);
    salarySummaryRows.push([
      'GRAND TOTAL', '', '', '',
      +totalBasicSal.toFixed(2),
      +totalExtraSal.toFixed(2),
      +totalAllowances.toFixed(2),
      +totalAdvancesSal.toFixed(2),
      +totalDeductionsSal.toFixed(2),
      +totalGrossSal.toFixed(2),
      +totalNetSal.toFixed(2),
      ''
    ]);

    const wsSal = XLSX.utils.aoa_to_sheet(salarySummaryRows);
    wsSal['!cols'] = [
      { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 16 },
      { wch: 18 }, { wch: 22 }, { wch: 22 },
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsSal, 'Salary Summary');

    // =========================================================
    // SHEET 8 — Other Operations Detail
    // =========================================================
    const otherDetailRows = [
      ['OTHER OPERATIONS HIRES DETAIL'],
      [`Date Range: ${formatDateRangeLabel(startDate, endDate)}`],
      [],
      [
        'Job No', 'Date', 'Vehicle (Lorry No)',
        'From', 'To', 'Distance (km)',
        'Fuel (L)', 'Fuel Price/L', 'Fuel Cost (LKR)',
        'Hire Amount (LKR)', 'Description'
      ],
    ];

    const sortedOtherDetail = [...(otherOpHires || [])].sort((a, b) => {
      const vA = a.base_lorry_number || '';
      const vB = b.base_lorry_number || '';
      if (vA !== vB) return vA.localeCompare(vB);
      return (a.hire_date || '').localeCompare(b.hire_date || '');
    });

    let otherSubLorry = null;
    let otherSubHire = 0, otherSubFuel = 0, otherSubDist = 0, otherSubJobs = 0;

    sortedOtherDetail.forEach((r, idx) => {
      const lorryNum = r.base_lorry_number || 'Other';

      if (otherSubLorry !== null && otherSubLorry !== lorryNum) {
        otherDetailRows.push([
          `Subtotal — ${otherSubLorry} (${otherSubJobs} job${otherSubJobs !== 1 ? 's' : ''})`,
          '', '', '', '',
          +otherSubDist.toFixed(2),
          '', '',
          +otherSubFuel.toFixed(2),
          +otherSubHire.toFixed(2),
          ''
        ]);
        otherDetailRows.push([]);
        otherSubHire = 0; otherSubFuel = 0; otherSubDist = 0; otherSubJobs = 0;
      }

      otherSubLorry = lorryNum;
      otherSubHire += r.hire_amount || 0;
      otherSubFuel += r.fuel_cost || 0;
      otherSubDist += r.distance || 0;
      otherSubJobs += 1;

      otherDetailRows.push([
        r.job_number || '',
        r.hire_date || '',
        lorryNum,
        r.from_location || '',
        r.to_location || '',
        r.distance || 0,
        r.fuel_litres || 0,
        r.fuel_price_per_litre || 0,
        +(r.fuel_cost || 0).toFixed(2),
        +(r.hire_amount || 0).toFixed(2),
        r.description || ''
      ]);

      if (idx === sortedOtherDetail.length - 1 && otherSubLorry) {
        otherDetailRows.push([
          `Subtotal — ${otherSubLorry} (${otherSubJobs} job${otherSubJobs !== 1 ? 's' : ''})`,
          '', '', '', '',
          +otherSubDist.toFixed(2),
          '', '',
          +otherSubFuel.toFixed(2),
          +otherSubHire.toFixed(2),
          ''
        ]);
      }
    });

    const wsOther = XLSX.utils.aoa_to_sheet(otherDetailRows);
    wsOther['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
      { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
      { wch: 16 }, { wch: 16 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, wsOther, 'Other Operations Detail');

    // 8. Download file
    const fileName = `JT_Revenue_${startDate}_to_${endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);

  } catch (err) {
    console.error('Export error:', err);
    alert('Export failed: ' + err.message);
  } finally {
    showExportLoading(false);
  }
}

// UI: Show/Hide loading state on export button
function showExportLoading(loading) {
  const btn = document.getElementById('exportExcelBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? '⏳ Exporting...' : '📥 Export Excel';
}

// UI: Open the date-range modal
function openExportModal() {
  const modal = document.getElementById('exportModal');
  if (!modal) return;

  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm    = String(today.getMonth() + 1).padStart(2, '0');
  const dd    = String(today.getDate()).padStart(2, '0');

  const startInput = document.getElementById('exportStartDate');
  const endInput   = document.getElementById('exportEndDate');

  if (startInput && !startInput.value) startInput.value = `${yyyy}-${mm}-01`;
  if (endInput   && !endInput.value)   endInput.value   = `${yyyy}-${mm}-${dd}`;

  modal.classList.add('active');
}

function closeExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) modal.classList.remove('active');
}

// Wire up the confirm button inside the modal
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exportConfirmBtn')?.addEventListener('click', () => {
    const start = document.getElementById('exportStartDate')?.value;
    const end   = document.getElementById('exportEndDate')?.value;
    closeExportModal();
    exportRevenueSummaryExcel(start, end);
  });

  document.getElementById('exportCancelBtn')?.addEventListener('click', closeExportModal);

  document.getElementById('exportModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('exportModal')) closeExportModal();
  });
});