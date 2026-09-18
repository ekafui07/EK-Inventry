/**
 * Staff & User Management Domain Module
 */

function validateUserPayload(data, currentId = null) {
  if (!data.name || data.name.trim().length < 2) return 'Full name must be at least 2 characters long.';
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return 'Please enter a valid email address.';
  
  const cleanEmail = data.email.trim().toLowerCase();
  const emailConflict = (state.users || []).find(u => u.id !== currentId && u.email && u.email.trim().toLowerCase() === cleanEmail);
  if (emailConflict) {
    return 'A user or staff member with this email address already exists.';
  }
  return null;
}
window.validateUserPayload = validateUserPayload;

function updateSidebarUserProfile() {
  if (!currentUser) return;
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const avatarEl = document.getElementById('user-avatar-text');
  const nameEl = document.getElementById('user-display-name');
  const titleEl = document.getElementById('user-display-title');
  if (avatarEl) avatarEl.innerText = initials || 'EK';
  if (nameEl) nameEl.innerText = currentUser.name;
  const isAdmin = currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin');
  if (titleEl) titleEl.innerText = isAdmin ? (currentUser.title || 'Admin') : `${currentUser.title || 'Staff'} (Staff)`;
}
window.updateSidebarUserProfile = updateSidebarUserProfile;

