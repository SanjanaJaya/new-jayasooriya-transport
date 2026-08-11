// ============================================================
// ============ CREDIT CARDS MANAGEMENT SYSTEM ================
// ============================================================

let _ccInitialized = false;
let _currentCreditCardPayments = {}; // cardId -> Set of monthKeys

// ── Entry Point ──────────────────────────────────────────────
async function loadCreditCardsPage() {
    if (!_ccInitialized) {
        initCreditCardsPage();
        _ccInitialized = true;
    }
    await refreshCreditCardsData();
}

// ── Initialize Event Listeners ──────────────────────────────
function initCreditCardsPage() {
    // Network Selector Buttons in Form
    document.querySelectorAll('.lease-type-selector button[data-network]').forEach(btn => {
        btn.addEventListener('click', () => {
            setCardFormNetwork(btn.dataset.network);
        });
    });

    // Form Toggle button
    document.getElementById('toggleAddCardFormBtn')?.addEventListener('click', () => {
        if (!checkAdminAccess('add')) return;
        const container = document.getElementById('addCardFormContainer');
        const isVisible = container.style.display !== 'none';
        if (isVisible) {
            container.style.display = 'none';
        } else {
            resetCardForm();
            container.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    // Cancel Form button
    document.getElementById('cancelAddCardBtn')?.addEventListener('click', () => {
        document.getElementById('addCardFormContainer').style.display = 'none';
        resetCardForm();
    });

    // Settle / Closed checkbox
    document.getElementById('cardSettledCheck')?.addEventListener('change', (e) => {
        const notesWrap = document.getElementById('cardSettledNotesWrap');
        if (notesWrap) notesWrap.style.display = e.target.checked ? 'block' : 'none';
    });

    // Form Submit
    document.getElementById('addCreditCardForm')?.addEventListener('submit', handleSaveCreditCard);
}

// ── Form Helpers ─────────────────────────────────────────────
function resetCardForm() {
    document.getElementById('addCreditCardForm')?.reset();
    document.getElementById('cardId').value = '';
    document.getElementById('cardSettledNotesWrap').style.display = 'none';
    setCardFormNetwork('visa');
}

function setCardFormNetwork(network) {
    document.getElementById('cardNetwork').value = network;
    document.querySelectorAll('.lease-type-selector button[data-network]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.network === network);
    });
}

// ── Database Sync: Fetch & Render ───────────────────────────
async function refreshCreditCardsData() {
    const uid = getQueryUserId();
    if (!uid) return;

    const grid = document.getElementById('creditCardsGridContainer');
    if (!grid) return;

    grid.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);grid-column:1/-1;">Loading credit cards...</div>';

    try {
        // 1. Fetch all cards
        const { data: cards, error: cErr } = await supabaseClient
            .from('credit_cards')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: true });
        
        if (cErr) throw cErr;
        const allCards = cards || [];

        // 2. Fetch all payment records for these cards
        let paymentsMap = {};
        if (allCards.length > 0) {
            const cardIds = allCards.map(c => c.id);
            const { data: payments, error: pErr } = await supabaseClient
                .from('credit_card_payments')
                .select('*')
                .in('card_id', cardIds);
            
            if (pErr) throw pErr;
            
            (payments || []).forEach(p => {
                if (!paymentsMap[p.card_id]) {
                    paymentsMap[p.card_id] = new Set();
                }
                paymentsMap[p.card_id].add(p.month_key);
            });
        }
        _currentCreditCardPayments = paymentsMap;

        // 3. Render Dashboard Statistics and virtual Cards
        renderCreditCardsSummaryStrip(allCards, paymentsMap);
        renderCreditCardsGrid(allCards, paymentsMap);

        // 4. Handle "Credit Cards Due Soon" Banner
        const activeCards = allCards.filter(c => !c.settled);
        const banner = document.getElementById('ccDueBanner');
        const bannerList = document.getElementById('ccDueBannerList');
        
        if (banner && bannerList) {
            const now = new Date();
            const today = new Date();
            today.setHours(0,0,0,0);
            const currMonthKey = leasingMonthKey(now.getFullYear(), now.getMonth());
            
            let dueAlerts = [];
            
            activeCards.forEach(c => {
                const paid = paymentsMap[c.id] || new Set();
                
                // Check current month paid state
                if (!paid.has(currMonthKey)) {
                    const lastDayOfThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                    const dueDay = Math.min(c.due_day, lastDayOfThisMonth);
                    const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
                    dueDate.setHours(0,0,0,0);
                    
                    const diffTime = dueDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const dueDateStr = dueDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
                    
                    if (diffDays < 0) {
                        dueAlerts.push(`<span class="cheque-due-item">🔴 <strong>${c.bank_name} (•••• ${c.last_four})</strong> minimum payment is OVERDUE! (Due: ${dueDateStr})</span>`);
                    } else if (diffDays === 0) {
                        dueAlerts.push(`<span class="cheque-due-item">🚨 <strong>${c.bank_name} (•••• ${c.last_four})</strong> minimum payment is due TODAY!</span>`);
                    } else if (diffDays <= 7) {
                        dueAlerts.push(`<span class="cheque-due-item">⏳ <strong>${c.bank_name} (•••• ${c.last_four})</strong> minimum payment due in ${diffDays} days (${dueDateStr})</span>`);
                    }
                }

                // Check past months overdue states (past 2 months)
                const createdDate = new Date(c.created_at || now);
                const createdMonthKey = leasingMonthKey(createdDate.getFullYear(), createdDate.getMonth());

                let prevYear = now.getFullYear(), prevMonth = now.getMonth() - 1;
                if (prevMonth < 0) { prevMonth = 11; prevYear--; }
                const prevMonthKey = leasingMonthKey(prevYear, prevMonth);

                let prev2Year = prevYear, prev2Month = prevMonth - 1;
                if (prev2Month < 0) { prev2Month = 11; prev2Year--; }
                const prev2MonthKey = leasingMonthKey(prev2Year, prev2Month);

                const pastMonths = [prev2MonthKey, prevMonthKey];
                pastMonths.forEach(mKey => {
                    if (mKey >= createdMonthKey && !paid.has(mKey)) {
                        const [y, m] = mKey.split('-').map(Number);
                        const dueOfPastMonth = new Date(y, m - 1, c.due_day);
                        const endOfPastMonth = new Date(y, m, 0);
                        const targetDay = Math.min(c.due_day, endOfPastMonth.getDate());
                        dueOfPastMonth.setDate(targetDay);
                        dueOfPastMonth.setHours(0,0,0,0);

                        if (today >= dueOfPastMonth) {
                            const cycleMonthName = dueOfPastMonth.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                            dueAlerts.push(`<span class="cheque-due-item">🔴 <strong>${c.bank_name} (•••• ${c.last_four})</strong> bill for ${cycleMonthName} is OVERDUE!</span>`);
                        }
                    }
                });
            });

            if (dueAlerts.length > 0) {
                banner.style.display = 'block';
                bannerList.innerHTML = dueAlerts.join('');
            } else {
                banner.style.display = 'none';
                bannerList.innerHTML = '';
            }
        }

    } catch (err) {
        console.error('Error refreshing credit cards:', err);
        grid.innerHTML = `<div style="padding:24px;text-align:center;color:var(--brand-red);grid-column:1/-1;">⚠️ Error: ${err.message || 'Make sure Supabase tables exist.'}</div>`;
    }
}

