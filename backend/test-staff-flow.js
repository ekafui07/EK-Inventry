const http = require('http');
const fs = require('fs');
const path = require('path');

function request(method, path, data, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('TESTING ADMIN-ONLY STAFF MANAGEMENT & STAFF LOGIN/CLICK FLOW');
  console.log('================================================================\n');

  try {
    // 1. Admin Login
    console.log('Step 1: Authenticating as Admin (admin@gearflow.com)...');
    const adminLogin = await request('POST', '/api/login', {
      email: 'admin@gearflow.com',
      password: 'Admin@123',
      accountType: 'Admin'
    });
    if (adminLogin.status !== 200 || !adminLogin.body.token) {
      throw new Error(`Admin login failed: status ${adminLogin.status}`);
    }
    const adminToken = adminLogin.body.token;
    console.log('✅ Admin authenticated successfully.\n');

    // 2. Admin Creates a Staff Member
    const testStaffEmail = `staff_flow_${Date.now()}@ekgearflow.com`;
    console.log(`Step 2: Admin creating new staff member (${testStaffEmail})...`);
    console.log('   (Attempting to include "manage_users" to verify backend auto-strips it for staff)');
    const createStaffRes = await request('POST', '/api/users', {
      name: 'Flow Test Staff',
      email: testStaffEmail,
      title: 'Equipment Coordinator',
      accountType: 'Staff',
      permissions: ['manage_clients', 'create_rentals', 'return_rentals', 'manage_users'],
      password: '12345',
      mustChangePassword: true
    }, adminToken);

    if (createStaffRes.status !== 200 && createStaffRes.status !== 201) {
      throw new Error(`Failed to create staff member: ${JSON.stringify(createStaffRes.body)}`);
    }
    const staffId = createStaffRes.body.id;
    const staffPerms = createStaffRes.body.permissions || [];
    if (staffPerms.includes('manage_users')) {
      throw new Error('SECURITY VIOLATION: Staff member was granted "manage_users" permission!');
    }
    console.log('✅ Staff created with mustChangePassword: true');
    console.log('✅ Backend successfully stripped "manage_users" from staff permissions.\n');

    // 3. Staff First-Time Login
    console.log('Step 3: Staff logging in with temporary password "12345"...');
    const staffLogin = await request('POST', '/api/login', {
      email: testStaffEmail,
      password: '12345',
      accountType: 'Staff'
    });
    if (staffLogin.status !== 200 || !staffLogin.body.token) {
      throw new Error(`Staff login failed: ${JSON.stringify(staffLogin.body)}`);
    }
    if (staffLogin.body.mustChangePassword !== true) {
      throw new Error('Expected mustChangePassword to be true on first login');
    }
    const initialStaffToken = staffLogin.body.token;
    console.log('✅ Staff logged in successfully. mustChangePassword is true.\n');

    // 4. Staff Mandatory Password Change
    console.log('Step 4: Staff updating password via /api/users/:id/change-password...');
    const changePassRes = await request('POST', `/api/users/${staffId}/change-password`, {
      newPassword: 'StaffSecurePass2026!'
    }, initialStaffToken);

    if (changePassRes.status !== 200) {
      throw new Error(`Password change failed: ${JSON.stringify(changePassRes.body)}`);
    }
    if (changePassRes.body.mustChangePassword !== false) {
      throw new Error('Expected mustChangePassword to be false after password change');
    }
    if (!changePassRes.body.token) {
      throw new Error('BUG REGRESSION: /api/users/:id/change-password did NOT return a valid JWT token! Session will be broken!');
    }
    const activeStaffToken = changePassRes.body.token;
    console.log('✅ Password changed successfully.');
    console.log('✅ Fresh JWT authentication token successfully issued and returned!\n');

    // 5. Staff Navigation & Data Fetching (Simulating tab clicks)
    console.log('Step 5: Simulating user navigation clicks across all tabs with active token...');
    const tabsToTest = [
      { name: 'Dashboard / Gear', path: '/api/gear' },
      { name: 'Client Directory', path: '/api/clients' },
      { name: 'Rentals Tracker', path: '/api/bookings' }
    ];

    for (const tab of tabsToTest) {
      const res = await request('GET', tab.path, null, activeStaffToken);
      if (res.status !== 200) {
        throw new Error(`Request to ${tab.path} failed with status ${res.status}: ${JSON.stringify(res.body)}`);
      }
      console.log(`   - Clicked [${tab.name}]: GET ${tab.path} -> 200 OK (Data loaded smoothly, NO 401 logout!)`);
    }
    console.log('✅ All application views load cleanly without triggering any 401 Unauthorized responses.\n');

    // 6. Verify Staff is Strictly Blocked from Managing Staff
    console.log('Step 6: Verifying staff CANNOT access or manage staff accounts...');
    const staffGetUsers = await request('GET', '/api/users', null, activeStaffToken);
    if (staffGetUsers.status !== 403) {
      throw new Error(`Expected 403 Forbidden for staff accessing /api/users, got ${staffGetUsers.status}`);
    }
    console.log('✅ GET /api/users -> 403 Forbidden (Blocked for staff)');

    const staffPostUsers = await request('POST', '/api/users', { name: 'Illegal User' }, activeStaffToken);
    if (staffPostUsers.status !== 403) {
      throw new Error(`Expected 403 Forbidden for staff creating user, got ${staffPostUsers.status}`);
    }
    console.log('✅ POST /api/users -> 403 Forbidden (Blocked for staff)');

    const staffDeleteUsers = await request('DELETE', `/api/users/u1`, null, activeStaffToken);
    if (staffDeleteUsers.status !== 403) {
      throw new Error(`Expected 403 Forbidden for staff deleting user, got ${staffDeleteUsers.status}`);
    }
    console.log('✅ DELETE /api/users/:id -> 403 Forbidden (Blocked for staff)\n');

    // 7. Verify Frontend HTML Template Integrity
    console.log('Step 7: Verifying frontend HTML templates...');
    const html = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');

    if (html.includes('value="manage_users"')) {
      throw new Error('HTML still contains checkbox with value="manage_users"!');
    }
    console.log('✅ Confirmed: "manage_users" checkbox completely removed from user modals.');

    const navUsersMatch = html.match(/<button[^>]*id="nav-users"[^>]*>/i);
    if (!navUsersMatch || !navUsersMatch[0].includes('display: none;')) {
      throw new Error('#nav-users button is not hidden by default in index.html!');
    }
    console.log('✅ Confirmed: #nav-users is hidden by default in HTML.\n');

    // Clean up test staff user
    await request('DELETE', `/api/users/${staffId}`, null, adminToken);
    console.log('Cleaned up test staff user.');

    console.log('\n================================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! ZERO ERRORS OR LOGOUT REGRESSIONS');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

run();
