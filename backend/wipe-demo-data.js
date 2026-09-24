#!/usr/bin/env node
/**
 * Wipes the LOCAL database (backend/db-mock.json). Does not touch AWS.
 *
 * Usage:
 *   node wipe-local-data.js               Empty everything, including users
 *   node wipe-local-data.js --keep-users  Empty everything except users
 *
 * The old file is saved to db-mock.backup.json first.
 * Default accounts are recreated automatically when the backend starts
 * with no users.
 */
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db-mock.json');
const backupPath = path.join(__dirname, 'db-mock.backup.json');
const keepUsers = process.argv.includes('--keep-users');

let users = [];
if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, backupPath);
  if (keepUsers) {
    try {
      users = JSON.parse(fs.readFileSync(dbPath, 'utf-8')).users || [];
    } catch (err) {
      console.error('Could not read users from db-mock.json. Nothing was changed.');
      process.exit(1);
    }
  }
}

const emptyDb = { gear: [], clients: [], bookings: [], users, auditLogs: [] };
fs.writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2), 'utf-8');

console.log('Local database wiped: db-mock.json');
console.log(`- Users kept: ${users.length}${keepUsers ? '' : ' (defaults are recreated on next backend start)'}`);
console.log('- Backup:     db-mock.backup.json');
