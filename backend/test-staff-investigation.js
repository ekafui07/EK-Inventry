const http = require('http');
const jwt = require('jsonwebtoken');

function post(url, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
      headers
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('1. Admin login...');
  const adminLogin = await post('http://localhost:3000/api/login', { email: 'admin@ekgearflow.com', password: 'admin123', accountType: 'Admin' });
  const adminToken = JSON.parse(adminLogin.body).token;

  console.log('2. Create staff...');
  const email = 'staff_' + Date.now() + '@test.com';
  const createStaff = await post('http://localhost:3000/api/users', {
    name: 'Sarah Staff',
    email: email,
    title: 'Specialist',
    accountType: 'Staff',
    password: '12345'
  }, adminToken);
  console.log('Created staff user:', createStaff.status, createStaff.body);

  console.log('3. Staff login...');
  const staffLogin = await post('http://localhost:3000/api/login', { email, password: '12345', accountType: 'Staff' });
  console.log('Staff login response status:', staffLogin.status);
  const staffData = JSON.parse(staffLogin.body);
  console.log('Staff response body:', staffData);
  const staffToken = staffData.token;

  console.log('\nDecoded Staff Token:\n', jwt.decode(staffToken));

  console.log('\n4. Testing endpoints as staff:');
  const g = await get('http://localhost:3000/api/gear', staffToken);
  console.log('GET /api/gear status:', g.status);
  const c = await get('http://localhost:3000/api/clients', staffToken);
  console.log('GET /api/clients status:', c.status);
  const b = await get('http://localhost:3000/api/bookings', staffToken);
  console.log('GET /api/bookings status:', b.status);
  const u = await get('http://localhost:3000/api/users', staffToken);
  console.log('GET /api/users status:', u.status, u.body);
  const me = await get('http://localhost:3000/api/auth/me', staffToken);
  console.log('GET /api/auth/me status:', me.status, me.body);
}

run().catch(console.error);
