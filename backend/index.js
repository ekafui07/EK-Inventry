require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const serverless = require('serverless-http');

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  ScanCommand, 
  UpdateCommand, 
  DeleteCommand 
} = require('@aws-sdk/lib-dynamodb');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_ek_key';
const REGION = process.env.AWS_REGION || 'us-east-1';

const GEAR_TABLE = process.env.GEAR_TABLE || 'EK_Gear';
const CLIENTS_TABLE = process.env.CLIENTS_TABLE || 'EK_Clients';
const BOOKINGS_TABLE = process.env.BOOKINGS_TABLE || 'EK_Bookings';
const USERS_TABLE = process.env.USERS_TABLE || 'EK_Users';

// Use local DynamoDB if specified via endpoint, otherwise default AWS
const dbClient = new DynamoDBClient({
  region: REGION,
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT })
});
const docClient = DynamoDBDocumentClient.from(dbClient);

// --- HELPER LOGIC ---
async function recomputeGearStatus(gearId) {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const gearRes = await docClient.send(new GetCommand({ TableName: GEAR_TABLE, Key: { id: gearId } }));
  const gearItem = gearRes.Item;
  if (!gearItem || gearItem.status === 'Maintenance') return;

  const bookingsRes = await docClient.send(new ScanCommand({ TableName: BOOKINGS_TABLE }));
  const isCurrentlyRented = (bookingsRes.Items || []).some(b => 
    b.gearId === gearId && 
    (b.status === 'Active' || !b.status) && 
    b.startDate <= todayStr && 
    b.endDate >= todayStr
  );

  await docClient.send(new UpdateCommand({
    TableName: GEAR_TABLE,
    Key: { id: gearId },
    UpdateExpression: 'set #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': isCurrentlyRented ? 'Rented' : 'Available' }
  }));
}

// --- GEAR LOGIC ---
async function getGear() {
  const result = await docClient.send(new ScanCommand({ TableName: GEAR_TABLE }));
  const gear = result.Items || [];
  for (let g of gear) {
    if (g.status !== 'Maintenance') await recomputeGearStatus(g.id);
  }
  const refetched = await docClient.send(new ScanCommand({ TableName: GEAR_TABLE }));
  return refetched.Items || [];
}

async function addGear(item) {
  if (!item.name || typeof item.name !== 'string' || item.name.trim().length < 2) throw new Error('Invalid Gear Name');
  if (!item.assetTag || typeof item.assetTag !== 'string' || item.assetTag.trim().length < 2) throw new Error('Invalid Asset Tag');
  if (!item.category || typeof item.category !== 'string' || item.category.trim().length < 2) throw new Error('Invalid Category');
  if (!item.serialNumber || typeof item.serialNumber !== 'string' || item.serialNumber.trim().length < 2) throw new Error('Invalid Serial Number');
  if (isNaN(item.dailyRate) || Number(item.dailyRate) <= 0) throw new Error('Invalid Daily Rate');

  const newGear = {
    id: item.id || 'g_' + Date.now(),
    name: item.name.trim(),
    assetTag: item.assetTag.trim().toUpperCase(),
    category: item.category.trim(),
    serialNumber: item.serialNumber.trim(),
    dailyRate: Number(item.dailyRate),
    status: item.status || 'Available'
  };

  await docClient.send(new PutCommand({ TableName: GEAR_TABLE, Item: newGear }));
  return newGear;
}

async function updateGear(id, fields) {
  const updateParts = [];
  const exprNames = {};
  const exprValues = {};

  if (fields.name !== undefined) { updateParts.push('#n = :name'); exprNames['#n'] = 'name'; exprValues[':name'] = fields.name; }
  if (fields.assetTag !== undefined) { updateParts.push('assetTag = :at'); exprValues[':at'] = fields.assetTag; }
  if (fields.category !== undefined) { updateParts.push('category = :cat'); exprValues[':cat'] = fields.category; }
  if (fields.serialNumber !== undefined) { updateParts.push('serialNumber = :sn'); exprValues[':sn'] = fields.serialNumber; }
  if (fields.dailyRate !== undefined) { updateParts.push('dailyRate = :dr'); exprValues[':dr'] = Number(fields.dailyRate); }
  if (fields.status !== undefined) { updateParts.push('#s = :status'); exprNames['#s'] = 'status'; exprValues[':status'] = fields.status; }

  if (updateParts.length === 0) return { id, ...fields };

  await docClient.send(new UpdateCommand({
    TableName: GEAR_TABLE,
    Key: { id },
    UpdateExpression: 'set ' + updateParts.join(', '),
    ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
    ExpressionAttributeValues: exprValues
  }));
  return { id, ...fields };
}

