// EK GearFlow - Frontend Application Logic

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Application State
let state = {
  gear: [],
  clients: [],
  bookings: []
};

let activeTab = 'dashboard'; // Track the active view panel
let activeRentalsFilter = 'all'; // Track the rentals status view filter

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupModals();
  setupForms();
  setupSearch();
  setupCheckoutFormDynamicRows();
  setupRentalsFilter();

  // Expose action functions to global scope for inline onclick= handlers
  window.toggleMaintenance = toggleMaintenance;
  window.returnGear = returnGear;
  window.cancelBookingAction = cancelBookingAction;
  window.editGear = editGear;
  window.deleteGear = deleteGear;
  window.editClient = editClient;
  window.deleteClient = deleteClient;
  
  // Load data from backend API
  await refreshData();
  
  // Initialize Lucide Icons
  lucide.createIcons();
});

// Fetch all data from backend API and update UI
async function refreshData(query = '') {
  try {
    const [gearRes, clientsRes, bookingsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/gear`),
      fetch(`${API_BASE_URL}/clients`),
      fetch(`${API_BASE_URL}/bookings`)
    ]);

    if (!gearRes.ok || !clientsRes.ok || !bookingsRes.ok) {
      throw new Error('Server returned an error');
    }

    state.gear = await gearRes.json();
    state.clients = await clientsRes.json();
    state.bookings = await bookingsRes.json();
  } catch (err) {
    showToast('Cannot connect to backend API (http://localhost:3000)', 'danger');
    return;
  }

  // Recompute gear availability status based on current active bookings today
  const todayStr = new Date().toISOString().split('T')[0];
  state.gear.forEach(g => {
    if (g.status === 'Maintenance') return;
    const isOutToday = state.bookings.some(b => 
      b.gearId === g.id && 
      (b.status === 'Active' || !b.status) && 
      b.startDate <= todayStr && 
      b.endDate >= todayStr
    );
    g.status = isOutToday ? 'Rented' : 'Available';
  });
  
  // Update all views
  updateStats();
  renderDashboardRentals(query);
  renderInventory('all', query);
  renderRentalsList(query);
  renderClients(query);
  populateCheckoutDropdowns();
  renderCategoryChart();
}

// Save back to LocalStorage (in Mock Mode only)
function saveMockState() {
  localStorage.setItem('EK_GEAR', JSON.stringify(state.gear));
  localStorage.setItem('EK_CLIENTS', JSON.stringify(state.clients));
  localStorage.setItem('EK_BOOKINGS', JSON.stringify(state.bookings));
}

// --- Navigation & Routing ---
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Toggle active class on menu items
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Toggle active view panel
      const targetTab = item.getAttribute('data-tab');
      activeTab = targetTab;
      
      // Clear global search on tab switch
      document.getElementById('global-search').value = '';

      viewPanels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `view-${targetTab}`) {
          panel.classList.add('active');
        }
      });

      // Reset filtered view immediately
      refreshData();
    });
  });
}

// --- Modals Setup ---
function setupModals() {
  const modalTriggers = [
    { trigger: 'btn-add-gear', modal: 'modal-add-gear' },
    { trigger: 'btn-add-client', modal: 'modal-add-client' },
    { trigger: 'btn-quick-rent', modal: 'modal-checkout' }
  ];
  
  modalTriggers.forEach(({ trigger, modal }) => {
    const btn = document.getElementById(trigger);
    const m = document.getElementById(modal);
    if (btn && m) {
      btn.addEventListener('click', () => openModal(modal));
    }
  });

  // Setup close buttons and backdrop clicks
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal(modal.id));
    modal.querySelector('.modal-cancel')?.addEventListener('click', () => closeModal(modal.id));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
}

// Ensure elements exist before populating when opening modal
function populateCheckoutDropdowns() {
  const gearSelects = document.querySelectorAll('.checkout-gear-select');
  const clientSelect = document.getElementById('checkout-client');
  
  if (!clientSelect) return;
  
  // Populate client dropdown once
  const currentClientVal = clientSelect.value;
  clientSelect.innerHTML = '<option value="" disabled selected>Select client...</option>';
  state.clients.forEach(client => {
    const opt = document.createElement('option');
    opt.value = client.id;
    opt.innerText = client.name;
    if (client.id === currentClientVal) opt.selected = true;
    clientSelect.appendChild(opt);
  });

  // Collect all values that are currently selected in ANY of the selects
  const allSelectedValues = Array.from(document.querySelectorAll('.checkout-gear-select'))
    .map(s => s.value)
    .filter(val => val);

  // Populate all gear selects with exclusion logic
  gearSelects.forEach(gearSelect => {
    const currentValue = gearSelect.value;
    gearSelect.innerHTML = '<option value="" disabled selected>Choose available gear...</option>';
    
    // Other values selected in other rows (which must be excluded)
    const otherSelectedValues = allSelectedValues.filter(val => val !== currentValue);
    
    // Show only Available items (or current selection)
    const availableGear = state.gear.filter(g => 
      (g.status === 'Available' && !otherSelectedValues.includes(g.id)) || 
      g.id === currentValue
    );
    
    availableGear.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.innerText = `${item.name} (${item.serialNumber})`;
      if (item.id === currentValue) opt.selected = true;
      gearSelect.appendChild(opt);
    });
  });
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

// --- Form Handling ---
function setupForms() {
  // Add Gear
  document.getElementById('form-add-gear').addEventListener('submit', async (e) => {
    e.preventDefault();
    const gearData = {
      name: document.getElementById('gear-name').value,
      assetTag: document.getElementById('gear-asset-tag').value.trim().toUpperCase(),
      category: document.getElementById('gear-category').value,
      serialNumber: document.getElementById('gear-serial').value,
      dailyRate: Number(document.getElementById('gear-rate').value),
      status: 'Available'
    };

    try {
      const res = await fetch(`${API_BASE_URL}/gear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gearData)
      });
      if (!res.ok) throw new Error('API Error');
      showToast('Gear registered in database');
    } catch (err) {
      showToast('Error registering gear', 'danger');
    }
    closeModal('modal-add-gear');
    e.target.reset();
    await refreshData();
  });

  // Edit Gear
  document.getElementById('form-edit-gear').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-gear-id').value;
    const gearData = {
      name: document.getElementById('edit-gear-name').value,
      assetTag: document.getElementById('edit-gear-asset-tag').value.trim().toUpperCase(),
      category: document.getElementById('edit-gear-category').value,
      serialNumber: document.getElementById('edit-gear-serial').value,
      dailyRate: Number(document.getElementById('edit-gear-rate').value)
    };

    try {
      const res = await fetch(`${API_BASE_URL}/gear/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gearData)
      });
      if (!res.ok) throw new Error('API Error');
      showToast('Gear updated in database');
    } catch (err) {
      showToast('Error updating gear', 'danger');
    }
    closeModal('modal-edit-gear');
    e.target.reset();
    await refreshData();
  });

  // Add Client
  document.getElementById('form-add-client').addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientData = {
      name: document.getElementById('client-name').value,
      email: document.getElementById('client-email').value,
      phone: document.getElementById('client-phone').value
    };

    try {
      const res = await fetch(`${API_BASE_URL}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      if (!res.ok) throw new Error('API Error');
      showToast('Client stored in database');
    } catch (err) {
      showToast('Error storing client', 'danger');
    }
    closeModal('modal-add-client');
    e.target.reset();
    await refreshData();
  });

  // Edit Client
  document.getElementById('form-edit-client').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-client-id').value;
    const clientData = {
      name: document.getElementById('edit-client-name').value,
      email: document.getElementById('edit-client-email').value,
      phone: document.getElementById('edit-client-phone').value
    };

    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      if (!res.ok) throw new Error('API Error');
      showToast('Client updated in database');
    } catch (err) {
      showToast('Error updating client', 'danger');
    }
    closeModal('modal-edit-client');
    e.target.reset();
    await refreshData();
  });

  // Check-Out Gear
  document.getElementById('form-checkout').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collect all selected gear IDs
    const gearSelects = document.querySelectorAll('.checkout-gear-select');
    const gearIds = Array.from(gearSelects).map(s => s.value).filter(val => val);
    
    if (gearIds.length === 0) {
      showToast('Please select at least one gear item', 'danger');
      return;
    }

    const bookingData = {
      gearIds: gearIds,
      clientId: document.getElementById('checkout-client').value,
      startDate: document.getElementById('checkout-start').value,
      endDate: document.getElementById('checkout-end').value,
      status: 'Active'
    };

    // Date Overlap Validation
    if (new Date(bookingData.startDate) > new Date(bookingData.endDate)) {
      showToast('Start date must be before end date', 'danger');
      return;
    }

    if (useMockMode) {
      // Check local overlap for each selected gear
      for (const gId of gearIds) {
        const hasOverlap = state.bookings.some(b => 
          b.gearId === gId && 
          b.status !== 'Returned' &&
          b.status !== 'Cancelled' &&
          !(bookingData.endDate < b.startDate || bookingData.startDate > b.endDate)
        );

        if (hasOverlap) {
          const item = state.gear.find(g => g.id === gId);
          const gearName = item ? item.name : 'Selected gear';
          showToast(`Double-booking Error: "${gearName}" is already reserved during those dates!`, 'danger');
          return;
        }
      }

      // Create bookings
      const timestamp = Date.now();
      const todayStr = new Date().toISOString().split('T')[0];
      const isOutToday = bookingData.startDate <= todayStr;

      gearIds.forEach((gId, index) => {
        const newBooking = {
          id: `b_${timestamp}_${index}`,
          gearId: gId,
          clientId: bookingData.clientId,
          startDate: bookingData.startDate,
          endDate: bookingData.endDate,
          status: 'Active'
        };
        state.bookings.push(newBooking);
        
        if (isOutToday) {
          const gearItem = state.gear.find(g => g.id === gId);
          if (gearItem && gearItem.status !== 'Maintenance') gearItem.status = 'Rented';
        }
      });
      
      saveMockState();
      showToast('Checkout completed');
    } else {
      try {
        const res = await fetch(`${API_BASE_URL}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });
        const result = await res.json();
        if (!res.ok) {
          showToast(result.message || 'Double-booking check failed', 'danger');
          return;
        }
        showToast('Checkout successful');
      } catch (err) {
        showToast('Connection error processing checkout', 'danger');
      }
    }
    
    // Close, reset form, and revert dynamic selects to single row
    closeModal('modal-checkout');
    e.target.reset();
    
    const listContainer = document.getElementById('checkout-gear-list');
    if (listContainer) {
      const rows = listContainer.querySelectorAll('.gear-select-row');
      for (let i = 1; i < rows.length; i++) {
        rows[i].remove();
      }
      const singleRemove = listContainer.querySelector('.btn-remove-gear');
      if (singleRemove) singleRemove.style.display = 'none';
    }
    
    await refreshData();
  });
}

// --- Dynamic Check-In (Return Gear) ---
async function returnGear(bookingId) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/return`, {
      method: 'PUT'
    });
    if (!res.ok) throw new Error('API Error');
    showToast('Gear checked back into inventory');
  } catch (err) {
    showToast('Error updating return', 'danger');
  }
  await refreshData();
}

