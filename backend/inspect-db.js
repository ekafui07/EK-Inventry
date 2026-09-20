const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db-mock.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

console.log('--- Current db-mock.json keys ---');
console.log(Object.keys(db));

console.log('\n--- Existing Gear Count ---', db.gear ? db.gear.length : 0);
if (db.gear && db.gear.length > 0) {
  console.log('Sample gear item:', JSON.stringify(db.gear[0], null, 2));
}

console.log('\n--- Existing Users ---');
console.log(db.users ? db.users.map(u => ({ id: u.id, email: u.email, role: u.role })) : []);

console.log('\n--- Other collections ---');
console.log('clients:', db.clients ? db.clients.length : 0);
console.log('bookings:', db.bookings ? db.bookings.length : 0);
console.log('auditLogs:', db.auditLogs ? db.auditLogs.length : 0);