async function deleteGear(id) {
  const bookingsRes = await docClient.send(new ScanCommand({ TableName: BOOKINGS_TABLE }));
  const todayStr = new Date().toISOString().split('T')[0];
  const isBlocked = (bookingsRes.Items || []).some(b =>
    b.gearId === id &&
    b.status !== 'Returned' &&
    b.status !== 'Cancelled' &&
    b.endDate >= todayStr
  );

  if (isBlocked) throw new Error('Gear is currently rented out or overdue and cannot be deleted.');

  await docClient.send(new DeleteCommand({ TableName: GEAR_TABLE, Key: { id } }));
  return { success: true };
}

// --- CLIENTS LOGIC ---
async function getClients() {
  const result = await docClient.send(new ScanCommand({ TableName: CLIENTS_TABLE }));
  return result.Items || [];
}

async function addClient(clientData) {
  const newClient = {
    id: clientData.id || 'c_' + Date.now(),
    name: clientData.name,
    email: clientData.email,
    phone: clientData.phone
  };
  await docClient.send(new PutCommand({ TableName: CLIENTS_TABLE, Item: newClient }));
  return newClient;
}

async function updateClient(id, clientData) {
  await docClient.send(new UpdateCommand({
    TableName: CLIENTS_TABLE,
    Key: { id },
    UpdateExpression: 'set #n = :name, email = :email, phone = :phone',
    ExpressionAttributeNames: { '#n': 'name' },
    ExpressionAttributeValues: {
      ':name': clientData.name,
      ':email': clientData.email,
      ':phone': clientData.phone
    }
  }));
  return { id, ...clientData };
}

async function deleteClient(id) {
  const bookingsRes = await docClient.send(new ScanCommand({ TableName: BOOKINGS_TABLE }));
  const todayStr = new Date().toISOString().split('T')[0];
  const hasActiveBookings = (bookingsRes.Items || []).some(b =>
    b.clientId === id &&
    b.status !== 'Returned' &&
    b.status !== 'Cancelled' &&
    b.endDate >= todayStr
  );

  if (hasActiveBookings) throw new Error('Client has active or upcoming rentals and cannot be deleted.');

  await docClient.send(new DeleteCommand({ TableName: CLIENTS_TABLE, Key: { id } }));
  return { success: true };
}

// --- BOOKINGS LOGIC ---
async function getBookings() {
  const result = await docClient.send(new ScanCommand({ TableName: BOOKINGS_TABLE }));
  return result.Items || [];
}

async function createBooking(bookingData) {
  const gearIds = bookingData.gearIds || (bookingData.gearId ? [bookingData.gearId] : []);
  if (gearIds.length === 0) throw new Error('No gear items selected for checkout.');

  const bookingsRes = await docClient.send(new ScanCommand({ TableName: BOOKINGS_TABLE }));
  const bookings = bookingsRes.Items || [];

  for (const gId of gearIds) {
    const hasOverlap = bookings.some(b => 
      b.gearId === gId && 
      b.status !== 'Returned' &&
      b.status !== 'Cancelled' &&
      bookingData.startDate <= b.endDate && 
      bookingData.endDate >= b.startDate
    );

    if (hasOverlap) {
      const gearRes = await docClient.send(new GetCommand({ TableName: GEAR_TABLE, Key: { id: gId } }));
      const item = gearRes.Item;
      throw new Error(`Double-booking Alert: "${item ? item.name : 'Selected gear'}" is already reserved or checked out during this date range.`);
    }
  }

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
      startDate: bookingData.startDate,
      endDate: bookingData.endDate,
      status: 'Active'
    };

    if (isOutToday) await updateGear(gId, { status: 'Rented' });
    await docClient.send(new PutCommand({ TableName: BOOKINGS_TABLE, Item: newBooking }));
    createdBookings.push(newBooking);
  }

  return createdBookings[0];
}

async function returnBooking(bookingId) {
  const bookingRes = await docClient.send(new GetCommand({ TableName: BOOKINGS_TABLE, Key: { id: bookingId } }));
  const booking = bookingRes.Item;
  if (!booking) return { success: false, gearId: null };

  await docClient.send(new UpdateCommand({
    TableName: BOOKINGS_TABLE,
    Key: { id: bookingId },
    UpdateExpression: 'set #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': 'Returned' }
  }));
  await updateGear(booking.gearId, { status: 'Available' });
  return { success: true, gearId: booking.gearId };
}

