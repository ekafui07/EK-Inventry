const http = require('http');

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getAuth(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verify() {
  try {
    console.log('Logging in as admin@ekgearflow.com...');
    const loginRes = await postJson('/api/auth/login', {
      email: 'admin@ekgearflow.com',
      password: 'admin123'
    });

    if (!loginRes.token) {
      console.error('Login failed:', loginRes);
      return;
    }
    console.log('✅ Logged in successfully!');

    console.log('Fetching gear catalog from http://localhost:3000/api/gear ...');
    const gearRes = await getAuth('/api/gear', loginRes.token);
    const items = Array.isArray(gearRes) ? gearRes : (gearRes.gear || []);
    console.log(`\n🎉 Total Live Gear Items returned by API: ${items.length}`);

    // Group by category
    const catGroups = {};
    items.forEach(item => {
      catGroups[item.category] = (catGroups[item.category] || 0) + 1;
    });
    console.log('\n📊 Category Distribution:');
    console.table(catGroups);

    console.log('\n🔍 Sample Items from API:');
    items.slice(0, 10).forEach((item, i) => {
      console.log(`${i + 1}. [${item.category}] ${item.name} | GHS ${item.dailyRate}/day | Tag: ${item.assetTag} | Status: ${item.status}`);
    });
  } catch (err) {
    console.error('Verification failed:', err);
  }
}

verify();
