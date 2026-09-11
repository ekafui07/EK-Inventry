const http = require('http');

console.log('Starting local server for Auth & RBAC integration testing...');
require('./index.js');

function request(method, path, data, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAuthTests() {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('\n====================================');
  console.log('RUNNING UPDATED AUTH & RBAC TEST SUITE');
  console.log('====================================\n');

  try {
    // 1. Unauthenticated Request
    console.log('Test 1: Unauthenticated request to POST /api/gear...');
    const unauthRes = await request('POST', '/api/gear', { name: 'Unauthorized Item' });
    if (unauthRes.statusCode === 401) {
      console.log('✅ Success: Unauthenticated access rejected with 401 Unauthorized.\n');
    } else {
      throw new Error(`Expected 401 but received ${unauthRes.statusCode}`);
    }

    // 2. Admin Login
    console.log('Test 2: Admin Login (admin@gearflow.com)...');
    const adminLoginRes = await request('POST', '/api/auth/login', {
      email: 'admin@gearflow.com',
      password: 'Admin@123'
    });
    if (adminLoginRes.statusCode !== 200 || !adminLoginRes.body.token) {
      throw new Error('Admin login failed');
    }
    const adminToken = adminLoginRes.body.token;
    console.log('✅ Success: Admin logged in successfully!\n');

    // 3. Staff Login
    console.log('Test 3: Staff Login (staff@gearflow.com)...');
    const staffLoginRes = await request('POST', '/api/auth/login', {
      email: 'staff@gearflow.com',
      password: 'Staff@123'
    });
    if (staffLoginRes.statusCode !== 200 || !staffLoginRes.body.token) {
      throw new Error('Staff login failed');
    }
    const staffToken = staffLoginRes.body.token;
    console.log('✅ Success: Staff logged in successfully!\n');

    // 4. Staff Trying to Add Gear (Blocked for Staff)
    console.log('Test 4: Staff attempting to add gear (POST /api/gear)...');
    const staffAddGearRes = await request('POST', '/api/gear', {
      name: 'Rogue Gear',
      category: 'Cameras',
      serialNumber: 'SN-ILLEGAL',
      dailyRate: 150
    }, staffToken);
    if (staffAddGearRes.statusCode === 403) {
      console.log('✅ Success: Staff blocked from adding gear (403 Forbidden).\n');
    } else {
      throw new Error(`Expected 403 for Staff adding gear, got ${staffAddGearRes.statusCode}`);
    }

    // 5. Staff CAN Cancel Bookings (Requirement #2: Staff granted permission to cancel bookings)
    console.log('Test 5: Staff cancelling a booking (PUT /api/bookings/:id/cancel)...');
    // Create a booking first to cancel
    const testBookingRes = await request('POST', '/api/bookings', {
      gearId: 'g2',
      clientId: 'c1',
      startDate: '2026-11-01',
      endDate: '2026-11-03'
    }, staffToken);

    if (testBookingRes.statusCode !== 201) {
      throw new Error(`Failed to create test booking: ${JSON.stringify(testBookingRes.body)}`);
    }
    const testBookingId = testBookingRes.body.id;

    const cancelRes = await request('PUT', `/api/bookings/${testBookingId}/cancel`, null, staffToken);
    if (cancelRes.statusCode === 200 && cancelRes.body.success) {
      console.log('✅ Success: Staff successfully cancelled booking as permitted!\n');
    } else {
      throw new Error(`Staff cancellation failed with status ${cancelRes.statusCode}`);
    }

    // 6. Staff Trying to Register Users (Requirement #2: Only Admin registers staff/manages users)
    console.log('Test 6: Staff attempting to register a new user (POST /api/users)...');
    const staffRegisterRes = await request('POST', '/api/users', {
      name: 'Unauthorized User',
      email: 'rogue@gearflow.com',
      password: 'Password123'
    }, staffToken);
    if (staffRegisterRes.statusCode === 403) {
      console.log('✅ Success: Staff blocked from registering users (403 Forbidden).\n');
    } else {
      throw new Error(`Expected 403 for Staff user registration, got ${staffRegisterRes.statusCode}`);
    }

    // 7. Policy Enforcement: Block Any Attempt to Create Another Admin Account (Requirement #1)
    console.log('Test 7: Attempting to create an extra Admin account (POST /api/users with role=admin)...');
    const extraAdminRes = await request('POST', '/api/users', {
      name: 'Second Admin',
      email: 'admin2@gearflow.com',
      password: 'AdminPassword123',
      role: 'admin'
    }, adminToken);
    if (extraAdminRes.statusCode === 400 && extraAdminRes.body.error.includes('Only one primary Administrator account')) {
      console.log('✅ Success: System policy blocked extra admin account creation:');
      console.log(`   "${extraAdminRes.body.error}"\n`);
    } else {
      throw new Error(`Expected 400 policy rejection for second admin, got ${extraAdminRes.statusCode}`);
    }

    // 8. Admin Successfully Registers a Staff Member (Requirement #2)
    console.log('Test 8: Admin registering a legitimate staff member (POST /api/users)...');
    const timestamp = Date.now();
    const newStaffRes = await request('POST', '/api/users', {
      name: 'Dave Operations',
      email: `dave_${timestamp}@gearflow.com`,
      password: 'DaveStaff@123'
    }, adminToken);
    if (newStaffRes.statusCode === 201 && newStaffRes.body.user && newStaffRes.body.user.role === 'staff') {
      console.log(`✅ Success: Admin registered staff member "${newStaffRes.body.user.name}" with role: ${newStaffRes.body.user.role}\n`);
    } else {
      throw new Error(`Admin staff registration failed: ${JSON.stringify(newStaffRes.body)}`);
    }

    // 9. Admin Fetching User List
    console.log('Test 9: Admin viewing all system users (GET /api/users)...');
    const usersListRes = await request('GET', '/api/users', null, adminToken);
    if (usersListRes.statusCode === 200 && Array.isArray(usersListRes.body)) {
      console.log(`✅ Success: Found ${usersListRes.body.length} registered system users.\n`);
    } else {
      throw new Error('Failed to fetch users list');
    }

    console.log('====================================');
    console.log('ALL UPDATED RBAC & POLICY TESTS PASSED! 🎉');
    console.log('====================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exit(1);
  }
}

runAuthTests();
