/**
 * Audit Trail Domain Module (Restricted to primary Administrator admin@ekgearflow.com)
 */

function setupAuditTrail() {
  const btnAuditTab = document.getElementById('btn-audit-trail-tab');
  if (btnAuditTab) {
    btnAuditTab.addEventListener('click', () => {
      const isAuditAdmin = currentUser && currentUser.email && currentUser.email.toLowerCase() === 'admin@ekgearflow.com';
      if (!isAuditAdmin) {
        showToast('Access Denied: The Audit Trail is strictly for the primary Administrator account.', 'danger');
        return;
      }
      activeTab = 'audit';
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      btnAuditTab.classList.add('active');
      document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'view-audit');
      });
      refreshData();
    });
  }

  const btnRefresh = document.getElementById('btn-refresh-audit');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      const isAuditAdmin = currentUser && currentUser.email && currentUser.email.toLowerCase() === 'admin@ekgearflow.com';
      if (!isAuditAdmin) return;
      btnRefresh.disabled = true;
      try {
        const res = await fetch(`${API_URL}/audit-logs`);
        if (res.ok) {
          const data = await res.json();
          state.auditLogs = data.auditLogs || [];
          renderAuditTrail(activeAuditCategory);
          showToast('Audit trail activity refreshed');
        } else {
          showToast('Failed to fetch audit logs', 'danger');
        }
      } catch (e) {
        showToast('Error refreshing audit logs', 'danger');
      } finally {
        btnRefresh.disabled = false;
      }
    });
  }

  const filterContainer = document.getElementById('audit-category-filters');
  if (filterContainer) {
    filterContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-tab');
      if (!btn) return;
      const category = btn.getAttribute('data-audit-filter') || 'All';
      activeAuditCategory = category;
      filterContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const searchInput = document.getElementById('audit-search-input');
      const query = searchInput ? searchInput.value.trim() : '';
      renderAuditTrail(activeAuditCategory, query);
    });
  }

  const searchInput = document.getElementById('audit-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderAuditTrail(activeAuditCategory, e.target.value.trim());
    });
  }
}
window.setupAuditTrail = setupAuditTrail;

