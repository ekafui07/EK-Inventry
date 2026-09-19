/**
 * EK GearFlow - Frontend Application Orchestrator
 * Integrates domain modules: utils, api, inventory, clients, rentals, staff, and audit.
 */

// Application State
let state = {
  gear: [],
  clients: [],
  bookings: [],
  users: [],
  auditLogs: []
};
window.state = state;

let currentUser = null; // Currently logged in user session
window.currentUser = currentUser;

let activeTab = 'dashboard';
let activeRentalsFilter = 'all';
let activeAuditCategory = 'All';

// Form Sanitization & Reset Helper (Preserved for test-frontend-checks compliance)
function clearModalForm(modalOrId) {
  const modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
  if (!modal) return;
  const form = modal.querySelector('form');
  if (form) {
    form.reset();
    form.querySelectorAll('input, textarea').forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = el.defaultChecked || false;
      } else if (el.type !== 'submit' && el.type !== 'button' && el.type !== 'hidden') {
        el.value = '';
        el.removeAttribute('value');
      }
    });
    form.querySelectorAll('select').forEach(el => {
      el.selectedIndex = 0;
    });
  }
}
window.clearModalForm = clearModalForm;

// High-Fidelity Printable Invoice Generator (btn-print-invoice)
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
  const status = typeof getBookingStatus === 'function' ? getBookingStatus(booking) : 'Active';

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

// Expose action functions to global scope immediately for inline onclick= handlers
window.toggleMaintenance = toggleMaintenance;
window.returnGear = returnGear;
window.cancelBookingAction = cancelBookingAction;
window.editGear = editGear;
window.deleteGear = deleteGear;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.editUser = editUser;
window.deleteUserAction = deleteUserAction;
window.resetUserPasswordAction = resetUserPasswordAction;
window.toggleUserStatusAction = toggleUserStatusAction;

// Permissions Helpers
function hasPermission(permKey) {
  if (!currentUser) return false;
  if (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin')) return true;
  const perms = currentUser.permissions || [];
  return perms.includes(permKey);
}
window.hasPermission = hasPermission;

function applyPermissions() {
  if (!currentUser) return;
  const isAdmin = currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin');
  const isAuditAdmin = currentUser && currentUser.email && currentUser.email.toLowerCase() === 'admin@ekgearflow.com';

  const navUsers = document.getElementById('nav-users');
  if (navUsers) {
    navUsers.style.display = isAdmin ? 'flex' : 'none';
  }

  const navAudit = document.getElementById('nav-audit');
  if (navAudit) {
    navAudit.style.display = isAuditAdmin ? 'flex' : 'none';
  }

  if (!isAdmin && activeTab === 'users') {
    activeTab = 'dashboard';
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.toggle('active', nav.getAttribute('data-tab') === 'dashboard');
    });
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'view-dashboard');
    });
  }

  if (!isAuditAdmin && activeTab === 'audit') {
    activeTab = 'dashboard';
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.toggle('active', nav.getAttribute('data-tab') === 'dashboard');
    });
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'view-dashboard');
    });
  }

  const btnAddGear = document.getElementById('btn-add-gear');
  if (btnAddGear) {
    btnAddGear.style.display = hasPermission('manage_gear') ? 'inline-flex' : 'none';
  }

  const btnAddGearInv = document.getElementById('btn-add-gear-inventory');
  if (btnAddGearInv) {
    btnAddGearInv.style.display = hasPermission('manage_gear') ? 'inline-flex' : 'none';
  }

  const btnAddClient = document.getElementById('btn-add-client');
  if (btnAddClient) {
    btnAddClient.style.display = hasPermission('manage_clients') ? 'inline-flex' : 'none';
  }

  const btnQuickRent = document.getElementById('btn-quick-rent');
  if (btnQuickRent) {
    btnQuickRent.style.display = hasPermission('create_rentals') ? 'inline-flex' : 'none';
  }
}
window.applyPermissions = applyPermissions;

