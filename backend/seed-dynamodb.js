#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const stageArg = process.argv.find((arg, i) => process.argv[i - 1] === '--stage') || 'prod';
const region = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const mockDbPath = path.resolve(__dirname, 'db-mock.json');

async function syncTable(tableName, items) {
  if (!items || items.length === 0) return;
  console.log(`Synchronizing table '${tableName}'...`);
  
  // Fetch existing IDs to avoid overwriting or duplicates
  const existingRes = await docClient.send(new ScanCommand({ 
    TableName: tableName,
    ProjectionExpression: 'id, email'
  }));
  const existingIds = new Set((existingRes.Items || []).map(i => i.id));
  const existingEmails = new Set((existingRes.Items || []).filter(i => i.email).map(i => i.email.toLowerCase()));

  let insertedCount = 0;
  for (const item of items) {
    if (!item.id) continue;
    if (existingIds.has(item.id)) continue;
    if (item.email && existingEmails.has(item.email.toLowerCase())) continue;

    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: item
    }));
    existingIds.add(item.id);
    if (item.email) existingEmails.add(item.email.toLowerCase());
    insertedCount++;
  }

  console.log(`  ✓ Synced '${tableName}': Added ${insertedCount} missing item(s). Total now: ${existingIds.size}`);
}

async function main() {
  if (!fs.existsSync(mockDbPath)) {
    console.log('No db-mock.json found. Skipping sync.');
    return;
  }

  const db = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
  console.log(`Syncing data to DynamoDB for stage: ${stageArg}...`);

  // Filter out any temporary test users from local db-mock if present
  const baseUsers = (db.users || []).filter(u => 
    !u.email.includes('admin2_') && 
    !u.email.includes('test_staff') && 
    !u.email.includes('client_xss')
  );

  await syncTable(`EK_Gear_${stageArg}`, db.gear);
  await syncTable(`EK_Clients_${stageArg}`, db.clients);
  await syncTable(`EK_Bookings_${stageArg}`, db.bookings);
  await syncTable(`EK_Users_${stageArg}`, baseUsers);

  console.log('\nDatabase synchronization complete!');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Sync Error:', err);
    process.exit(1);
  });
}

module.exports = { main };
