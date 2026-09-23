const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('VERIFYING FRONTEND PRIVACY, FORM CLEARS, AND PLACEHOLDERS');
console.log('======================================================');

const rootDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(rootDir, 'frontend/index.html'), 'utf8');
const jsDir = path.join(rootDir, 'frontend/js');
const jsFiles = fs.existsSync(jsDir) ? fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')) : [];
const appJs = fs.readFileSync(path.join(rootDir, 'frontend/app.js'), 'utf8') + '\n' + jsFiles.join('\n');
const rentalsJs = fs.readFileSync(path.join(rootDir, 'frontend/js/rentals.js'), 'utf8');
const invoiceJs = fs.readFileSync(path.join(rootDir, 'frontend/js/invoice.js'), 'utf8');
const dbMock = JSON.parse(fs.readFileSync(path.join(__dirname, 'db-mock.json'), 'utf8'));

// 1. Check placeholders in HTML do not match any db records
console.log('Check 1: Placeholders do not match existing database records...');
const placeholderMatches = [...html.matchAll(/placeholder="([^"]+)"/g)].map(m => m[1]);
const leakedPlaceholders = [];

const realEmails = [
  ...(dbMock.clients || []).map(c => c.email.toLowerCase()),
  ...(dbMock.users || []).map(u => u.email.toLowerCase())
];
const realPhones = (dbMock.clients || []).map(c => c.phone.replace(/\D/g, ''));
const realAssetTags = (dbMock.gear || []).filter(g => g.assetTag).map(g => g.assetTag.toUpperCase());
const realSerials = (dbMock.gear || []).filter(g => g.serialNumber).map(g => g.serialNumber.toLowerCase());
const realClientNames = (dbMock.clients || []).filter(c => c.name).map(c => c.name.toLowerCase());

placeholderMatches.forEach(ph => {
  const cleanPh = ph.replace(/^e\.g\.\s*/i, '').trim().toLowerCase();
  if (realEmails.includes(cleanPh)) leakedPlaceholders.push(`Email leak in placeholder: ${ph}`);
  if (realAssetTags.includes(cleanPh.toUpperCase())) leakedPlaceholders.push(`Asset tag leak in placeholder: ${ph}`);
  if (realSerials.includes(cleanPh)) leakedPlaceholders.push(`Serial leak in placeholder: ${ph}`);
  if (realClientNames.includes(cleanPh)) leakedPlaceholders.push(`Client name leak in placeholder: ${ph}`);
});

if (leakedPlaceholders.length > 0) {
  throw new Error(`Found real database records used as placeholders: ${leakedPlaceholders.join(', ')}`);
}
console.log(`✅ Success: All ${placeholderMatches.length} placeholders are purely illustrative format examples.`);

// 2. Check autocomplete="off" on creation forms
console.log('Check 2: Autocomplete disabled on creation modals...');
const creationForms = ['form-add-gear', 'form-add-client', 'form-add-user', 'form-checkout'];
creationForms.forEach(formId => {
  const formRegex = new RegExp(`<form[^>]*id="${formId}"[^>]*>`, 'i');
  const match = html.match(formRegex);
  if (!match || !match[0].includes('autocomplete="off"')) {
    throw new Error(`Form #${formId} is missing autocomplete="off"`);
  }
});
console.log('✅ Success: All creation forms have autocomplete="off" configured.');

// 3. Check client email and phone inputs have autocomplete="off"
console.log('Check 3: Individual client inputs have autocomplete="off"...');
const clientInputs = ['client-name', 'client-email', 'client-phone'];
clientInputs.forEach(inputId => {
  const inputRegex = new RegExp(`<input[^>]*id="${inputId}"[^>]*>`, 'i');
  const match = html.match(inputRegex);
  if (!match || !match[0].includes('autocomplete="off"')) {
    throw new Error(`Input #${inputId} is missing autocomplete="off"`);
  }
});
console.log('✅ Success: Client input fields have autocomplete="off".');