// Statistics & Metrics
function updateStats() {
  const avail = state.gear.filter(g => g.status === 'Available').length;
  const rented = state.gear.filter(g => g.status === 'Rented').length;
  const maint = state.gear.filter(g => g.status === 'Maintenance').length;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const overdue = state.bookings.filter(b => (b.status === 'Active' || !b.status) && b.endDate < todayStr).length;

  const elAvail = document.getElementById('stat-avail-count');
  const elRented = document.getElementById('stat-rented-count');
  const elMaint = document.getElementById('stat-maint-count');
  const elOverdue = document.getElementById('stat-overdue-count');
  const elBadge = document.getElementById('active-rentals-badge');

  if (elAvail) elAvail.innerText = avail;
  if (elRented) elRented.innerText = rented;
  if (elMaint) elMaint.innerText = maint;
  if (elOverdue) elOverdue.innerText = overdue;
  if (elBadge) elBadge.innerText = `${rented} active`;
}
window.updateStats = updateStats;

// Category Chart
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
        <span class="category-name">${escapeHtmlText(name)}</span>
        <span class="category-count">${count} (${percentage}%)</span>
      </div>
      <div class="category-bar-wrapper">
        <div class="category-bar" style="width: ${percentage}%"></div>
      </div>
    `;
    chartContainer.appendChild(item);
  });
}
window.renderCategoryChart = renderCategoryChart;

// Dynamic Checkout Dropdown Sync
function populateCheckoutDropdowns() {
  const gearSelects = document.querySelectorAll('.checkout-gear-select');
  const clientSelect = document.getElementById('checkout-client');
  if (!clientSelect) return;
  
  const currentClientVal = clientSelect.value;
  clientSelect.innerHTML = '<option value="" disabled selected>Select client...</option>';
  state.clients.forEach(client => {
    const opt = document.createElement('option');
    opt.value = client.id;
    opt.innerText = client.name;
    if (client.id === currentClientVal) opt.selected = true;
    clientSelect.appendChild(opt);
  });

  const allSelectedValues = Array.from(document.querySelectorAll('.checkout-gear-select'))
    .map(s => s.value)
    .filter(val => val);

  gearSelects.forEach(gearSelect => {
    const currentValue = gearSelect.value;
    gearSelect.innerHTML = '<option value="" disabled selected>Choose available gear...</option>';
    
    const otherSelectedValues = allSelectedValues.filter(val => val !== currentValue);
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
window.populateCheckoutDropdowns = populateCheckoutDropdowns;

// Data Fetch & Synchronization
async function refreshData(query = '') {
  try {
    await syncLiveUserProfile();
    const isAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
    const isAuditAdmin = currentUser && currentUser.email && currentUser.email.toLowerCase() === 'admin@ekgearflow.com';
    const requests = [
      fetch(`${API_URL}/gear`),
      fetch(`${API_URL}/clients`),
      fetch(`${API_URL}/bookings`)
    ];
    if (isAdmin) {
      requests.push(fetch(`${API_URL}/users`));
    }
    if (isAuditAdmin) {
      requests.push(fetch(`${API_URL}/audit-logs`));
    }

    const responses = await Promise.all(requests);
    const gearRes = responses[0];
    const clientsRes = responses[1];
    const bookingsRes = responses[2];
    let nextIdx = 3;
    const usersRes = isAdmin ? responses[nextIdx++] : null;
    const auditRes = isAuditAdmin ? responses[nextIdx++] : null;

    if (!gearRes.ok || !clientsRes.ok || !bookingsRes.ok) {
      throw new Error('Server returned an error');
    }

    state.gear = await gearRes.json();
    state.clients = await clientsRes.json();
    state.bookings = await bookingsRes.json();
    if (usersRes && usersRes.ok) {
      state.users = await usersRes.json();
    } else if (!isAdmin) {
      state.users = [];
    }

    if (auditRes && auditRes.ok) {
      const auditData = await auditRes.json();
      state.auditLogs = auditData.auditLogs || [];
    } else if (!isAuditAdmin) {
      state.auditLogs = [];
    }
  } catch (err) {
    console.error('Data synchronization error:', err);
    showToast('Unable to synchronize data with backend server. Please check your connection.', 'danger');
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
  
  updateStats();
  renderDashboardRentals(query);
  renderInventory(window.activeInventoryFilter || 'all', query);
  renderRentalsList(query);
  renderClients(query);
  renderUsers(query);
  renderAuditTrail(activeAuditCategory, query);
  populateCheckoutDropdowns();
  renderCategoryChart();
  applyPermissions();
}
window.refreshData = refreshData;

// Navigation & Tab Switching
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      const isAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
      const isAuditAdmin = currentUser && currentUser.email && currentUser.email.toLowerCase() === 'admin@ekgearflow.com';

      if (targetTab === 'users' && !isAdmin) return;
      if (targetTab === 'audit' && !isAuditAdmin) return;

      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      activeTab = targetTab;
      const searchEl = document.getElementById('global-search');
      if (searchEl) searchEl.value = '';

      viewPanels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `view-${targetTab}`) {
          panel.classList.add('active');
        }
      });

      refreshData();
    });
  });
}

// Modal Trigger Setup
function setupModals() {
  const modalTriggers = [
    { trigger: 'btn-add-gear', modal: 'modal-add-gear' },
    { trigger: 'btn-add-gear-inventory', modal: 'modal-add-gear' },
    { trigger: 'btn-add-client', modal: 'modal-add-client' },
    { trigger: 'btn-add-user', modal: 'modal-add-user' },
    { trigger: 'btn-quick-rent', modal: 'modal-checkout' }
  ];
  
  modalTriggers.forEach(({ trigger, modal }) => {
    const btn = document.getElementById(trigger);
    if (btn) {
      btn.addEventListener('click', () => {
        clearModalForm(modal);
        openModal(modal);
      });
    }
  });

  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    if (modal.id === 'modal-force-change-password') return;

    modal.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => closeModal(modal.id));
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  const printBtn = document.getElementById('btn-trigger-print');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

// Form Handlers
function setupForms() {
  // Add Gear
  const formAddGear = document.getElementById('form-add-gear');
  if (formAddGear) {
    formAddGear.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!hasPermission('manage_gear')) {
        showToast('Permission Denied: You do not have permission to add gear.', 'danger');
        return;
      }
      const gearData = {
        name: document.getElementById('gear-name').value.trim(),
        assetTag: document.getElementById('gear-asset-tag').value.trim().toUpperCase(),
        category: document.getElementById('gear-category').value.trim(),
        serialNumber: document.getElementById('gear-serial').value.trim(),
        dailyRate: Number(document.getElementById('gear-rate').value),
        status: 'Available'
      };

      const valErr = validateGearPayload(gearData);
      if (valErr) {
        showToast(valErr, 'danger');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/gear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gearData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error registering gear');
        }
        showToast('Gear registered in database');
      } catch (err) {
        showToast(err.message, 'danger');
        return;
      }
      clearModalForm('modal-add-gear');
      closeModal('modal-add-gear');
      await refreshData();
    });
  }

  // Edit Gear
  const formEditGear = document.getElementById('form-edit-gear');
  if (formEditGear) {
    formEditGear.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!hasPermission('manage_gear')) {
        showToast('Permission Denied: You do not have permission to edit gear.', 'danger');
        return;
      }
      const id = document.getElementById('edit-gear-id').value;
      const gearData = {
        name: document.getElementById('edit-gear-name').value.trim(),
        assetTag: document.getElementById('edit-gear-asset-tag').value.trim().toUpperCase(),
        category: document.getElementById('edit-gear-category').value.trim(),
        serialNumber: document.getElementById('edit-gear-serial').value.trim(),
        dailyRate: Number(document.getElementById('edit-gear-rate').value)
      };

      const valErr = validateGearPayload(gearData, id);
      if (valErr) {
        showToast(valErr, 'danger');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/gear/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gearData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error updating gear');
        }
        showToast('Gear updated in database');
      } catch (err) {
        showToast(err.message, 'danger');
        return;
      }
      closeModal('modal-edit-gear');
      e.target.reset();
      await refreshData();
    });
  }

  // Add Client
  const formAddClient = document.getElementById('form-add-client');
  if (formAddClient) {
    formAddClient.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!hasPermission('manage_clients')) {
        showToast('Permission Denied: You do not have permission to add clients.', 'danger');
        return;
      }
      const clientData = {
        name: document.getElementById('client-name').value.trim(),
        email: document.getElementById('client-email').value.trim(),
        phone: document.getElementById('client-phone').value.trim()
      };

      const valErr = validateClientPayload(clientData);
      if (valErr) {
        showToast(valErr, 'danger');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/clients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error storing client');
        }
        showToast('Client stored in database');
      } catch (err) {
        showToast(err.message, 'danger');
        return;
      }
      clearModalForm('modal-add-client');
      closeModal('modal-add-client');
      await refreshData();
    });
  }

  // Edit Client
  const formEditClient = document.getElementById('form-edit-client');
  if (formEditClient) {
    formEditClient.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!hasPermission('manage_clients')) {
        showToast('Permission Denied: You do not have permission to edit clients.', 'danger');
        return;
      }
      const id = document.getElementById('edit-client-id').value;
      const clientData = {
        name: document.getElementById('edit-client-name').value.trim(),
        email: document.getElementById('edit-client-email').value.trim(),
        phone: document.getElementById('edit-client-phone').value.trim()
      };

      const valErr = validateClientPayload(clientData, id);
      if (valErr) {
        showToast(valErr, 'danger');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/clients/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error updating client');
        }
        showToast('Client updated in database');
      } catch (err) {
        showToast(err.message, 'danger');
        return;
      }
      closeModal('modal-edit-client');
      e.target.reset();
      await refreshData();
    });
  }

  // Checkout Form
  const formCheckout = document.getElementById('form-checkout');
  if (formCheckout) {
    formCheckout.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!hasPermission('create_rentals')) {
        showToast('Permission Denied: You do not have permission to process checkouts.', 'danger');
        return;
      }
      
      const gearSelects = document.querySelectorAll('.checkout-gear-select');
      const gearIds = Array.from(gearSelects).map(s => s.value).filter(val => val);

      const bookingData = {
        gearIds: gearIds,
        clientId: document.getElementById('checkout-client').value,
        startDate: document.getElementById('checkout-start').value,
        endDate: document.getElementById('checkout-end').value,
        status: 'Active'
      };

      if (!bookingData.clientId) {
        showToast('Please select a registered client.', 'danger');
        return;
      }
      if (!bookingData.gearIds || bookingData.gearIds.length === 0) {
        showToast('Please select at least one gear item for checkout.', 'danger');
        return;
      }
      if (!bookingData.startDate || !bookingData.endDate) {
        showToast('Both start date and end date are required.', 'danger');
        return;
      }
      if (new Date(bookingData.startDate) > new Date(bookingData.endDate)) {
        showToast('Rental start date cannot be after the return date.', 'danger');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });
        const result = await res.json();
        if (!res.ok) {
          showToast(result.message || result.error || 'Double-booking check failed', 'danger');
          return;
        }
        showToast('Checkout processed successfully');
      } catch (err) {
        showToast('Connection error processing checkout', 'danger');
        return;
      }
      
      clearModalForm('modal-checkout');
      closeModal('modal-checkout');
      
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

  // Add User
  const formAddUser = document.getElementById('form-add-user');
  if (formAddUser) {
    formAddUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!hasPermission('manage_users')) {
        showToast('Permission Denied: You do not have permission to manage users.', 'danger');
        return;
      }
      const accountType = document.getElementById('user-account-type').value;
      const isAdmin = accountType === 'Admin';
      const checkedPerms = isAdmin
        ? ['manage_gear', 'manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals', 'manage_users']
        : Array.from(document.querySelectorAll('input[name="add-perm"]:checked'))
            .map(c => c.value)
            .filter(p => p !== 'manage_users');
      if (checkedPerms.includes('return_rentals') && !checkedPerms.includes('cancel_rentals')) {
        checkedPerms.push('cancel_rentals');
      }

      const userData = {
        name: document.getElementById('user-name').value.trim(),
        email: document.getElementById('user-email').value.trim(),
        title: document.getElementById('user-title').value.trim(),
        accountType: accountType,
        permissions: checkedPerms,
        password: '12345',
        mustChangePassword: true
      };

      const valErr = validateUserPayload(userData);
      if (valErr) {
        showToast(valErr, 'danger');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error creating account');
        }
        showToast('Staff account created (Default Password: 12345)');
      } catch (err) {
        showToast(err.message, 'danger');
        return;
      }
      clearModalForm('modal-add-user');
      closeModal('modal-add-user');
      await refreshData();
    });
  }

  // Edit User
  const formEditUser = document.getElementById('form-edit-user');
  if (formEditUser) {
    formEditUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!hasPermission('manage_users')) {
        showToast('Permission Denied: You do not have permission to manage users.', 'danger');
        return;
      }
      const id = document.getElementById('edit-user-id').value;
      const accountType = document.getElementById('edit-user-account-type').value;
      const isAdmin = accountType === 'Admin';
      const checkedPerms = isAdmin
        ? ['manage_gear', 'manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals', 'manage_users']
        : Array.from(document.querySelectorAll('input[name="edit-perm"]:checked'))
            .map(c => c.value)
            .filter(p => p !== 'manage_users');
      if (checkedPerms.includes('return_rentals') && !checkedPerms.includes('cancel_rentals')) {
        checkedPerms.push('cancel_rentals');
      }

      const userData = {
        name: document.getElementById('edit-user-name').value.trim(),
        email: document.getElementById('edit-user-email').value.trim(),
        title: document.getElementById('edit-user-title').value.trim(),
        accountType: accountType,
        permissions: checkedPerms
      };

      const valErr = validateUserPayload(userData, id);
      if (valErr) {
        showToast(valErr, 'danger');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error updating staff profile');
        }
        const updatedStaff = await res.json();

        if (currentUser && currentUser.id === id) {
          currentUser = {
            ...currentUser,
            ...updatedStaff,
            token: updatedStaff.token || currentUser.token
          };
          window.currentUser = currentUser;
          sessionStorage.setItem('EK_CURRENT_USER', JSON.stringify(currentUser));
          updateSidebarUserProfile();
          applyPermissions();
        }

        showToast(`Profile updated: ${updatedStaff.name} is now ${updatedStaff.accountType}`);
      } catch (err) {
        showToast(err.message || 'Error updating staff profile', 'danger');
        return;
      }
      closeModal('modal-edit-user');
      e.target.reset();
      await refreshData();
    });
  }
}

// Authentication Handlers
function setupAuth() {
  const toggleBtns = document.querySelectorAll('.login-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.getAttribute('data-login-type');
      document.getElementById('login-account-type').value = type;
    });
  });

  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const accountType = document.getElementById('login-account-type').value;

      try {
        const res = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, accountType })
        });
        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || 'Login failed', 'danger');
          return;
        }

        currentUser = data;
        window.currentUser = currentUser;
        sessionStorage.setItem('EK_CURRENT_USER', JSON.stringify(currentUser));

        document.querySelector('.app-container').style.display = 'flex';
        document.getElementById('login-screen-overlay').style.display = 'none';

        updateSidebarUserProfile();

        if (currentUser.mustChangePassword) {
          openModal('modal-force-change-password');
        }

        showToast(`Welcome back, ${currentUser.name}!`);
        applyPermissions();
        await refreshData();
      } catch (err) {
        showToast('Error connecting to backend API', 'danger');
      }
    });
  }

  const formForcePass = document.getElementById('form-force-change-password');
  if (formForcePass) {
    formForcePass.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPass = document.getElementById('force-new-password').value;
      const confirmPass = document.getElementById('force-confirm-password').value;

      if (newPass !== confirmPass) {
        showToast('Passwords do not match', 'danger');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/users/${currentUser.id}/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword: newPass })
        });
        const updatedUser = await res.json();
        if (!res.ok) throw new Error(updatedUser.error || 'Error updating password');

        currentUser = {
          ...currentUser,
          ...updatedUser,
          token: updatedUser.token || currentUser.token
        };
        window.currentUser = currentUser;
        sessionStorage.setItem('EK_CURRENT_USER', JSON.stringify(currentUser));

        closeModal('modal-force-change-password');
        e.target.reset();
        showToast('Password updated successfully! Welcome to EK GearFlow.');
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      currentUser = null;
      window.currentUser = null;
      sessionStorage.removeItem('EK_CURRENT_USER');
      document.querySelector('.app-container').style.display = 'none';
      document.getElementById('login-screen-overlay').style.display = 'grid';
      showToast('Logged out successfully');
    });
  }
}

async function syncLiveUserProfile() {
  if (!currentUser || !currentUser.token) return;
  try {
    const res = await fetch(`${API_URL}/auth/me`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        const live = data.user;
        let changed = false;
        if (JSON.stringify(currentUser.permissions || []) !== JSON.stringify(live.permissions || [])) {
          currentUser.permissions = live.permissions || [];
          changed = true;
        }
        if (currentUser.role !== live.role) {
          currentUser.role = live.role;
          changed = true;
        }
        if (currentUser.accountType !== live.accountType) {
          currentUser.accountType = live.accountType;
          changed = true;
        }
        if (changed) {
          window.currentUser = currentUser;
          sessionStorage.setItem('EK_CURRENT_USER', JSON.stringify(currentUser));
          updateSidebarUserProfile();
          applyPermissions();
          if (typeof renderInventory === 'function') renderInventory();
          if (typeof renderClients === 'function') renderClients();
        }
      }
    }
  } catch (err) {}
}
window.syncLiveUserProfile = syncLiveUserProfile;

function checkAuthSession() {
  const saved = sessionStorage.getItem('EK_CURRENT_USER');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      window.currentUser = currentUser;
      if (currentUser && (currentUser.accountType === 'Admin' || currentUser.role === 'admin')) {
        if (!currentUser.title || currentUser.title === 'Operations Manager') {
          currentUser.title = 'Admin';
          sessionStorage.setItem('EK_CURRENT_USER', JSON.stringify(currentUser));
        }
      }
      document.querySelector('.app-container').style.display = 'flex';
      document.getElementById('login-screen-overlay').style.display = 'none';
      updateSidebarUserProfile();

      if (currentUser.mustChangePassword) {
        openModal('modal-force-change-password');
      }
      applyPermissions();
      syncLiveUserProfile();
    } catch (e) {
      currentUser = null;
      window.currentUser = null;
      document.querySelector('.app-container').style.display = 'none';
      document.getElementById('login-screen-overlay').style.display = 'grid';
    }
  } else {
    document.querySelector('.app-container').style.display = 'none';
    document.getElementById('login-screen-overlay').style.display = 'grid';
  }
}

// Global Search
function setupSearch() {
  const searchInput = document.getElementById('global-search');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    renderDashboardRentals(query);
    renderInventory(window.activeInventoryFilter || 'all', query);
    renderRentalsList(query);
    renderClients(query);
    renderUsers(query);
    renderAuditTrail(activeAuditCategory, query);
  });
}

// Theme Controller (Light / Dark Mode Layer)
function setupTheme() {
  const currentTheme = localStorage.getItem('EK_THEME') || 'dark';
  applyTheme(currentTheme);

  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = activeTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      try {
        localStorage.setItem('EK_THEME', newTheme);
      } catch (e) {}
    });
  }
}
window.setupTheme = setupTheme;

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeText = document.getElementById('theme-toggle-text');
  const iconDark = document.getElementById('icon-theme-dark');
  const iconLight = document.getElementById('icon-theme-light');
  
  if (themeText) {
    themeText.innerText = theme === 'light' ? 'Light Mode' : 'Dark Mode';
  }
  if (iconDark && iconLight) {
    if (theme === 'light') {
      iconDark.style.display = 'none';
      iconLight.style.display = 'inline-block';
    } else {
      iconDark.style.display = 'inline-block';
      iconLight.style.display = 'none';
    }
  }
  if (window.lucide) {
    lucide.createIcons();
  }
}
window.applyTheme = applyTheme;

// App Bootstrap
async function initApp() {
  setupTheme();
  setupAuth();
  setupNavigation();
  setupModals();
  setupForms();
  setupSearch();
  setupCheckoutFormDynamicRows();
  if (window.setupInventoryFilter) setupInventoryFilter();
  setupRentalsFilter();
  setupAuditTrail();

  checkAuthSession();

  if (currentUser !== null) {
    await refreshData();
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
