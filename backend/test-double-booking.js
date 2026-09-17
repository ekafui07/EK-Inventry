const http = require('http');
const { app, seedInitialUsers } = require('./index.js');

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

async function runDoubleBookingTests() {
  serverInstance = await startTestServer();
  if (typeof seedInitialUsers === 'function') {
    await seedInitialUsers();
  }
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log('\n====================================');
  console.log('RUNNING DOUBLE-BOOKING CONFLICT SUITE');
  console.log('====================================\n');

  try {
    // 1. Authenticate as Admin
    console.log('Step 1: Authenticating as Admin...');
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'admin@gearflow.com',
      password: 'Admin@123'
    });

    if (loginRes.statusCode !== 200 || !loginRes.body.token) {
      throw new Error(`Admin authentication failed with status ${loginRes.statusCode}`);
    }
    const adminToken = loginRes.body.token;
    console.log('✅ Success: Admin authenticated for testing.\n');

    // 2. Fetch existing gear and clients
    const gearRes = await request('GET', '/api/gear', null, adminToken);
    const clientsRes = await request('GET', '/api/clients', null, adminToken);

    const gearList = Array.isArray(gearRes.body) ? gearRes.body : [];
    const clientList = Array.isArray(clientsRes.body) ? clientsRes.body : [];

    const targetGear1 = gearList[0] ? gearList[0].id : 'g_test_1';
    const targetGear2 = gearList[1] ? gearList[1].id : 'g_test_2';
    const clientId = clientList[0] ? clientList[0].id : 'c_test_1';

    const testYear = 2029; // Use future year to avoid colliding with active production bookings

    // Clean up any lingering testYear bookings to ensure test idempotency
    const existingBookingsRes = await request('GET', '/api/bookings', null, adminToken);
    if (Array.isArray(existingBookingsRes.body)) {
      for (const b of existingBookingsRes.body) {
        if (b.startDate && b.startDate.startsWith(`${testYear}`) && b.status === 'Active') {
          await request('PUT', `/api/bookings/${b.id}/cancel`, null, adminToken);
        }
      }
    }

    // Test 1: Create initial booking
    console.log(`Test 1: Creating initial booking for gear \"${targetGear1}\" (${testYear}-06-10 to ${testYear}-06-15)...`);
    const book1Res = await request('POST', '/api/bookings', {
      clientId,
      gearId: targetGear1,
      startDate: `${testYear}-06-10`,
      endDate: `${testYear}-06-15`
    }, adminToken);

    if (book1Res.statusCode !== 201 || !book1Res.body.id) {
      throw new Error(`Failed to create baseline booking: ${JSON.stringify(book1Res.body)}`);
    }
    const primaryBookingId = book1Res.body.id;
    console.log('✅ Success: Primary booking created successfully.\n');

    // Test 2: Exact overlap attempt
    console.log(`Test 2: Attempting exact duplicate booking (${testYear}-06-10 to ${testYear}-06-15)...`);
    const book2Res = await request('POST', '/api/bookings', {
      clientId,
      gearId: targetGear1,
      startDate: `${testYear}-06-10`,
      endDate: `${testYear}-06-15`
    }, adminToken);

    if (book2Res.statusCode === 400 && (book2Res.body.message || '').includes('already reserved')) {
      console.log('✅ Success: Exact duplicate booking correctly rejected with 400 Double-booking Alert.\n');
    } else {
      throw new Error(`Expected 400 rejection, received ${book2Res.statusCode}: ${JSON.stringify(book2Res.body)}`);
    }

    // Test 3: Subset overlap attempt
    console.log(`Test 3: Attempting subset overlap (${testYear}-06-11 to ${testYear}-06-14)...`);
    const book3Res = await request('POST', '/api/bookings', {
      clientId,
      gearId: targetGear1,
      startDate: `${testYear}-06-11`,
      endDate: `${testYear}-06-14`
    }, adminToken);

    if (book3Res.statusCode === 400 && (book3Res.body.message || '').includes('already reserved')) {
      console.log('✅ Success: Subset overlap correctly rejected with 400 Double-booking Alert.\n');
    } else {
      throw new Error(`Expected 400 rejection, received ${book3Res.statusCode}: ${JSON.stringify(book3Res.body)}`);
    }

    // Test 4: Left-boundary overlap attempt
    console.log(`Test 4: Attempting left-boundary overlap (${testYear}-06-08 to ${testYear}-06-12)...`);
    const book4Res = await request('POST', '/api/bookings', {
      clientId,
      gearId: targetGear1,
      startDate: `${testYear}-06-08`,
      endDate: `${testYear}-06-12`
    }, adminToken);

    if (book4Res.statusCode === 400 && (book4Res.body.message || '').includes('already reserved')) {
      console.log('✅ Success: Left-boundary overlap correctly rejected with 400 Double-booking Alert.\n');
    } else {
      throw new Error(`Expected 400 rejection, received ${book4Res.statusCode}: ${JSON.stringify(book4Res.body)}`);
    }

    // Test 5: Right-boundary overlap attempt
    console.log(`Test 5: Attempting right-boundary overlap (${testYear}-06-14 to ${testYear}-06-18)...`);
    const book5Res = await request('POST', '/api/bookings', {
      clientId,
      gearId: targetGear1,
      startDate: `${testYear}-06-14`,
      endDate: `${testYear}-06-18`
    }, adminToken);

    if (book5Res.statusCode === 400 && (book5Res.body.message || '').includes('already reserved')) {
      console.log('✅ Success: Right-boundary overlap correctly rejected with 400 Double-booking Alert.\n');
    } else {
      throw new Error(`Expected 400 rejection, received ${book5Res.statusCode}: ${JSON.stringify(book5Res.body)}`);
    }

    // Test 6: Non-overlapping booking attempt
    console.log(`Test 6: Booking same gear on non-overlapping dates (${testYear}-06-20 to ${testYear}-06-25)...`);
    const book6Res = await request('POST', '/api/bookings', {
      clientId,
      gearId: targetGear1,
      startDate: `${testYear}-06-20`,
      endDate: `${testYear}-06-25`
    }, adminToken);

    if (book6Res.statusCode === 201) {
      console.log('✅ Success: Non-overlapping booking confirmed with 201 Created.\n');
    } else {
      throw new Error(`Expected 201 Created, received ${book6Res.statusCode}: ${JSON.stringify(book6Res.body)}`);
    }

    // Test 7: Different gear concurrent booking
    console.log(`Test 7: Booking different gear \"${targetGear2}\" during same dates (${testYear}-06-10 to ${testYear}-06-15)...`);
    const book7Res = await request('POST', '/api/bookings', {
      clientId,
      gearId: targetGear2,
      startDate: `${testYear}-06-10`,
      endDate: `${testYear}-06-15`
    }, adminToken);

    if (book7Res.statusCode === 201) {
      console.log('✅ Success: Concurrent booking for independent gear confirmed with 201 Created.\n');
    } else {
      throw new Error(`Expected 201 Created, received ${book7Res.statusCode}: ${JSON.stringify(book7Res.body)}`);
    }

    // Test 8: Cancelled booking does not block dates
    console.log(`Test 8: Cancelling primary booking (${primaryBookingId}) and re-booking same dates...`);
    const cancelRes = await request('PUT', `/api/bookings/${primaryBookingId}/cancel`, null, adminToken);
    if (cancelRes.statusCode !== 200 || !cancelRes.body.success) {
      throw new Error(`Failed to cancel baseline booking: ${JSON.stringify(cancelRes.body)}`);
    }

    const rebookRes = await request('POST', '/api/bookings', {
      clientId,
      gearId: targetGear1,
      startDate: `${testYear}-06-10`,
      endDate: `${testYear}-06-15`
    }, adminToken);

    if (rebookRes.statusCode === 201) {
      console.log('✅ Success: Re-booking previously cancelled date range succeeded with 201 Created.\n');
    } else {
      throw new Error(`Expected 201 Created after cancellation, received ${rebookRes.statusCode}: ${JSON.stringify(rebookRes.body)}`);
    }

    // Clean up created test bookings
    const finalBookingsRes = await request('GET', '/api/bookings', null, adminToken);
    if (Array.isArray(finalBookingsRes.body)) {
      for (const b of finalBookingsRes.body) {
        if (b.startDate && b.startDate.startsWith(`${testYear}`) && b.status === 'Active') {
          await request('PUT', `/api/bookings/${b.id}/cancel`, null, adminToken);
        }
      }
    }

    console.log('====================================');
    console.log('ALL DOUBLE-BOOKING TESTS PASSED! 🎉');
    console.log('====================================\n');
    if (serverInstance) serverInstance.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ DOUBLE-BOOKING TEST SUITE FAILED:', err.message);
    if (serverInstance) serverInstance.close();
    process.exit(1);
  }
}

runDoubleBookingTests();
