// AWS Serverless API for EK GearFlow (Media Inventory Management)
// Architecture: Node.js + Express (Local & AWS Lambda Serverless Wrapper) + DynamoDB Client

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// AWS SDK v3 DynamoDB Imports (Included for AWS deployment)
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  ScanCommand, 
  UpdateCommand, 
  DeleteCommand 
} = require('@aws-sdk/lib-dynamodb');

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const REGION = process.env.AWS_REGION || 'us-east-1';

// DynamoDB Table Names
const GEAR_TABLE = process.env.GEAR_TABLE || 'EK_Gear';
const CLIENTS_TABLE = process.env.CLIENTS_TABLE || 'EK_Clients';
const BOOKINGS_TABLE = process.env.BOOKINGS_TABLE || 'EK_Bookings';

// DynamoDB Document Client (Auto-marshals JS types)
const dbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dbClient);

// Local JSON File Fallback for Offline/Local Testing without AWS credentials
const localDbPath = path.join(__dirname, 'db-mock.json');

function readLocalDb() {
  if (!fs.existsSync(localDbPath)) {
    const initialData = {
      gear: [
        { id: 'g1', name: 'Sony FX3 Cinema Camera', category: 'Cameras', serialNumber: 'SN-FX3-9821', dailyRate: 150, status: 'Available' },
        { id: 'g2', name: 'Aputure 600d Pro LED', category: 'Lighting', serialNumber: 'SN-AP-600D', dailyRate: 90, status: 'Available' },
        { id: 'g3', name: 'Zoom H6 Audio Recorder', category: 'Audio', serialNumber: 'SN-ZH6-0012', dailyRate: 35, status: 'Available' },
        { id: 'g4', name: 'Sennheiser MKH416 Mic', category: 'Audio', serialNumber: 'SN-SEN-416', dailyRate: 40, status: 'Maintenance' },
        { id: 'g5', name: 'Manfrotto 504HD Tripod', category: 'Support & Grip', serialNumber: 'SN-MAN-504', dailyRate: 25, status: 'Available' }
      ],
      clients: [
        { id: 'c1', name: 'John Doe (Apex Films)', email: 'john@apexfilms.com', phone: '+1 555-019-2834' },
        { id: 'c2', name: 'Sarah Jenkins (Bright Media)', email: 'sarah@brightmedia.co', phone: '+1 555-014-9922' }
      ],
      bookings: [
        {
          id: 'b1',
          gearId: 'g1',
          clientId: 'c1',
          startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'Returned'
        }
      ]
    };
    fs.writeFileSync(localDbPath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
}

function writeLocalDb(data) {
  fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
}

// Recompute gear status based on active ongoing bookings today
function recomputeGearStatus(db, gearId) {
  const todayStr = new Date().toISOString().split('T')[0];
  const gearItem = db.gear.find(g => g.id === gearId);
  if (!gearItem || gearItem.status === 'Maintenance') return;

  const isCurrentlyRented = db.bookings.some(b => 
    b.gearId === gearId && 
    (b.status === 'Active' || !b.status) && 
    b.startDate <= todayStr && 
    b.endDate >= todayStr
  );
  gearItem.status = isCurrentlyRented ? 'Rented' : 'Available';
}

// --- CORE CONTROLLER LOGIC ---

// Fetch Gear
async function getGear() {
  if (!isLambda) {
    const db = readLocalDb();
    // Ensure all gear status matches current active rentals
    db.gear.forEach(g => {
      if (g.status !== 'Maintenance') {
        recomputeGearStatus(db, g.id);
      }
    });
    writeLocalDb(db);
    return db.gear;
  }
  const result = await docClient.send(new ScanCommand({ TableName: GEAR_TABLE }));
  return result.Items || [];
}

// Add Gear
async function addGear(item) {
  const newGear = {
    id: item.id || 'g_' + Date.now(),
    name: item.name,
    category: item.category,
    serialNumber: item.serialNumber,
    dailyRate: Number(item.dailyRate),
    status: item.status || 'Available'
  };

  if (!isLambda) {
    const db = readLocalDb();
    db.gear.push(newGear);
    writeLocalDb(db);
    return newGear;
  }

  await docClient.send(new PutCommand({
    TableName: GEAR_TABLE,
    Item: newGear
  }));
  return newGear;
}

// Update Gear Status
async function updateGearStatus(id, status) {
  if (!isLambda) {
    const db = readLocalDb();
    const gearItem = db.gear.find(g => g.id === id);
    if (gearItem) {
      gearItem.status = status;
      writeLocalDb(db);
    }
    return gearItem;
  }

  await docClient.send(new UpdateCommand({
    TableName: GEAR_TABLE,
    Key: { id },
    UpdateExpression: 'set #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': status }
  }));
}

// Fetch Clients
async function getClients() {
  if (!isLambda) {
    return readLocalDb().clients;
  }
  const result = await docClient.send(new ScanCommand({ TableName: CLIENTS_TABLE }));
  return result.Items || [];
}

// Add Client
async function addClient(clientData) {
  const newClient = {
    id: clientData.id || 'c_' + Date.now(),
    name: clientData.name,
    email: clientData.email,
    phone: clientData.phone
  };

  if (!isLambda) {
    const db = readLocalDb();
    db.clients.push(newClient);
    writeLocalDb(db);
    return newClient;
  }

  await docClient.send(new PutCommand({
    TableName: CLIENTS_TABLE,
    Item: newClient
  }));
  return newClient;
}

// Fetch Bookings
async function getBookings() {
  if (!isLambda) {
    return readLocalDb().bookings;
  }
  const result = await docClient.send(new ScanCommand({ TableName: BOOKINGS_TABLE }));
  return result.Items || [];
}

// Check out gear (with double-booking date overlap validation)
async function createBooking(bookingData) {
  // Support both gearIds array and single gearId string
  const gearIds = bookingData.gearIds || (bookingData.gearId ? [bookingData.gearId] : []);
  
  if (gearIds.length === 0) {
    throw new Error('No gear items selected for checkout.');
  }

  // Get active bookings
  const bookings = await getBookings();
  
  // Date Overlap Validation for ALL requested gear items (exclude Returned & Cancelled)
  for (const gId of gearIds) {
    const hasOverlap = bookings.some(b => 
      b.gearId === gId && 
      b.status !== 'Returned' &&
      b.status !== 'Cancelled' &&
      bookingData.startDate <= b.endDate && 
      bookingData.endDate >= b.startDate
    );

    if (hasOverlap) {
      const db = !isLambda ? readLocalDb() : null;
      let gearName = 'Selected gear';
      if (db) {
        const item = db.gear.find(g => g.id === gId);
        if (item) gearName = item.name;
      }
      throw new Error(`Double-booking Alert: "${gearName}" is already reserved or checked out during this date range.`);
    }
  }

  // Save Bookings
  const createdBookings = [];
  const timestamp = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];
  const isOutToday = bookingData.startDate <= todayStr;
  
  for (let i = 0; i < gearIds.length; i++) {
    const gId = gearIds[i];
    const newBooking = {
      id: `b_${timestamp}_${i}`,
      gearId: gId,
      clientId: bookingData.clientId,
      startDate: bookingData.startDate, // YYYY-MM-DD
      endDate: bookingData.endDate,     // YYYY-MM-DD
      status: 'Active'
    };

    // If starts today or past, mark Rented. If future booking, keep Available in shop today!
    if (isOutToday) {
      await updateGearStatus(gId, 'Rented');
    }

    // Save Booking
    if (!isLambda) {
      const db = readLocalDb();
      db.bookings.push(newBooking);
      writeLocalDb(db);
    } else {
      await docClient.send(new PutCommand({
        TableName: BOOKINGS_TABLE,
        Item: newBooking
      }));
    }
    createdBookings.push(newBooking);
  }

  return createdBookings[0];
}

