const http = require('http');

// Start the server by requiring index.js
console.log('Starting local server for integration testing...');
require('./index.js');

// Helper to make HTTP requests
function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body ? JSON.parse(body) : null
        });
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

// Run tests
async function runTests() {
  // Wait 1 second for server to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n====================================');
  console.log('RUNNING DUAL-BOOKING OVERLAP TESTS');
  console.log('====================================\n');

  try {
    // 1. Get Gear List
    console.log('Test 1: Fetching master gear list...');
    const gearList = await request('GET', '/api/gear');
    if (gearList.statusCode === 200 && gearList.body.length > 0) {
      console.log(`✅ Success: Found ${gearList.body.length} gear items.\n`);
    } else {
      throw new Error('Failed to fetch gear list');
    }

    // Seed data has booking b1: gearId 'g1' from (2 days ago) to (+3 days)
    const today = new Date();
    const dateStr = (daysOffset) => {
      const d = new Date(today);
      d.setDate(today.getDate() + daysOffset);
      return d.toISOString().split('T')[0];
    };

    // 2. Test Double Booking (Overlapping Dates)
    // Attempting to book g1 (Sony FX3) for today to tomorrow (clearly overlaps with active b1)
    console.log('Test 2: Attempting double-booking (overlapping dates)...');
    const overlapBooking = {
      gearId: 'g1',
      clientId: 'c2',
      startDate: dateStr(0), // Today
      endDate: dateStr(1)    // Tomorrow
    };

    const overlapResult = await request('POST', '/api/bookings', overlapBooking);
    if (overlapResult.statusCode === 400 && overlapResult.body.message.includes('Double-booking')) {
      console.log('✅ Success: Overlap rejected correctly with message:');
      console.log(`   "${overlapResult.body.message}"\n`);
    } else {
      console.error('Overlap response:', overlapResult);
      throw new Error('Double-booking was NOT blocked!');
    }

    // 3. Test Successful Booking (Non-overlapping Dates)
    // Booking g1 (Sony FX3) in 10 days
    console.log('Test 3: Attempting booking with non-overlapping future dates...');
    const validBooking = {
      gearId: 'g1',
      clientId: 'c2',
      startDate: dateStr(10), // 10 days from now
      endDate: dateStr(12)    // 12 days from now
    };

    const validResult = await request('POST', '/api/bookings', validBooking);
    if (validResult.statusCode === 201 && validResult.body.id) {
      console.log('✅ Success: Non-overlapping booking created successfully!\n');
    } else {
      console.error('Valid booking response:', validResult);
      throw new Error('Valid booking was rejected!');
    }

    console.log('====================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY 🎉');
    console.log('====================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