async function cancelBooking(bookingId) {
  const bookingRes = await docClient.send(new GetCommand({ TableName: BOOKINGS_TABLE, Key: { id: bookingId } }));
  const booking = bookingRes.Item;
  if (!booking) return { success: false, gearId: null };

  await docClient.send(new UpdateCommand({
    TableName: BOOKINGS_TABLE,
    Key: { id: bookingId },
    UpdateExpression: 'set #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': 'Cancelled' }
  }));
  await updateGear(booking.gearId, { status: 'Available' });
  return { success: true, gearId: booking.gearId };
}

// --- USER LOGIC (DynamoDB + Bcrypt) ---
async function getUsers() {
  const result = await docClient.send(new ScanCommand({ TableName: USERS_TABLE }));
  return (result.Items || []).map(({ password, ...u }) => u);
}

async function getUserByEmail(email) {
  const result = await docClient.send(new ScanCommand({ TableName: USERS_TABLE }));
  return (result.Items || []).find(u => u.email.toLowerCase() === email.trim().toLowerCase());
}

async function loginUser({ email, password, accountType }) {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('Invalid email or password');
  if (user.status === 'Banned') throw new Error('Your account has been suspended by an Administrator.');
  if (accountType && user.accountType.toLowerCase() !== accountType.toLowerCase()) {
    throw new Error(`This account is registered as ${user.accountType}, not ${accountType}.`);
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) throw new Error('Invalid email or password');

  const { password: _, ...userSession } = user;
  const token = jwt.sign({ id: user.id, email: user.email, role: user.accountType }, JWT_SECRET, { expiresIn: '24h' });
  return { ...userSession, token };
}

async function addUser(userData) {
  const existing = await getUserByEmail(userData.email);
  if (existing) throw new Error('A staff member with this email already exists.');

  const hashedPassword = await bcrypt.hash(userData.password || '12345', 10);
  const newUser = {
    id: userData.id || 'u_' + Date.now(),
    name: userData.name,
    email: userData.email.trim(),
    password: hashedPassword,
    title: userData.title || 'Staff Member',
    accountType: userData.accountType || 'Staff',
    permissions: userData.permissions || ['manage_clients', 'create_rentals', 'return_rentals'],
    status: 'Active',
    mustChangePassword: userData.mustChangePassword !== undefined ? userData.mustChangePassword : true
  };

  await docClient.send(new PutCommand({ TableName: USERS_TABLE, Item: newUser }));
  const { password: _, ...savedUser } = newUser;
  return savedUser;
}

async function updateUser(id, fields) {
  const updateParts = [];
  const exprNames = {};
  const exprValues = {};

  if (fields.name !== undefined) { updateParts.push('#n = :name'); exprNames['#n'] = 'name'; exprValues[':name'] = fields.name; }
  if (fields.email !== undefined) { updateParts.push('email = :em'); exprValues[':em'] = fields.email.trim(); }
  if (fields.title !== undefined) { updateParts.push('title = :ti'); exprValues[':ti'] = fields.title; }
  if (fields.accountType !== undefined) { updateParts.push('accountType = :at'); exprValues[':at'] = fields.accountType; }
  if (fields.permissions !== undefined) { updateParts.push('permissions = :pe'); exprValues[':pe'] = fields.permissions; }
  if (fields.status !== undefined) { updateParts.push('#s = :status'); exprNames['#s'] = 'status'; exprValues[':status'] = fields.status; }

  if (updateParts.length === 0) return null;

  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { id },
    UpdateExpression: 'set ' + updateParts.join(', '),
    ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
    ExpressionAttributeValues: exprValues
  }));
  
  const userRes = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { id } }));
  const { password: _, ...updatedUser } = userRes.Item || {};
  return updatedUser;
}

async function deleteUser(id) {
  await docClient.send(new DeleteCommand({ TableName: USERS_TABLE, Key: { id } }));
  return { success: true };
}

async function resetUserPassword(id) {
  const hashedPassword = await bcrypt.hash('12345', 10);
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { id },
    UpdateExpression: 'set password = :pw, mustChangePassword = :mc',
    ExpressionAttributeValues: { ':pw': hashedPassword, ':mc': true }
  }));
  return { success: true, message: 'Password reset to 12345' };
}

async function forgotPasswordReset(email) {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('No user account found with that email address.');
  
  const hashedPassword = await bcrypt.hash('12345', 10);
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { id: user.id },
    UpdateExpression: 'set password = :pw, mustChangePassword = :mc',
    ExpressionAttributeValues: { ':pw': hashedPassword, ':mc': true }
  }));
  return { success: true, message: 'Password has been reset to 12345' };
}

