#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const stageArg = process.argv.find((arg, i) => process.argv[i - 1] === '--stage') || 'prod';
const region = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const mockDbPath = path.resolve(__dirname, 'db-mock.json');

async function seedTable(tableName, items, itemNameKey = 'name') {
  if (!items || items.length === 0) return;
  console.log(`Checking table '${tableName}'...`);
  
  const existing = await docClient.send(new ScanCommand({ TableName: tableName, Limit: 5 }));
  if (existing.Items && existing.Items.length > 0) {
    console.log(`  Table '${tableName}' already contains ${existing.Count} item(s). Skipping seed.`);
    return;
  }
  
  console.log(`  Seeding ${items.length} records into '${tableName}'...`);
  for (const item of items) {
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: item
    }));
  }
  console.log(`  ✓ Successfully seeded '${tableName}'`);
}

async function main() {
  if (!fs.existsSync(mockDbPath)) {
    console.log('No db-mock.json found. Skipping seed.');
    return;
  }

  const db = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
  console.log(`Seeding DynamoDB tables for stage: ${stageArg}...`);

  await seedTable(`EK_Gear_${stageArg}`, db.gear);
  await seedTable(`EK_Clients_${stageArg}`, db.clients);
  await seedTable(`EK_Bookings_${stageArg}`, db.bookings);
  await seedTable(`EK_Users_${stageArg}`, db.users);

  console.log('Seed completed successfully.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Seed Error:', err);
    process.exit(1);
  });
}

module.exports = { main };
