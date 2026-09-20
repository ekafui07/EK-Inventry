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
let activeFinanceDateStart = '';
let activeFinanceDateEnd = '';
let activeFinanceCat = 'all';

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

// NOTE: openRentalInvoice is defined in js/rentals.js (the domain module).
// Do NOT duplicate it here — rentals.js is the single source of truth.

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
  const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));

  const navUsers = document.getElementById('nav-users');
  if (navUsers) {
    navUsers.style.display = hasPermission('manage_users') ? 'flex' : 'none';
  }

  const navAudit = document.getElementById('nav-audit');
  if (navAudit) {
    navAudit.style.display = isAdmin ? 'flex' : 'none';
  }

  const navFinances = document.getElementById('nav-finances');
  if (navFinances) {
    navFinances.style.display = hasPermission('view_finances') ? 'flex' : 'none';
  }

  const navInvoice = document.getElementById('nav-invoice');
  if (navInvoice) {
    navInvoice.style.display = hasPermission('generate_invoices') ? 'flex' : 'none';
  }

  if (!hasPermission('manage_users') && activeTab === 'users') {
    activeTab = 'dashboard';
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.toggle('active', nav.getAttribute('data-tab') === 'dashboard');
    });
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'view-dashboard');
    });
  }

  if (!hasPermission('view_finances') && activeTab === 'finances') {
    activeTab = 'dashboard';
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.toggle('active', nav.getAttribute('data-tab') === 'dashboard');
    });
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'view-dashboard');
    });
  }

  if (!hasPermission('generate_invoices') && activeTab === 'invoice') {
    activeTab = 'dashboard';
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.toggle('active', nav.getAttribute('data-tab') === 'dashboard');
    });
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'view-dashboard');
    });
  }

  if (!isAdmin && activeTab === 'audit') {
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

// Finances Dashboard
function renderFinancesDashboard() {
  if (typeof hasPermission === 'function' && !hasPermission('view_finances')) return;

  const totalRevEl = document.getElementById('finance-total-revenue');
  const activeRevEl = document.getElementById('finance-active-revenue');
  const totalBookingsEl = document.getElementById('finance-total-bookings');
  const chartContainer = document.getElementById('finance-category-chart');
  const topEarnersTbody = document.getElementById('finance-top-earners');
  const catFilter = document.getElementById('finance-cat-filter');

  if (!totalRevEl || !chartContainer) return;

  // Populate category filter if empty
  if (catFilter && catFilter.options.length <= 1) {
    const uniqueCats = [...new Set(state.gear.map(g => g.category || 'Uncategorized'))].sort();
    uniqueCats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      catFilter.appendChild(opt);
    });
    catFilter.value = activeFinanceCat;
  }

  let totalRevenue = 0;
  let activeRevenue = 0;
  let totalCompletedBookings = 0;
  
  const categoryRevenue = {};
  const gearRevenue = {};

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  state.bookings.forEach(booking => {
    if (booking.status === 'Cancelled') return;

    const item = state.gear.find(g => g.id === booking.gearId);
    if (!item) return;

    // Apply Category Filter
    const cat = item.category || 'Uncategorized';
    if (activeFinanceCat !== 'all' && cat !== activeFinanceCat) return;

    const start = new Date(booking.startDate);
    
    // Apply Date Range Filter (Using Booking Start Date as the reference point)
    if (activeFinanceDateStart) {
      if (booking.startDate < activeFinanceDateStart) return;
    }
    if (activeFinanceDateEnd) {
      if (booking.startDate > activeFinanceDateEnd) return;
    }

    const end = new Date(booking.endDate);
    const diffTime = Math.abs(end - start);
    const durationDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
    const dailyRate = Number(item.dailyRate) || 0;
    const bookingRevenue = dailyRate * durationDays;

    totalRevenue += bookingRevenue;
    
    const todayStr = now.toISOString().split('T')[0];
    let computedStatus = booking.status;
    if (!computedStatus) {
      if (booking.startDate > todayStr) computedStatus = 'Booked';
      else if (booking.endDate < todayStr) computedStatus = 'Overdue';
      else computedStatus = 'Active';
    }

    if (computedStatus === 'Active' || computedStatus === 'Overdue') {
      activeRevenue += bookingRevenue;
    }

    if (computedStatus === 'Returned') {
      totalCompletedBookings++;
    }

    categoryRevenue[cat] = (categoryRevenue[cat] || 0) + bookingRevenue;

    if (!gearRevenue[item.id]) {
      gearRevenue[item.id] = { gear: item, revenue: 0, days: 0 };
    }
    gearRevenue[item.id].revenue += bookingRevenue;
    gearRevenue[item.id].days += durationDays;
  });

  totalRevEl.innerText = `GH₵${totalRevenue.toFixed(2)}`;
  activeRevEl.innerText = `GH₵${activeRevenue.toFixed(2)}`;
  totalBookingsEl.innerText = totalCompletedBookings;

  chartContainer.innerHTML = '';
  const totalCatRevenue = Object.values(categoryRevenue).reduce((a, b) => a + b, 0) || 1;
  
  const sortedCategories = Object.entries(categoryRevenue).sort((a, b) => b[1] - a[1]);

  sortedCategories.forEach(([name, rev]) => {
    if (rev === 0) return;
    const percentage = Math.round((rev / totalCatRevenue) * 100);
    const item = document.createElement('div');
    item.className = 'category-item';
    item.innerHTML = `
      <div class="category-info">
        <span class="category-name">${escapeHtmlText(name)}</span>
        <span class="category-count">GH₵${rev.toFixed(2)} (${percentage}%)</span>
      </div>
      <div class="category-bar-wrapper">
        <div class="category-bar" style="width: ${percentage}%"></div>
      </div>
    `;
    chartContainer.appendChild(item);
  });
  
  if (sortedCategories.length === 0 || totalRevenue === 0) {
     chartContainer.innerHTML = `<div style="text-align:center; color: var(--text-muted); padding: 1rem;">No revenue found for this filter.</div>`;
  }

  if (topEarnersTbody) {
    topEarnersTbody.innerHTML = '';
    const sortedGear = Object.values(gearRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    
    if (sortedGear.length === 0) {
      topEarnersTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No revenue data available.</td></tr>`;
    } else {
      sortedGear.forEach(itemData => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtmlText(itemData.gear.name)}</strong></td>
          <td><span class="status-badge status-active">${escapeHtmlText(itemData.gear.assetTag || '—')}</span></td>
          <td>${escapeHtmlText(itemData.gear.category || '—')}</td>
          <td style="text-align: right;">${itemData.days}</td>
          <td style="text-align: right;"><strong>GH₵${itemData.revenue.toFixed(2)}</strong></td>
        `;
        topEarnersTbody.appendChild(tr);
      });
    }
  }
}
window.renderFinancesDashboard = renderFinancesDashboard;
window.renderCategoryChart = renderCategoryChart;

