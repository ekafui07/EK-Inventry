const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'db-mock.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const defaultPasswords = {
  'admin@ekgearflow.com': 'admin123',
  'sarah@ekgearflow.com': 'BerlinB1214@',
  'admin@gearflow.com': 'Admin@123',
  'staff@gearflow.com': 'Staff@123'
};
db.users.forEach(u => {
  u.password = defaultPasswords[u.email] || '12345';
});
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Reset passwords to documented defaults in db-mock.json');
