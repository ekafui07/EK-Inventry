/**
 * Clients Domain Module
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]*[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;

function validateClientPayload(data, currentId = null) {
  if (!data.name || data.name.trim().length < 2) return 'Client Full Name must be at least 2 characters long.';
  if (!data.email || !EMAIL_REGEX.test(data.email.trim())) return 'Please enter a valid email address (e.g., client@domain.com).';
  if (!data.phone || !PHONE_REGEX.test(data.phone.trim())) return 'Please enter a valid phone number (minimum 7 digits).';
  if (!data.ghanaCardNumber || data.ghanaCardNumber.trim().length < 5) return 'Ghana Card Number is strictly required.';
  if (!data.guarantorName || data.guarantorName.trim().length < 2) return 'Guarantor Name is strictly required.';
  if (!data.guarantorGhanaCard || data.guarantorGhanaCard.trim().length < 5) return 'Guarantor Ghana Card is strictly required.';
  if (!data.guarantorPhone || !PHONE_REGEX.test(data.guarantorPhone.trim())) return 'Valid Guarantor Phone Number is required.';

  const cleanEmail = data.email.trim().toLowerCase();
  const emailConflict = (state.clients || []).find(c => c.id !== currentId && c.email && c.email.trim().toLowerCase() === cleanEmail);
  if (emailConflict) {
    return 'A client with this email address already exists.';
  }

  const normPhone = data.phone.replace(/\D/g, '');
  const phoneConflict = (state.clients || []).find(c => {
    if (c.id === currentId || !c.phone) return false;
    const cNorm = c.phone.replace(/\D/g, '');
    return (normPhone && cNorm && normPhone === cNorm) || c.phone.trim() === data.phone.trim();
  });
  if (phoneConflict) {
    return 'A client with this phone number already exists.';
  }

  return null;
}
window.validateClientPayload = validateClientPayload;

function renderClients(query = '') {
  const grid = document.getElementById('clients-list') || document.getElementById('clients-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  let list = state.clients || [];
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) || 
      (c.companyName && c.companyName.toLowerCase().includes(q)) ||
      (c.ghanaCardNumber && c.ghanaCardNumber.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) || 
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  }
  
  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No clients found</div>';
    return;
  }

  const canManageClients = typeof hasPermission === 'function'
    ? hasPermission('manage_clients')
    : (currentUser && (
        currentUser.accountType === 'Admin' ||
        currentUser.role === 'admin' ||
        (currentUser.permissions && currentUser.permissions.includes('manage_clients'))
      ));
  const canDelete = typeof hasPermission === 'function' ? hasPermission('delete_records') : false;
  
  list.forEach(client => {
    const card = document.createElement('div');
    card.className = 'client-card client-directory-card';
    
    const activeRentals = (state.bookings || []).filter(b => b.clientId === client.id && b.status === 'Active').length;
    const safeName = escapeHtmlText(client.name);
    const safeEmail = escapeHtmlText(client.email || '—');
    const safePhone = escapeHtmlText(client.phone || '—');

    // 2-letter uppercase initials
    const nameWords = safeName.trim().split(/\s+/).filter(Boolean);
    let initials = 'CL';
    if (nameWords.length === 1) {
      initials = nameWords[0].slice(0, 2).toUpperCase();
    } else if (nameWords.length >= 2) {
      initials = (nameWords[0][0] + nameWords[nameWords.length - 1][0]).toUpperCase();
    }

    card.innerHTML = `
      <div class="client-card-header">
        <div class="client-avatar">
          <span>${initials}</span>
        </div>
        <div class="client-title-block">
          <h3 class="client-name-heading">${safeName}</h3>
          <span class="client-rentals-tag ${activeRentals > 0 ? 'active' : 'idle'}">
            ${activeRentals} Active ${activeRentals === 1 ? 'Rental' : 'Rentals'}
          </span>
        </div>
      </div>
      
      <div class="client-contact-details" style="display: flex; flex-direction: column; gap: 0.4rem;">
        ${client.companyName ? `
        <div class="contact-line" style="font-size: 0.85rem; color: var(--text-main);">
          <i data-lucide="building" style="width:14px; height:14px;"></i>
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtmlText(client.companyName)}</span>
        </div>` : ''}
        <div class="contact-line" style="font-size: 0.85rem; color: var(--text-main);">
          <i data-lucide="mail" style="width:14px; height:14px;"></i>
          <a href="${safeEmail !== '—' ? `mailto:${safeEmail}` : 'javascript:void(0)'}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${safeEmail}</a>
        </div>
        <div class="contact-line" style="font-size: 0.85rem; color: var(--text-main);">
          <i data-lucide="phone" style="width:14px; height:14px;"></i>
          <a href="${safePhone !== '—' ? `tel:${safePhone.replace(/\s+/g, '')}` : 'javascript:void(0)'}" style="color: var(--text-main);">${safePhone}</a>
        </div>
        ${client.ghanaCardNumber ? `
        <div class="contact-line" style="font-size: 0.85rem; color: var(--text-main);">
          <i data-lucide="credit-card" style="width:14px; height:14px;"></i>
          <span style="font-family: monospace;">${escapeHtmlText(client.ghanaCardNumber)}</span>
        </div>` : ''}
        ${client.guarantorName ? `
        <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 0.3rem;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Guarantor</div>
          <div class="contact-line" style="font-size: 0.85rem; color: var(--text-main);">
            <i data-lucide="user" style="width:14px; height:14px;"></i>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtmlText(client.guarantorName)}</span>
          </div>
          <div class="contact-line" style="font-size: 0.85rem; color: var(--text-main);">
            <i data-lucide="credit-card" style="width:14px; height:14px;"></i>
            <span style="font-family: monospace;">${escapeHtmlText(client.guarantorGhanaCard || '—')}</span>
          </div>
          <div class="contact-line" style="font-size: 0.85rem; color: var(--text-main);">
            <i data-lucide="phone" style="width:14px; height:14px;"></i>
            <a href="tel:${(client.guarantorPhone || '').replace(/\s+/g, '')}" style="color: var(--text-main);">${escapeHtmlText(client.guarantorPhone || '—')}</a>
          </div>
        </div>` : ''}
      </div>
      
      <div class="client-card-footer">
        ${canManageClients ? `
          <button class="btn btn-secondary btn-sm" onclick="editClient('${client.id}')" title="Edit Client">
            <i data-lucide="pencil" style="width:13px; height:13px;"></i> Edit
          </button>
        ` : ''}
        ${canDelete ? `
          <button class="btn btn-secondary btn-sm btn-delete-client" onclick="deleteClient('${client.id}')" title="Delete Client">
            <i data-lucide="trash-2" style="width:13px; height:13px;"></i>
          </button>
        ` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
  
  if (window.lucide) {
    lucide.createIcons();
  }
}
window.renderClients = renderClients;

function editClient(id) {
  if (typeof hasPermission === 'function' && !hasPermission('manage_clients')) {
    showToast('Permission Denied: You do not have permission to edit clients.', 'danger');
    return;
  }
  const client = state.clients.find(c => c.id === id);
  if (!client) return;
  
  document.getElementById('edit-client-id').value = client.id;
  document.getElementById('edit-client-name').value = client.name || '';
  document.getElementById('edit-client-company').value = client.companyName || '';
  document.getElementById('edit-client-email').value = client.email || '';
  document.getElementById('edit-client-phone').value = client.phone || '';
  document.getElementById('edit-client-ghana-card').value = client.ghanaCardNumber || '';
  document.getElementById('edit-client-guarantor-name').value = client.guarantorName || '';
  document.getElementById('edit-client-guarantor-ghana-card').value = client.guarantorGhanaCard || '';
  document.getElementById('edit-client-guarantor-phone').value = client.guarantorPhone || '';
  
  openModal('modal-edit-client');
}
window.editClient = editClient;

async function deleteClient(id) {
  if (typeof hasPermission === 'function' && !hasPermission('delete_records')) {
    showToast('Permission Denied: You do not have permission to delete clients.', 'danger');
    return;
  }
  const client = state.clients.find(c => c.id === id);
  const confirmed = await showConfirmModal(
    'Delete Client',
    `Are you sure you want to remove "${client ? client.name : 'this client'}"? Clients with active rentals cannot be deleted.`,
    true
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_URL}/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete client');
    }
    if (window.AppEvents) {
      AppEvents.emit('clients:changed');
    } else {
      await refreshData();
    }
    showToast('Client removed successfully');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
window.deleteClient = deleteClient;
