/**
 * Audit Trail Domain Module (Accessible to all Administrator accounts)
 */

function setupAuditTrail() {
  const btnAuditTab = document.getElementById('btn-audit-trail-tab');
  if (btnAuditTab) {
    btnAuditTab.addEventListener('click', () => {
      const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
      if (!isAuditAdmin) {
        showToast('Access Denied: The Audit Trail is restricted to Administrator accounts only.', 'danger');
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
      const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
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

  const btnExport = document.getElementById('btn-export-audit');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportAuditTrailToCSV();
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

  const isAuditAdmin = currentUser && (currentUser.accountType === 'Admin' || (currentUser.role && currentUser.role.toLowerCase() === 'admin'));
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
      ? `<span class="audit-role-badge admin">Admin</span>`
      : `<span class="audit-role-badge staff">Staff</span>`;

    const cat = log.category || 'System';
    let catBadge = '';
    if (cat === 'Inventory') {
      catBadge = `<span class="badge badge-cat badge-cat-inventory"><i data-lucide="package" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Inventory</span>`;
    } else if (cat === 'Rentals') {
      catBadge = `<span class="badge badge-cat badge-cat-rentals"><i data-lucide="repeat" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Rentals</span>`;
    } else if (cat === 'Clients') {
      catBadge = `<span class="badge badge-cat badge-cat-clients"><i data-lucide="users" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Clients</span>`;
    } else if (cat === 'Staff') {
      catBadge = `<span class="badge badge-cat badge-cat-staff"><i data-lucide="shield-check" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Staff</span>`;
    } else if (cat === 'Auth') {
      catBadge = `<span class="badge badge-cat badge-cat-auth"><i data-lucide="lock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Auth</span>`;
    } else {
      catBadge = `<span class="badge badge-cat">${escapeHtmlText(cat)}</span>`;
    }

    let detailsStr = '';
    if (log.details) {
      if (typeof log.details === 'string') {
        try {
          const parsed = JSON.parse(log.details);
          detailsStr = formatLogDetailsObject(parsed);
        } catch(e) {
          detailsStr = log.details;
        }
      } else {
        detailsStr = formatLogDetailsObject(log.details);
      }
    }

    return `
      <tr>
        <td style="font-size: 0.82rem; white-space: nowrap; color: var(--text-main); vertical-align: middle;">
          ${timeDisplay}
        </td>
        <td style="vertical-align: middle;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div class="audit-actor-avatar">
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
              <div style="font-size: 0.77rem; color: var(--text-main); line-height: 1.4; word-break: break-word;">
                ${escapeHtmlText(detailsStr)}
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) {
    lucide.createIcons();
  }
}
window.renderAuditTrail = renderAuditTrail;

function formatLogDetailsObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const parts = [];

  if (obj.gearName) parts.push(`Gear: ${obj.gearName}`);
  if (obj.name && !obj.gearName) parts.push(`Item: ${obj.name}`);
  if (obj.clientName) parts.push(`Client: ${obj.clientName}`);
  if (obj.category) parts.push(`Category: ${obj.category}`);
  if (obj.assetTag) parts.push(`Asset Tag: ${obj.assetTag}`);
  if (obj.serialNumber) parts.push(`SN: ${obj.serialNumber}`);
  if (obj.dailyRate !== undefined) parts.push(`Daily Rate: GH₵${Number(obj.dailyRate).toFixed(2)}`);
  if (obj.startDate && obj.endDate) parts.push(`Rental Period: ${window.formatDateReadable(obj.startDate)} to ${window.formatDateReadable(obj.endDate)}`);
  if (obj.status) parts.push(`Status: ${obj.status}`);
  if (obj.title) parts.push(`Job Title: ${obj.title}`);
  if (obj.accountType) parts.push(`Role: ${obj.accountType}`);
  if (obj.email) parts.push(`Email: ${obj.email}`);
  if (obj.phone) parts.push(`Phone: ${obj.phone}`);
  if (obj.reason) parts.push(`Reason: ${obj.reason}`);

  if (parts.length === 0) {
    const extractFields = (objParam) => {
      for (const [k, v] of Object.entries(objParam)) {
        if (/id$/i.test(k) || k === 'id' || k === 'password' || k === 'token') continue;
        if (typeof v === 'object' && v !== null) {
          extractFields(v);
          continue;
        }
        const formattedKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        parts.push(`${formattedKey} = ${v}`);
      }
    };
    extractFields(obj);
  }

  return parts.length > 0 ? parts.join('. ') : 'Completed successfully';
}

function formatLogDetailsForExport(log) {
  if (!log.details) {
    return log.summary || log.action || 'No additional details';
  }

  if (typeof log.details === 'string') {
    try {
      const parsed = JSON.parse(log.details);
      return formatLogDetailsObject(parsed);
    } catch (e) {
      return log.details.replace(/id:[a-z0-9_-]+/gi, '').replace(/\s+/g, ' ').trim();
    }
  }

  if (typeof log.details === 'object') {
    return formatLogDetailsObject(log.details);
  }

  return String(log.details);
}

function exportAuditTrailToCSV() {
  const allLogs = state.auditLogs || [];
  if (allLogs.length === 0) {
    showToast('No audit records available to export', 'warning');
    return;
  }

  const category = (window.activeAuditCategory && window.activeAuditCategory !== 'All') ? window.activeAuditCategory : null;
  const searchInput = document.getElementById('audit-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let logs = allLogs;
  if (category) {
    logs = logs.filter(l => l.category && l.category.toLowerCase() === category.toLowerCase());
  }
  if (query) {
    logs = logs.filter(l =>
      (l.userName && l.userName.toLowerCase().includes(query)) ||
      (l.userEmail && l.userEmail.toLowerCase().includes(query)) ||
      (l.action && l.action.toLowerCase().includes(query)) ||
      (l.summary && l.summary.toLowerCase().includes(query)) ||
      (l.details && typeof l.details === 'string' && l.details.toLowerCase().includes(query)) ||
      (l.category && l.category.toLowerCase().includes(query)) ||
      (l.ip && l.ip.toLowerCase().includes(query))
    );
  }

  if (logs.length === 0) {
    showToast('No records match the current filter to export', 'warning');
    return;
  }

  const headers = [
    'Date & Time',
    'Staff / User',
    'Email Address',
    'Account Role',
    'Category',
    'Action Description',
    'Plain-English Details',
    'IP Address',
    'Outcome'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = logs.map(log => {
    const dateObj = new Date(log.timestamp);
    const dateStr = !isNaN(dateObj)
      ? `${dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })} ${dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
      : String(log.timestamp || '');

    const actorName = log.userName || 'System User';
    const actorEmail = log.userEmail || '—';
    const actorRole = (log.accountType === 'Admin' || (log.userRole && log.userRole.toLowerCase() === 'admin')) ? 'Administrator' : 'Staff Member';
    const cat = log.category || 'System';
    const action = log.summary || log.action || 'System Event';
    const details = formatLogDetailsForExport(log);
    const ip = log.ip || '127.0.0.1';
    const outcome = log.outcome || (log.status === 'Failed' ? 'Failed' : 'Success');

    return [
      escapeCSV(dateStr),
      escapeCSV(actorName),
      escapeCSV(actorEmail),
      escapeCSV(actorRole),
      escapeCSV(cat),
      escapeCSV(action),
      escapeCSV(details),
      escapeCSV(ip),
      escapeCSV(outcome)
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const nowStr = new Date().toISOString().split('T')[0];
  const catLabel = category ? `_${category}` : '';
  const filename = `EK_GearFlow_Audit_Report${catLabel}_${nowStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Successfully exported ${logs.length} audit record(s) to CSV!`);
}
window.exportAuditTrailToCSV = exportAuditTrailToCSV;
