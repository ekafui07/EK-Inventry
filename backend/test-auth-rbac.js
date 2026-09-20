const http = require('http');
const jwt = require('jsonwebtoken');
const { app, seedInitialUsers } = require('./index.js');
const { JWT_SECRET } = require('./middleware/auth');

let serverInstance = null;
let testPort = 0;

function startTestServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      testPort = server.address().port;
      console.log(`Started isolated test server on ephemeral port ${testPort}...\n`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

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
      hostname: '127.0.0.1',
      port: testPort,
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
  serverInstance = await startTestServer();
  if (typeof seedInitialUsers === 'function') {
    await seedInitialUsers();
  }
  await new Promise((resolve) => setTimeout(resolve, 200));

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
    let staffLoginRes = await request('POST', '/api/auth/login', {
      email: 'staff@gearflow.com',
      password: 'Staff@123'
    });
    if (staffLoginRes.statusCode !== 200 || !staffLoginRes.body.token) {
      staffLoginRes = await request('POST', '/api/auth/login', {
        email: 'staff@gearflow.com',
        password: '12345'
      });
    }
    if (staffLoginRes.statusCode !== 200 || !staffLoginRes.body.token) {
      throw new Error('Staff login failed');
    }
    const staffToken = staffLoginRes.body.token;
    console.log('✅ Success: Staff logged in successfully!\n');

    // 4. Staff Permission Enforcement on POST /api/gear
    console.log('Test 4.1: Staff WITHOUT manage_gear blocked from adding gear (403 Forbidden)...');
    const noGearToken = jwt.sign({ id: 'u_no_gear', email: 'nogear@gearflow.com', role: 'staff', permissions: ['create_rentals'] }, JWT_SECRET);
    const unauthAddGearRes = await request('POST', '/api/gear', {
      name: 'Rogue Gear',
      assetTag: 'TAG-ROGUE',
      category: 'Cameras',
      serialNumber: 'SN-ILLEGAL',
      dailyRate: 150
    }, noGearToken);
    if (unauthAddGearRes.statusCode === 403) {
      console.log('✅ Success: Staff without manage_gear blocked (403 Forbidden).\n');
    } else {
      throw new Error(`Expected 403 for Staff without manage_gear, got ${unauthAddGearRes.statusCode}`);
    }

    console.log('Test 4.2: Staff WITH manage_gear successfully adding gear (201 Created)...');
    const withGearToken = jwt.sign({ id: 'u_with_gear', email: 'withgear@gearflow.com', role: 'staff', permissions: ['manage_gear'] }, JWT_SECRET);
    const staffAddGearRes = await request('POST', '/api/gear', {
      name: 'Authorized Staff Gear',
      assetTag: 'TAG-STAFF-01',
      category: 'Cameras',
      serialNumber: 'SN-STAFF-001',
      dailyRate: 150
    }, withGearToken);
    if (staffAddGearRes.statusCode === 201) {
      console.log('✅ Success: Staff with manage_gear created gear (201 Created).\n');
      await request('DELETE', `/api/gear/${staffAddGearRes.body.id}`, null, adminToken);
    } else {
      throw new Error(`Expected 201 for Staff with manage_gear, got ${staffAddGearRes.statusCode}: ${JSON.stringify(staffAddGearRes.body)}`);
    }

    // 5. Staff CAN Cancel Bookings (Requirement #2: Staff granted permission to cancel bookings)
    console.log('Test 5: Staff cancelling a booking (PUT /api/bookings/:id/cancel)...');
    // Create a booking first to cancel (use unique future year to prevent conflict across test runs)
    const testYear = 2040 + Math.floor(Math.random() * 100);
    const testBookingRes = await request('POST', '/api/bookings', {
      gearId: 'g2',
      clientId: 'c1',
      startDate: `${testYear}-11-01`,
      endDate: `${testYear}-11-03`
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

    // 7. Admin can register an Administrator account (POST /api/users with role=admin)
    console.log('Test 7: Admin creating an Administrator account (POST /api/users with role=admin)...');
    const extraAdminRes = await request('POST', '/api/users', {
      name: 'Second Admin',
      email: `admin2_${Date.now()}@gearflow.com`,
      password: 'AdminPassword123',
      role: 'admin'
    }, adminToken);
    if (extraAdminRes.statusCode === 201) {
      console.log('✅ Success: Admin successfully registered an Administrator account!\n');
    } else {
      throw new Error(`Expected 201 for creating admin, got ${extraAdminRes.statusCode}`);
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

    // Clean up created test user
    if (newStaffRes.body.user && newStaffRes.body.user.id) {
      await request('DELETE', `/api/users/${newStaffRes.body.user.id}`, null, adminToken);
    }

    console.log('====================================');
    console.log('ALL UPDATED RBAC & POLICY TESTS PASSED! 🎉');
    console.log('====================================\n');
    if (serverInstance) serverInstance.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    if (serverInstance) serverInstance.close();
    process.exit(1);
  }
}

runAuthTests();
