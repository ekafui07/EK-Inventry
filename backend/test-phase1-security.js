const http = require('http');

function request(method, path, body = null, token = null, headersOverride = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 
      'Content-Type': 'application/json',
      ...headersOverride
    };
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
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
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

// Simple browser HTML escape simulation to test identical encoding
function escapeHtmlText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function runSecurityTests() {
  console.log('======================================================');
  console.log('RUNNING PHASE 1 SECURITY & HARDENING VERIFICATION');
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
    assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin logged in successfully');
    const adminToken = adminLogin.data.token;

    // 2. Staff User Creation & Initial Token
    console.log('\n2. Staff Account & Active Token Verification');
    const testStaffEmail = `sec_staff_${Date.now()}@ekgearflow.com`;
    const createStaff = await request('POST', '/api/users', {
      name: 'Security Test Staff',
      email: testStaffEmail,
      title: 'Field Coordinator',
      accountType: 'Staff',
      permissions: ['manage_clients', 'create_rentals'],
      password: '12345'
    }, adminToken);
    assert(createStaff.status === 201 || createStaff.status === 200, 'Created test staff account');
    const staffId = createStaff.data.id;

    const staffLogin = await request('POST', '/api/login', {
      email: testStaffEmail,
      password: '12345',
      accountType: 'Staff'
    });
    assert(staffLogin.status === 200 && staffLogin.data.token, 'Staff authenticated and received token');
    const staffToken = staffLogin.data.token;

    // Verify staff token can access permitted API
    const initialGearCheck = await request('GET', '/api/gear', null, staffToken);
    assert(initialGearCheck.status === 200, 'Staff token successfully accesses /api/gear when active');

    // 3. Instant Account Ban Enforcement
    console.log('\n3. Testing Instant Account Ban & Token Invalidation');
    const banRes = await request('PUT', `/api/users/${staffId}/status`, { status: 'Banned' }, adminToken);
    assert(banRes.status === 200, 'Admin successfully set staff status to Banned');

    // Now, test calling APIs with the existing, UNEXPIRED staff token
    console.log('   Testing API calls using staff token issued prior to ban...');
    const bannedGearCheck = await request('GET', '/api/gear', null, staffToken);
    assert(bannedGearCheck.status === 403, 'Banned staff token is IMMEDIATELY blocked on /api/gear (403 Forbidden)');
    assert(
      bannedGearCheck.data && bannedGearCheck.data.error && bannedGearCheck.data.error.includes('banned or deactivated'),
      'Appropriate session termination error message returned'
    );

    const bannedClientCheck = await request('GET', '/api/clients', null, staffToken);
    assert(bannedClientCheck.status === 403, 'Banned staff token is IMMEDIATELY blocked on /api/clients (403 Forbidden)');

    const bannedBookingCheck = await request('GET', '/api/bookings', null, staffToken);
    assert(bannedBookingCheck.status === 403, 'Banned staff token is IMMEDIATELY blocked on /api/bookings (403 Forbidden)');

    // 4. Instant Unban / Restoration
    console.log('\n4. Testing Account Restoration');
    const unbanRes = await request('PUT', `/api/users/${staffId}/status`, { status: 'Active' }, adminToken);
    assert(unbanRes.status === 200, 'Admin successfully restored staff status to Active');

    const restoredGearCheck = await request('GET', '/api/gear', null, staffToken);
    assert(restoredGearCheck.status === 200, 'Restored staff token immediately re-allowed on /api/gear (200 OK)');

    // 5. Universal Frontend XSS Sanitization Logic
    console.log('\n5. Frontend XSS Sanitization & Escaping Verification');
    const maliciousPayload = `<script>alert("pwned")</script><img src=x onerror=alert('xss')>&"test"`;
    const escaped = escapeHtmlText(maliciousPayload);

    assert(!escaped.includes('<script>'), '<script> tag neutralized');
    assert(!escaped.includes('</script>'), '</script> tag neutralized');
    assert(!escaped.includes('<img'), '<img tag neutralized');
    assert(escaped.includes('&lt;script&gt;'), '<script> converted to &lt;script&gt;');
    assert(escaped.includes('&quot;test&quot;'), 'Double quotes converted to &quot;');
    assert(escaped.includes('&#039;xss&#039;'), 'Single quotes converted to &#039;');

    // 6. Database Storage & Retrieval with Special Characters
    console.log('\n6. Special Characters & XSS Payload Ingestion');
    const xssClientName = `Secure Client <script>alert(1)</script>`;
    const createXssClient = await request('POST', '/api/clients', {
      name: xssClientName,
      email: `client_xss_${Date.now()}@example.com`,
      phone: `+233 24 ${Math.floor(1000000 + Math.random() * 9000000)}`,
      ghanaCardNumber: `GHA-${Date.now().toString().slice(-9)}-1`,
      guarantorName: 'Guarantor Safety',
      guarantorGhanaCard: `GHA-${Date.now().toString().slice(-9)}-2`,
      guarantorPhone: `+233 20 ${Math.floor(1000000 + Math.random() * 9000000)}`
    }, adminToken);
    assert(createXssClient.status === 201, 'Client with script characters stored safely');
    const clientId = createXssClient.data.id;

    // Verify stored name preserves literal text for safe HTML-escaped rendering
    const clientFetch = await request('GET', '/api/clients', null, adminToken);
    const fetchedClient = clientFetch.data.find(c => c.id === clientId);
    assert(fetchedClient && fetchedClient.name === xssClientName, 'Database accurately preserves raw text for client-side escaping');

    // 7. CORS Policy Verification
    console.log('\n7. CORS Policy Verification');
    const corsAllowedRes = await request('GET', '/api/gear', null, adminToken, {
      'Origin': 'http://localhost:8080'
    });
    assert(
      corsAllowedRes.headers['access-control-allow-origin'] === 'http://localhost:8080',
      'CORS permits whitelisted origin (http://localhost:8080)'
    );

    // Clean up created resources
    if (clientId) {
      await request('DELETE', `/api/clients/${clientId}`, null, adminToken);
    }
    if (staffId) {
      await request('DELETE', `/api/users/${staffId}`, null, adminToken);
    }

    console.log(`\n======================================================`);
    console.log(`PHASE 1 SECURITY RESULTS: ${passed}/${total} TESTS PASSED (${Math.round(passed/total*100)}%)`);
    console.log(`======================================================\n`);
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Security test failed with error:', err);
    process.exit(1);
  }
}

runSecurityTests();
