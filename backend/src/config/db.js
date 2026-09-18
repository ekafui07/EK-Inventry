const path = require('path');
const fs = require('fs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const REGION = process.env.AWS_REGION || 'us-east-1';

const TABLES = {
  GEAR: process.env.GEAR_TABLE || 'EK_Gear',
  CLIENTS: process.env.CLIENTS_TABLE || 'EK_Clients',
  BOOKINGS: process.env.BOOKINGS_TABLE || 'EK_Bookings',
  USERS: process.env.USERS_TABLE || 'EK_Users',
  AUDIT: process.env.AUDIT_TABLE || 'EK_AuditLogs'
};

// DynamoDB Document Client (used when running on AWS Lambda or when DynamoDB endpoint is provided)
let docClient = null;
if (isLambda || process.env.DYNAMODB_ENDPOINT) {
  const dbClient = new DynamoDBClient({
    region: REGION,
    ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT })
  });
  docClient = DynamoDBDocumentClient.from(dbClient);
}

// Local JSON File Database for local/offline execution
const localDbPath = path.join(__dirname, '..', '..', 'db-mock.json');

function readLocalDb() {
  if (!fs.existsSync(localDbPath)) {
    const initialData = { gear: [], clients: [], bookings: [], users: [], auditLogs: [] };
    fs.writeFileSync(localDbPath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
  } catch (e) {
    return { gear: [], clients: [], bookings: [], users: [], auditLogs: [] };
  }
}

function writeLocalDb(data) {
  fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
}

module.exports = {
  isLambda,
  docClient,
  TABLES,
  readLocalDb,
  writeLocalDb
};