// --- Cancel Future Booking ---
async function cancelBookingAction(bookingId) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/cancel`, {
      method: 'PUT'
    });
    if (!res.ok) throw new Error('API Error');
    showToast('Booking cancelled successfully');
  } catch (err) {
    showToast('Error cancelling booking', 'danger');
  }
  await refreshData();
}

// --- Toggle Maintenance Mode ---
async function toggleMaintenance(gearId) {
  const item = state.gear.find(g => g.id === gearId);
  if (!item) return;

  const newStatus = item.status === 'Maintenance' ? 'Available' : 'Maintenance';
  
  try {
    const res = await fetch(`${API_BASE_URL}/gear/${gearId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('API Error');
    showToast(`Gear status updated to ${newStatus}`);
  } catch (err) {
    showToast('Error toggling maintenance status', 'danger');
  }
  await refreshData();
}

// --- UI Rendering Helpers ---

function updateStats() {
  const avail = state.gear.filter(g => g.status === 'Available').length;
  const rented = state.gear.filter(g => g.status === 'Rented').length;
  const maint = state.gear.filter(g => g.status === 'Maintenance').length;
  
  // Calculate overdue (Active rental where end date is in the past)
  const todayStr = new Date().toISOString().split('T')[0];
  const overdue = state.bookings.filter(b => b.status === 'Active' && b.endDate < todayStr).length;

  document.getElementById('stat-avail-count').innerText = avail;
  document.getElementById('stat-rented-count').innerText = rented;
  document.getElementById('stat-maint-count').innerText = maint;
  document.getElementById('stat-overdue-count').innerText = overdue;
  
  document.getElementById('active-rentals-badge').innerText = `${rented} active`;
}

