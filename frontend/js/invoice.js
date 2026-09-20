// Invoice Generator Logic
let invoiceSelectedClient = null;
let invoiceItems = [];

function initInvoiceGenerator() {
  const clientInput = document.getElementById('invoice-client-search');
  const clientDropdown = document.getElementById('invoice-client-dropdown');
  const gearInput = document.getElementById('invoice-gear-search');
  const gearDropdown = document.getElementById('invoice-gear-dropdown');
  const btnAddItem = document.getElementById('btn-invoice-add-item');
  const btnPreview = document.getElementById('btn-preview-invoice');
  const btnPrint = document.getElementById('btn-trigger-custom-print');
  const dateInput = document.getElementById('invoice-sale-date');

  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Client Autocomplete
  if (clientInput) {
    clientInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        clientDropdown.style.display = 'none';
        invoiceSelectedClient = null;
        return;
      }
      
      const matches = state.clients.filter(c => 
        (c.name || '').toLowerCase().includes(query) || 
        (c.phone || '').toLowerCase().includes(query)
      );

      if (matches.length > 0) {
        clientDropdown.innerHTML = matches.map(c => `
          <div class="autocomplete-item" data-id="${c.id}">
            <strong>${escapeHtmlText(c.name)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtmlText(c.phone || '')}</div>
          </div>
        `).join('');
        clientDropdown.style.display = 'block';
      } else {
        clientDropdown.innerHTML = '<div style="padding: 0.5rem 1rem; color: var(--text-muted); font-size: 0.85rem;">No clients found</div>';
        clientDropdown.style.display = 'block';
      }
    });

    clientDropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      const id = item.getAttribute('data-id');
      const client = state.clients.find(c => c.id === id);
      if (client) {
        invoiceSelectedClient = client;
        document.getElementById('invoice-client-id').value = client.id;
        clientInput.value = client.name;
        clientDropdown.style.display = 'none';
      }
    });
  }

  // Gear Autocomplete
  let selectedGearForAdd = null;
  if (gearInput) {
    gearInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        gearDropdown.style.display = 'none';
        selectedGearForAdd = null;
        btnAddItem.disabled = true;
        return;
      }

      // Filter available gear that isn't already in the invoice list
      const matches = state.gear.filter(g => 
        (g.status === 'Available' || g.status === 'Internal Use') &&
        !invoiceItems.some(item => item.id === g.id) &&
        ((g.name || '').toLowerCase().includes(query) || (g.assetTag || '').toLowerCase().includes(query))
      );

      if (matches.length > 0) {
        gearDropdown.innerHTML = matches.map(g => `
          <div class="autocomplete-item" data-id="${g.id}">
            <strong>${escapeHtmlText(g.name)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtmlText(g.assetTag || 'No Tag')} - GH₵${Number(g.dailyRate || 0).toFixed(2)}</div>
          </div>
        `).join('');
        gearDropdown.style.display = 'block';
      } else {
        gearDropdown.innerHTML = '<div style="padding: 0.5rem 1rem; color: var(--text-muted); font-size: 0.85rem;">No available gear found</div>';
        gearDropdown.style.display = 'block';
      }
    });

    gearDropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      const id = item.getAttribute('data-id');
      const gear = state.gear.find(g => g.id === id);
      if (gear) {
        selectedGearForAdd = gear;
        document.getElementById('invoice-gear-id').value = gear.id;
        gearInput.value = gear.name;
        gearDropdown.style.display = 'none';
        btnAddItem.disabled = false;
      }
    });
  }

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (clientInput && !clientInput.contains(e.target) && !clientDropdown.contains(e.target)) {
      clientDropdown.style.display = 'none';
    }
    if (gearInput && !gearInput.contains(e.target) && !gearDropdown.contains(e.target)) {
      gearDropdown.style.display = 'none';
    }
  });

  // Add Item Logic
  if (btnAddItem) {
    btnAddItem.addEventListener('click', () => {
      if (!selectedGearForAdd) return;
      invoiceItems.push({
        id: selectedGearForAdd.id,
        name: selectedGearForAdd.name,
        assetTag: selectedGearForAdd.assetTag || 'No Tag',
        quantity: 1,
        unitPrice: Number(selectedGearForAdd.dailyRate || 0)
      });
      selectedGearForAdd = null;
      gearInput.value = '';
      btnAddItem.disabled = true;
      renderInvoiceItems();
    });
  }

  if (btnPreview) {
    btnPreview.addEventListener('click', previewInvoice);
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', async () => {
      if (window.apiLogActivity) {
        const clientName = invoiceSelectedClient ? invoiceSelectedClient.name : 'Unknown Client';
        const recNumber = document.getElementById('invoice-print-number').textContent || 'Receipt';
        const totalAmount = document.getElementById('invoice-print-total').textContent || 'GH₵ 0.00';
        
        await window.apiLogActivity(
          'GENERATED_INVOICE',
          'Finances',
          `Generated and exported invoice ${recNumber} for ${clientName}`,
          { invoiceNumber: recNumber, client: clientName, total: totalAmount, itemsCount: invoiceItems.length }
        );
      }
      window.print();
    });
  }
}

