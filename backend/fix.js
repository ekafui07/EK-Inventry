const fs = require('fs');
const dbPath = '/home/ekafui07/EK-Inventry/backend/db-mock.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
db.users.forEach(u => { u.password = '12345'; });
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Fixed passwords in db-mock.json');