// ── Render Summary Dashboard ────────────────────────────────
function renderCreditCardsSummaryStrip(cards, paymentsMap) {
    const now = new Date();
    const currMonthKey = leasingMonthKey(now.getFullYear(), now.getMonth());

    // Month Label
    const currentMonthLabelEl = document.getElementById('ccCurrentMonthLabel');
    if (currentMonthLabelEl) {
        currentMonthLabelEl.textContent = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }

    let overdueCount = 0;
    let unpaidCount = 0;
    let totalLimit = 0;

    cards.forEach(card => {
        if (card.settled) return; // skip inactive closed cards

        totalLimit += parseFloat(card.card_limit || 0);

        const paid = paymentsMap[card.id] || new Set();

        // Check if unpaid for current month
        if (!paid.has(currMonthKey)) {
            unpaidCount++;
        }

        // Check overdue for past 3 months
        const createdDate = new Date(card.created_at || now);
        const createdMonthKey = leasingMonthKey(createdDate.getFullYear(), createdDate.getMonth());

        // Previous month key
        let prevYear = now.getFullYear(), prevMonth = now.getMonth() - 1;
        if (prevMonth < 0) { prevMonth = 11; prevYear--; }
        const prevMonthKey = leasingMonthKey(prevYear, prevMonth);

        // Two months ago key
        let prev2Year = prevYear, prev2Month = prevMonth - 1;
        if (prev2Month < 0) { prev2Month = 11; prev2Year--; }
        const prev2MonthKey = leasingMonthKey(prev2Year, prev2Month);

        const pastMonths = [prev2MonthKey, prevMonthKey];
        pastMonths.forEach(mKey => {
            if (mKey >= createdMonthKey && !paid.has(mKey)) {
                // If due day has passed in that month, it's overdue
                const [y, m] = mKey.split('-').map(Number);
                const dueOfPastMonth = new Date(y, m - 1, card.due_day);
                const endOfPastMonth = new Date(y, m, 0); // last day of that month
                const targetDay = Math.min(card.due_day, endOfPastMonth.getDate());
                dueOfPastMonth.setDate(targetDay);
                dueOfPastMonth.setHours(0,0,0,0);

                const today = new Date();
                today.setHours(0,0,0,0);

                if (today >= dueOfPastMonth) {
                    overdueCount++;
                }
            }
        });
    });

    const overdueVal = document.getElementById('ccOverdueCount');
    const unpaidVal = document.getElementById('ccUnpaidCount');
    const limitVal = document.getElementById('ccTotalLimit');

    if (overdueVal) overdueVal.textContent = overdueCount === 1 ? '1 Overdue' : `${overdueCount} Overdue`;
    if (unpaidVal) unpaidVal.textContent = unpaidCount === 1 ? '1 Card' : `${unpaidCount} Cards`;
    if (limitVal) {
        limitVal.textContent = 'LKR ' + totalLimit.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const prevCard = document.querySelector('#ccSummaryStrip .lss-prev-due');
    if (prevCard) {
        prevCard.classList.toggle('lss-overdue-alert', overdueCount > 0);
    }
}

// ── Render Cards Grid ────────────────────────────────────────
function renderCreditCardsGrid(cards, paymentsMap) {
    const container = document.getElementById('creditCardsGridContainer');
    if (!container) return;

    container.innerHTML = '';

    if (cards.length === 0) {
        container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);grid-column:1/-1;">No credit cards found. Click <strong>+ Add Credit Card</strong> to get started.</div>';
        return;
    }

    const activeCards = cards.filter(c => !c.settled);
    const closedCards = cards.filter(c => c.settled);

    const renderSingle = (c) => {
        const paid = paymentsMap[c.id] || new Set();
        const now = new Date();
        const currMonthKey = leasingMonthKey(now.getFullYear(), now.getMonth());
        const isPaidThisMonth = paid.has(currMonthKey);

        // Days until due date this month
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate actual due date for this month (capping at last day of month if necessary)
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const dueDay = Math.min(c.due_day, lastDayOfMonth);
        const dueDateThisMonth = new Date(today.getFullYear(), today.getMonth(), dueDay);
        dueDateThisMonth.setHours(0, 0, 0, 0);

        let daysLeft = Math.ceil((dueDateThisMonth - today) / (1000 * 60 * 60 * 24));
        
        let statusClass = 'card-upcoming';
        let statusText = '⏳ Unpaid';
        let statusBadgeClass = 'badge-unpaid';

        if (c.settled) {
            statusClass = 'card-settled';
            statusText = '🏁 Closed';
            statusBadgeClass = 'badge-unpaid';
        } else if (isPaidThisMonth) {
            statusClass = 'card-paid-state';
            statusText = '🟢 Paid';
            statusBadgeClass = 'badge-paid';
        } else {
            if (daysLeft < 0) {
                statusClass = 'card-overdue-state';
                statusText = '🔴 Overdue';
                statusBadgeClass = 'badge-overdue';
            } else if (daysLeft === 0) {
                statusClass = 'card-due-today-state';
                statusText = '🚨 Due Today';
                statusBadgeClass = 'badge-due-today';
            } else if (daysLeft <= 5) {
                statusClass = 'card-due-soon-state';
                statusText = `⏳ Due in ${daysLeft}d`;
                statusBadgeClass = 'badge-due-soon';
            } else {
                statusText = `⏳ Due in ${daysLeft}d`;
                statusBadgeClass = 'badge-upcoming-day';
            }
        }

        const formattedLimit = 'LKR ' + Number(c.card_limit || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const cardDiv = document.createElement('div');
        cardDiv.className = 'credit-card-wrapper' + (c.settled ? ' cc-settled-card' : '');
        cardDiv.innerHTML = `
            <div class="credit-card-container card-${c.card_network} ${statusClass}">
                <div class="card-chip-container">
                    <div class="card-chip-gold"></div>
                    <span class="card-type-title">${c.card_network}</span>
                </div>
                <div class="card-bank-display">${c.bank_name}</div>
                <div class="card-number-display">•••• •••• •••• ${c.last_four}</div>
                <div class="card-limit-display">
                    <span class="card-label">Limit</span>
                    <span class="card-val">${formattedLimit}</span>
                </div>
                <div class="card-bottom-display">
                    <div class="card-due-display">
                        <span class="card-label">Due Day</span>
                        <span class="card-val">Day ${c.due_day}</span>
                    </div>
                    <div class="card-status-display ${statusBadgeClass}">${statusText}</div>
                </div>
            </div>
            <div class="credit-card-actions" style="grid-template-columns: 2fr 1fr 1fr;">
                ${!c.settled && userRole !== 'viewer' ? `
                    <button class="btn btn-card-pay ${isPaidThisMonth ? 'btn-unpay' : 'btn-pay'}" onclick="window.toggleCardPaid('${c.id}', '${currMonthKey}', ${isPaidThisMonth})">
                        ${isPaidThisMonth ? '↩️ Unmark' : '✅ Mark Paid'}
                    </button>
                ` : `<span style="grid-column: 1/2;"></span>`}
                <button class="btn btn-secondary btn-sm" onclick="window.editCreditCard('${c.id}')">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteCreditCard('${c.id}')">🗑️</button>
            </div>
        `;
        container.appendChild(cardDiv);
    };

    activeCards.forEach(renderSingle);

    if (closedCards.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'leasing-settled-section-header';
        divider.style.gridColumn = '1 / -1';
        divider.innerHTML = `
            <div class="leasing-settled-section-line"></div>
            <span class="leasing-settled-section-label">🏁 Closed Cards (${closedCards.length})</span>
            <div class="leasing-settled-section-line"></div>
        `;
        container.appendChild(divider);
        closedCards.forEach(renderSingle);
    }
}

// ── Save Credit Card ─────────────────────────────────────────
async function handleSaveCreditCard(e) {
    e.preventDefault();
    if (!checkAdminAccess('save')) return;

    const id = document.getElementById('cardId').value;
    const bankName = document.getElementById('cardBankName').value.trim();
    const lastFour = document.getElementById('cardLast4').value.trim();
    const network = document.getElementById('cardNetwork').value;
    const dueDay = parseInt(document.getElementById('cardDueDay').value);
    const limit = parseFloat(document.getElementById('cardLimit').value);
    const isSettled = document.getElementById('cardSettledCheck')?.checked || false;
    const settledNotes = isSettled ? (document.getElementById('cardSettledNotes')?.value || '') : null;

    if (!bankName || !lastFour || !dueDay || !limit) {
        showToast('Please fill in all fields.', 'warning');
        return;
    }

    const payload = {
        user_id: getQueryUserId(),
        bank_name: bankName,
        last_four: lastFour,
        card_network: network,
        due_day: dueDay,
        card_limit: limit,
        settled: isSettled,
        settled_notes: settledNotes
    };

    const submitBtn = document.querySelector('#addCreditCardForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }

    try {
        let err;
        if (id) {
            ({ error: err } = await supabaseClient.from('credit_cards').update(payload).eq('id', id));
        } else {
            ({ error: err } = await supabaseClient.from('credit_cards').insert([payload]));
        }

        if (err) throw err;

        document.getElementById('addCardFormContainer').style.display = 'none';
        resetCardForm();
        await refreshCreditCardsData();
        if (typeof loadNotifications === 'function') loadNotifications();
        showToast('Credit card saved successfully!', 'success');
    } catch (err) {
        console.error('Error saving credit card:', err);
        showToast('Failed to save: ' + (err.message || 'Please try again.'), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '💾 Save Card';
        }
    }
}

// ── Edit Credit Card ─────────────────────────────────────────
window.editCreditCard = async function (cardId) {
    if (!checkAdminAccess('edit')) return;

    try {
        const { data: card, error } = await supabaseClient
            .from('credit_cards')
            .select('*')
            .eq('id', cardId)
            .single();

        if (error || !card) throw error || new Error('Card not found');

        resetCardForm();
        document.getElementById('cardId').value = card.id;
        document.getElementById('cardBankName').value = card.bank_name;
        document.getElementById('cardLast4').value = card.last_four;
        document.getElementById('cardDueDay').value = card.due_day;
        document.getElementById('cardLimit').value = card.card_limit;
        
        setCardFormNetwork(card.card_network || 'visa');

        if (card.settled) {
            document.getElementById('cardSettledCheck').checked = true;
            document.getElementById('cardSettledNotesWrap').style.display = 'block';
            document.getElementById('cardSettledNotes').value = card.settled_notes || '';
        }

        document.getElementById('addCardFormContainer').style.display = 'block';
        document.getElementById('addCardFormContainer').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error('Error loading card edit:', err);
        showToast('Failed to load card details: ' + err.message, 'error');
    }
};

// ── Delete Credit Card ───────────────────────────────────────
window.deleteCreditCard = async function (cardId) {
    if (!checkAdminAccess('delete')) return;
    if (!await showConfirmAsync('Are you sure you want to delete this credit card and all its payment history?')) return;

    try {
        const { error } = await supabaseClient
            .from('credit_cards')
            .delete()
            .eq('id', cardId);

        if (error) throw error;

        await refreshCreditCardsData();
        if (typeof loadNotifications === 'function') loadNotifications();
        showToast('Credit card deleted.', 'success');
    } catch (err) {
        console.error('Error deleting card:', err);
        showToast('Failed to delete card: ' + err.message, 'error');
    }
};

// ── Toggle Paid Status ──────────────────────────────────────
window.toggleCardPaid = async function (cardId, monthKey, isPaid) {
    if (!checkAdminAccess('update')) return;
    const uid = getQueryUserId();

    try {
        if (isPaid) {
            const { error } = await supabaseClient
                .from('credit_card_payments')
                .delete()
                .eq('card_id', cardId)
                .eq('month_key', monthKey);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('credit_card_payments')
                .insert([{ user_id: uid, card_id: cardId, month_key: monthKey }]);
            if (error) throw error;
        }
        await refreshCreditCardsData();
    } catch (err) {
        console.error('Error toggling paid state:', err);
        showToast('Failed to update status: ' + err.message, 'error');
    }
};

// ── Notification Center Fetch Hook ──────────────────────────
async function fetchCreditCardAlerts(userId) {
    const alerts = [];
    try {
        // Fetch active cards
        const { data: cards, error: cErr } = await supabaseClient
            .from('credit_cards')
            .select('*')
            .eq('user_id', userId)
            .eq('settled', false);

        if (cErr) throw cErr;
        if (!cards || cards.length === 0) return [];

        const cardIds = cards.map(c => c.id);

        // Fetch card payments
        const { data: payments, error: pErr } = await supabaseClient
            .from('credit_card_payments')
            .select('*')
            .in('card_id', cardIds);

        if (pErr) throw pErr;

        const paymentsMap = {};
        (payments || []).forEach(p => {
            if (!paymentsMap[p.card_id]) {
                paymentsMap[p.card_id] = new Set();
            }
            paymentsMap[p.card_id].add(p.month_key);
        });

        const now = new Date();
        const today = new Date();
        today.setHours(0,0,0,0);

        // Build list of months to check: previous 2 months + current month
        const currentMonthKey = leasingMonthKey(now.getFullYear(), now.getMonth());

        let prevYear = now.getFullYear(), prevMonth = now.getMonth() - 1;
        if (prevMonth < 0) { prevMonth = 11; prevYear--; }
        const prevMonthKey = leasingMonthKey(prevYear, prevMonth);

        let prev2Year = prevYear, prev2Month = prevMonth - 1;
        if (prev2Month < 0) { prev2Month = 11; prev2Year--; }
        const prev2MonthKey = leasingMonthKey(prev2Year, prev2Month);

        const checkMonths = [prev2MonthKey, prevMonthKey, currentMonthKey];

        cards.forEach(card => {
            const paid = paymentsMap[card.id] || new Set();
            const createdDate = new Date(card.created_at || now);
            const createdMonthKey = leasingMonthKey(createdDate.getFullYear(), createdDate.getMonth());

            checkMonths.forEach(mKey => {
                // Only alert for cycles during the card's lifetime, and if unpaid
                if (mKey >= createdMonthKey && !paid.has(mKey)) {
                    const [yr, mn] = mKey.split('-').map(Number);
                    
                    // Calc due date for that specific month cycle
                    const lastDayOfCycleMonth = new Date(yr, mn, 0).getDate();
                    const dueDay = Math.min(card.due_day, lastDayOfCycleMonth);
                    const cycleDueDate = new Date(yr, mn - 1, dueDay);
                    cycleDueDate.setHours(0,0,0,0);

                    const diffTime = cycleDueDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const dueDateStr = cycleDueDate.toLocaleDateString('en-GB');

                    const isCurrentMonthCycle = (mKey === currentMonthKey);

                    if (diffDays < 0) {
                        // OVERDUE ALERT
                        const cycleMonthName = cycleDueDate.toLocaleString('en-US', { month: 'short', year: '2-digit' });
                        alerts.push({
                            id: `cc_overdue_${card.id}_${mKey}`,
                            title: `🚨 Credit Card Overdue: ${card.bank_name}`,
                            desc: `Card Ending ${card.last_four} bill for ${cycleMonthName} is unpaid! (Due date was ${dueDateStr})`,
                            icon: `⚠️`,
                            type: 'credit-card',
                            cardId: card.id,
                            date: mKey
                        });
                    } else if (diffDays <= 7 && isCurrentMonthCycle) {
                        // DUE SOON WARNING (only alert for current month's due cycle)
                        let descText = `Bill ending ${card.last_four} is due in ${diffDays} days on ${dueDateStr}.`;
                        if (diffDays === 0) {
                            descText = `Bill ending ${card.last_four} minimum payment is due TODAY!`;
                        }

                        alerts.push({
                            id: `cc_due_${card.id}_${mKey}`,
                            title: `💳 Credit Card Due: ${card.bank_name}`,
                            desc: descText,
                            icon: `💳`,
                            type: 'credit-card',
                            cardId: card.id,
                            date: mKey
                        });
                    }
                }
            });
        });

    } catch (err) {
        console.error('Error fetching credit card alerts for notifications:', err);
    }
    return alerts;
}

// Expose alert fetching globally for notification center queries
window.fetchCreditCardAlerts = fetchCreditCardAlerts;