function renderInvoiceItems() {
  const tbody = document.getElementById('invoice-items-body');
  if (!tbody) return;

  if (invoiceItems.length === 0) {
    tbody.innerHTML = '<tr id="invoice-empty-row"><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No items added to invoice yet.</td></tr>';
    document.getElementById('invoice-subtotal').textContent = 'GH₵ 0.00';
    document.getElementById('invoice-total').textContent = 'GH₵ 0.00';
    return;
  }

  let subtotal = 0;
  tbody.innerHTML = '';

  invoiceItems.forEach((item, index) => {
    const total = item.quantity * item.unitPrice;
    subtotal += total;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${escapeHtmlText(item.name)}</strong>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtmlText(item.assetTag)}</div>
      </td>
      <td style="text-align: center;">
        <input type="number" min="1" value="${item.quantity}" class="form-control" style="width: 60px; padding: 0.2rem; text-align: center; display: inline-block;" onchange="updateInvoiceItem(${index}, 'quantity', this.value)">
      </td>
      <td style="text-align: right;">
        <input type="number" min="0" step="0.01" value="${item.unitPrice.toFixed(2)}" class="form-control" style="width: 90px; padding: 0.2rem; text-align: right; display: inline-block;" onchange="updateInvoiceItem(${index}, 'unitPrice', this.value)">
      </td>
      <td style="text-align: right; font-weight: bold;">GH₵ ${total.toFixed(2)}</td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-icon" onclick="removeInvoiceItem(${index})" style="color: var(--color-danger); padding: 0.2rem;" title="Remove Item">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('invoice-subtotal').textContent = `GH₵ ${subtotal.toFixed(2)}`;
  document.getElementById('invoice-total').textContent = `GH₵ ${subtotal.toFixed(2)}`;
  
  if (window.lucide) lucide.createIcons();
}

window.updateInvoiceItem = function(index, field, value) {
  const val = Number(value);
  if (isNaN(val) || val < 0) return;
  
  if (field === 'quantity') {
    invoiceItems[index].quantity = Math.max(1, Math.floor(val));
  } else if (field === 'unitPrice') {
    invoiceItems[index].unitPrice = val;
  }
  renderInvoiceItems();
};

window.removeInvoiceItem = function(index) {
  invoiceItems.splice(index, 1);
  renderInvoiceItems();
};

function previewInvoice() {
  if (!invoiceSelectedClient) {
    showToast('Please select a client to invoice.', 'warning');
    return;
  }
  if (invoiceItems.length === 0) {
    showToast('Please add at least one item to the invoice.', 'warning');
    return;
  }

  // Populate Preview
  const status = document.getElementById('invoice-status').value;
  const statusEl = document.getElementById('invoice-print-status');
  statusEl.textContent = status;
  if (status === 'Paid') {
    statusEl.style.color = '#22c55e'; // Green
  } else {
    statusEl.style.color = '#ef4444'; // Red
  }

  document.getElementById('invoice-print-client-name').textContent = invoiceSelectedClient.name;
  document.getElementById('invoice-print-client-phone').textContent = invoiceSelectedClient.phone || '';

  const recNumber = 'REC-' + Math.floor(10000 + Math.random() * 90000);
  document.getElementById('invoice-print-number').textContent = recNumber;

  const rawDate = document.getElementById('invoice-sale-date').value;
  if (rawDate) {
    const d = new Date(rawDate);
    const dateString = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    document.getElementById('invoice-print-date').textContent = dateString;
  }

  const tbody = document.getElementById('invoice-print-items');
  tbody.innerHTML = '';
  let subtotal = 0;

  invoiceItems.forEach(item => {
    const total = item.quantity * item.unitPrice;
    subtotal += total;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #e2e8f0';
    tr.innerHTML = `
      <td style="padding: 0.75rem 0.5rem; color: #334155;">
        <div style="font-weight: 600; color: #0f172a;">${escapeHtmlText(item.name)}</div>
        <div style="font-size: 0.8rem; color: #64748b;">${escapeHtmlText(item.assetTag)}</div>
      </td>
      <td style="text-align: center; padding: 0.75rem 0.5rem; color: #334155;">${item.quantity.toFixed(2)}</td>
      <td style="text-align: right; padding: 0.75rem 0.5rem; color: #334155;">GH₵ ${item.unitPrice.toFixed(2)}</td>
      <td style="text-align: right; padding: 0.75rem 0.5rem; color: #0f172a; font-weight: 500;">GH₵ ${total.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('invoice-print-subtotal').textContent = `GH₵ ${subtotal.toFixed(2)}`;
  document.getElementById('invoice-print-total').textContent = `GH₵ ${subtotal.toFixed(2)}`;

  openModal('modal-custom-invoice');
}

// Attach init to DOM content loaded or call from main app.js
document.addEventListener('DOMContentLoaded', () => {
  initInvoiceGenerator();
});
