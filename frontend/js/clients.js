/**
 * Clients Domain Module
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]*[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;

function validateClientPayload(data, currentId = null) {
  if (!data.name || data.name.trim().length < 2) return 'Client Full Name must be at least 2 characters long.';
  if (!data.email || !EMAIL_REGEX.test(data.email.trim())) return 'Please enter a valid email address (e.g., client@domain.com).';
  if (!data.phone || !PHONE_REGEX.test(data.phone.trim())) return 'Please enter a valid phone number (minimum 7 digits).';

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
  
  let list = state.clients;
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.email.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  }
  
  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No clients found</div>';
    return;
  }

  const canManageClients = currentUser && (
    currentUser.role === 'admin' ||
    (currentUser.permissions && currentUser.permissions.includes('manage_clients'))
  );
  const canDelete = currentUser && currentUser.role === 'admin';
  
  list.forEach(client => {
    const card = document.createElement('div');
    card.className = 'client-card';
    
    const activeRentals = state.bookings.filter(b => b.clientId === client.id && b.status === 'Active').length;
    const safeName = escapeHtmlText(client.name);
    const safeId = escapeHtmlText(client.id);
    const safeEmail = escapeHtmlText(client.email);
    const safePhone = escapeHtmlText(client.phone);
    
    card.innerHTML = `
      <div class="client-header">
        <div class="client-avatar">${safeName.charAt(0).toUpperCase()}</div>
        <div class="client-title">
          <div class="client-name">${safeName}</div>
          <div class="client-id">ID: ${safeId}</div>
        </div>
      </div>
      
      <div class="client-contact">
        <div class="contact-item">
          <i data-lucide="mail"></i>
          <span>${safeEmail}</span>
        </div>
        <div class="contact-item">
          <i data-lucide="phone"></i>
          <span>${safePhone}</span>
        </div>
      </div>
      
      <div class="client-footer">
        <span class="active-badge">${activeRentals} Active ${activeRentals === 1 ? 'Rental' : 'Rentals'}</span>
        <div class="client-actions">
          ${canManageClients ? `
            <button class="btn btn-secondary btn-icon" onclick="editClient('${client.id}')" title="Edit Client">
              <i data-lucide="edit"></i>
            </button>
          ` : ''}
          ${canDelete ? `
            <button class="btn btn-secondary btn-icon" onclick="deleteClient('${client.id}')" title="Delete Client">
              <i data-lucide="trash-2"></i>
            </button>
          ` : ''}
        </div>
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
  const client = state.clients.find(c => c.id === id);
  if (!client) return;
  
  document.getElementById('edit-client-id').value = client.id;
  document.getElementById('edit-client-name').value = client.name;
  document.getElementById('edit-client-email').value = client.email;
  document.getElementById('edit-client-phone').value = client.phone;
  
  openModal('modal-edit-client');
}
window.editClient = editClient;

async function deleteClient(id) {
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
    await refreshData();
    showToast('Client removed successfully');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
window.deleteClient = deleteClient;
