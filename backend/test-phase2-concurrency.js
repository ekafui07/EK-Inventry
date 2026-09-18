const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runConcurrencyTests() {
  console.log('======================================================');
  console.log('RUNNING PHASE 2 CONCURRENCY & RACE CONDITION TESTS');
  console.log('======================================================\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  }

  try {
    // 1. Admin Authentication
    console.log('1. Admin Authentication');
    const adminLogin = await request('POST', '/api/login', {
      email: 'admin@ekgearflow.com',
      password: 'admin123',
      accountType: 'Admin'
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin authenticated');
    const adminToken = adminLogin.data.token;

    // 2. Setup Test Gear & Client
    console.log('\n2. Setup Isolated Test Gear & Client');
    const timestamp = Date.now();
    const createGearRes = await request('POST', '/api/gear', {
      name: `Concurrency Lens ${timestamp}`,
      assetTag: `TAG-CC-${timestamp.toString().slice(-4)}`,
      category: 'Lenses',
      serialNumber: `SN-CC-${timestamp.toString().slice(-4)}`,
      dailyRate: 150,
      status: 'Available'
    }, adminToken);
    assert(createGearRes.status === 201, 'Created primary test gear item');
    const gearId = createGearRes.data.id;

    const createClientRes = await request('POST', '/api/clients', {
      name: `Concurrent Client ${timestamp}`,
      email: `client_cc_${timestamp}@example.com`,
      phone: `+233 20 ${Math.floor(1000000 + Math.random() * 9000000)}`
    }, adminToken);
    assert(createClientRes.status === 201, 'Created primary test client');
    const clientId = createClientRes.data.id;

    // 3. High-Concurrency Stress Test: 5 Simultaneous Checkouts for the SAME Gear
    console.log('\n3. High-Concurrency Stress Test: Firing 5 simultaneous checkouts for same gear...');
    const bookingPayload = {
      gearIds: [gearId],
      clientId: clientId,
      startDate: '2035-09-01',
      endDate: '2035-09-07'
    };

    // Dispatch all 5 requests concurrently using Promise.all
    const concurrentResponses = await Promise.all([
      request('POST', '/api/bookings', bookingPayload, adminToken),
      request('POST', '/api/bookings', bookingPayload, adminToken),
      request('POST', '/api/bookings', bookingPayload, adminToken),
      request('POST', '/api/bookings', bookingPayload, adminToken),
      request('POST', '/api/bookings', bookingPayload, adminToken)
    ]);

    const successes = concurrentResponses.filter(r => r.status === 201);
    const rejections = concurrentResponses.filter(r => r.status === 400);

    console.log(`   Results: ${successes.length} succeeded, ${rejections.length} rejected.`);

    assert(successes.length === 1, 'EXACTLY ONE concurrent checkout succeeded (Status 201)');
    assert(rejections.length === 4, 'EXACTLY FOUR concurrent checkouts were safely rejected (Status 400)');

    console.log('   Rejection data:', rejections.map(r => r.data));
    const allHaveConflictAlert = rejections.every(r => 
      r.data && (r.data.message || r.data.error || '').includes('Double-booking Alert')
    );
    assert(allHaveConflictAlert, 'All 4 rejections received explicit "Double-booking Alert" message');

    // 4. Verify Database Contains Exactly One Booking
    console.log('\n4. Database Integrity Verification');
    const allBookingsRes = await request('GET', '/api/bookings', null, adminToken);
    const matchingBookings = allBookingsRes.data.filter(b => 
      b.gearId === gearId && b.startDate === '2035-09-01' && b.status !== 'Cancelled'
    );
    assert(matchingBookings.length === 1, 'Database contains strictly 1 confirmed booking (Zero duplicate writes)');
    const confirmedBookingId = matchingBookings[0] ? matchingBookings[0].id : null;

    // 5. Concurrent Checkouts for DIFFERENT Gear Items (Non-Interfering)
    console.log('\n5. Parallel Checkouts for Distinct Gear Items');
    const gear2Res = await request('POST', '/api/gear', {
      name: `Independent Mic ${timestamp}`,
      assetTag: `TAG-MIC-${timestamp.toString().slice(-4)}`,
      category: 'Audio',
      serialNumber: `SN-MIC-${timestamp.toString().slice(-4)}`,
      dailyRate: 40,
      status: 'Available'
    }, adminToken);
    assert(gear2Res.status === 201, 'Created secondary independent gear');
    const gear2Id = gear2Res.data.id;

    const parallelDistinct = await Promise.all([
      request('POST', '/api/bookings', {
        gearIds: [gear2Id],
        clientId: clientId,
        startDate: '2035-10-01',
        endDate: '2035-10-05'
      }, adminToken),
      request('POST', '/api/bookings', {
        gearIds: [gear2Id],
        clientId: clientId,
        startDate: '2035-10-10',
        endDate: '2035-10-15'
      }, adminToken)
    ]);

    assert(
      parallelDistinct[0].status === 201 && parallelDistinct[1].status === 201,
      'Both distinct non-conflicting parallel checkouts succeeded with 201 Created'
    );

    // Clean up created test data
    console.log('\n6. Cleanup Test Data');
    if (confirmedBookingId) {
      await request('PUT', `/api/bookings/${confirmedBookingId}/cancel`, null, adminToken);
    }
    for (const res of parallelDistinct) {
      if (res.data && res.data.id) {
        await request('PUT', `/api/bookings/${res.data.id}/cancel`, null, adminToken);
      }
    }
    await request('DELETE', `/api/gear/${gearId}`, null, adminToken);
    await request('DELETE', `/api/gear/${gear2Id}`, null, adminToken);
    await request('DELETE', `/api/clients/${clientId}`, null, adminToken);
    console.log('   Cleanup complete.');

    console.log(`\n======================================================`);
    console.log(`PHASE 2 CONCURRENCY RESULTS: ${passed}/${total} TESTS PASSED (${Math.round(passed/total*100)}%)`);
    console.log(`======================================================\n`);
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Concurrency test failed with error:', err);
    process.exit(1);
  }
}

runConcurrencyTests();