function renderAuditTrail(category = activeAuditCategory, query = '') {
  const tbody = document.getElementById('audit-table-body');
  if (!tbody) return;

  const isAuditAdmin = currentUser && currentUser.email && currentUser.email.toLowerCase() === 'admin@ekgearflow.com';
  if (!isAuditAdmin) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Access restricted to primary administrator account.</td></tr>`;
    return;
  }

  const allLogs = state.auditLogs || [];

  // Update Stats Cards
  const totalCount = allLogs.length;
  const invCount = allLogs.filter(l => l.category === 'Inventory').length;
  const rentCount = allLogs.filter(l => l.category === 'Rentals').length;
  const staffCount = allLogs.filter(l => l.category === 'Staff' || l.category === 'Auth').length;

  const elTotal = document.getElementById('audit-stat-total');
  const elInv = document.getElementById('audit-stat-inventory');
  const elRent = document.getElementById('audit-stat-rentals');
  const elStaff = document.getElementById('audit-stat-staff');

  if (elTotal) elTotal.innerText = totalCount;
  if (elInv) elInv.innerText = invCount;
  if (elRent) elRent.innerText = rentCount;
  if (elStaff) elStaff.innerText = staffCount;

  // Filter by category
  let logs = allLogs;
  if (category && category !== 'All') {
    logs = logs.filter(l => l.category && l.category.toLowerCase() === category.toLowerCase());
  }

  // Filter by search query
  if (query) {
    const q = query.toLowerCase();
    logs = logs.filter(l =>
      (l.userName && l.userName.toLowerCase().includes(q)) ||
      (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.summary && l.summary.toLowerCase().includes(q)) ||
      (l.details && typeof l.details === 'string' && l.details.toLowerCase().includes(q)) ||
      (l.category && l.category.toLowerCase().includes(q)) ||
      (l.ip && l.ip.toLowerCase().includes(q))
    );
  }

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <i data-lucide="shield-check" style="width: 32px; height: 32px; margin: 0 auto 0.75rem auto; display: block; opacity: 0.5;"></i>
          <p style="font-size: 0.95rem; font-weight: 500;">No audit records found matching current criteria.</p>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const dateObj = new Date(log.timestamp);
    const timeDisplay = !isNaN(dateObj)
      ? `${dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} <span style="color:var(--text-muted); font-size:0.75rem; display:block;">${dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>`
      : escapeHtmlText(log.timestamp);

    const initial = (log.userName || log.userEmail || 'U').charAt(0).toUpperCase();
    const isAdminActor = log.accountType === 'Admin' || (log.userRole && log.userRole.toLowerCase() === 'admin');
    const roleBadge = isAdminActor
      ? `<span style="font-size:0.65rem; font-weight:700; background:rgba(2,132,199,0.15); color:#38bdf8; border:1px solid rgba(2,132,199,0.3); padding:1px 6px; border-radius:10px;">Admin</span>`
      : `<span style="font-size:0.65rem; font-weight:600; background:rgba(59,130,246,0.12); color:#60a5fa; border:1px solid rgba(59,130,246,0.25); padding:1px 6px; border-radius:10px;">Staff</span>`;

    const cat = log.category || 'System';
    let catBadge = '';
    if (cat === 'Inventory') {
      catBadge = `<span class="badge" style="background:rgba(16,185,129,0.12); color:#34d399; border-color:rgba(16,185,129,0.25);"><i data-lucide="package" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Inventory</span>`;
    } else if (cat === 'Rentals') {
      catBadge = `<span class="badge" style="background:rgba(139,92,246,0.12); color:#a78bfa; border-color:rgba(139,92,246,0.25);"><i data-lucide="repeat" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Rentals</span>`;
    } else if (cat === 'Clients') {
      catBadge = `<span class="badge" style="background:rgba(245,158,11,0.12); color:#fbbf24; border-color:rgba(245,158,11,0.25);"><i data-lucide="users" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Clients</span>`;
    } else if (cat === 'Staff') {
      catBadge = `<span class="badge" style="background:rgba(2,132,199,0.12); color:#38bdf8; border-color:rgba(2,132,199,0.25);"><i data-lucide="shield-check" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Staff</span>`;
    } else if (cat === 'Auth') {
      catBadge = `<span class="badge" style="background:rgba(236,72,153,0.12); color:#f472b6; border-color:rgba(236,72,153,0.25);"><i data-lucide="lock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Auth</span>`;
    } else {
      catBadge = `<span class="badge">${escapeHtmlText(cat)}</span>`;
    }

    const detailsStr = log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : '';

    return `
      <tr>
        <td style="font-size: 0.82rem; white-space: nowrap; color: var(--text-main); vertical-align: middle;">
          ${timeDisplay}
        </td>
        <td style="vertical-align: middle;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #0284c7, #0369a1); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; color: #fff; flex-shrink: 0;">
              ${initial}
            </div>
            <div style="min-width: 0;">
              <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtmlText(log.userName || 'User')}
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; margin-top: 1px;">
                <span>${escapeHtmlText(log.userEmail || '')}</span>
                ${roleBadge}
              </div>
            </div>
          </div>
        </td>
        <td style="vertical-align: middle;">
          ${catBadge}
        </td>
        <td style="vertical-align: middle;">
          <div style="display: flex; flex-direction: column; gap: 0.2rem;">
            <div style="font-weight: 600; font-size: 0.84rem; color: var(--text-main);">
              ${escapeHtmlText(log.summary || log.action || '')}
            </div>
            ${detailsStr ? `
              <div style="font-size: 0.77rem; color: var(--text-muted); line-height: 1.35; word-break: break-word;">
                ${escapeHtmlText(detailsStr)}
              </div>
            ` : ''}
          </div>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <span style="font-family: monospace; font-size: 0.74rem; color: var(--text-muted); background: rgba(255,255,255,0.04); padding: 2px 7px; border-radius: 4px; border: 1px solid var(--border-color);">
            ${escapeHtmlText(log.ip || '127.0.0.1')}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) {
    lucide.createIcons();
  }
}
window.renderAuditTrail = renderAuditTrail;
