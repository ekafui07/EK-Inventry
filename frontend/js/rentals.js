/**
 * Rentals & Bookings Domain Module
 */

function getBookingStatus(booking) {
  if (booking.status === 'Returned') return 'Returned';
  if (booking.status === 'Cancelled') return 'Cancelled';
  const todayStr = new Date().toISOString().split('T')[0];
  if (booking.startDate > todayStr) return 'Booked';
  if (booking.endDate < todayStr) return 'Overdue';
  return 'Active';
}
window.getBookingStatus = getBookingStatus;

function renderRentalsList(query = '') {
  const tbody = document.getElementById('rentals-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  let bookings = state.bookings;
  
  // Apply tab status filter
  if (activeRentalsFilter !== 'all') {
    bookings = bookings.filter(b => getBookingStatus(b) === activeRentalsFilter);
  }
  
  if (query) {
    bookings = bookings.filter(booking => {
      const item = state.gear.find(g => g.id === booking.gearId) || { name: '', serialNumber: '' };
      const client = state.clients.find(c => c.id === booking.clientId) || { name: '' };
      return booking.id.toLowerCase().includes(query) ||
             item.name.toLowerCase().includes(query) ||
             client.name.toLowerCase().includes(query);
    });
  }
  
  if (bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">${query ? 'No matching rental records found.' : 'No rental records found.'}</td></tr>`;
    return;
  }

  bookings.forEach(booking => {
    const item = state.gear.find(g => g.id === booking.gearId) || { name: 'Unknown Gear', dailyRate: 0 };
    const client = state.clients.find(c => c.id === booking.clientId) || { name: 'Unknown Client' };
    
    const calculatedStatus = getBookingStatus(booking);
    const statusClass = calculatedStatus.toLowerCase();

    // Print invoice button for all booked, active, returned, and overdue rentals
    let invoiceButton = '<span style="color:var(--text-muted); font-size:0.8rem;">—</span>';
    if (calculatedStatus !== 'Cancelled') {
      invoiceButton = `
        <button class="btn-print-invoice" onclick="openRentalInvoice('${booking.id}')" title="Print or Save Invoice PDF">
          <i data-lucide="printer" style="width:13px; height:13px;"></i> Print Invoice
        </button>
      `;
    }

    const canReturn = hasPermission('return_rentals');
    let actionButton = '—';
    if (canReturn) {
      if (calculatedStatus === 'Booked') {
        actionButton = `
          <button class="btn btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; color: var(--color-danger); border-color: rgba(239, 68, 68, 0.3);" onclick="cancelBookingAction('${booking.id}')" title="Void Reservation">
            <i data-lucide="x-circle" style="width:12px; height:12px"></i> Cancel
          </button>
        `;
      } else if (calculatedStatus === 'Active' || calculatedStatus === 'Overdue') {
        actionButton = `
          <button class="btn btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; color: var(--color-success); border-color: rgba(16, 185, 129, 0.3);" onclick="returnGear('${booking.id}')" title="Return Gear">
            <i data-lucide="check-square" style="width:12px; height:12px"></i> Check In
          </button>
        `;
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtmlText(client.name)}</strong></td>
      <td><strong>${escapeHtmlText(item.name)}</strong></td>
      <td>${escapeHtmlText(booking.startDate)} to ${escapeHtmlText(booking.endDate)}</td>
      <td>GH₵${escapeHtmlText(item.dailyRate)}/day</td>
      <td><span class="status-pill ${statusClass}">${escapeHtmlText(calculatedStatus)}</span></td>
      <td>${invoiceButton}</td>
      <td>${actionButton}</td>
    `;
    tbody.appendChild(tr);
  });
  if (window.lucide) lucide.createIcons();
}
window.renderRentalsList = renderRentalsList;

function renderDashboardRentals(query = '') {
  const tbody = document.getElementById('dashboard-rentals-table') || document.getElementById('dashboard-rentals-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  let activeBookings = state.bookings.filter(b => b.status === 'Active' || !b.status);
  
  if (query) {
    activeBookings = activeBookings.filter(booking => {
      const item = state.gear.find(g => g.id === booking.gearId) || { name: '' };
      const client = state.clients.find(c => c.id === booking.clientId) || { name: '' };
      return booking.id.toLowerCase().includes(query) ||
             item.name.toLowerCase().includes(query) ||
             client.name.toLowerCase().includes(query);
    });
  }
  
  if (activeBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">${query ? 'No matching active checkouts found.' : 'No active rentals at the moment.'}</td></tr>`;
    return;
  }
  
  const canReturn = hasPermission('return_rentals');

  activeBookings.forEach(booking => {
    const item = state.gear.find(g => g.id === booking.gearId) || { name: 'Unknown Gear' };
    const client = state.clients.find(c => c.id === booking.clientId) || { name: 'Unknown Client' };
    
    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = booking.endDate < todayStr;
    const statusText = isOverdue ? 'Overdue' : 'Active';
    const statusClass = isOverdue ? 'overdue' : 'active';
    
    const invoiceButton = `
      <button class="btn-print-invoice" onclick="openRentalInvoice('${booking.id}')" title="Print or Save Invoice PDF">
        <i data-lucide="printer" style="width:13px; height:13px;"></i> Print Invoice
      </button>
    `;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtmlText(item.name)}</strong></td>
      <td>${escapeHtmlText(client.name)}</td>
      <td>${escapeHtmlText(booking.startDate)}</td>
      <td>${escapeHtmlText(booking.endDate)}</td>
      <td><span class="status-pill ${statusClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });
  if (window.lucide) lucide.createIcons();
}
window.renderDashboardRentals = renderDashboardRentals;

function openRentalInvoice(bookingId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking) return;

  const item = state.gear.find(g => g.id === booking.gearId) || {
    name: 'Cinema Equipment',
    category: 'Media Gear',
    assetTag: '—',
    serialNumber: '—',
    dailyRate: 0
  };
  const client = state.clients.find(c => c.id === booking.clientId) || {
    name: 'Valued Client',
    email: '—',
    phone: '—'
  };

  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  const diffTime = Math.abs(end - start);
  const durationDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
  const dailyRate = Number(item.dailyRate) || 0;
  const lineTotal = dailyRate * durationDays;
  const invoiceNumber = `INV-${booking.id.replace(/^b_/, '').slice(-6).toUpperCase()}`;
  const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const status = getBookingStatus(booking);

  const container = document.getElementById('printable-invoice-content');
  if (!container) return;

  container.innerHTML = `
    <div class="inv-brand-row">
      <div>
        <div class="inv-logo-title">EK GEARFLOW</div>
        <div class="inv-subtitle">Professional Media Equipment Rental Registry</div>
        <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.35rem;">
          Accra, Greater Accra, Ghana &bull; rentals@ekgearflow.com &bull; +233 24 000 0000
        </div>
      </div>
      <div class="inv-meta-box">
        <div class="inv-meta-title">RENTAL INVOICE</div>
        <div class="inv-meta-detail"><strong>Invoice #:</strong> ${invoiceNumber}</div>
        <div class="inv-meta-detail"><strong>Date Issued:</strong> ${todayFormatted}</div>
        <div class="inv-meta-detail"><strong>Status:</strong> <span style="display:inline-block; padding: 2px 8px; border-radius: 12px; font-weight:700; font-size:0.75rem; background:#e0f2fe; color:#0369a1;">${status.toUpperCase()}</span></div>
      </div>
    </div>

    <div class="inv-two-col">
      <div>
        <div class="inv-section-title">Billed To (Client Details)</div>
        <div class="inv-info-block">
          <strong>${escapeHtmlText(client.name)}</strong><br>
          Email: ${escapeHtmlText(client.email || '—')}<br>
          Phone: ${escapeHtmlText(client.phone || '—')}
        </div>
      </div>
      <div>
        <div class="inv-section-title">Rental Schedule</div>
        <div class="inv-info-block">
          <strong>Booking ID:</strong> ${escapeHtmlText(booking.id)}<br>
          <strong>Check-Out Date:</strong> ${escapeHtmlText(booking.startDate)}<br>
          <strong>Return Due Date:</strong> ${escapeHtmlText(booking.endDate)}<br>
          <strong>Duration:</strong> ${durationDays} Day${durationDays > 1 ? 's' : ''}
        </div>
      </div>
    </div>

    <table class="inv-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Equipment Description</th>
          <th>Asset Tag</th>
          <th>Serial Number</th>
          <th style="text-align:right">Daily Rate</th>
          <th style="text-align:center">Days</th>
          <th style="text-align:right">Amount (GH₵)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <strong>${escapeHtmlText(item.name)}</strong><br>
            <span style="font-size:0.75rem; color:#64748b;">Category: ${escapeHtmlText(item.category || 'Gear')}</span>
          </td>
          <td><code>${escapeHtmlText(item.assetTag || '—')}</code></td>
          <td><code>${escapeHtmlText(item.serialNumber || '—')}</code></td>
          <td style="text-align:right">GH₵${dailyRate.toFixed(2)}</td>
          <td style="text-align:center">${durationDays}</td>
          <td style="text-align:right"><strong>GH₵${lineTotal.toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="inv-totals-wrap">
      <div class="inv-totals-box">
        <div class="inv-totals-row">
          <span>Subtotal:</span>
          <span>GH₵${lineTotal.toFixed(2)}</span>
        </div>
        <div class="inv-totals-row">
          <span>Taxes / Fees (0%):</span>
          <span>GH₵0.00</span>
        </div>
        <div class="inv-totals-row grand-total">
          <span>Total Due:</span>
          <span>GH₵${lineTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="inv-terms-box">
      <strong>Rental Agreement &amp; Equipment Verification:</strong><br>
      The renter acknowledges receipt of the equipment listed above in clean, fully operational working condition. 
      The renter agrees to operate the gear in accordance with manufacturer guidelines and assumes liability for any damages, 
      loss, or overdue rental fees accrued until official check-in by EK GearFlow operations.
    </div>

    <div class="inv-signatures-row">
      <div class="inv-sig-box">
        Client / Renter Signature &amp; Date
      </div>
      <div class="inv-sig-box">
        Authorized EK GearFlow Desk Agent
      </div>
    </div>
  `;

  openModal('modal-invoice-preview');
  if (window.lucide) lucide.createIcons();
}
window.openRentalInvoice = openRentalInvoice;

async function returnGear(bookingId) {
  if (!hasPermission('return_rentals')) {
    showToast('Permission Denied: You do not have permission to process returns.', 'danger');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/bookings/${bookingId}/return`, {
      method: 'PUT'
    });
    if (!res.ok) throw new Error('API Error');
    showToast('Gear checked back into inventory');
    if (window.AppEvents) {
      AppEvents.emit('rentals:changed');
    } else {
      await refreshData();
    }
  } catch (err) {
    showToast('Error updating return', 'danger');
  }
}
window.returnGear = returnGear;

async function cancelBookingAction(bookingId) {
  if (!hasPermission('return_rentals')) {
    showToast('Permission Denied: You do not have permission to cancel bookings.', 'danger');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/bookings/${bookingId}/cancel`, {
      method: 'PUT'
    });
    if (!res.ok) throw new Error('API Error');
    showToast('Booking cancelled successfully');
    if (window.AppEvents) {
      AppEvents.emit('rentals:changed');
    } else {
      await refreshData();
    }
  } catch (err) {
    showToast('Error cancelling booking', 'danger');
  }
}
window.cancelBookingAction = cancelBookingAction;

function setupCheckoutFormDynamicRows() {
  const addBtn = document.getElementById('btn-add-gear-row');
  const listContainer = document.getElementById('checkout-gear-list');
  
  if (!addBtn || !listContainer) return;
  
  addBtn.addEventListener('click', () => {
    const firstRow = listContainer.querySelector('.gear-select-row');
    if (!firstRow) return;
    
    const newRow = firstRow.cloneNode(true);
    const select = newRow.querySelector('.checkout-gear-select');
    select.value = '';
    
    const removeBtn = newRow.querySelector('.btn-remove-gear');
    removeBtn.disabled = false;
    removeBtn.style.opacity = '1';
    removeBtn.style.pointerEvents = 'auto';
    
    removeBtn.onclick = () => {
      newRow.remove();
      populateCheckoutDropdowns();
    };
    
    select.onchange = () => {
      populateCheckoutDropdowns();
    };
    
    listContainer.appendChild(newRow);
    populateCheckoutDropdowns();
  });
}
window.setupCheckoutFormDynamicRows = setupCheckoutFormDynamicRows;

function setupRentalsFilter() {
  const filterTabs = document.querySelectorAll('#rentals-filter-bar .filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeRentalsFilter = tab.getAttribute('data-status');
      renderRentalsList(document.getElementById('global-search').value.toLowerCase().trim());
    });
  });
}
window.setupRentalsFilter = setupRentalsFilter;
