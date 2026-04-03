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

    // 4. Build unique months list from records (FIXED: snake_case hire_date)
    const monthSet = new Set();
    [...(hireRecords || []), ...(commitmentRecords || [])].forEach(r => {
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
        commitVehicleMonthRevenue[key] = {
          vehicleNumber: r.commitment_vehicles?.vehicle_number || 'Unknown',
          fixedPayment: r.commitment_vehicles?.fixed_monthly_payment || 0,
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

    const extraKmByVehicleMonth = {};
    (commitmentRecords || []).forEach(r => {
      if (!r.hire_date) return;
      const month = r.hire_date.substring(0, 7);
      const key = `${r.vehicle_id}-${month}`;
      extraKmByVehicleMonth[key] = (extraKmByVehicleMonth[key] || 0) + (r.extra_charges || 0);
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
      'Distance (km)', 'Waiting Chg (LKR)', '',
    ];
    const commitJobHeader = [
      'Job No', 'Date', 'Vehicle', 'From',
      'To', 'Fixed Pay (LKR)', 'Fuel Cost (LKR)', 'Net (LKR)',
      'Distance (km)', 'Extra Chg (LKR)', '',
    ];

    let grandTotalRevenue  = 0;
    let grandTotalFuel     = 0;
    let grandTotalProfit   = 0;
    let grandTotalHires    = 0;
    let grandTotalDistance = 0;

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

      const totalRevenue = hireRevenue + commitRevenue;
      const totalFuel    = hireFuel + commitFuel;
      const netProfit    = totalRevenue - totalFuel;
      const totalHires   = hireHires + commitHires;
      const totalDist    = hireDist + commitDist;

      // ── Month summary row ──────────────────────────────────
      summaryRows.push([
        month,
        +hireRevenue.toFixed(2),
        +commitRevenue.toFixed(2),
        +totalRevenue.toFixed(2),
        +totalFuel.toFixed(2),
        +netProfit.toFixed(2),
        totalHires,
        +totalDist.toFixed(2),
        '', '', '',
      ]);

      // ── SECTION A: Hire-to-Pay jobs ────────────────────────
      if (monthHire.length > 0) {
        summaryRows.push(['--- HIRE-TO-PAY JOBS ---', '', '', '', '', '', '', '', '', '', '']);
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
            '',
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
          '', '',
        ]);
      }

      // ── SECTION B: Commitment jobs ─────────────────────────
      if (commitMonthRecords.length > 0) {
        summaryRows.push(['--- COMMITMENT JOBS ---', '', '', '', '', '', '', '', '', '', '']);
        summaryRows.push(commitJobHeader);

        const sortedCommit = [...commitMonthRecords].sort((a, b) => {
          const d = (a.hire_date || '').localeCompare(b.hire_date || '');
          if (d !== 0) return d;
          return (a.commitment_vehicles?.vehicle_number || '')
            .localeCompare(b.commitment_vehicles?.vehicle_number || '');
        });

        sortedCommit.forEach(r => {
          const fixedPay  = r.commitment_vehicles?.fixed_monthly_payment || 0;
          const fuelCost  = r.fuel_cost    || 0;
          const extraChg  = r.extra_charges|| 0;
          summaryRows.push([
            r.job_number                          || '',
            r.hire_date                           || '',
            r.commitment_vehicles?.vehicle_number || '',
            r.from_location                       || '',
            r.to_location                         || '',
            +fixedPay.toFixed(2),
            +fuelCost.toFixed(2),
            +(fixedPay - fuelCost + extraChg).toFixed(2),
            +(r.distance   || 0).toFixed(2),
            +extraChg.toFixed(2),
            '',
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
          '', '',
        ]);
      }

      summaryRows.push([]); // spacer between months

      grandTotalRevenue  += totalRevenue;
      grandTotalFuel     += totalFuel;
      grandTotalProfit   += netProfit;
      grandTotalHires    += totalHires;
      grandTotalDistance += totalDist;
    });

    summaryRows.push([
      'GRAND TOTAL', '', '',
      +grandTotalRevenue.toFixed(2),
      +grandTotalFuel.toFixed(2),
      +grandTotalProfit.toFixed(2),
      grandTotalHires,
      +grandTotalDistance.toFixed(2),
      '', '', '',
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    // A:JobNo  B:Date  C:Vehicle  D:From  E:To(wide)  F:HireAmt  G:Fuel  H:Net  I:Dist  J:WaitChg  K:spare
    ws1['!cols'] = [
      { wch: 20 }, { wch: 12 }, { wch: 26 }, { wch: 22 },
      { wch: 55 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
      { wch: 14 }, { wch: 20 }, { wch: 6 },
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

    // 7. Download file
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