function renderDashboardRentals(query = '') {
  const tbody = document.getElementById('dashboard-rentals-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  let activeBookings = state.bookings.filter(b => b.status === 'Active');
  
  if (query) {
    activeBookings = activeBookings.filter(booking => {
      const item = state.gear.find(g => g.id === booking.gearId) || { name: '', serialNumber: '' };
      const client = state.clients.find(c => c.id === booking.clientId) || { name: '' };
      return item.name.toLowerCase().includes(query) ||
             item.serialNumber.toLowerCase().includes(query) ||
             client.name.toLowerCase().includes(query);
    });
  }
  
  if (activeBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">${query ? 'No matching rentals found.' : 'No items checked out. All gear is secure.'}</td></tr>`;
    return;
  }
  
  const todayStr = new Date().toISOString().split('T')[0];

  activeBookings.forEach(booking => {
    const item = state.gear.find(g => g.id === booking.gearId) || { name: 'Unknown Gear', serialNumber: '' };
    const client = state.clients.find(c => c.id === booking.clientId) || { name: 'Unknown Client' };
    const isOverdue = booking.endDate < todayStr;
    const isFuture = booking.startDate > todayStr;
    const statusClass = isOverdue ? 'overdue' : (isFuture ? 'booked' : 'rented');
    const statusText = isOverdue ? 'Overdue' : (isFuture ? 'Booked' : 'Active');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.name}</strong><br><small style="color:var(--text-muted)">${item.serialNumber}</small></td>
      <td>${client.name}</td>
      <td>${booking.startDate}</td>
      <td>${booking.endDate}</td>
      <td><span class="status-pill ${statusClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

function renderInventory(filter = 'all', query = '') {
  const tbody = document.getElementById('inventory-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  let items = state.gear;
  if (filter !== 'all') {
    items = state.gear.filter(g => g.status === filter);
  }
  
  if (query) {
    items = items.filter(g =>
      g.name.toLowerCase().includes(query) ||
      (g.assetTag || '').toLowerCase().includes(query) ||
      g.serialNumber.toLowerCase().includes(query) ||
      g.category.toLowerCase().includes(query)
    );
  }
  
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">${query ? 'No matching gear found.' : 'No gear matches this filter.'}</td></tr>`;
    return;
  }

  items.forEach(item => {
    const statusClass = item.status.toLowerCase();
    const actionText = item.status === 'Maintenance' ? 'Put In Service' : 'Send to Repair';
    const actionIcon = item.status === 'Maintenance' ? 'check-circle' : 'wrench';
    
    // Disable check-out toggle if rented out
    const toggleButton = item.status === 'Rented' 
      ? `<span style="font-size: 0.75rem; color: var(--text-muted)">Rented Out</span>` 
      : `<button class="btn btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.75rem" onclick="toggleMaintenance('${item.id}')">
          <i data-lucide="${actionIcon}" style="width:12px; height:12px"></i> ${actionText}
         </button>`;

    // Modify column: Edit always available; Delete blocked if Rented or Overdue
    const isInUse = item.status === 'Rented';
    const deleteBtn = isInUse
      ? `<button class="btn btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; opacity:0.4; cursor:not-allowed;" disabled title="Cannot delete — gear is currently rented out">
           <i data-lucide="trash-2" style="width:12px; height:12px"></i> Delete
         </button>`
      : `<button class="btn btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; color: var(--color-danger); border-color: rgba(239,68,68,0.3);" onclick="deleteGear('${item.id}')" title="Delete gear">
           <i data-lucide="trash-2" style="width:12px; height:12px"></i> Delete
         </button>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td>${item.category}</td>
      <td><code>${item.assetTag || '—'}</code></td>
      <td><code>${item.serialNumber}</code></td>
      <td>GH₵${item.dailyRate}/day</td>
      <td><span class="status-pill ${statusClass}">${item.status}</span></td>
      <td>${toggleButton}</td>
      <td>
        <div style="display:flex; gap:0.4rem; align-items:center;">
          <button class="btn btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.75rem;" onclick="editGear('${item.id}')" title="Edit gear">
            <i data-lucide="pencil" style="width:12px; height:12px"></i> Edit
          </button>
          ${deleteBtn}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

// Setup inventory filter tabs
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    // Only target the inventory filter tabs
    if (tab.closest('#rentals-filter-bar')) return;
    document.querySelectorAll('.view-panel#view-inventory .filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const filter = tab.getAttribute('data-filter');
    renderInventory(filter);
  });
});

// Helper to determine active, overdue, returned, booked, or cancelled status
function getBookingStatus(booking) {
  if (booking.status === 'Returned') return 'Returned';
  if (booking.status === 'Cancelled') return 'Cancelled';
  const todayStr = new Date().toISOString().split('T')[0];
  if (booking.startDate > todayStr) return 'Booked';
  if (booking.endDate < todayStr) return 'Overdue';
  return 'Active';
}

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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">${query ? 'No matching rental records found.' : 'No rental records found.'}</td></tr>`;
    return;
  }

  bookings.forEach(booking => {
    const item = state.gear.find(g => g.id === booking.gearId) || { name: 'Unknown Gear', dailyRate: 0 };
    const client = state.clients.find(c => c.id === booking.clientId) || { name: 'Unknown Client' };
    
    const calculatedStatus = getBookingStatus(booking);
    const statusClass = calculatedStatus.toLowerCase();

    let actionButton = '—';
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

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${client.name}</strong></td>
      <td><strong>${item.name}</strong></td>
      <td>${booking.startDate} to ${booking.endDate}</td>
      <td>GH₵${item.dailyRate}/day</td>
      <td><span class="status-pill ${statusClass}">${calculatedStatus}</span></td>
      <td>${actionButton}</td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

function renderClients(query = '') {
  const container = document.getElementById('clients-list');
  if (!container) return;
  container.innerHTML = '';
  
  let clients = state.clients;
  
  if (query) {
    clients = clients.filter(client => 
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      client.phone.toLowerCase().includes(query)
    );
  }
  
  if (clients.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted); grid-column: 1/-1;">${query ? 'No matching clients found.' : 'No clients registered.'}</p>`;
    return;
  }

  clients.forEach(client => {
    const initials = client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <div class="client-header">
        <div class="client-avatar">${initials}</div>
        <div class="client-name-box">
          <h3>${client.name}</h3>
          <span>ID: ${client.id}</span>
        </div>
      </div>
      <div class="client-details">
        <div class="client-detail-item"><i data-lucide="mail"></i> <span>${client.email}</span></div>
        <div class="client-detail-item"><i data-lucide="phone"></i> <span>${client.phone}</span></div>
      </div>
      <div class="client-actions">
        <button class="btn btn-secondary" style="padding: 0.4rem 0.85rem; font-size: 0.78rem;" onclick="editClient('${client.id}')">
          <i data-lucide="pencil" style="width:13px; height:13px"></i> Edit
        </button>
        <button class="btn btn-secondary" style="padding: 0.4rem 0.85rem; font-size: 0.78rem; color: var(--color-danger); border-color: rgba(239,68,68,0.3);" onclick="deleteClient('${client.id}')">
          <i data-lucide="trash-2" style="width:13px; height:13px"></i> Delete
        </button>
      </div>
    `;
    container.appendChild(card);
  });
  lucide.createIcons();
}

function renderCategoryChart() {
  const chartContainer = document.getElementById('dashboard-category-chart');
  if (!chartContainer) return;
  chartContainer.innerHTML = '';
  
  const categories = {};
  state.gear.forEach(g => {
    categories[g.category] = (categories[g.category] || 0) + 1;
  });
  
  const total = state.gear.length || 1;

  Object.entries(categories).forEach(([name, count]) => {
    const percentage = Math.round((count / total) * 100);
    const item = document.createElement('div');
    item.className = 'category-item';
    item.innerHTML = `
      <div class="category-info">
        <span class="category-name">${name}</span>
        <span class="category-count">${count} (${percentage}%)</span>
      </div>
      <div class="category-bar-wrapper">
        <div class="category-bar" style="width: ${percentage}%"></div>
      </div>
    `;
    chartContainer.appendChild(item);
  });
}

// --- Search Filter Logic ---
function setupSearch() {
  const searchInput = document.getElementById('global-search');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    // Dynamic tab-aware UI filtering
    renderDashboardRentals(query);
    renderInventory('all', query);
    renderRentalsList(query);
    renderClients(query);
  });
}

// --- Toast Notifications ---
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-notification');
  const toastMsg = document.getElementById('toast-message');
  
  if (!toast || !toastMsg) return;
  
  toastMsg.innerText = message;
  toast.className = 'toast';
  if (type === 'danger') {
    toast.style.borderColor = 'var(--color-danger)';
  } else {
    toast.style.borderColor = 'var(--color-primary)';
  }
  
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// --- Dynamic Row Management for New Rental Form ---
function setupCheckoutFormDynamicRows() {
  const addBtn = document.getElementById('btn-add-gear-row');
  const listContainer = document.getElementById('checkout-gear-list');
  
  if (!addBtn || !listContainer) return;
  
  addBtn.addEventListener('click', () => {
    const firstRow = listContainer.querySelector('.gear-select-row');
    if (!firstRow) return;
    
    // Clone row
    const newRow = firstRow.cloneNode(true);
    
    // Clear selection
    const select = newRow.querySelector('.checkout-gear-select');
    select.value = '';
    
    // Show remove button
    const removeBtn = newRow.querySelector('.btn-remove-gear');
    removeBtn.style.display = 'block';
    
    listContainer.appendChild(newRow);
    
    // Populate select lists
    populateCheckoutDropdowns();
    
    updateRemoveButtonsState();
    lucide.createIcons();
  });
  
  // Remove button event delegation
  listContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-remove-gear');
    if (!btn) return;
    
    const row = btn.closest('.gear-select-row');
    if (row) {
      row.remove();
      updateRemoveButtonsState();
      populateCheckoutDropdowns();
    }
  });

  // Re-populate when selections change to apply dynamic mutual exclusion
  listContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('checkout-gear-select')) {
      populateCheckoutDropdowns();
    }
  });

  function updateRemoveButtonsState() {
    const rows = listContainer.querySelectorAll('.gear-select-row');
    rows.forEach(row => {
      const removeBtn = row.querySelector('.btn-remove-gear');
      if (rows.length > 1) {
        removeBtn.style.display = 'block';
      } else {
        removeBtn.style.display = 'none';
      }
    });
  }
}

// --- Status Filter Management for Rentals Tab ---
function setupRentalsFilter() {
  const filterBar = document.getElementById('rentals-filter-bar');
  if (!filterBar) return;
  
  filterBar.addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    
    filterBar.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    activeRentalsFilter = tab.getAttribute('data-rent-filter');
    refreshData();
  });
}

// --- Client Edit & Delete Actions ---

function editClient(id) {
  const client = state.clients.find(c => c.id === id);
  if (!client) return;

  document.getElementById('edit-client-id').value = client.id;
  document.getElementById('edit-client-name').value = client.name;
  document.getElementById('edit-client-email').value = client.email;
  document.getElementById('edit-client-phone').value = client.phone;

  openModal('modal-edit-client');
}

async function deleteClient(id) {
  const client = state.clients.find(c => c.id === id);
  if (!client) return;

  // Block deletion if client has any Active or Booked rentals
  const hasActiveBookings = state.bookings.some(b =>
    b.clientId === id && (b.status === 'Active' || b.status === 'Booked' ||
      // Also catch future bookings stored without explicit 'Booked' status
      (b.status !== 'Returned' && b.status !== 'Cancelled' &&
        new Date(b.endDate) >= new Date(new Date().toISOString().split('T')[0]))
    )
  );

  if (hasActiveBookings) {
    showToast(`Cannot delete "${client.name}" — they have active or upcoming rentals.`, 'danger');
    return;
  }

  const confirmed = window.confirm(`Delete client "${client.name}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE_URL}/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Error deleting client', 'danger');
      return;
    }
    showToast('Client removed from database');
  } catch (err) {
    showToast('Error deleting client', 'danger');
    return;
  }
  await refreshData();
}

// --- Gear Edit & Delete Actions ---

function editGear(id) {
  const item = state.gear.find(g => g.id === id);
  if (!item) return;

  document.getElementById('edit-gear-id').value = item.id;
  document.getElementById('edit-gear-name').value = item.name;
  document.getElementById('edit-gear-asset-tag').value = item.assetTag || '';
  document.getElementById('edit-gear-category').value = item.category;
  document.getElementById('edit-gear-serial').value = item.serialNumber;
  document.getElementById('edit-gear-rate').value = item.dailyRate;

  openModal('modal-edit-gear');
}

async function deleteGear(id) {
  const item = state.gear.find(g => g.id === id);
  if (!item) return;

  // Block if gear is currently rented out or overdue
  const todayStr = new Date().toISOString().split('T')[0];
  const isBlocked = state.bookings.some(b =>
    b.gearId === id &&
    b.status !== 'Returned' &&
    b.status !== 'Cancelled' &&
    b.endDate >= todayStr
  );

  if (isBlocked) {
    showToast(`Cannot delete "${item.name}" — it is currently rented out or overdue.`, 'danger');
    return;
  }

  const confirmed = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE_URL}/gear/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Error deleting gear', 'danger');
      return;
    }
    showToast('Gear removed from database');
  } catch (err) {
    showToast('Error deleting gear', 'danger');
    return;
  }
  await refreshData();
}