function setupAutocomplete(searchInput, valueInput, listbox, getOptionsCb, renderOptionCb, getInputValueCb) {
  if (!searchInput || !valueInput || !listbox) return;
  if (searchInput.dataset.acBound === "true") return; // Prevent double binding
  searchInput.dataset.acBound = "true";

  function renderList(query) {
    const data = getOptionsCb(query);
    listbox.innerHTML = '';
    if (data.length === 0) {
      listbox.style.display = 'none';
      return;
    }
    
    data.forEach(item => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.innerHTML = renderOptionCb(item);
      div.onmousedown = (e) => {
        e.preventDefault(); // Prevent blur
        valueInput.value = item.id;
        searchInput.value = getInputValueCb ? getInputValueCb(item) : div.innerText.trim();
        listbox.style.display = 'none';
        const event = new Event('change');
        valueInput.dispatchEvent(event);
      };
      listbox.appendChild(div);
    });
    listbox.style.display = 'block';
  }

  searchInput.addEventListener('input', (e) => {
    valueInput.value = '';
    renderList(e.target.value.toLowerCase());
  });

  searchInput.addEventListener('focus', (e) => {
    if (!valueInput.value) {
      renderList(e.target.value.toLowerCase());
    }
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => { listbox.style.display = 'none'; }, 150);
  });
}

