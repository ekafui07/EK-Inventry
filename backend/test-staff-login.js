const fs = require('fs');
const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
      headers
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const db = JSON.parse(fs.readFileSync('/home/ekafui07/EK-Inventry/backend/db-mock.json', 'utf8'));
  console.log('Users in db-mock.json:');
  db.users.forEach(u => console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Type: ${u.accountType}`));

  // Try logging in with the staff users in db-mock
  for (const u of db.users) {
    if (u.accountType === 'Staff' || u.role === 'staff') {
      console.log(`\nTrying login for ${u.email} with 12345...`);
      let res = await post('http://localhost:3000/api/login', {
        email: u.email,
        password: '12345',
        accountType: 'Staff'
      });
      console.log('Result:', res.status, res.body.token ? 'Got token!' : res.body.error);
      if (res.body.token) {
        console.log('Testing GET endpoints for', u.email);
        for (const ep of ['/api/gear', '/api/clients', '/api/bookings', '/api/users']) {
          const epRes = await get(`http://localhost:3000${ep}`, res.body.token);
          console.log(`GET ${ep} -> ${epRes.status}`, epRes.body.error || 'OK');
        }
      }
    }
  }
}

main().catch(console.error);