async function changeUserPassword(id, newPassword) {
  if (!newPassword || newPassword.trim().length < 4) throw new Error('New password must be at least 4 characters long.');
  if (newPassword === '12345') throw new Error('Please choose a password other than the default 12345.');

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { id },
    UpdateExpression: 'set password = :pw, mustChangePassword = :mc',
    ExpressionAttributeValues: { ':pw': hashedPassword, ':mc': false }
  }));
  
  const userRes = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { id } }));
  const { password: _, ...updatedUser } = userRes.Item || {};
  return updatedUser;
}

async function toggleUserStatus(id, status) {
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { id },
    UpdateExpression: 'set #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': status }
  }));
  
  const userRes = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { id } }));
  const { password: _, ...updatedUser } = userRes.Item || {};
  return updatedUser;
}

// --- AUTH MIDDLEWARE ---
function verifyToken(req, res, next) {
  const bearerHeader = req.headers['authorization'];
  if (typeof bearerHeader !== 'undefined') {
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[1];
    jwt.verify(bearerToken, JWT_SECRET, (err, authData) => {
      if (err) return res.status(401).json({ error: 'Invalid or expired token' });
      req.authData = authData;
      next();
    });
  } else {
    res.status(401).json({ error: 'Authorization header required' });
  }
}

// --- API SERVER ---
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/gear', verifyToken, async (req, res) => { try { res.json(await getGear()); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/gear', verifyToken, async (req, res) => { try { res.status(201).json(await addGear(req.body)); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put('/api/gear/:id', verifyToken, async (req, res) => { try { const updated = await updateGear(req.params.id, req.body); if (!updated) return res.status(404).json({ error: 'Gear not found' }); res.json(updated); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete('/api/gear/:id', verifyToken, async (req, res) => { try { res.json(await deleteGear(req.params.id)); } catch (err) { res.status(400).json({ error: err.message }); } });

app.get('/api/clients', verifyToken, async (req, res) => { try { res.json(await getClients()); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/clients', verifyToken, async (req, res) => { try { res.status(201).json(await addClient(req.body)); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put('/api/clients/:id', verifyToken, async (req, res) => { try { const updated = await updateClient(req.params.id, req.body); if (!updated) return res.status(404).json({ error: 'Client not found' }); res.json(updated); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete('/api/clients/:id', verifyToken, async (req, res) => { try { res.json(await deleteClient(req.params.id)); } catch (err) { res.status(400).json({ error: err.message }); } });

app.get('/api/bookings', verifyToken, async (req, res) => { try { res.json(await getBookings()); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/bookings', verifyToken, async (req, res) => { try { const booking = await createBooking(req.body); res.status(201).json(booking); } catch (err) { res.status(400).json({ message: err.message }); } });
app.put('/api/bookings/:id/return', verifyToken, async (req, res) => { try { res.json(await returnBooking(req.params.id)); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put('/api/bookings/:id/cancel', verifyToken, async (req, res) => { try { res.json(await cancelBooking(req.params.id)); } catch (err) { res.status(500).json({ error: err.message }); } });

app.post('/api/login', async (req, res) => { try { const userSession = await loginUser(req.body); res.json(userSession); } catch (err) { res.status(401).json({ error: err.message }); } });
app.get('/api/users', verifyToken, async (req, res) => { try { res.json(await getUsers()); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/users', verifyToken, async (req, res) => { try { res.status(201).json(await addUser(req.body)); } catch (err) { res.status(400).json({ error: err.message }); } });
app.put('/api/users/:id', verifyToken, async (req, res) => { try { const updated = await updateUser(req.params.id, req.body); if (!updated) return res.status(404).json({ error: 'User not found' }); res.json(updated); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete('/api/users/:id', verifyToken, async (req, res) => { try { res.json(await deleteUser(req.params.id)); } catch (err) { res.status(400).json({ error: err.message }); } });
app.post('/api/users/:id/reset-password', async (req, res) => { try { res.json(await resetUserPassword(req.params.id)); } catch (err) { res.status(400).json({ error: err.message }); } });
app.post('/api/forgot-password', async (req, res) => { try { res.json(await forgotPasswordReset(req.body.email)); } catch (err) { res.status(400).json({ error: err.message }); } });
app.post('/api/users/:id/change-password', async (req, res) => { try { res.json(await changeUserPassword(req.params.id, req.body.newPassword)); } catch (err) { res.status(400).json({ error: err.message }); } });
app.put('/api/users/:id/status', verifyToken, async (req, res) => { try { res.json(await toggleUserStatus(req.params.id, req.body.status)); } catch (err) { res.status(400).json({ error: err.message }); } });

if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const PORT = process.env.PORT || 3000; app.listen(PORT, () => { console.log(`[API Server] Running at http://localhost:${PORT}`); });
}

exports.handler = serverless(app);
