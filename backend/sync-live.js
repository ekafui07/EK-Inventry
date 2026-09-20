const fs = require('fs');
const path = require('path');

const LIVE_API_URL = 'https://dbjo34z68f2kg.cloudfront.net/api';
const DB_PATH = path.join(__dirname, 'db-mock.json');

async function syncLiveToLocal() {
  console.log('🔄 Starting sync from Live AWS API...');
  try {
    // 1. Authenticate as Admin
    console.log('🔑 Authenticating as Master Admin...');
    const loginRes = await fetch(`${LIVE_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ekgearflow.com', password: '12345' }) // Trying default first
    });
    
    let token;
    if (!loginRes.ok) {
      // Try the other password documented in README
      const loginRes2 = await fetch(`${LIVE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@ekgearflow.com', password: 'admin123' })
      });
      if (!loginRes2.ok) {
         throw new Error(`Authentication failed. Ensure admin credentials are correct. Status: ${loginRes2.status}`);
      }
      const authData = await loginRes2.json();
      token = authData.token;
    } else {
      const authData = await loginRes.json();
      token = authData.token;
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Fetch all data
    console.log('📥 Fetching Gear...');
    const gearReq = await fetch(`${LIVE_API_URL}/gear`, { headers });
    const gear = await gearReq.json();

    console.log('📥 Fetching Clients...');
    const clientsReq = await fetch(`${LIVE_API_URL}/clients`, { headers });
    const clients = await clientsReq.json();

    console.log('📥 Fetching Bookings...');
    const bookingsReq = await fetch(`${LIVE_API_URL}/bookings`, { headers });
    const bookings = await bookingsReq.json();

    console.log('📥 Fetching Users...');
    const usersReq = await fetch(`${LIVE_API_URL}/users`, { headers });
    const users = await usersReq.json();

    console.log('📥 Fetching Audit Logs...');
    const auditReq = await fetch(`${LIVE_API_URL}/audit-logs`, { headers });
    const auditData = await auditReq.json();
    const auditLogs = auditData.auditLogs || [];

    // 3. Assemble and Save
    const mockDb = {
      gear,
      clients,
      bookings,
      users,
      auditLogs
    };

    fs.writeFileSync(DB_PATH, JSON.stringify(mockDb, null, 2), 'utf-8');
    console.log(`✅ Successfully synced ${gear.length} gear items, ${clients.length} clients, ${bookings.length} bookings, ${users.length} users, and ${auditLogs.length} audit logs to db-mock.json!`);

  } catch (err) {
    console.error('❌ Sync Failed:', err.message);
    process.exit(1);
  }
}

syncLiveToLocal();
