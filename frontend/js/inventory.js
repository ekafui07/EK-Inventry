/**
 * Inventory & Gear Domain Module
 */
function validateGearPayload(data, currentId = null) {
  if (!data.name || data.name.trim().length < 2) return 'Gear Name must be at least 2 characters long.';
  if (!data.assetTag || data.assetTag.trim().length < 2) return 'Asset Tag must be at least 2 characters long.';
  if (!data.category || data.category.trim().length < 2) return 'Category is required.';
  if (!data.serialNumber || data.serialNumber.trim().length < 2) return 'Serial Number is required.';
  if (isNaN(data.dailyRate) || Number(data.dailyRate) <= 0) return 'Daily Rate must be greater than 0.';

  const cleanTag = data.assetTag.trim().toUpperCase();
  const tagConflict = (state.gear || []).find(g => g.id !== currentId && g.assetTag && g.assetTag.toUpperCase() === cleanTag);
  if (tagConflict) {
    return 'A gear item with this asset tag already exists.';
  }

  const cleanSerial = data.serialNumber.trim().toLowerCase();
  const serialConflict = (state.gear || []).find(g => g.id !== currentId && g.serialNumber && g.serialNumber.toLowerCase() === cleanSerial);
  if (serialConflict) {
    return 'A gear item with this serial number already exists.';
  }

  return null;
}
window.validateGearPayload = validateGearPayload;

let activeInventoryFilter = 'all';

