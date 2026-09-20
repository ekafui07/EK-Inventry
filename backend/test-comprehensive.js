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
      console.log(`Started test server on ephemeral port ${testPort}...\n`);
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

async function runComprehensiveTests() {
  serverInstance = await startTestServer();
  if (typeof seedInitialUsers === 'function') {
    await seedInitialUsers();
  }
  await new Promise((resolve) => setTimeout(resolve, 300));

  console.log('======================================================');
  console.log('RUNNING COMPREHENSIVE PRE-DEPLOYMENT TEST SUITE');
  console.log('======================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & SECURITY
    // -------------------------------------------------------------------------
    console.log('--- 1. AUTHENTICATION & SECURITY ---');

    console.log('Test 1.1: Admin login with valid credentials...');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@gearflow.com',
      password: 'Admin@123'
    });
    if (adminLogin.statusCode !== 200 || !adminLogin.body.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
    }
    const adminToken = adminLogin.body.token;
    const adminId = adminLogin.body.id;
    console.log('✅ Success: Admin authenticated with JWT token.');

    console.log('Test 1.2: Staff login with valid credentials...');
    let staffLogin = await request('POST', '/api/auth/login', {
      email: 'staff@gearflow.com',
      password: 'Staff@123'
    });
    if (staffLogin.statusCode !== 200 || !staffLogin.body.token) {
      staffLogin = await request('POST', '/api/auth/login', {
        email: 'staff@gearflow.com',
        password: '12345'
      });
    }
    if (staffLogin.statusCode !== 200 || !staffLogin.body.token) {
      throw new Error(`Staff login failed: ${JSON.stringify(staffLogin.body)}`);
    }
    const staffToken = staffLogin.body.token;
    console.log('✅ Success: Staff authenticated with JWT token.');

    console.log('Test 1.3: Login rejection on wrong password...');
    const invalidLogin = await request('POST', '/api/auth/login', {
      email: 'admin@gearflow.com',
      password: 'WrongPassword'
    });
    if (invalidLogin.statusCode !== 401) {
      throw new Error(`Expected 401 on invalid password, got ${invalidLogin.statusCode}`);
    }
    console.log('✅ Success: Invalid credentials rejected with 401.');

    console.log('Test 1.4: Login rejection when role mismatch (Staff selecting Admin login)...');
    const roleMismatchLogin = await request('POST', '/api/auth/login', {
      email: 'staff@gearflow.com',
      password: 'Staff@123',
      accountType: 'Admin'
    });
    if (roleMismatchLogin.statusCode !== 401) {
      throw new Error(`Expected 401 on role mismatch, got ${roleMismatchLogin.statusCode}`);
    }
    console.log('✅ Success: Role mismatch rejected cleanly.');

    // -------------------------------------------------------------------------
    // 2. USER MANAGEMENT, RBAC, BAN & SECURITY POLICIES
    // -------------------------------------------------------------------------
    console.log('\n--- 2. USER MANAGEMENT & SECURITY POLICIES ---');

    console.log('Test 2.1: Admin creating a new staff member...');
    const ts = Date.now();
    const tsSuffix = String(ts).slice(-4);
    const newStaffRes = await request('POST', '/api/users', {
      name: 'Audit Staff',
      email: `audit_staff_${ts}@gearflow.com`,
      title: 'Gear Tech',
      accountType: 'Staff',
      permissions: ['create_rentals', 'return_rentals']
    }, adminToken);
    if (newStaffRes.statusCode !== 201) {
      throw new Error(`Failed to create staff: ${JSON.stringify(newStaffRes.body)}`);
    }
    const createdStaff = newStaffRes.body.user || newStaffRes.body;
    console.log(`✅ Success: Staff "${createdStaff.name}" created with default password.`);

    console.log('Test 2.2: Banning a staff member and verifying login is BLOCKED...');
    const banRes = await request('PUT', `/api/users/${createdStaff.id}/status`, { status: 'Banned' }, adminToken);
    if (banRes.statusCode !== 200) {
      throw new Error(`Failed to ban staff: ${JSON.stringify(banRes.body)}`);
    }
    const bannedLoginAttempt = await request('POST', '/api/auth/login', {
      email: createdStaff.email,
      password: '12345'
    });
    if (bannedLoginAttempt.statusCode !== 401 || !bannedLoginAttempt.body.error.includes('banned')) {
      throw new Error(`Banned account was able to log in or returned wrong error: ${JSON.stringify(bannedLoginAttempt.body)}`);
    }
    console.log('✅ Success: Banned staff member blocked from login (Fix verified!).');

    console.log('Test 2.3: Admin cannot ban or deactivate their own account...');
    const selfBanAttempt = await request('PUT', `/api/users/${adminId}/status`, { status: 'Banned' }, adminToken);
    if (selfBanAttempt.statusCode !== 400) {
      throw new Error(`Expected 400 when admin attempts self-ban, got ${selfBanAttempt.statusCode}`);
    }
    console.log('✅ Success: Self-ban blocked with 400 Bad Request.');

    console.log('Test 2.4: Admin cannot delete their own account...');
    const selfDeleteAttempt = await request('DELETE', `/api/users/${adminId}`, null, adminToken);
    if (selfDeleteAttempt.statusCode !== 400) {
      throw new Error(`Expected 400 when admin attempts self-deletion, got ${selfDeleteAttempt.statusCode}`);
    }
    console.log('✅ Success: Self-deletion blocked with 400 Bad Request.');

    console.log('Test 2.5: Unbanning staff and testing password reset flow...');
    await request('PUT', `/api/users/${createdStaff.id}/status`, { status: 'Active' }, adminToken);
    const resetPassRes = await request('POST', `/api/users/${createdStaff.id}/reset-password`, null, adminToken);
    if (resetPassRes.statusCode !== 200) {
      throw new Error(`Failed to reset password: ${JSON.stringify(resetPassRes.body)}`);
    }
    const staffLoginAfterReset = await request('POST', '/api/auth/login', {
      email: createdStaff.email,
      password: '12345'
    });
    if (staffLoginAfterReset.statusCode !== 200) {
      throw new Error(`Staff login after password reset failed: ${JSON.stringify(staffLoginAfterReset.body)}`);
    }
    console.log('✅ Success: Password reset to default 12345 and staff successfully logged in.');

    // -------------------------------------------------------------------------
    // 3. GEAR INVENTORY LIFECYCLE & MAINTENANCE
    // -------------------------------------------------------------------------
    console.log('\n--- 3. GEAR INVENTORY & MAINTENANCE ---');

    console.log('Test 3.1: Gear validation rejects invalid daily rate and missing fields...');
    const invalidGear = await request('POST', '/api/gear', {
      name: 'X',
      assetTag: '',
      category: '',
      serialNumber: '',
      dailyRate: -50
    }, adminToken);
    if (invalidGear.statusCode !== 500 && invalidGear.statusCode !== 400) {
      throw new Error(`Expected rejection for invalid gear, got ${invalidGear.statusCode}`);
    }
    console.log('✅ Success: Invalid gear rejected.');

    console.log('Test 3.2: Admin registers a new gear item...');
    const gearTag = `TST-${ts}`;
    const createGearRes = await request('POST', '/api/gear', {
      name: 'RED V-Raptor 8K Cinema Camera',
      assetTag: gearTag,
      category: 'Cameras',
      serialNumber: `SN-RED-${ts}`,
      dailyRate: 350
    }, adminToken);
    if (createGearRes.statusCode !== 201) {
      throw new Error(`Failed to create gear: ${JSON.stringify(createGearRes.body)}`);
    }
    const testGear = createGearRes.body;
    console.log(`✅ Success: Gear registered with ID: ${testGear.id}`);

    console.log('Test 3.3: Toggling maintenance mode (send to repair / put in service)...');
    const maintRes = await request('PUT', `/api/gear/${testGear.id}`, { status: 'Maintenance' }, adminToken);
    if (maintRes.statusCode !== 200 || maintRes.body.status !== 'Maintenance') {
      throw new Error(`Failed to set maintenance: ${JSON.stringify(maintRes.body)}`);
    }
    const availRes = await request('PUT', `/api/gear/${testGear.id}`, { status: 'Available' }, adminToken);
    if (availRes.statusCode !== 200 || availRes.body.status !== 'Available') {
      throw new Error(`Failed to restore available: ${JSON.stringify(availRes.body)}`);
    }
    console.log('✅ Success: Gear status toggled between Maintenance and Available.');

    // -------------------------------------------------------------------------
    // 4. CLIENT DIRECTORY LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- 4. CLIENT DIRECTORY ---');

    console.log('Test 4.1: Registering a new client...');
    const clientRes = await request('POST', '/api/clients', {
      name: 'Universal Visuals Ltd',
      email: `contact_${ts}@universalvisuals.com`,
      phone: `+1 555-444-${tsSuffix}`,
      ghanaCardNumber: `GHA-${tsSuffix}-1`,
      guarantorName: 'Chief Guarantor',
      guarantorGhanaCard: `GHA-${tsSuffix}-G1`,
      guarantorPhone: `+1 555-333-${tsSuffix}`
    }, adminToken);
    if (clientRes.statusCode !== 201) {
      throw new Error(`Failed to create client: ${JSON.stringify(clientRes.body)}`);
    }
    let testClient = clientRes.body;
    console.log(`✅ Success: Client created with ID: ${testClient.id}`);

    console.log('Test 4.2: Updating client details...');
    const updateClientRes = await request('PUT', `/api/clients/${testClient.id}`, {
      name: 'Universal Visuals Studios',
      email: `studio_${ts}@universalvisuals.com`,
      phone: `+1 555-999-${tsSuffix}`
    }, adminToken);
    if (updateClientRes.statusCode !== 200 || updateClientRes.body.name !== 'Universal Visuals Studios') {
      throw new Error(`Failed to update client: ${JSON.stringify(updateClientRes.body)}`);
    }
    testClient = updateClientRes.body;
    console.log('✅ Success: Client details updated.');

    // -------------------------------------------------------------------------
    // 5. RENTAL SCHEDULING, CONFLICT CHECK & STATUS SYNC
    // -------------------------------------------------------------------------
    console.log('\n--- 5. RENTAL SCHEDULING, CONFLICT CHECK & STATUS SYNC ---');

    console.log('Test 5.1: Booking rejection when start date > end date...');
    const invalidDatesBooking = await request('POST', '/api/bookings', {
      gearId: testGear.id,
      clientId: testClient.id,
      startDate: '2030-05-10',
      endDate: '2030-05-01'
    }, staffToken);
    if (invalidDatesBooking.statusCode !== 400) {
      throw new Error(`Expected 400 for inverted dates, got ${invalidDatesBooking.statusCode}`);
    }
    console.log('✅ Success: Inverted rental dates rejected with 400 (Fix verified!).');

    console.log('Test 5.2: Booking creation for test gear (2030-05-01 to 2030-05-10)...');
    const validBookingRes = await request('POST', '/api/bookings', {
      gearId: testGear.id,
      clientId: testClient.id,
      startDate: '2030-05-01',
      endDate: '2030-05-10'
    }, staffToken);
    if (validBookingRes.statusCode !== 201) {
      throw new Error(`Failed to create booking: ${JSON.stringify(validBookingRes.body)}`);
    }
    const testBooking = validBookingRes.body;
    console.log(`✅ Success: Booking confirmed with ID: ${testBooking.id}`);

    console.log('Test 5.3: Double-booking prevention during overlapping period...');
    const conflictBookingRes = await request('POST', '/api/bookings', {
      gearId: testGear.id,
      clientId: testClient.id,
      startDate: '2030-05-05',
      endDate: '2030-05-15'
    }, staffToken);
    if (conflictBookingRes.statusCode !== 400 || !conflictBookingRes.body.message.includes('Double-booking Alert')) {
      throw new Error(`Expected double-booking rejection, got: ${JSON.stringify(conflictBookingRes.body)}`);
    }
    console.log('✅ Success: Overlapping booking blocked by Double-booking Alert.');

    console.log('Test 5.4: Client deletion BLOCKED while having active/upcoming booking...');
    const deleteClientAttempt = await request('DELETE', `/api/clients/${testClient.id}`, null, adminToken);
    if (deleteClientAttempt.statusCode !== 400) {
      throw new Error(`Expected 400 for client deletion with active bookings, got ${deleteClientAttempt.statusCode}`);
    }
    console.log('✅ Success: Client deletion blocked when active bookings exist.');

    console.log('Test 5.5: Cancelling booking and verifying re-booking is allowed...');
    const cancelRes = await request('PUT', `/api/bookings/${testBooking.id}/cancel`, null, staffToken);
    if (cancelRes.statusCode !== 200) {
      throw new Error(`Failed to cancel booking: ${JSON.stringify(cancelRes.body)}`);
    }
    const rebookRes = await request('POST', '/api/bookings', {
      gearId: testGear.id,
      clientId: testClient.id,
      startDate: '2030-05-01',
      endDate: '2030-05-10'
    }, staffToken);
    if (rebookRes.statusCode !== 201) {
      throw new Error(`Re-booking cancelled date range failed: ${JSON.stringify(rebookRes.body)}`);
    }
    const rebookedBooking = rebookRes.body;
    console.log('✅ Success: Cancelled booking released the dates for re-booking.');

    console.log('Test 5.6: Returning booking (check-in)...');
    const returnRes = await request('PUT', `/api/bookings/${rebookedBooking.id}/return`, null, staffToken);
    if (returnRes.statusCode !== 200) {
      throw new Error(`Failed to return booking: ${JSON.stringify(returnRes.body)}`);
    }
    console.log('✅ Success: Gear returned and checked in.');

    // -------------------------------------------------------------------------
    // 6. DATABASE INTEGRITY & DUPLICATE PREVENTION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. DATABASE INTEGRITY & DUPLICATE PREVENTION ---');

    console.log('Test 6.1: Duplicate client email rejection (no info leak)...');
    const dupClientEmail = await request('POST', '/api/clients', {
      name: 'Duplicate Client Name',
      email: testClient.email,
      phone: `+1 999-888-${tsSuffix}`,
      ghanaCardNumber: `GHA-${tsSuffix}-2`,
      guarantorName: 'Chief Guarantor',
      guarantorGhanaCard: `GHA-${tsSuffix}-G2`,
      guarantorPhone: `+1 555-333-8888`
    }, adminToken);
    if (dupClientEmail.statusCode !== 400 || !dupClientEmail.body.error.includes('already exists') || dupClientEmail.body.error.includes('(')) {
      throw new Error(`Expected 400 without leaking owner identity, got ${dupClientEmail.statusCode}: ${JSON.stringify(dupClientEmail.body)}`);
    }
    console.log('✅ Success: Duplicate client email rejected with generic 400 Bad Request (no data leak).');

    console.log('Test 6.2: Duplicate client phone rejection (no info leak)...');
    const dupClientPhone = await request('POST', '/api/clients', {
      name: 'Another Client Name',
      email: `another_${ts}@test.com`,
      phone: testClient.phone,
      ghanaCardNumber: `GHA-${tsSuffix}-3`,
      guarantorName: 'Chief Guarantor',
      guarantorGhanaCard: `GHA-${tsSuffix}-G3`,
      guarantorPhone: `+1 555-333-9999`
    }, adminToken);
    if (dupClientPhone.statusCode !== 400 || !dupClientPhone.body.error.includes('already exists') || dupClientPhone.body.error.includes('(')) {
      throw new Error(`Expected 400 without leaking owner identity, got ${dupClientPhone.statusCode}: ${JSON.stringify(dupClientPhone.body)}`);
    }
    console.log('✅ Success: Duplicate client phone rejected with generic 400 Bad Request (no data leak).');

    console.log('Test 6.3: Client update email collision rejection...');
    const client2Res = await request('POST', '/api/clients', {
      name: 'Client Two',
      email: `client2_${ts}@unique.com`,
      phone: `+1 555-123-${tsSuffix}`,
      ghanaCardNumber: `GHA-${tsSuffix}-4`,
      guarantorName: 'Chief Guarantor',
      guarantorGhanaCard: `GHA-${tsSuffix}-G4`,
      guarantorPhone: `+1 555-333-7777`
    }, adminToken);
    const client2 = client2Res.body;
    const clientCollision = await request('PUT', `/api/clients/${client2.id}`, {
      email: testClient.email
    }, adminToken);
    if (clientCollision.statusCode !== 400 || !clientCollision.body.error.includes('already exists') || clientCollision.body.error.includes('(')) {
      throw new Error(`Expected 400 without leaking owner identity, got ${clientCollision.statusCode}`);
    }
    await request('DELETE', `/api/clients/${client2.id}`, null, adminToken);
    console.log('✅ Success: Client update collision rejected with 400 Bad Request.');

    console.log('Test 6.4: Duplicate gear asset tag rejection (no info leak)...');
    const dupGearTag = await request('POST', '/api/gear', {
      name: 'Duplicate Tag Gear',
      assetTag: testGear.assetTag,
      category: 'Cameras',
      serialNumber: `SN-UNIQUE-${ts}-X`,
      dailyRate: 100
    }, adminToken);
    if (dupGearTag.statusCode !== 400 || !dupGearTag.body.error.includes('already exists') || dupGearTag.body.error.includes('(')) {
      throw new Error(`Expected 400 without leaking owner identity, got ${dupGearTag.statusCode}: ${JSON.stringify(dupGearTag.body)}`);
    }
    console.log('✅ Success: Duplicate gear asset tag rejected with generic 400 Bad Request.');

    console.log('Test 6.5: Duplicate gear serial number rejection (no info leak)...');
    const dupGearSerial = await request('POST', '/api/gear', {
      name: 'Duplicate Serial Gear',
      assetTag: `TAG-UNIQUE-${ts}-Y`,
      category: 'Cameras',
      serialNumber: testGear.serialNumber,
      dailyRate: 100
    }, adminToken);
    if (dupGearSerial.statusCode !== 400 || !dupGearSerial.body.error.includes('already exists') || dupGearSerial.body.error.includes('(')) {
      throw new Error(`Expected 400 without leaking owner identity, got ${dupGearSerial.statusCode}: ${JSON.stringify(dupGearSerial.body)}`);
    }
    console.log('✅ Success: Duplicate gear serial number rejected with generic 400 Bad Request.');

    console.log('Test 6.6: Staff email collision rejection on update...');
    const staffEmailCollision = await request('PUT', `/api/users/${createdStaff.id}`, {
      email: 'admin@gearflow.com'
    }, adminToken);
    if (staffEmailCollision.statusCode !== 400 || !staffEmailCollision.body.error.includes('already exists') || staffEmailCollision.body.error.includes('(')) {
      throw new Error(`Expected 400 for staff email collision, got ${staffEmailCollision.statusCode}: ${JSON.stringify(staffEmailCollision.body)}`);
    }
    console.log('✅ Success: Staff email collision rejected with 400 Bad Request.');

    console.log('Test 6.7: Booking gearIds array deduplication on checkout...');
    const multiDupBooking = await request('POST', '/api/bookings', {
      gearIds: [testGear.id, testGear.id],
      clientId: testClient.id,
      startDate: '2031-01-01',
      endDate: '2031-01-05'
    }, staffToken);
    if (multiDupBooking.statusCode !== 201) {
      throw new Error(`Expected 201 for deduplicated booking checkout, got ${multiDupBooking.statusCode}: ${JSON.stringify(multiDupBooking.body)}`);
    }
    const bId = multiDupBooking.body.id;
    await request('PUT', `/api/bookings/${bId}/cancel`, null, staffToken);
    console.log('✅ Success: Single checkout deduplicated gearIds without duplicate bookings.');

    // -------------------------------------------------------------------------
    // 7. CLEANUP & DELETION POLICIES
    // -------------------------------------------------------------------------
    console.log('\n--- 7. CLEANUP & DELETION POLICIES ---');

    console.log('Test 7.1: Staff member WITHOUT manage_gear blocked from deleting gear (403 Forbidden)...');
    const noGearToken = jwt.sign({ id: 'u_no_gear', email: 'nogear@gearflow.com', role: 'staff', permissions: ['create_rentals'] }, JWT_SECRET);
    const staffDeleteGear = await request('DELETE', `/api/gear/${testGear.id}`, null, noGearToken);
    if (staffDeleteGear.statusCode !== 403) {
      throw new Error(`Expected 403 for staff without manage_gear deleting gear, got ${staffDeleteGear.statusCode}`);
    }
    console.log('✅ Success: Staff without manage_gear blocked from deleting gear.');

    console.log('Test 6.2: Admin successfully deleting test gear when returned...');
    const adminDeleteGear = await request('DELETE', `/api/gear/${testGear.id}`, null, adminToken);
    if (adminDeleteGear.statusCode !== 200) {
      throw new Error(`Failed to delete gear: ${JSON.stringify(adminDeleteGear.body)}`);
    }
    console.log('✅ Success: Admin deleted gear.');

    console.log('Test 6.3: Admin successfully deleting test client when no active bookings remain...');
    const adminDeleteClient = await request('DELETE', `/api/clients/${testClient.id}`, null, adminToken);
    if (adminDeleteClient.statusCode !== 200) {
      throw new Error(`Failed to delete client: ${JSON.stringify(adminDeleteClient.body)}`);
    }
    console.log('✅ Success: Admin deleted client.');

    console.log('Test 6.4: Admin cleaning up created test staff user...');
    const adminDeleteStaff = await request('DELETE', `/api/users/${createdStaff.id}`, null, adminToken);
    if (adminDeleteStaff.statusCode !== 200) {
      throw new Error(`Failed to delete staff user: ${JSON.stringify(adminDeleteStaff.body)}`);
    }
    console.log('✅ Success: Test staff user deleted.');

    console.log('\n======================================================');
    console.log('ALL COMPREHENSIVE PRE-DEPLOYMENT TESTS PASSED! 🎉');
    console.log('======================================================\n');

    if (serverInstance) serverInstance.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ COMPREHENSIVE TEST SUITE FAILED:', err.message);
    if (serverInstance) serverInstance.close();
    process.exit(1);
  }
}

runComprehensiveTests();