// Check in gear (return)
async function returnBooking(bookingId) {
  let gearId = null;

  if (!isLambda) {
    const db = readLocalDb();
    const booking = db.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.status = 'Returned';
      gearId = booking.gearId;
      recomputeGearStatus(db, gearId);
      writeLocalDb(db);
    }
  } else {
    const bookingResult = await docClient.send(new GetCommand({
      TableName: BOOKINGS_TABLE,
      Key: { id: bookingId }
    }));
    
    const booking = bookingResult.Item;
    if (booking) {
      gearId = booking.gearId;
      await docClient.send(new UpdateCommand({
        TableName: BOOKINGS_TABLE,
        Key: { id: bookingId },
        UpdateExpression: 'set #s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': 'Returned' }
      }));
      await updateGearStatus(gearId, 'Available');
    }
  }

  return { success: true, gearId };
}

// Cancel booking (void reservation)
async function cancelBooking(bookingId) {
  let gearId = null;

  if (!isLambda) {
    const db = readLocalDb();
    const booking = db.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.status = 'Cancelled';
      gearId = booking.gearId;
      recomputeGearStatus(db, gearId);
      writeLocalDb(db);
    }
  } else {
    const bookingResult = await docClient.send(new GetCommand({
      TableName: BOOKINGS_TABLE,
      Key: { id: bookingId }
    }));
    
    const booking = bookingResult.Item;
    if (booking) {
      gearId = booking.gearId;
      await docClient.send(new UpdateCommand({
        TableName: BOOKINGS_TABLE,
        Key: { id: bookingId },
        UpdateExpression: 'set #s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': 'Cancelled' }
      }));
      await updateGearStatus(gearId, 'Available');
    }
  }

  return { success: true, gearId };
}


// --- API SERVER FOR LOCAL DEVELOPMENT ---
const app = express();
app.use(cors());
app.use(express.json());

// API Endpoints
app.get('/api/gear', async (req, res) => {
  try { res.json(await getGear()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/gear', async (req, res) => {
  try { res.status(201).json(await addGear(req.body)); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/gear/:id', async (req, res) => {
  try {
    await updateGearStatus(req.params.id, req.body.status);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/clients', async (req, res) => {
  try { res.json(await getClients()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clients', async (req, res) => {
  try { res.status(201).json(await addClient(req.body)); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bookings', async (req, res) => {
  try { res.json(await getBookings()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const booking = await createBooking(req.body);
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/bookings/:id/return', async (req, res) => {
  try { res.json(await returnBooking(req.params.id)); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bookings/:id/cancel', async (req, res) => {
  try { res.json(await cancelBooking(req.params.id)); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Start server locally if not inside Lambda
if (!isLambda) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[Local API Server] Running at http://localhost:${PORT}`);
  });
}

// --- AWS LAMBDA PROXY INTEGRATION ---
const serverless = require('serverless-http');
exports.handler = serverless(app);
