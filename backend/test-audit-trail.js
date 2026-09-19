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

async function runTests() {
  console.log('=== RUNNING AUDIT TRAIL AUTOMATED TESTS ===\n');
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
    // 1. Log in as primary Admin (admin@ekgearflow.com)
    console.log('1. Primary Admin Authentication');
    const adminLogin = await request('POST', '/api/login', {
      email: 'admin@ekgearflow.com',
      password: 'admin123',
      accountType: 'Admin'
    });
    assert(adminLogin.status === 200, 'Primary Admin logs in successfully');
    const adminToken = adminLogin.data.token;
    assert(!!adminToken, 'Admin token received');

    // 2. Fetch Audit Logs as primary Admin
    console.log('\n2. Primary Admin Access to /api/audit-logs');
    const auditRes = await request('GET', '/api/audit-logs', null, adminToken);
    assert(auditRes.status === 200, 'Primary Admin GET /api/audit-logs returns 200 OK');
    assert(Array.isArray(auditRes.data.auditLogs), 'Audit logs array is returned');
    assert(typeof auditRes.data.total === 'number', 'Total audit count is provided');
    console.log(`     Total existing audit entries: ${auditRes.data.total}`);

    // 3. Create a test staff user and verify staff restriction
    console.log('\n3. Staff User Access Restrictions');
    const testStaffEmail = `staff_audit_${Date.now()}@ekgearflow.com`;
    const createStaff = await request('POST', '/api/users', {
      name: 'Audit Test Staff',
      email: testStaffEmail,
      phone: '555-9988',
      title: 'Rental Coordinator',
      accountType: 'Staff',
      permissions: ['create_rentals', 'return_rentals'],
      password: '12345'
    }, adminToken);
    assert(createStaff.status === 201 || createStaff.status === 200, 'Created test staff user');
    const staffId = createStaff.data.id;

    const staffLogin = await request('POST', '/api/login', {
      email: testStaffEmail,
      password: '12345',
      accountType: 'Staff'
    });
    assert(staffLogin.status === 200, 'Staff logs in successfully');
    const staffToken = staffLogin.data.token;
    assert(!!staffToken, 'Staff token received');

    const staffAuditRes = await request('GET', '/api/audit-logs', null, staffToken);
    assert(staffAuditRes.status === 403, 'Staff user is FORBIDDEN (403) from accessing /api/audit-logs');
    console.log(`     Response error message: "${staffAuditRes.data.error}"`);

    // 4. Multi-Admin Audit Access - all Admin accounts should have FULL audit access
    console.log('\n4. Multi-Admin Audit Access (all Admin accounts can view audit trail)');
    const secondAdminEmail = `admin_secondary_${Date.now()}@ekgearflow.com`;
    const createSecondAdmin = await request('POST', '/api/users', {
      name: 'Secondary Admin',
      email: secondAdminEmail,
      phone: '555-7766',
      title: 'Co-Administrator',
      accountType: 'Admin',
      password: '12345'
    }, adminToken);
    assert(createSecondAdmin.status === 201 || createSecondAdmin.status === 200, 'Created secondary admin user');
    const secondAdminId = createSecondAdmin.data.id;

    const secondAdminLogin = await request('POST', '/api/login', {
      email: secondAdminEmail,
      password: '12345',
      accountType: 'Admin'
    });
    const secondAdminToken = secondAdminLogin.data.token;

    const secondAdminAuditRes = await request('GET', '/api/audit-logs', null, secondAdminToken);
    assert(secondAdminAuditRes.status === 200, 'Secondary Admin can access audit trail (200 OK - role-based access');
    console.log();

    // 5. Test Live Audit Logging by performing operations
    console.log('\n5. Verification of Operation Logging');
    const testGearName = `Audit Lens ${Date.now()}`;
    const testAssetTag = `AT-AUD-${Date.now().toString().slice(-4)}`;
    const addGearRes = await request('POST', '/api/gear', {
      name: testGearName,
      assetTag: testAssetTag,
      category: 'Lenses',
      serialNumber: `SN-AUDIT-${Date.now().toString().slice(-4)}`,
      dailyRate: 65,
      status: 'Available',
      condition: 'Excellent'
    }, adminToken);
    assert(addGearRes.status === 201, 'Gear item added successfully');

    // Fetch logs again and find the new gear entry
    const updatedAudit = await request('GET', '/api/audit-logs', null, adminToken);
    const foundLog = updatedAudit.data.auditLogs.find(l => l.summary && l.summary.includes(testGearName));
    assert(!!foundLog, 'Audit log accurately recorded the gear addition');
    if (foundLog) {
      assert(foundLog.category === 'Inventory', 'Audit log category is "Inventory"');
      assert(foundLog.userEmail === 'admin@ekgearflow.com', 'Audit log correctly attributes primary admin as actor');
      assert(foundLog.accountType === 'Admin', 'Audit log correctly attributes role as Admin');
      console.log(`     Recorded: "${foundLog.summary}" by ${foundLog.userName} (${foundLog.userRole})`);
    }

    // 6. Test Filtering by Category
    console.log('\n6. Filter Audit Logs by Category');
    const invLogs = await request('GET', '/api/audit-logs?category=Inventory', null, adminToken);
    assert(invLogs.status === 200, 'GET /api/audit-logs?category=Inventory returns 200 OK');
    const allAreInventory = invLogs.data.auditLogs.every(l => l.category.toLowerCase() === 'inventory');
    assert(allAreInventory, 'All filtered logs belong to "Inventory" category');

    // 7. Test Search Query
    console.log('\n7. Search Audit Logs');
    const searchRes = await request('GET', `/api/audit-logs?search=${encodeURIComponent(testGearName)}`, null, adminToken);
    assert(searchRes.status === 200, 'GET /api/audit-logs?search=... returns 200 OK');
    assert(searchRes.data.auditLogs.length >= 1, 'Search finds the newly logged gear event');

    // Clean up created test gear & users
    if (addGearRes.data && addGearRes.data.id) {
      await request('DELETE', `/api/gear/${addGearRes.data.id}`, null, adminToken);
    }
    if (staffId) {
      await request('DELETE', `/api/users/${staffId}`, null, adminToken);
    }
    if (secondAdminId) {
      await request('DELETE', `/api/users/${secondAdminId}`, null, adminToken);
    }

    console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED (${Math.round(passed/total*100)}%) ===`);
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runTests();