// Dynamic Checkout Dropdown Sync
function populateCheckoutDropdowns() {
  const clientSearch = document.getElementById('checkout-client-search');
  const clientValue = document.getElementById('checkout-client-value');
  const clientListbox = document.getElementById('checkout-client-listbox');
  
  if (clientSearch && clientValue && clientListbox) {
    setupAutocomplete(clientSearch, clientValue, clientListbox, (query) => {
      if (!query) return state.clients;
      return state.clients.filter(c => 
        (c.name || '').toLowerCase().includes(query) || 
        (c.email || '').toLowerCase().includes(query)
      );
    }, 
    (client) => `<strong>${escapeHtmlText(client.name)}</strong> <span style="color:var(--text-muted);font-size:0.75rem;">${escapeHtmlText(client.email || '')}</span>`,
    (client) => client.name);
  }

  const gearRows = document.querySelectorAll('.gear-select-row');
  gearRows.forEach(row => {
    const searchInput = row.querySelector('.checkout-gear-search');
    const valueInput = row.querySelector('.checkout-gear-value');
    const listbox = row.querySelector('.checkout-gear-listbox');
    
    if (searchInput && valueInput && listbox) {
      setupAutocomplete(searchInput, valueInput, listbox, (query) => {
        // Collect currently selected gear from ALL rows except this one
        const otherSelectedValues = Array.from(document.querySelectorAll('.checkout-gear-value'))
          .filter(input => input !== valueInput && input.value)
          .map(input => input.value);
        
        let availableGear = state.gear.filter(g => 
          g.status === 'Available' && !otherSelectedValues.includes(g.id)
        );
        
        if (query) {
          availableGear = availableGear.filter(g => 
            (g.name || '').toLowerCase().includes(query) || 
            (g.assetTag || '').toLowerCase().includes(query)
          );
        }
        return availableGear;
      }, 
      (gear) => `<strong>${escapeHtmlText(gear.name)}</strong> <span style="color:var(--text-muted);font-size:0.75rem;">(${escapeHtmlText(gear.assetTag || 'No Tag')})</span>`,
      (gear) => gear.assetTag ? `${gear.name} (${gear.assetTag})` : gear.name);
    }
  });
}
window.populateCheckoutDropdowns = populateCheckoutDropdowns;

// Local Gear Availability Calculation
function recomputeGearStatusLocally() {
  if (!Array.isArray(state.gear) || !Array.isArray(state.bookings)) return;
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
}
window.recomputeGearStatusLocally = recomputeGearStatusLocally;

// Targeted Domain Refreshers
async function refreshGearData() {
  try {
    const res = await fetch(`${API_URL}/gear`);
    if (!res.ok) throw new Error(`Gear fetch failed with status ${res.status}`);
    state.gear = await res.json();
    recomputeGearStatusLocally();
    const query = document.getElementById('global-search')?.value.toLowerCase().trim() || '';
    safeComponentRender('Gear Inventory', () => renderInventory(window.activeInventoryFilter || 'all', query), 'inventory-list');
    safeComponentRender('Category Distribution', () => renderCategoryChart());
    safeComponentRender('Dashboard Statistics', () => updateStats());
    safeComponentRender('Checkout Dropdowns', () => populateCheckoutDropdowns());
  } catch (err) {
    console.error('Error refreshing gear data:', err);
    showToast('Failed to refresh gear inventory.', 'danger');
  }
}
window.refreshGearData = refreshGearData;

async function refreshClientsData() {
  try {
    const res = await fetch(`${API_URL}/clients`);
    if (!res.ok) throw new Error(`Clients fetch failed with status ${res.status}`);
    state.clients = await res.json();
    const query = document.getElementById('global-search')?.value.toLowerCase().trim() || '';
    safeComponentRender('Clients Directory', () => renderClients(query), 'clients-list');
    safeComponentRender('Checkout Dropdowns', () => populateCheckoutDropdowns());
  } catch (err) {
    console.error('Error refreshing clients data:', err);
    showToast('Failed to refresh clients directory.', 'danger');
  }
}
window.refreshClientsData = refreshClientsData;

async function refreshRentalsData() {
  try {
    const [bookingsRes, gearRes] = await Promise.all([
      fetch(`${API_URL}/bookings`),
      fetch(`${API_URL}/gear`)
    ]);
    if (!bookingsRes.ok) throw new Error(`Bookings fetch failed with status ${bookingsRes.status}`);
    state.bookings = await bookingsRes.json();
    if (gearRes.ok) {
      state.gear = await gearRes.json();
    }
    recomputeGearStatusLocally();
    const query = document.getElementById('global-search')?.value.toLowerCase().trim() || '';
    safeComponentRender('Rentals Timeline', () => renderDashboardRentals(query), 'timeline-list');
    safeComponentRender('Rentals List', () => renderRentalsList(query), 'rentals-table-body');
    safeComponentRender('Dashboard Statistics', () => updateStats());
    safeComponentRender('Gear Inventory', () => renderInventory(window.activeInventoryFilter || 'all', query), 'inventory-list');
    safeComponentRender('Category Distribution', () => renderCategoryChart());
    safeComponentRender('Checkout Dropdowns', () => populateCheckoutDropdowns());
  } catch (err) {
    console.error('Error refreshing rentals data:', err);
    showToast('Failed to refresh rentals data.', 'danger');
  }
}
window.refreshRentalsData = refreshRentalsData;

