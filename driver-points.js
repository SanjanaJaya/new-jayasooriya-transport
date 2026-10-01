/**
 * Jayasooriya Transport - Driver Points & Award System
 * Manages Driver Point Accumulation, Deduction Incidents, Season Leaderboard, and Side-by-Side Comparison.
 *
 * Season Cycles:
 *  - Inaugural Season: Oct 2026 – Mar 2027 (6 Months)
 *  - Season 2027/2028: Apr 2027 – Mar 2028 (12 Months)
 *  - Season 2028/2029: Apr 2028 – Mar 2029 (12 Months)
 */

(function () {
    'use strict';

    // Local Storage Keys
    const LOCAL_INCIDENTS_KEY = 'jtms_driver_incidents';

    // Season Definitions
    const SEASONS = {
        'cycle_2026_2027': {
            id: 'cycle_2026_2027',
            name: '🌟 Inaugural Season (Oct 2026 – Mar 2027)',
            startMonth: '2026-10',
            endMonth: '2027-03',
            months: ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']
        },
        'cycle_2027_2028': {
            id: 'cycle_2027_2028',
            name: '🏆 Season 2027/2028 (Apr 2027 – Mar 2028)',
            startMonth: '2027-04',
            endMonth: '2028-03',
            months: ['2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2027-11', '2027-12', '2028-01', '2028-02', '2028-03']
        },
        'cycle_2028_2029': {
            id: 'cycle_2028_2029',
            name: '🏆 Season 2028/2029 (Apr 2028 – Mar 2029)',
            startMonth: '2028-04',
            endMonth: '2029-03',
            months: ['2028-04', '2028-05', '2028-06', '2028-07', '2028-08', '2028-09', '2028-10', '2028-11', '2028-12', '2029-01', '2029-02', '2029-03']
        }
    };

    // Helper: Get stored incidents
    function getStoredIncidents() {
        try {
            const raw = localStorage.getItem(LOCAL_INCIDENTS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Error reading driver incidents:', e);
            return [];
        }
    }

    // Helper: Save incidents
    function saveStoredIncidents(incidents) {
        try {
            localStorage.setItem(LOCAL_INCIDENTS_KEY, JSON.stringify(incidents));
        } catch (e) {
            console.error('Error saving driver incidents:', e);
        }
    }

    // Get Drivers List from global state or localStorage fallback
    function getDriversList() {
        if (Array.isArray(window.drivers) && window.drivers.length > 0) {
            return window.drivers.filter(d => !d.terminated);
        }
        try {
            const raw = localStorage.getItem('drivers');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.filter(d => !d.terminated);
                }
            }
        } catch (e) {}

        // Fallback default sample list if none exists yet
        return [
            { id: 'DRV-001', name: 'K. G. Perera', lorry_number: 'GB-5157' },
            { id: 'DRV-002', name: 'S. A. Silva', lorry_number: 'LC-2289' },
            { id: 'DRV-003', name: 'M. Fernando', lorry_number: 'DA-8812' },
            { id: 'DRV-004', name: 'W. D. Bandara', lorry_number: 'ND-3019' }
        ];
    }

    // Fetch day offs count for driver in specific month
    function getDriverDayOffsCountForMonth(driverId, monthStr) {
        let count = 0;
        try {
            const dayOffsRaw = localStorage.getItem('driverDayOffs');
            if (dayOffsRaw) {
                const dayOffs = JSON.parse(dayOffsRaw);
                if (Array.isArray(dayOffs)) {
                    count += dayOffs.filter(d => {
                        const matchesDriver = d.driverId === driverId || d.driver_id === driverId || d.driverName === driverId;
                        const matchesMonth = d.date && d.date.startsWith(monthStr);
                        return matchesDriver && matchesMonth;
                    }).length;
                }
            }
        } catch (e) {}

        // Also check stored incidents of type 'dayoff'
        const incidents = getStoredIncidents();
        const manualDayOffs = incidents.filter(i => (i.driverId === driverId || i.driverName === driverId) && i.type === 'dayoff' && i.date.startsWith(monthStr));
        count += manualDayOffs.length;

        return count;
    }

    // Calculate Points for a Driver for a single Month
    window.calculateDriverMonthlyPoints = function (driverId, monthStr) {
        const baseScore = 100;
        const dayOffsCount = getDriverDayOffsCountForMonth(driverId, monthStr);
        const dayOffDeduction = dayOffsCount * 3; // -3 pts per day off

        const incidents = getStoredIncidents().filter(i => (i.driverId === driverId || i.driverName === driverId) && i.date && i.date.startsWith(monthStr));

        let accidentCost = 0;
        let accidentDeduction = 0;

        let goodsShortageCost = 0;
        let goodsShortageDeduction = 0;

        let missedFuelCount = 0;
        let missedFuelDeduction = 0;

        incidents.forEach(inc => {
            if (inc.type === 'accident') {
                const cost = parseFloat(inc.cost || 0);
                accidentCost += cost;
                accidentDeduction += Math.floor(cost / 1000); // -1 pt per 1000 LKR
            } else if (inc.type === 'goods_shortage') {
                const cost = parseFloat(inc.cost || 0);
                goodsShortageCost += cost;
                goodsShortageDeduction += Math.floor(cost / 500); // -1 pt per 500 LKR
            } else if (inc.type === 'missed_fuel') {
                missedFuelCount += 1;
                missedFuelDeduction += 15; // -15 pts per missed fuel bill
            }
        });

        const totalDeductions = dayOffDeduction + accidentDeduction + goodsShortageDeduction + missedFuelDeduction;
        const isCleanMonth = (totalDeductions === 0);
        const cleanBonus = isCleanMonth ? 20 : 0; // +20 bonus for 0 deductions

        const netScore = Math.max(0, baseScore - totalDeductions + cleanBonus);

        return {
            month: monthStr,
            baseScore,
            cleanBonus,
            isCleanMonth,
            dayOffsCount,
            dayOffDeduction,
            accidentCost,
            accidentDeduction,
            goodsShortageCost,
            goodsShortageDeduction,
            missedFuelCount,
            missedFuelDeduction,
            totalDeductions,
            netScore
        };
    };

    // Calculate Accumulated Points for a Driver for an entire Season or Month list
    window.calculateDriverSeasonPoints = function (driverId, monthsArray) {
        let totalNetScore = 0;
        let totalCleanMonths = 0;
        let totalDayOffs = 0;
        let totalDayOffDeduction = 0;
        let totalAccidentCost = 0;
        let totalAccidentDeduction = 0;
        let totalGoodsShortageCost = 0;
        let totalGoodsShortageDeduction = 0;
        let totalMissedFuelCount = 0;
        let totalMissedFuelDeduction = 0;
        let totalCleanBonus = 0;
        let totalBaseScore = 0;

        monthsArray.forEach(m => {
            const res = window.calculateDriverMonthlyPoints(driverId, m);
            totalBaseScore += res.baseScore;
            totalNetScore += res.netScore;
            if (res.isCleanMonth) totalCleanMonths += 1;
            totalCleanBonus += res.cleanBonus;
            totalDayOffs += res.dayOffsCount;
            totalDayOffDeduction += res.dayOffDeduction;
            totalAccidentCost += res.accidentCost;
            totalAccidentDeduction += res.accidentDeduction;
            totalGoodsShortageCost += res.goodsShortageCost;
            totalGoodsShortageDeduction += res.goodsShortageDeduction;
            totalMissedFuelCount += res.missedFuelCount;
            totalMissedFuelDeduction += res.missedFuelDeduction;
        });

        return {
            totalBaseScore,
            totalNetScore,
            totalCleanMonths,
            totalCleanBonus,
            totalDayOffs,
            totalDayOffDeduction,
            totalAccidentCost,
            totalAccidentDeduction,
            totalGoodsShortageCost,
            totalGoodsShortageDeduction,
            totalMissedFuelCount,
            totalMissedFuelDeduction,
            monthsCount: monthsArray.length
        };
    };

    // Render Main Driver Points Page
    window.renderDriverPointsSystem = function () {
        const cycleSelect = document.getElementById('pointsCycleSelect');
        if (!cycleSelect) return;

        const cycleVal = cycleSelect.value;
        let monthsToCalculate = [];
        let seasonName = '';

        if (cycleVal === 'single_month') {
            const singleInput = document.getElementById('pointsSingleMonthInput');
            let m = singleInput ? singleInput.value : '';
            if (!m) {
                const now = new Date();
                m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                if (singleInput) singleInput.value = m;
            }
            monthsToCalculate = [m];
            seasonName = `Month: ${m}`;
        } else {
            const sDef = SEASONS[cycleVal] || SEASONS['cycle_2026_2027'];
            monthsToCalculate = sDef.months;
            seasonName = sDef.name;
        }

        // Update Season Badge
        const seasonBadge = document.getElementById('pointsSeasonBadge');
        if (seasonBadge) seasonBadge.textContent = seasonName;

        const drivers = getDriversList();
        
        // Calculate points for all drivers
        const standings = drivers.map(drv => {
            const stats = window.calculateDriverSeasonPoints(drv.id || drv.name, monthsToCalculate);
            return {
                driver: drv,
                stats
            };
        });

        // Sort descending by totalNetScore
        standings.sort((a, b) => b.stats.totalNetScore - a.stats.totalNetScore);

        // Render Podium Top 3
        renderPodiumUI(standings);

        // Render Full Table Standings
        renderStandingsTable(standings);

        // Populate Driver Select Dropdowns
        populateDriverDropdowns(drivers);
    };

    // Render Podium UI
    function renderPodiumUI(standings) {
        const container = document.getElementById('driverPodiumContainer');
        if (!container) return;

        if (standings.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">No drivers found in system.</div>';
            return;
        }

        const top1 = standings[0];
        const top2 = standings[1];
        const top3 = standings[2];

        let html = '';

        // 1st Place (Gold Winner)
        if (top1) {
            html += `
                <div class="podium-card gold-winner">
                    <div class="podium-badge-icon">🥇</div>
                    <div class="podium-driver-name">${top1.driver.name}</div>
                    <div style="font-size:12px; color:var(--text-muted); font-weight:600;">🚛 Vehicle: ${top1.driver.lorry_number || 'Main Fleet'}</div>
                    <div class="podium-score-val">${top1.stats.totalNetScore} <span style="font-size:14px; font-weight:700;">PTS</span></div>
                    <div class="podium-sub-text">✨ ${top1.stats.totalCleanMonths} Clean Months (+${top1.stats.totalCleanBonus} Bonus Pts)</div>
                </div>
            `;
        }

        // 2nd Place (Silver Winner)
        if (top2) {
            html += `
                <div class="podium-card silver-winner">
                    <div class="podium-badge-icon">🥈</div>
                    <div class="podium-driver-name">${top2.driver.name}</div>
                    <div style="font-size:12px; color:var(--text-muted); font-weight:600;">🚛 Vehicle: ${top2.driver.lorry_number || 'Fleet'}</div>
                    <div class="podium-score-val">${top2.stats.totalNetScore} <span style="font-size:14px; font-weight:700;">PTS</span></div>
                    <div class="podium-sub-text">✨ ${top2.stats.totalCleanMonths} Clean Months</div>
                </div>
            `;
        }

        // 3rd Place (Bronze Winner)
        if (top3) {
            html += `
                <div class="podium-card bronze-winner">
                    <div class="podium-badge-icon">🥉</div>
                    <div class="podium-driver-name">${top3.driver.name}</div>
                    <div style="font-size:12px; color:var(--text-muted); font-weight:600;">🚛 Vehicle: ${top3.driver.lorry_number || 'Fleet'}</div>
                    <div class="podium-score-val">${top3.stats.totalNetScore} <span style="font-size:14px; font-weight:700;">PTS</span></div>
                    <div class="podium-sub-text">✨ ${top3.stats.totalCleanMonths} Clean Months</div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    // Render Standings Table
    function renderStandingsTable(standings) {
        const tbody = document.getElementById('driverPointsTableBody');
        if (!tbody) return;

        if (standings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">No driver point data available.</td></tr>';
            return;
        }

        let html = '';
        standings.forEach((item, idx) => {
            const rank = idx + 1;
            let rankBadge = `#${rank}`;
            if (rank === 1) rankBadge = '🥇 1st';
            else if (rank === 2) rankBadge = '🥈 2nd';
            else if (rank === 3) rankBadge = '🥉 3rd';

            const drv = item.driver;
            const s = item.stats;

            html += `
                <tr>
                    <td style="font-weight:800; font-size:14px;">${rankBadge}</td>
                    <td>
                        <strong style="color:var(--text-primary); font-size:14px;">${drv.name}</strong>
                        <div style="font-size:11px; color:var(--text-muted);">${drv.lorry_number || 'Fleet Lorry'}</div>
                    </td>
                    <td>
                        <span style="padding:4px 8px; border-radius:6px; background:rgba(39,174,96,0.12); color:#27AE60; font-weight:700; font-size:12px;">
                            ${s.totalCleanMonths} Months (+${s.totalCleanBonus} pts)
                        </span>
                    </td>
                    <td>
                        <span style="color:${s.totalDayOffs > 0 ? 'var(--brand-red)' : 'var(--text-muted)'}; font-weight:700;">
                            ${s.totalDayOffs} Days (-${s.totalDayOffDeduction} pts)
                        </span>
                    </td>
                    <td>
                        <span style="color:${s.totalAccidentCost > 0 ? 'var(--brand-red)' : 'var(--text-muted)'}; font-weight:700;">
                            LKR ${s.totalAccidentCost.toLocaleString()} (-${s.totalAccidentDeduction} pts)
                        </span>
                    </td>
                    <td>
                        <span style="color:${s.totalGoodsShortageCost > 0 ? 'var(--brand-red)' : 'var(--text-muted)'}; font-weight:700;">
                            LKR ${s.totalGoodsShortageCost.toLocaleString()} (-${s.totalGoodsShortageDeduction} pts)
                        </span>
                    </td>
                    <td>
                        <span style="color:${s.totalMissedFuelCount > 0 ? 'var(--brand-red)' : 'var(--text-muted)'}; font-weight:700;">
                            ${s.totalMissedFuelCount} Missed (-${s.totalMissedFuelDeduction} pts)
                        </span>
                    </td>
                    <td>
                        <strong style="font-size:16px; color:var(--brand-red); font-weight:900;">${s.totalNetScore} PTS</strong>
                    </td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button class="btn btn-sm btn-primary" onclick="quickLogDriverIncident('${drv.id || drv.name}')" title="Log Deduction Incident">➕ Log</button>
                            <button class="btn btn-sm btn-secondary" onclick="viewDriverIncidentHistory('${drv.id || drv.name}', '${drv.name}')" title="View History">📜 History</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Populate Driver Dropdowns for Modal & Side-by-Side Comparison
    function populateDriverDropdowns(drivers) {
        const incDriver = document.getElementById('incidentDriverId');
        const drvA = document.getElementById('compareDriverASelect');
        const drvB = document.getElementById('compareDriverBSelect');

        if (!incDriver && !drvA && !drvB) return;

        let optionsHtml = '<option value="">-- Select Driver --</option>';
        drivers.forEach(d => {
            optionsHtml += `<option value="${d.id || d.name}">${d.name} (${d.lorry_number || 'Fleet'})</option>`;
        });

        if (incDriver) incDriver.innerHTML = optionsHtml;
        if (drvA) {
            drvA.innerHTML = optionsHtml;
            if (drivers.length > 0) drvA.value = drivers[0].id || drivers[0].name;
        }
        if (drvB) {
            drvB.innerHTML = optionsHtml;
            if (drivers.length > 1) drvB.value = drivers[1].id || drivers[1].name;
        }

        window.updateDriverComparisonUI();
    }

    // Update Side-by-Side Driver Comparison UI
    window.updateDriverComparisonUI = function () {
        const container = document.getElementById('compareResultContainer');
        const drvAVal = document.getElementById('compareDriverASelect')?.value;
        const drvBVal = document.getElementById('compareDriverBSelect')?.value;

        if (!container || !drvAVal || !drvBVal) return;

        const cycleVal = document.getElementById('pointsCycleSelect')?.value || 'cycle_2026_2027';
        const months = SEASONS[cycleVal]?.months || ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'];

        const drivers = getDriversList();
        const drvA = drivers.find(d => (d.id || d.name) === drvAVal) || { name: drvAVal };
        const drvB = drivers.find(d => (d.id || d.name) === drvBVal) || { name: drvBVal };

        const statsA = window.calculateDriverSeasonPoints(drvA.id || drvA.name, months);
        const statsB = window.calculateDriverSeasonPoints(drvB.id || drvB.name, months);

        const winnerA = statsA.totalNetScore > statsB.totalNetScore;
        const winnerB = statsB.totalNetScore > statsA.totalNetScore;

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:10px;">
                <!-- Driver A Card -->
                <div style="background:var(--surface-ground); border:2px solid ${winnerA ? '#27AE60' : 'var(--surface-border)'}; border-radius:14px; padding:16px; position:relative;">
                    ${winnerA ? '<span style="position:absolute; top:12px; right:12px; background:#27AE60; color:#fff; font-size:11px; font-weight:800; padding:4px 10px; border-radius:12px;">🏆 HIGHER RANK</span>' : ''}
                    <h4 style="margin:0; font-size:16px; font-weight:800; color:var(--text-primary);">${drvA.name}</h4>
                    <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Vehicle: ${drvA.lorry_number || 'Fleet'}</div>
                    <div style="font-size:24px; font-weight:900; color:var(--brand-red); margin-bottom:14px;">${statsA.totalNetScore} PTS</div>

                    <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
                        <div style="display:flex; justify-content:space-between;"><span>✨ Clean Months:</span><strong>${statsA.totalCleanMonths} (+${statsA.totalCleanBonus} pts)</strong></div>
                        <div style="display:flex; justify-content:space-between;"><span>⛔ Day Offs Loss:</span><span style="color:var(--brand-red); font-weight:700;">-${statsA.totalDayOffDeduction} pts</span></div>
                        <div style="display:flex; justify-content:space-between;"><span>💥 Accident Loss:</span><span style="color:var(--brand-red); font-weight:700;">-${statsA.totalAccidentDeduction} pts</span></div>
                        <div style="display:flex; justify-content:space-between;"><span>📦 Goods Shortage Loss:</span><span style="color:var(--brand-red); font-weight:700;">-${statsA.totalGoodsShortageDeduction} pts</span></div>
                        <div style="display:flex; justify-content:space-between;"><span>Receipts Missed Loss:</span><span style="color:var(--brand-red); font-weight:700;">-${statsA.totalMissedFuelDeduction} pts</span></div>
                    </div>
                </div>

                <!-- Driver B Card -->
                <div style="background:var(--surface-ground); border:2px solid ${winnerB ? '#27AE60' : 'var(--surface-border)'}; border-radius:14px; padding:16px; position:relative;">
                    ${winnerB ? '<span style="position:absolute; top:12px; right:12px; background:#27AE60; color:#fff; font-size:11px; font-weight:800; padding:4px 10px; border-radius:12px;">🏆 HIGHER RANK</span>' : ''}
                    <h4 style="margin:0; font-size:16px; font-weight:800; color:var(--text-primary);">${drvB.name}</h4>
                    <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Vehicle: ${drvB.lorry_number || 'Fleet'}</div>
                    <div style="font-size:24px; font-weight:900; color:var(--brand-red); margin-bottom:14px;">${statsB.totalNetScore} PTS</div>

                    <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
                        <div style="display:flex; justify-content:space-between;"><span>✨ Clean Months:</span><strong>${statsB.totalCleanMonths} (+${statsB.totalCleanBonus} pts)</strong></div>
                        <div style="display:flex; justify-content:space-between;"><span>⛔ Day Offs Loss:</span><span style="color:var(--brand-red); font-weight:700;">-${statsB.totalDayOffDeduction} pts</span></div>
                        <div style="display:flex; justify-content:space-between;"><span>💥 Accident Loss:</span><span style="color:var(--brand-red); font-weight:700;">-${statsB.totalAccidentDeduction} pts</span></div>
                        <div style="display:flex; justify-content:space-between;"><span>📦 Goods Shortage Loss:</span><span style="color:var(--brand-red); font-weight:700;">-${statsB.totalGoodsShortageDeduction} pts</span></div>
                        <div style="display:flex; justify-content:space-between;"><span>Receipts Missed Loss:</span><span style="color:var(--brand-red); font-weight:700;">-${statsB.totalMissedFuelDeduction} pts</span></div>
                    </div>
                </div>
            </div>
        `;
    };

    // Cycle selector change event handler
    window.onDriverPointsCycleChange = function () {
        const cycleVal = document.getElementById('pointsCycleSelect')?.value;
        const singleWrap = document.getElementById('pointsSingleMonthWrap');
        if (singleWrap) {
            singleWrap.style.display = (cycleVal === 'single_month') ? 'block' : 'none';
        }
        window.renderDriverPointsSystem();
    };

    // Toggle Driver Comparison Section
    window.toggleDriverCompareSection = function () {
        const sec = document.getElementById('driverCompareSection');
        if (sec) {
            sec.style.display = (sec.style.display === 'none' || !sec.style.display) ? 'block' : 'none';
        }
    };

    // Modal Helpers
    window.openModalLogDriverIncident = function () {
        const modal = document.getElementById('modalLogDriverIncident');
        if (modal) {
            document.getElementById('formLogDriverIncident').reset();
            document.getElementById('incidentRecordId').value = '';
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('incidentDate').value = today;
            window.onIncidentTypeChange();
            modal.style.display = 'flex';
        }
    };

    window.quickLogDriverIncident = function (driverId) {
        window.openModalLogDriverIncident();
        const sel = document.getElementById('incidentDriverId');
        if (sel) sel.value = driverId;
    };

    window.closeModalLogDriverIncident = function () {
        const modal = document.getElementById('modalLogDriverIncident');
        if (modal) modal.style.display = 'none';
    };

    window.onIncidentTypeChange = function () {
        const type = document.getElementById('incidentType')?.value;
        const costGroup = document.getElementById('incidentCostGroup');
        const costLabel = document.getElementById('incidentCostLabel');

        if (type === 'accident') {
            if (costGroup) costGroup.style.display = 'block';
            if (costLabel) costLabel.textContent = '💰 Vehicle Damage Repair Cost (LKR)';
        } else if (type === 'goods_shortage') {
            if (costGroup) costGroup.style.display = 'block';
            if (costLabel) costLabel.textContent = '📦 Lost / Short Cargo Value (LKR)';
        } else {
            if (costGroup) costGroup.style.display = 'none';
        }
        window.previewIncidentDeductionPoints();
    };

    window.previewIncidentDeductionPoints = function () {
        const type = document.getElementById('incidentType')?.value;
        const cost = parseFloat(document.getElementById('incidentCost')?.value || 0);
        const preview = document.getElementById('incidentPointPenaltyPreview');
        if (!preview) return;

        let penalty = 0;
        if (type === 'accident') {
            penalty = Math.floor(cost / 1000);
        } else if (type === 'goods_shortage') {
            penalty = Math.floor(cost / 500);
        } else if (type === 'missed_fuel') {
            penalty = 15;
        } else if (type === 'dayoff') {
            penalty = 3;
        }

        preview.textContent = `-${penalty} Points`;
    };

    // Save Incident Record Form Submit
    window.saveDriverIncident = function (e) {
        e.preventDefault();
        const driverId = document.getElementById('incidentDriverId')?.value;
        const date = document.getElementById('incidentDate')?.value;
        const type = document.getElementById('incidentType')?.value;
        const cost = parseFloat(document.getElementById('incidentCost')?.value || 0);
        const notes = document.getElementById('incidentNotes')?.value || '';

        if (!driverId || !date || !type) {
            alert('Please select driver, incident date, and category.');
            return;
        }

        const drivers = getDriversList();
        const drvObj = drivers.find(d => (d.id || d.name) === driverId);
        const driverName = drvObj ? drvObj.name : driverId;

        const record = {
            id: 'INC-' + Date.now(),
            driverId,
            driverName,
            date,
            type,
            cost,
            notes,
            created_at: new Date().toISOString()
        };

        const incidents = getStoredIncidents();
        incidents.unshift(record);
        saveStoredIncidents(incidents);

        window.closeModalLogDriverIncident();
        window.renderDriverPointsSystem();

        if (typeof showToast === 'function') {
            showToast('✅ Incident record saved and points updated successfully!', 'success');
        } else {
            alert('✅ Incident record saved!');
        }
    };

    // View Driver Incident History
    window.viewDriverIncidentHistory = function (driverId, driverName) {
        const modal = document.getElementById('modalIncidentHistory');
        const title = document.getElementById('modalIncidentHistoryTitle');
        const list = document.getElementById('incidentHistoryList');
        if (!modal || !list) return;

        if (title) title.textContent = `📜 Incident History — ${driverName}`;

        const incidents = getStoredIncidents().filter(i => (i.driverId === driverId || i.driverName === driverId));

        if (incidents.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">No incident records logged for this driver yet.</div>';
        } else {
            let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
            incidents.forEach(inc => {
                let categoryLabel = '⛔ Day Off';
                let penaltyText = '-3 Points';
                if (inc.type === 'accident') {
                    categoryLabel = '💥 Vehicle Accident Damage';
                    penaltyText = `-${Math.floor(inc.cost / 1000)} Points (Cost: LKR ${inc.cost.toLocaleString()})`;
                } else if (inc.type === 'goods_shortage') {
                    categoryLabel = '📦 Shortage of Goods / Lost Cargo';
                    penaltyText = `-${Math.floor(inc.cost / 500)} Points (Cost: LKR ${inc.cost.toLocaleString()})`;
                } else if (inc.type === 'missed_fuel') {
                    categoryLabel = '🧾 Missed / Unbilled Fuel Receipt';
                    penaltyText = '-15 Points';
                }

                html += `
                    <div style="background:var(--surface-ground); border:1px solid var(--surface-border); border-radius:10px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="font-size:13px; color:var(--text-primary);">${categoryLabel}</strong>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">📅 ${inc.date} ${inc.notes ? ' | ' + inc.notes : ''}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-weight:800; font-size:13px; color:var(--brand-red);">${penaltyText}</span>
                            <button onclick="deleteDriverIncident('${inc.id}')" style="background:none; border:none; color:var(--brand-red); cursor:pointer; font-size:14px;" title="Delete Record">🗑️</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            list.innerHTML = html;
        }

        modal.style.display = 'flex';
    };

    window.closeModalIncidentHistory = function () {
        const modal = document.getElementById('modalIncidentHistory');
        if (modal) modal.style.display = 'none';
    };

    window.deleteDriverIncident = function (id) {
        if (!confirm('Are you sure you want to delete this incident record?')) return;
        let incidents = getStoredIncidents();
        incidents = incidents.filter(i => i.id !== id);
        saveStoredIncidents(incidents);
        window.closeModalIncidentHistory();
        window.renderDriverPointsSystem();
    };

    // Initialization hook: Render when driver-points page is loaded or clicked
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.nav-item[data-page="driver-points"]').forEach(btn => {
            btn.addEventListener('click', function () {
                setTimeout(window.renderDriverPointsSystem, 50);
            });
        });
    });

})();
