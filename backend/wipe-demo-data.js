#!/usr/bin/env node
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const stage = process.argv.find((arg, i) => process.argv[i - 1] === '--stage') || 'prod';
const region = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

// The exact allowed staff/admin emails to preserve
const PRESERVED_EMAILS = new Set([
  'admin@ekgearflow.com',
  'admin@gearflow.com',
  'staff@gearflow.com'
]);

async function clearTable(tableName, idField = 'id') {
  console.log(`Clearing table '${tableName}'...`);
  let deletedCount = 0;
  
  let scanRes = await docClient.send(new ScanCommand({
    TableName: tableName,
    ProjectionExpression: idField
  }));

  const items = scanRes.Items || [];
  for (const item of items) {
    if (!item[idField]) continue;
    await docClient.send(new DeleteCommand({
      TableName: tableName,
      Key: { [idField]: item[idField] }
    }));
    deletedCount++;
  }

  console.log(`  ✓ Cleared '${tableName}': Deleted ${deletedCount} item(s). Count is now 0.`);
}

async function cleanUsersTable(tableName) {
  console.log(`Cleaning users table '${tableName}'...`);
  const scanRes = await docClient.send(new ScanCommand({
    TableName: tableName
  }));

  const users = scanRes.Items || [];
  let preservedCount = 0;
  let deletedCount = 0;

  for (const user of users) {
    const emailLower = (user.email || '').toLowerCase().trim();
    if (PRESERVED_EMAILS.has(emailLower)) {
      console.log(`  Keeping user: ${user.name} (${user.email}) - Title: ${user.title}, Role: ${user.accountType || user.role}`);
      preservedCount++;
    } else {
      console.log(`  Deleting user: ${user.name} (${user.email})`);
      await docClient.send(new DeleteCommand({
        TableName: tableName,
        Key: { id: user.id }
      }));
      deletedCount++;
    }
  }

  console.log(`  ✓ Users table '${tableName}' updated: Kept ${preservedCount}, Deleted ${deletedCount}.`);
}

async function run() {
  console.log('======================================================');
  console.log(`🧹 EK GEARFLOW — DEMO DATA PURGE & RESET (Stage: ${stage})`);
  console.log('======================================================\n');

  // 1. Wipe Gear, Clients, Bookings, AuditLogs
  await clearTable(`EK_Gear_${stage}`);
  await clearTable(`EK_Clients_${stage}`);
  await clearTable(`EK_Bookings_${stage}`);
  await clearTable(`EK_AuditLogs_${stage}`);

  // 2. Clean Users table to only keep the 3 required accounts
  await cleanUsersTable(`EK_Users_${stage}`);

  console.log('\n======================================================');
  console.log('✅ DATABASE RESET COMPLETE — READY FOR CLEAN CLIENT DEMO!');
  console.log('======================================================');
}

run().catch(err => {
  console.error('Error during data wipe:', err);
  process.exit(1);
});