function renderInventory(filterOrCategory = (window.activeInventoryFilter || 'all'), query = '') {
  const tbody = document.getElementById('inventory-list');
  const grid = document.getElementById('inventory-grid');
  if (!tbody && !grid) return;
  
  let items = state.gear || [];
  if (filterOrCategory !== 'all') {
    items = items.filter(g => 
      (g.status && g.status.toLowerCase() === filterOrCategory.toLowerCase()) ||
      (g.category && g.category.toLowerCase() === filterOrCategory.toLowerCase())
    );
  }
  
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(g => 
      (g.name && g.name.toLowerCase().includes(q)) || 
      (g.serialNumber && g.serialNumber.toLowerCase().includes(q)) ||
      (g.category && g.category.toLowerCase().includes(q)) ||
      (g.assetTag && g.assetTag.toLowerCase().includes(q))
    );
  }
  
  const canEditGear = typeof hasPermission === 'function' 
    ? hasPermission('manage_gear')
    : (currentUser && (
        currentUser.accountType === 'Admin' || 
        (currentUser.role && currentUser.role.toLowerCase() === 'admin') ||
        (currentUser.permissions && currentUser.permissions.includes('manage_gear'))
      ));

  const canDeleteGear = typeof hasPermission === 'function' ? hasPermission('delete_records') : false;
  const canOverrideStatus = typeof hasPermission === 'function' ? hasPermission('override_status') : false;

  if (tbody) {
    tbody.innerHTML = '';
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">${query ? 'No matching equipment found.' : 'No equipment matches this filter.'}</td></tr>`;
    } else {
      items.forEach(item => {
        const statusClass = (item.status || 'Available').toLowerCase();
        const actionText = item.status === 'Maintenance' ? 'Put In Service' : 'Send to Repair';
        const actionIcon = item.status === 'Maintenance' ? 'check-circle' : 'wrench';
        
        let toggleButton = `<span style="font-size: 0.75rem; color: var(--text-muted)">—</span>`;
        if (item.status === 'Rented') {
          toggleButton = `<span style="font-size: 0.75rem; color: var(--text-muted)">Rented Out</span>`;
        } else if (canOverrideStatus) {
          toggleButton = `<button class="btn btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.75rem" onclick="toggleMaintenance('${item.id}')">
              <i data-lucide="${actionIcon}" style="width:12px; height:12px"></i> ${actionText}
             </button>`;
        }

        let modifyButtons = '';
        if (canEditGear) {
          modifyButtons += `<button class="btn btn-secondary btn-icon" onclick="editGear('${item.id}')" title="Edit Gear" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;"><i data-lucide="edit" style="width:13px; height:13px;"></i></button>`;
        }
        if (canDeleteGear) {
          modifyButtons += `<button class="btn btn-secondary btn-icon" onclick="deleteGear('${item.id}')" title="Delete Gear" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; color: var(--color-danger); margin-left: 0.4rem;"><i data-lucide="trash-2" style="width:13px; height:13px;"></i></button>`;
        }
        
        modifyButtons = modifyButtons ? `<div style="display: flex; gap: 0.4rem;">${modifyButtons}</div>` : '<span style="color: var(--text-muted); font-size: 0.75rem;">—</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtmlText(item.name)}</strong></td>
          <td>${escapeHtmlText(item.category || '—')}</td>
          <td><code>${escapeHtmlText(item.assetTag || '—')}</code></td>
          <td><code>${escapeHtmlText(item.serialNumber || '—')}</code></td>
          <td>GH₵${Number(item.dailyRate || 0).toFixed(2)}/day</td>
          <td><span class="status-pill ${statusClass}">${escapeHtmlText(item.status || 'Available')}</span></td>
          <td>${toggleButton}</td>
          <td>${modifyButtons}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  if (grid) {
    grid.innerHTML = '';
    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No equipment found</div>';
    } else {
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'gear-card';
        let statusClass = 'available';
        if (item.status === 'Rented') statusClass = 'rented';
        if (item.status === 'Maintenance') statusClass = 'maintenance';
        
        card.innerHTML = `
          <div class="gear-card-header">
            <span class="gear-category">${escapeHtmlText(item.category || 'Gear')}</span>
            <span class="gear-status ${statusClass}">${escapeHtmlText(item.status || 'Available')}</span>
          </div>
          <h3 class="gear-title">${escapeHtmlText(item.name)}</h3>
          <div class="gear-meta">
            <span>Tag: ${escapeHtmlText(item.assetTag || 'NO-TAG')}</span>
            <span>SN: ${escapeHtmlText(item.serialNumber || '—')}</span>
          </div>
          <div class="gear-footer">
            <div class="gear-price">GH₵${Number(item.dailyRate || 0).toFixed(2)} <span style="font-size: 0.75rem; color: var(--text-muted);">/day</span></div>
            <div class="gear-actions">
              ${canEditGear ? `
                <button class="btn btn-secondary btn-icon" onclick="toggleMaintenance('${item.id}')" title="Toggle Maintenance">
                  <i data-lucide="wrench"></i>
                </button>
                <button class="btn btn-secondary btn-icon" onclick="editGear('${item.id}')" title="Edit Gear">
                  <i data-lucide="edit"></i>
                </button>
                <button class="btn btn-secondary btn-icon" onclick="deleteGear('${item.id}')" title="Delete Gear">
                  <i data-lucide="trash-2"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    }
  }
  
  if (window.lucide) {
    lucide.createIcons();
  }
}
window.renderInventory = renderInventory;

async function toggleMaintenance(id) {
  if (typeof hasPermission === 'function' && !hasPermission('override_status')) {
    showToast('Permission Denied: You do not have permission to override gear status.', 'danger');
    return;
  }
  const item = state.gear.find(g => g.id === id);
  if (!item) return;

  const willBeMaint = item.status !== 'Maintenance';
  const confirmed = await showConfirmModal(
    willBeMaint ? 'Send to Maintenance' : 'Return to Service',
    willBeMaint 
      ? `Are you sure you want to mark "${item.name}" for maintenance/repair?`
      : `Mark "${item.name}" as ready and return to active inventory?`,
    false
  );
  if (!confirmed) return;

  const targetStatus = willBeMaint ? 'Maintenance' : 'Available';
  
  try {
    const res = await fetch(`${API_URL}/gear/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update equipment');
    }
    if (window.AppEvents) {
      AppEvents.emit('gear:changed');
    } else {
      await refreshData();
    }
    showToast(`Gear status updated to ${targetStatus}`);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
window.toggleMaintenance = toggleMaintenance;

function editGear(id) {
  if (typeof hasPermission === 'function' && !hasPermission('manage_gear')) {
    showToast('Permission Denied: You do not have permission to edit gear.', 'danger');
    return;
  }
  const item = state.gear.find(g => g.id === id);
  if (!item) return;
  
  const idEl = document.getElementById('edit-gear-id');
  const nameEl = document.getElementById('edit-gear-name');
  const catEl = document.getElementById('edit-gear-category');
  const rateEl = document.getElementById('edit-gear-rate');
  const tagEl = document.getElementById('edit-gear-asset-tag') || document.getElementById('edit-gear-tag');
  const serialEl = document.getElementById('edit-gear-serial');
  
  if (idEl) idEl.value = item.id;
  if (nameEl) nameEl.value = item.name || '';
  if (catEl) catEl.value = item.category || '';
  if (rateEl) rateEl.value = item.dailyRate || '';
  if (tagEl) tagEl.value = item.assetTag || '';
  if (serialEl) serialEl.value = item.serialNumber || '';
  
  openModal('modal-edit-gear');
}
window.editGear = editGear;

async function deleteGear(id) {
  if (typeof hasPermission === 'function' && !hasPermission('delete_records')) {
    showToast('Permission Denied: You do not have permission to delete gear.', 'danger');
    return;
  }
  const item = state.gear.find(g => g.id === id);
  const confirmed = await showConfirmModal(
    'Delete Equipment',
    `Permanently delete "${item ? item.name : 'this item'}" from inventory? This action cannot be undone.`,
    true
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_URL}/gear/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete gear');
    }
    if (window.AppEvents) {
      AppEvents.emit('gear:changed');
    } else {
      await refreshData();
    }
    showToast('Equipment removed successfully');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
window.deleteGear = deleteGear;

function setupInventoryFilter() {
  const filterTabs = document.querySelectorAll('#view-inventory .filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeInventoryFilter = tab.getAttribute('data-filter') || 'all';
      window.activeInventoryFilter = activeInventoryFilter;
      const searchEl = document.getElementById('global-search');
      const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
      renderInventory(activeInventoryFilter, query);
    });
  });
}
window.activeInventoryFilter = activeInventoryFilter;
window.setupInventoryFilter = setupInventoryFilter;