async function refreshUsersData() {
  const isAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
  if (!isAdmin) {
    state.users = [];
    return;
  }
  try {
    const res = await fetch(`${API_URL}/users`);
    if (!res.ok) throw new Error(`Users fetch failed with status ${res.status}`);
    state.users = await res.json();
    const query = document.getElementById('global-search')?.value.toLowerCase().trim() || '';
    safeComponentRender('Staff & Users', () => renderUsers(query), 'users-list');
    safeComponentRender('User Permissions', () => applyPermissions());
  } catch (err) {
    console.error('Error refreshing users data:', err);
    showToast('Failed to refresh staff users.', 'danger');
  }
}
window.refreshUsersData = refreshUsersData;

async function refreshAuditData() {
  const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
  if (!isAuditAdmin) {
    state.auditLogs = [];
    return;
  }
  try {
    const res = await fetch(`${API_URL}/audit-logs`);
    if (!res.ok) throw new Error(`Audit fetch failed with status ${res.status}`);
    const auditData = await res.json();
    state.auditLogs = auditData.auditLogs || [];
    const query = document.getElementById('global-search')?.value.toLowerCase().trim() || '';
    safeComponentRender('Audit Trail', () => renderAuditTrail(activeAuditCategory, query), 'audit-trail-body');
  } catch (err) {
    console.error('Error refreshing audit data:', err);
  }
}
window.refreshAuditData = refreshAuditData;

// Pub/Sub Domain Event Subscriptions
function setupDomainEvents() {
  if (!window.AppEvents) return;

  AppEvents.on('gear:changed', async () => {
    await refreshGearData();
    const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
    if (isAuditAdmin) refreshAuditData();
  });

  AppEvents.on('clients:changed', async () => {
    await refreshClientsData();
    const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
    if (isAuditAdmin) refreshAuditData();
  });

  AppEvents.on('rentals:changed', async () => {
    await refreshRentalsData();
    const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
    if (isAuditAdmin) refreshAuditData();
  });

  AppEvents.on('users:changed', async () => {
    await refreshUsersData();
    // Re-sync the logged-in user's own profile so sidebar name/title always stays current
    await syncLiveUserProfile();
    const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
    if (isAuditAdmin) refreshAuditData();
  });

  AppEvents.on('audit:changed', async () => {
    await refreshAuditData();
  });
}
window.setupDomainEvents = setupDomainEvents;