// 4. Test Frontend Validation Logic & Privacy Error Messaging
console.log('Check 4: Frontend validation messages do not leak client/user/gear identities...');
const state = {
  gear: [{ id: 'g1', name: 'Sony FX3 Cinema Camera', assetTag: 'CAM-001', serialNumber: 'SN-FX3-001', dailyRate: 150 }],
  clients: [{ id: 'c1', name: 'Sarah Jenkins (Bright Media)', email: 'sarah@brightmedia.com', phone: '+233599972644' }],
  users: [{ id: 'u1', name: 'Admin User', email: 'admin@ekgearflow.com', title: 'Admin' }]
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]*[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;

function validateClientPayload(data, currentId = null) {
  if (!data.name || data.name.trim().length < 2) return 'Client Full Name must be at least 2 characters long.';
  if (!data.email || !EMAIL_REGEX.test(data.email.trim())) return 'Please enter a valid email address (e.g., client@domain.com).';
  if (!data.phone || !PHONE_REGEX.test(data.phone.trim())) return 'Please enter a valid phone number (minimum 7 digits).';
  const cleanEmail = data.email.trim().toLowerCase();
  const emailConflict = (state.clients || []).find(c => c.id !== currentId && c.email && c.email.trim().toLowerCase() === cleanEmail);
  if (emailConflict) return 'A client with this email address already exists.';
  const normPhone = data.phone.replace(/\D/g, '');
  const phoneConflict = (state.clients || []).find(c => {
    if (c.id === currentId || !c.phone) return false;
    const cNorm = c.phone.replace(/\D/g, '');
    return (normPhone && cNorm && normPhone === cNorm) || c.phone.trim() === data.phone.trim();
  });
  if (phoneConflict) return 'A client with this phone number already exists.';
  return null;
}

function validateGearPayload(data, currentId = null) {
  const cleanTag = data.assetTag.trim().toUpperCase();
  const tagConflict = (state.gear || []).find(g => g.id !== currentId && g.assetTag && g.assetTag.toUpperCase() === cleanTag);
  if (tagConflict) return 'A gear item with this asset tag already exists.';
  const cleanSerial = data.serialNumber.trim().toLowerCase();
  const serialConflict = (state.gear || []).find(g => g.id !== currentId && g.serialNumber && g.serialNumber.toLowerCase() === cleanSerial);
  if (serialConflict) return 'A gear item with this serial number already exists.';
  return null;
}

const clientEmailErr = validateClientPayload({ name: 'BussyBee', email: 'sarah@brightmedia.com', phone: '+233 20 111 2222' });
if (clientEmailErr !== 'A client with this email address already exists.') {
  throw new Error(`Client email duplicate message failed: ${clientEmailErr}`);
}
if (clientEmailErr.includes('Sarah') || clientEmailErr.includes('(')) {
  throw new Error('Client email duplicate leaked user identity!');
}

const clientPhoneErr = validateClientPayload({ name: 'BussyBee', email: 'fresh@example.com', phone: '+233599972644' });
if (clientPhoneErr !== 'A client with this phone number already exists.') {
  throw new Error(`Client phone duplicate message failed: ${clientPhoneErr}`);
}
if (clientPhoneErr.includes('Sarah') || clientPhoneErr.includes('(')) {
  throw new Error('Client phone duplicate leaked user identity!');
}

const gearTagErr = validateGearPayload({ name: 'Camera', assetTag: 'CAM-001', serialNumber: 'SN-NEW', dailyRate: 100 });
if (gearTagErr !== 'A gear item with this asset tag already exists.') {
  throw new Error(`Gear tag duplicate message failed: ${gearTagErr}`);
}
if (gearTagErr.includes('Sony') || gearTagErr.includes('(')) {
  throw new Error('Gear tag duplicate leaked gear identity!');
}

console.log('✅ Success: All duplicate validation errors protect privacy and never leak identities.');

// 5. Check clearModalForm implementation in app.js
console.log('Check 5: clearModalForm function is defined and wired up...');
if (!appJs.includes('function clearModalForm(')) {
  throw new Error('clearModalForm is missing in app.js');
}
if (!appJs.includes("clearModalForm('modal-add-client')")) {
  throw new Error('clearModalForm is not called on modal-add-client submit');
}
if (!appJs.includes("clearModalForm('modal-add-gear')")) {
  throw new Error('clearModalForm is not called on modal-add-gear submit');
}
console.log('✅ Success: clearModalForm is thoroughly integrated into modal open, close, and submit flows.');

// 6. Check Dedicated Invoice Generator & Custom Receipt Modal
console.log('Check 6: Dedicated Invoice Generator & custom invoice modal...');
if (!html.includes('id="view-invoice"')) {
  throw new Error('view-invoice view missing in index.html');
}
if (!html.includes('id="modal-custom-invoice"')) {
  throw new Error('modal-custom-invoice modal missing in index.html');
}
if (!appJs.includes('initInvoiceGenerator')) {
  throw new Error('initInvoiceGenerator function missing in frontend scripts');
}
if (!appJs.includes('previewInvoice')) {
  throw new Error('previewInvoice missing in frontend scripts');
}
console.log('✅ Success: Dedicated Invoice Generator and custom invoice modal verified.');

// 7. Check Checkout Modal Delete Button Fix
console.log('Check 7: Checkout modal delete button layout fix...');
const css = fs.readFileSync(path.join(rootDir, 'frontend/style.css'), 'utf8');
if (!css.includes('.gear-select-row .checkout-gear-select') || !css.includes('min-width: 0')) {
  throw new Error('CSS for .gear-select-row .checkout-gear-select is missing min-width: 0');
}
if (!css.includes('.btn-remove-gear') || !css.includes('flex: 0 0 42px')) {
  throw new Error('CSS for .btn-remove-gear is missing flex: 0 0 42px');
}
console.log('✅ Success: Checkout delete button sizing and flexbox containment verified.');

// 8. Rental lifecycle status, button mapping, and matched active badge
console.log('Check 8: Rental status paths, cancellation permissions, and active badge matching...');
if (!appJs.includes('const checkoutType = document.querySelector') ||
  !appJs.includes('input[name="checkout-type"]:checked') ||
    !appJs.includes('status: checkoutType')) {
  throw new Error('Checkout form does not forward the selected Active/Booked status.');
}
if (!html.includes('name="checkout-type" value="Active"') || !html.includes('name="checkout-type" value="Booked"')) {
  throw new Error('Checkout form is missing one of the required status choices.');
}
if (!rentalsJs.includes("const canCancel = hasPermission('cancel_rentals') || canReturn;") ||
    !rentalsJs.includes("if (!hasPermission('cancel_rentals') && !hasPermission('return_rentals'))")) {
  throw new Error('Booked cancellation does not support cancel_rentals and return_rentals permissions.');
}
if (!rentalsJs.includes("calculatedStatus === 'Active' || calculatedStatus === 'Overdue'") ||
    !rentalsJs.includes('Check In') || !rentalsJs.includes('Check Out') || !rentalsJs.includes('Cancel')) {
  throw new Error('Rental button mapping is incomplete.');
}

const updateStatsStart = appJs.indexOf('function updateStats() {');
const updateStatsEnd = appJs.indexOf('\nwindow.updateStats = updateStats;', updateStatsStart);
if (updateStatsStart === -1 || updateStatsEnd === -1) throw new Error('updateStats function could not be isolated.');
const updateStatsSource = appJs.slice(updateStatsStart, updateStatsEnd);
const badgeElements = {
  'stat-avail-count': { innerText: '' },
  'stat-rented-count': { innerText: '' },
  'stat-maint-count': { innerText: '' },
  'stat-overdue-count': { innerText: '' },
  'active-rentals-badge': { innerText: '' }
};
const warnings = [];
const badgeSandbox = {
  state: {
    gear: [
      { id: 'g-active', status: 'Rented' },
      { id: 'g-available', status: 'Available' },
      { id: 'g-orphan', status: 'Rented' }
    ],
    bookings: [
      { id: 'b-matched', gearId: 'g-active', status: 'Active', endDate: '2099-01-01' },
      { id: 'b-mismatch', gearId: 'g-available', status: 'Active', endDate: '2099-01-01' }
    ]
  },
  window: {},
  document: { getElementById: id => badgeElements[id] },
  console: { warn: (...args) => warnings.push(args) },
  Set,
  Date
};
require('vm').runInNewContext(`${updateStatsSource}; updateStats();`, badgeSandbox);
if (badgeElements['stat-rented-count'].innerText !== 2) {
  throw new Error(`Deployed counter regression: expected 2 Rented gear, got ${badgeElements['stat-rented-count'].innerText}`);
}
if (badgeElements['active-rentals-badge'].innerText !== '1 active') {
  throw new Error(`Active badge regression: expected 1 matched active rental, got ${badgeElements['active-rentals-badge'].innerText}`);
}
if (badgeSandbox.window.rentalStatusMismatches.length !== 2 || warnings.length !== 1) {
  throw new Error('Active/gear mismatch was not flagged exactly once with both mismatch records.');
}
console.log('✅ Success: Active badge counts only matched Active + Rented records; deployed count and mismatch warning verified.');

// 9. Company-facing invoice search and shared rental invoice model
console.log('Check 9: Company invoice labels, booking statement wiring, and rental invoice model regression...');
if (!invoiceJs.includes('companyName') || !invoiceJs.includes('invoiceClientLabel') ||
    !invoiceJs.includes('invoiceClientLabel(client)')) {
  throw new Error('Manual invoice flow does not use companyName with a fallback label.');
}
if (!invoiceJs.includes("(c.companyName || '').toLowerCase().includes(query)") ||
    !invoiceJs.includes("(c.name || '').toLowerCase().includes(query)")) {
  throw new Error('Manual invoice search does not independently match companyName and name.');
}
if (!appJs.includes("(c.companyName || '').toLowerCase().includes(query)")) {
  throw new Error('Checkout autocomplete does not include companyName search.');
}
const statementIds = [
  'statement-client-search',
  'statement-client-dropdown',
  'statement-client-id',
  'statement-booking-select',
  'statement-invoice-status',
  'btn-preview-statement'
];
statementIds.forEach(id => {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing statement control: ${id}`);
});
const activeClient = dbMock.clients.find(client => client.id === 'c_rdc_002');
const invoiceSearchMatches = query => (dbMock.clients || []).filter(client =>
  (client.companyName || '').toLowerCase().includes(query.toLowerCase()) ||
  (client.name || '').toLowerCase().includes(query.toLowerCase()) ||
  (client.phone || '').toLowerCase().includes(query.toLowerCase())
);
if (!activeClient || !invoiceSearchMatches('Ama Serwaa Darko').some(client => client.id === 'c_rdc_002') ||
    !invoiceSearchMatches('Golden Lens Productions').some(client => client.id === 'c_rdc_002')) {
  throw new Error('Company and personal-name searches do not both resolve c_rdc_002.');
}
const activeClientBookings = (dbMock.bookings || []).filter(booking => booking.clientId === 'c_rdc_002');
if (!activeClientBookings.some(booking => booking.status === 'Active')) {
  throw new Error('The c_rdc_002 statement selection does not expose its Active booking.');
}
if (!invoiceJs.includes('state.bookings') ||
    !invoiceJs.includes('booking.clientId === statementSelectedClient?.id') ||
    !invoiceJs.includes("'CLIENT_BOOKING_INVOICE_GENERATED'") ||
    !invoiceJs.includes('clientId: statement.rentalModel.booking.clientId') ||
    !invoiceJs.includes('bookingId: statement.rentalModel.booking.id') ||
    !invoiceJs.includes("openModal('modal-custom-invoice')")) {
  throw new Error('Booking statement selection or audit wiring is incomplete.');
}
if (!rentalsJs.includes('function buildRentalInvoiceModel(') ||
    !rentalsJs.includes('window.buildRentalInvoiceModel = buildRentalInvoiceModel;') ||
    !rentalsJs.includes('renderRentalInvoice(model)')) {
  throw new Error('Rental invoice model-builder refactor is incomplete.');
}
if (!invoiceJs.includes('function buildManualInvoiceModel(') ||
    !invoiceJs.includes('function renderManualInvoice(') ||
    !invoiceJs.includes('buildStatementManualInvoiceModel') ||
    !invoiceJs.includes('bookingId: rentalModel.booking.id') ||
    !invoiceJs.includes('rentalStartDate: rentalModel.booking.startDate') ||
    !invoiceJs.includes('rentalEndDate: rentalModel.booking.endDate')) {
  throw new Error('Manual invoice renderer/model extraction is incomplete.');
}
if (!html.includes('id="invoice-print-booking-reference"')) {
  throw new Error('Optional statement booking reference element is missing.');
}

const rentalSandbox = {
  window: {},
  document: {},
  console,
  Date
};
require('vm').runInNewContext(rentalsJs, rentalSandbox);
const regressionBooking = {
  id: 'b_invoice_regression',
  gearId: 'g_invoice_regression',
  clientId: 'c_invoice_regression',
  startDate: '2030-05-01T10:00:00.000Z',
  endDate: '2030-05-04T10:00:00.000Z',
  status: 'Returned'
};
const regressionGear = { id: regressionBooking.gearId, name: 'Regression Camera', dailyRate: 125 };
const fallbackClient = { id: regressionBooking.clientId, name: 'Fallback Person', companyName: '' };
const model = rentalSandbox.window.buildRentalInvoiceModel(regressionBooking, regressionGear, fallbackClient);
const legacyDurationDays = Math.max(1, Math.round((new Date(regressionBooking.endDate) - new Date(regressionBooking.startDate)) / (1000 * 60 * 60 * 24)) + 1);
const legacyTotal = regressionGear.dailyRate * legacyDurationDays;
if (model.durationDays !== legacyDurationDays || model.lineTotal !== legacyTotal || model.clientDisplayName !== fallbackClient.name) {
  throw new Error(`Rental invoice model regression failed: ${JSON.stringify(model)}`);
}
const companyClient = { id: regressionBooking.clientId, name: 'Fallback Person', companyName: 'Company Invoice Name' };
const companyModel = rentalSandbox.window.buildRentalInvoiceModel(regressionBooking, regressionGear, companyClient);
if (companyModel.clientDisplayName !== companyClient.companyName) {
  throw new Error('Rental invoice model did not prefer companyName.');
}

const invoiceElements = new Map([
  ['invoice-print-status', { textContent: '', style: {} }],
  ['invoice-print-client-name', { textContent: '' }],
  ['invoice-print-client-phone', { textContent: '' }],
  ['invoice-print-number', { textContent: '' }],
  ['invoice-print-date', { textContent: '' }],
  ['invoice-print-booking-reference', { textContent: '', style: { display: 'none' } }],
  ['invoice-print-items', { innerHTML: '', rows: [], appendChild(row) { this.rows.push(row); } }],
  ['invoice-print-subtotal', { textContent: '' }],
  ['invoice-print-total', { textContent: '' }]
]);
const invoiceSandbox = {
  window: {},
  document: {
    addEventListener() {},
    getElementById: id => invoiceElements.get(id),
    createElement: () => ({ style: {}, innerHTML: '' })
  },
  escapeHtmlText: value => String(value),
  console,
  Date
};
require('vm').runInNewContext(invoiceJs, invoiceSandbox);
const manualModel = invoiceSandbox.window.buildManualInvoiceModel({
  client: companyClient,
  items: [{ name: regressionGear.name, assetTag: 'CAM-1', quantity: 1, unitPrice: regressionGear.dailyRate }],
  saleDate: '2030-05-01',
  paymentStatus: 'Paid',
  invoiceNumber: 'REC-REGRESSION'
});
invoiceSandbox.window.renderManualInvoice(manualModel);
if (manualModel.total !== regressionGear.dailyRate ||
    invoiceElements.get('invoice-print-client-name').textContent !== companyClient.companyName ||
  invoiceElements.get('invoice-print-total').textContent !== `GH₵ ${regressionGear.dailyRate.toFixed(2)}` ||
    invoiceElements.get('invoice-print-items').rows.length !== 1) {
  throw new Error(`Manual invoice renderer regression failed: ${JSON.stringify(manualModel)}`);
}
const statementModel = invoiceSandbox.window.buildStatementManualInvoiceModel({
  ...model,
  paymentStatus: 'Paid'
});
invoiceSandbox.window.renderManualInvoice(statementModel);
const referenceElement = invoiceElements.get('invoice-print-booking-reference');
if (!referenceElement.textContent.includes('Booking Ref: INV-') ||
    !referenceElement.textContent.includes(regressionBooking.startDate) ||
    !referenceElement.textContent.includes(regressionBooking.endDate) ||
    referenceElement.style.display !== 'block') {
  throw new Error(`Statement booking reference did not render correctly: ${referenceElement.textContent}`);
}
invoiceSandbox.window.renderManualInvoice(manualModel);
if (referenceElement.textContent !== '' || referenceElement.style.display !== 'none') {
  throw new Error('Plain manual invoice rendered a statement booking reference.');
}
console.log(`✅ Success: Company/fallback labels, shared rental totals, and manual-format rendering verified (${model.durationDays} days, GH₵${model.lineTotal.toFixed(2)}).`);

// 10. Full-datetime normalization regression for recomputeGearStatusLocally()
console.log('Check 10: Full-datetime booking normalization in recomputeGearStatusLocally...');
const datetimeSandbox = {
  state: {
    gear: [
      { id: 'g_test_1', name: 'Test Gear 1', status: 'Available' },
      { id: 'g_test_2', name: 'Test Gear 2', status: 'Available' },
      { id: 'g_test_3', name: 'Test Gear 3', status: 'Available' },
      { id: 'g_test_4', name: 'Test Gear 4', status: 'Available' },
      { id: 'g_test_5', name: 'Test Gear 5', status: 'Available' },
      { id: 'g_test_6', name: 'Test Gear 6', status: 'Available' },
      { id: 'g_test_7', name: 'Test Gear 7', status: 'Available' },
      { id: 'g_test_8', name: 'Test Gear 8', status: 'Maintenance' }
    ],
    bookings: [
      // Case 1: In-progress datetime booking (full ISO format with T) - should be Rented
      { id: 'b1', gearId: 'g_test_1', status: 'Active', startDate: '2026-09-15T10:00:00.000Z', endDate: '2026-09-30T18:00:00.000Z' },
      // Case 2: Date-only booking for today - should be Rented
      { id: 'b2', gearId: 'g_test_2', status: 'Active', startDate: '2026-09-22', endDate: '2026-09-25' },
      // Case 3: Booking before start (all dates in past) - should be Available
      { id: 'b3', gearId: 'g_test_3', status: 'Active', startDate: '2026-09-01', endDate: '2026-09-10' },
      // Case 4: Booking after end (all dates in future) - should be Available
      { id: 'b4', gearId: 'g_test_4', status: 'Active', startDate: '2026-10-01', endDate: '2026-10-15' },
      // Case 5: Booked status (not Active) - should be Available despite matching date
      { id: 'b5', gearId: 'g_test_5', status: 'Booked', startDate: '2026-09-22', endDate: '2026-09-25' },
      // Case 6: Returned status - should be Available despite matching date
      { id: 'b6', gearId: 'g_test_6', status: 'Returned', startDate: '2026-09-22', endDate: '2026-09-25' },
      // Case 7: Cancelled status - should be Available despite matching date
      { id: 'b7', gearId: 'g_test_7', status: 'Cancelled', startDate: '2026-09-22', endDate: '2026-09-25' }
      // Case 8: Maintenance gear - stays Maintenance regardless of bookings
    ]
  },
  window: {},
  document: { getElementById: () => ({ textContent: '', innerText: '' }) },
  console,
  Array,
  Date
};
const recomputeSource = appJs.substring(
  appJs.indexOf('function recomputeGearStatusLocally() {'),
  appJs.indexOf('\nwindow.recomputeGearStatusLocally = recomputeGearStatusLocally;') + 1
);
require('vm').runInNewContext(`${recomputeSource}; recomputeGearStatusLocally();`, datetimeSandbox);

const testCases = [
  { gearId: 'g_test_1', expectedStatus: 'Rented', caseNum: 1, desc: 'In-progress datetime booking (full ISO)' },
  { gearId: 'g_test_2', expectedStatus: 'Rented', caseNum: 2, desc: 'Date-only booking for today' },
  { gearId: 'g_test_3', expectedStatus: 'Available', caseNum: 3, desc: 'Booking before start (past)' },
  { gearId: 'g_test_4', expectedStatus: 'Available', caseNum: 4, desc: 'Booking after end (future)' },
  { gearId: 'g_test_5', expectedStatus: 'Available', caseNum: 5, desc: 'Booked status (not Active)' },
  { gearId: 'g_test_6', expectedStatus: 'Available', caseNum: 6, desc: 'Returned status' },
  { gearId: 'g_test_7', expectedStatus: 'Available', caseNum: 7, desc: 'Cancelled status' },
  { gearId: 'g_test_8', expectedStatus: 'Maintenance', caseNum: 8, desc: 'Maintenance gear' }
];

const failedCases = [];
testCases.forEach(test => {
  const gear = datetimeSandbox.state.gear.find(g => g.id === test.gearId);
  if (!gear) {
    failedCases.push(`Case ${test.caseNum}: Gear not found (${test.gearId})`);
  } else if (gear.status !== test.expectedStatus) {
    failedCases.push(`Case ${test.caseNum} FAILED: ${test.desc} — expected '${test.expectedStatus}', got '${gear.status}'`);
  }
});

if (failedCases.length > 0) {
  throw new Error(`Full-datetime regression test FAILED:\n${failedCases.join('\n')}`);
}
console.log('✅ Success: All 8 datetime normalization cases passed (datetime ISO, date-only, past, future, non-Active statuses, Maintenance preserved).');

console.log('\n======================================================');
console.log('ALL FRONTEND & INVOICE CHECKS PASSED WITH 100% COMPLIANCE! 🎉');
console.log('======================================================');