function renderUsers(query = '') {
  const container = document.getElementById('users-list');
  if (!container) return;
  container.innerHTML = '';

  const isAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
  if (!isAdmin) return;

  let users = state.users || [];
  if (query) {
    users = users.filter(u =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.title.toLowerCase().includes(query)
    );
  }

  if (users.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No staff members found.</div>`;
    return;
  }

  const permLabels = {
    'manage_gear': 'Gear Inventory',
    'manage_clients': 'Clients',
    'create_rentals': 'Checkouts',
    'return_rentals': 'Returns',
    'manage_users': 'Staff Admin'
  };

  users.forEach(user => {
    const isBanned = user.status === 'Banned';
    const statusClass = isBanned ? 'overdue' : 'available';
    const statusText = isBanned ? 'Banned' : 'Active';
    const isUserAdmin = user.accountType === 'Admin' || (user.role && user.role.toLowerCase() === 'admin');
    const typeBadge = isUserAdmin 
      ? `<span style="font-size:0.7rem; font-weight:700; background:rgba(2,132,199,0.15); color:#38bdf8; border:1px solid rgba(2,132,199,0.3); padding:2px 8px; border-radius:12px;">Admin</span>`
      : `<span style="font-size:0.7rem; font-weight:600; background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); padding:2px 8px; border-radius:12px;">Staff</span>`;

    const userPerms = isUserAdmin
      ? `<span style="font-size:0.75rem; font-weight:600; color:#38bdf8; background:rgba(2,132,199,0.12); border:1px solid rgba(2,132,199,0.25); padding:3px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:0.35rem;"><i data-lucide="shield-check" style="width:13px; height:13px"></i> Full Administrative Access</span>`
      : ((user.permissions || []).map(p => 
          `<span style="font-size:0.68rem; background:rgba(255,255,255,0.06); color:var(--text-muted); padding:2px 6px; border-radius:4px; border:1px solid var(--border-color);">${permLabels[p] || p}</span>`
        ).join(' ') || '<span style="font-size:0.7rem; color:var(--text-muted)">None</span>');

    const card = document.createElement('div');
    card.className = 'client-card';
    if (isBanned) card.style.borderColor = 'rgba(239,68,68,0.4)';

    card.innerHTML = `
      <div class="client-header" style="align-items: flex-start;">
        <div>
          <h3>${escapeHtmlText(user.name)} ${typeBadge}</h3>
          <p class="company">${escapeHtmlText(user.title)}</p>
        </div>
        <span class="status-pill ${statusClass}">${statusText}</span>
      </div>
      <div class="client-details">
        <div class="detail-item"><i data-lucide="mail"></i> <span>${escapeHtmlText(user.email)}</span></div>
      </div>
      <div style="margin-top:0.75rem;">
        <span style="font-size:0.72rem; color:var(--text-muted); display:block; margin-bottom:0.35rem; font-weight:600;">Assigned Permissions:</span>
        <div style="display:flex; flex-wrap:wrap; gap:0.25rem;">
          ${userPerms}
        </div>
      </div>
      <div class="client-actions" style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem; display: flex; gap: 0.4rem; flex-wrap: wrap;">
        <button class="btn btn-secondary" style="padding: 0.4rem 0.6rem; font-size: 0.72rem;" onclick="editUser('${user.id}')" title="Edit Profile & Permissions">
          <i data-lucide="pencil" style="width:12px; height:12px"></i> Edit
        </button>
        ${currentUser && currentUser.id !== user.id ? `
        <button class="btn btn-secondary" style="padding: 0.4rem 0.6rem; font-size: 0.72rem; color:var(--color-primary);" onclick="resetUserPasswordAction('${user.id}')" title="Reset password to default 12345">
          <i data-lucide="key" style="width:12px; height:12px"></i> Reset Pass (12345)
        </button>
        <button class="btn btn-secondary" style="padding: 0.4rem 0.6rem; font-size: 0.72rem; ${isBanned ? 'color:#4ade80;' : 'color:var(--color-danger);'}" onclick="toggleUserStatusAction('${user.id}', '${isBanned ? 'Active' : 'Banned'}')" title="${isBanned ? 'Unban Account' : 'Ban Account'}">
          <i data-lucide="${isBanned ? 'user-check' : 'user-x'}" style="width:12px; height:12px"></i> ${isBanned ? 'Unban' : 'Ban'}
        </button>
        <button class="btn btn-secondary" style="padding: 0.4rem 0.6rem; font-size: 0.72rem; color: var(--color-danger); border-color: rgba(239,68,68,0.3);" onclick="deleteUserAction('${user.id}')" title="Delete Account">
          <i data-lucide="trash-2" style="width:12px; height:12px"></i>
        </button>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}
window.renderUsers = renderUsers;

function updateEditUserFormPermissionsVisibility(type, isMotherAdmin = false) {
  const permGroup = document.getElementById('edit-user-permissions-group');
  const adminNotice = document.getElementById('edit-user-admin-notice');
  const accountTypeGroup = document.getElementById('edit-user-account-type-group');
  const titleEl = document.getElementById('modal-edit-user-title');
  const isAdmin = type === 'Admin';
  if (permGroup) permGroup.style.display = isAdmin ? 'none' : 'flex';
  if (adminNotice) adminNotice.style.display = isAdmin ? 'flex' : 'none';
  if (accountTypeGroup) accountTypeGroup.style.display = isMotherAdmin ? 'none' : 'flex';
  if (titleEl) titleEl.innerText = isAdmin ? 'Edit Administrator Profile' : 'Edit Staff Profile & Permissions';
  if (window.lucide) lucide.createIcons();
}

function updateAddUserFormPermissionsVisibility(type) {
  const permGroup = document.getElementById('add-user-permissions-group');
  const adminNotice = document.getElementById('add-user-admin-notice');
  const isAdmin = type === 'Admin';
  if (permGroup) permGroup.style.display = isAdmin ? 'none' : 'flex';
  if (adminNotice) adminNotice.style.display = isAdmin ? 'flex' : 'none';
  if (window.lucide) lucide.createIcons();
}

function editUser(id) {
  const user = state.users.find(u => u.id === id);
  if (!user) return;

  const isMotherAdmin = user.email === 'admin@ekgearflow.com';

  document.getElementById('edit-user-id').value = user.id;
  document.getElementById('edit-user-name').value = user.name;
  document.getElementById('edit-user-email').value = user.email;
  
  const type = user.accountType || (user.role && user.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff');
  const currentTitle = (isMotherAdmin && (!user.title || user.title === 'Operations Manager')) ? 'Admin' : (user.title || '');
  document.getElementById('edit-user-title').value = currentTitle;
  
  document.getElementById('edit-user-account-type').value = type;
  updateEditUserFormPermissionsVisibility(type, isMotherAdmin);

  const userPerms = user.permissions || [];
  document.querySelectorAll('input[name="edit-perm"]').forEach(cb => {
    cb.checked = userPerms.includes(cb.value);
  });

  openModal('modal-edit-user');
}
window.editUser = editUser;

async function resetUserPasswordAction(id) {
  const user = state.users.find(u => u.id === id);
  if (!user) return;

  const confirmReset = await window.showConfirmModal('Reset Password', `Reset password for "${user.name}" to default "12345"? They will be forced to change it on their next login.`, true);
  if (!confirmReset) return;

  try {
    const res = await fetch(`${API_URL}/users/${id}/reset-password`, { method: 'POST' });
    if (!res.ok) throw new Error('API Error');
    showToast(`Password for ${user.name} reset to 12345`);
    await refreshData();
  } catch (err) {
    showToast('Error resetting password', 'danger');
  }
}
window.resetUserPasswordAction = resetUserPasswordAction;

async function toggleUserStatusAction(id, newStatus) {
  const user = state.users.find(u => u.id === id);
  if (!user) return;

  const actionText = newStatus === 'Banned' ? 'Ban' : 'Unban';
  const confirmAction = await window.showConfirmModal(`${actionText} Account`, `Are you sure you want to ${actionText.toLowerCase()} the account for "${user.name}"?`, true);
  if (!confirmAction) return;

  try {
    const res = await fetch(`${API_URL}/users/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('API Error');
    showToast(`Account status updated to ${newStatus}`);
    await refreshData();
  } catch (err) {
    showToast('Error updating account status', 'danger');
  }
}
window.toggleUserStatusAction = toggleUserStatusAction;

async function deleteUserAction(id) {
  const user = state.users.find(u => u.id === id);
  if (!user) return;

  if (currentUser && currentUser.id === id) {
    showToast('You cannot delete your own active account!', 'danger');
    return;
  }

  const confirmDelete = await window.showConfirmModal('Delete Account', `Delete staff account "${user.name}"? This cannot be undone.`, true);
  if (!confirmDelete) return;

  try {
    const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('API Error');
    showToast(`Account "${user.name}" deleted successfully.`);
    await refreshData();
  } catch (err) {
    showToast('Error deleting account', 'danger');
  }
}
window.deleteUserAction = deleteUserAction;