// Resilient Global Synchronization (Using Promise.allSettled)
async function refreshData(query = '') {
  try {
    await syncLiveUserProfile();
    const isAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
    const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
    const requests = [
      fetch(`${API_URL}/gear`).then(r => r.ok ? r.json() : Promise.reject(new Error(`Gear HTTP ${r.status}`))),
      fetch(`${API_URL}/clients`).then(r => r.ok ? r.json() : Promise.reject(new Error(`Clients HTTP ${r.status}`))),
      fetch(`${API_URL}/bookings`).then(r => r.ok ? r.json() : Promise.reject(new Error(`Bookings HTTP ${r.status}`)))
    ];
    if (isAdmin) {
      requests.push(fetch(`${API_URL}/users`).then(r => r.ok ? r.json() : Promise.reject(new Error(`Users HTTP ${r.status}`))));
    }
    if (isAuditAdmin) {
      requests.push(fetch(`${API_URL}/audit-logs`).then(r => r.ok ? r.json() : Promise.reject(new Error(`Audit HTTP ${r.status}`))));
    }

    const results = await Promise.allSettled(requests);
    
    if (results[0].status === 'fulfilled') {
      state.gear = results[0].value;
    } else {
      console.warn('Gear synchronization failed:', results[0].reason);
    }

    if (results[1].status === 'fulfilled') {
      state.clients = results[1].value;
    } else {
      console.warn('Clients synchronization failed:', results[1].reason);
    }

    if (results[2].status === 'fulfilled') {
      state.bookings = results[2].value;
    } else {
      console.warn('Bookings synchronization failed:', results[2].reason);
    }

    let nextIdx = 3;
    if (isAdmin) {
      const userRes = results[nextIdx++];
      if (userRes && userRes.status === 'fulfilled') {
        state.users = userRes.value;
      } else {
        console.warn('Users synchronization failed:', userRes ? userRes.reason : 'No response');
      }
    } else {
      state.users = [];
    }

    if (isAuditAdmin) {
      const auditRes = results[nextIdx++];
      if (auditRes && auditRes.status === 'fulfilled') {
        state.auditLogs = auditRes.value.auditLogs || [];
      } else {
        console.warn('Audit synchronization failed:', auditRes ? auditRes.reason : 'No response');
      }
    } else {
      state.auditLogs = [];
    }
  } catch (err) {
    console.error('Data synchronization error:', err);
    showToast('Unable to synchronize data with backend server. Please check your connection.', 'danger');
    return;
  }

  // Recompute gear availability status based on current active bookings today
  recomputeGearStatusLocally();
  
  safeComponentRender('Dashboard Statistics', () => updateStats());
  safeComponentRender('Rentals Timeline', () => renderDashboardRentals(query), 'timeline-list');
  safeComponentRender('Gear Inventory', () => renderInventory(window.activeInventoryFilter || 'all', query), 'inventory-list');
  safeComponentRender('Rentals List', () => renderRentalsList(query), 'rentals-table-body');
  safeComponentRender('Clients Directory', () => renderClients(query), 'clients-list');
  safeComponentRender('Staff & Users', () => renderUsers(query), 'users-list');
  safeComponentRender('Audit Trail', () => renderAuditTrail(activeAuditCategory, query), 'audit-trail-body');
  safeComponentRender('Checkout Dropdowns', () => populateCheckoutDropdowns());
  safeComponentRender('Category Distribution', () => renderCategoryChart());
  safeComponentRender('Finances Dashboard', () => renderFinancesDashboard());
  safeComponentRender('User Permissions', () => applyPermissions());
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
      const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));

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
        if (modal === 'modal-checkout') {
          // Set default start time (now) and return time (12:00 PM next day)
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          document.getElementById('checkout-start-date').value = now.toISOString().split('T')[0];
          document.getElementById('checkout-start-time').value = now.toTimeString().substring(0, 5);
          
          document.getElementById('checkout-end-date').value = tomorrow.toISOString().split('T')[0];
          document.getElementById('checkout-end-time').value = '12:00';
        }
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
      if (window.AppEvents) {
        AppEvents.emit('gear:changed');
      } else {
        await refreshData();
      }
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
      if (window.AppEvents) {
        AppEvents.emit('gear:changed');
      } else {
        await refreshData();
      }
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
        companyName: document.getElementById('client-company').value.trim(),
        email: document.getElementById('client-email').value.trim(),
        phone: document.getElementById('client-phone').value.trim(),
        ghanaCardNumber: document.getElementById('client-ghana-card').value.trim().toUpperCase(),
        guarantorName: document.getElementById('client-guarantor-name').value.trim(),
        guarantorGhanaCard: document.getElementById('client-guarantor-ghana-card').value.trim().toUpperCase(),
        guarantorPhone: document.getElementById('client-guarantor-phone').value.trim()
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
      if (window.AppEvents) {
        AppEvents.emit('clients:changed');
      } else {
        await refreshData();
      }
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
        companyName: document.getElementById('edit-client-company').value.trim(),
        email: document.getElementById('edit-client-email').value.trim(),
        phone: document.getElementById('edit-client-phone').value.trim(),
        ghanaCardNumber: document.getElementById('edit-client-ghana-card').value.trim().toUpperCase(),
        guarantorName: document.getElementById('edit-client-guarantor-name').value.trim(),
        guarantorGhanaCard: document.getElementById('edit-client-guarantor-ghana-card').value.trim().toUpperCase(),
        guarantorPhone: document.getElementById('edit-client-guarantor-phone').value.trim()
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
      if (window.AppEvents) {
        AppEvents.emit('clients:changed');
      } else {
        await refreshData();
      }
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
      
      const gearValues = document.querySelectorAll('.checkout-gear-value');
      const gearIds = Array.from(gearValues).map(s => s.value).filter(val => val);

      const startDateStr = document.getElementById('checkout-start-date').value;
      const startTimeStr = document.getElementById('checkout-start-time').value;
      const endDateStr = document.getElementById('checkout-end-date').value;
      const endTimeStr = document.getElementById('checkout-end-time').value;

      const checkoutType = document.querySelector('input[name="checkout-type"]:checked')?.value || 'Booked';

      const bookingData = {
        gearIds: gearIds,
        clientId: document.getElementById('checkout-client-value').value,
        startDate: startDateStr && startTimeStr ? `${startDateStr}T${startTimeStr}` : '',
        endDate: endDateStr && endTimeStr ? `${endDateStr}T${endTimeStr}` : '',
        status: checkoutType
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
        showToast('Both date and time are required for Pick Up and Return.', 'danger');
        return;
      }
      if (new Date(bookingData.startDate) > new Date(bookingData.endDate)) {
        showToast('Pick Up Date/Time cannot be after Return Date/Time.', 'danger');
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
      
      if (window.AppEvents) {
        AppEvents.emit('rentals:changed');
      } else {
        await refreshData();
      }
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
        ? ['manage_gear', 'manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals', 'manage_users', 'view_finances', 'delete_records', 'export_data', 'override_status']
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
      if (window.AppEvents) {
        AppEvents.emit('users:changed');
      } else {
        await refreshData();
      }
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
        ? ['manage_gear', 'manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals', 'manage_users', 'view_finances', 'delete_records', 'export_data', 'override_status']
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
      if (window.AppEvents) {
        AppEvents.emit('users:changed');
      } else {
        await refreshData();
      }
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
        // Sync display name and title so sidebar always reflects latest edits
        if (live.name && currentUser.name !== live.name) {
          currentUser.name = live.name;
          changed = true;
        }
        if (live.title && currentUser.title !== live.title) {
          currentUser.title = live.title;
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
    safeComponentRender('Rentals Timeline', () => renderDashboardRentals(query), 'timeline-list');
    safeComponentRender('Gear Inventory', () => renderInventory(window.activeInventoryFilter || 'all', query), 'inventory-list');
    safeComponentRender('Rentals List', () => renderRentalsList(query), 'rentals-table-body');
    safeComponentRender('Clients Directory', () => renderClients(query), 'clients-list');
    safeComponentRender('Staff & Users', () => renderUsers(query), 'users-list');
    safeComponentRender('Audit Trail', () => renderAuditTrail(activeAuditCategory, query), 'audit-trail-body');
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

// Finances Logic
function exportFinancesCSV() {
  if (typeof hasPermission === 'function' && !hasPermission('export_data')) {
    showToast('Permission Denied: You do not have permission to export data.', 'danger');
    return;
  }
  const tbody = document.getElementById('finance-top-earners');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr');
  if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.includes('No revenue data'))) {
    showToast('No financial data to export.', 'warning');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Gear Item,Asset Tag,Category,Total Days Rented,Revenue Generated (GHC)\n";

  rows.forEach(row => {
    const cols = row.querySelectorAll('td');
    if (cols.length === 5) {
      const name = cols[0].innerText.replace(/,/g, '');
      const asset = cols[1].innerText.replace(/,/g, '');
      const cat = cols[2].innerText.replace(/,/g, '');
      const days = cols[3].innerText.replace(/,/g, '');
      const rev = cols[4].innerText.replace(/,/g, '').replace('GH₵', '').trim();
      csvContent += `${name},${asset},${cat},${days},${rev}\n`;
    }
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `ek_finances_export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setupFinances() {
  const dateStart = document.getElementById('finance-date-start');
  const dateEnd = document.getElementById('finance-date-end');
  const catFilter = document.getElementById('finance-cat-filter');
  const btnExport = document.getElementById('btn-export-finances');

  if (dateStart) {
    dateStart.addEventListener('change', (e) => {
      activeFinanceDateStart = e.target.value;
      safeComponentRender('Finances Dashboard', () => renderFinancesDashboard());
    });
  }

  if (dateEnd) {
    dateEnd.addEventListener('change', (e) => {
      activeFinanceDateEnd = e.target.value;
      safeComponentRender('Finances Dashboard', () => renderFinancesDashboard());
    });
  }

  if (catFilter) {
    catFilter.addEventListener('change', (e) => {
      activeFinanceCat = e.target.value;
      safeComponentRender('Finances Dashboard', () => renderFinancesDashboard());
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', exportFinancesCSV);
  }
}
window.setupFinances = setupFinances;

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
  setupFinances();
  setupDomainEvents();

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
