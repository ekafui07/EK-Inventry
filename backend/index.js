require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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

const {
  authenticate,
  verifyToken,
  requireRole,
  requirePermission,
  JWT_SECRET
} = require('./middleware/auth');

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const REGION = process.env.AWS_REGION || 'us-east-1';

const GEAR_TABLE = process.env.GEAR_TABLE || 'EK_Gear';
const CLIENTS_TABLE = process.env.CLIENTS_TABLE || 'EK_Clients';
const BOOKINGS_TABLE = process.env.BOOKINGS_TABLE || 'EK_Bookings';
const USERS_TABLE = process.env.USERS_TABLE || 'EK_Users';

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
const localDbPath = path.join(__dirname, 'db-mock.json');

function readLocalDb() {
  if (!fs.existsSync(localDbPath)) {
    const initialData = { gear: [], clients: [], bookings: [], users: [] };
    fs.writeFileSync(localDbPath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
  } catch (e) {
    return { gear: [], clients: [], bookings: [], users: [] };
  }
}

function writeLocalDb(data) {
  fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
}

function recomputeGearStatusLocal(db, gearId) {
  const todayStr = new Date().toISOString().split('T')[0];
  const gearItem = (db.gear || []).find(g => g.id === gearId);
  if (!gearItem || gearItem.status === 'Maintenance') return;

  const isCurrentlyRented = (db.bookings || []).some(b => 
    b.gearId === gearId && 
    (b.status === 'Active' || !b.status) && 
    b.startDate <= todayStr && 
    b.endDate >= todayStr
  );
  gearItem.status = isCurrentlyRented ? 'Rented' : 'Available';
}

// --- HELPER LOGIC ---
async function recomputeGearStatus(gearId) {
  if (!isLambda) {
    const db = readLocalDb();
    recomputeGearStatusLocal(db, gearId);
    writeLocalDb(db);
    return;
  }

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
  if (!isLambda) {
    const db = readLocalDb();
    if (!db.gear) db.gear = [];
    for (let g of db.gear) {
      if (g.status !== 'Maintenance') recomputeGearStatusLocal(db, g.id);
    }
    writeLocalDb(db);
    return db.gear;
  }

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

  if (!isLambda) {
    const db = readLocalDb();
    if (!db.gear) db.gear = [];
    db.gear.push(newGear);
    writeLocalDb(db);
    return newGear;
  }

  await docClient.send(new PutCommand({ TableName: GEAR_TABLE, Item: newGear }));
  return newGear;
}

async function updateGear(id, fields) {
  if (!isLambda) {
    const db = readLocalDb();
    if (!db.gear) db.gear = [];
    const gearItem = db.gear.find(g => g.id === id);
    if (!gearItem) return null;
    if (fields.name !== undefined) gearItem.name = fields.name;
    if (fields.assetTag !== undefined) gearItem.assetTag = fields.assetTag;
    if (fields.category !== undefined) gearItem.category = fields.category;
    if (fields.serialNumber !== undefined) gearItem.serialNumber = fields.serialNumber;
    if (fields.dailyRate !== undefined) gearItem.dailyRate = Number(fields.dailyRate);
    if (fields.status !== undefined) gearItem.status = fields.status;
    writeLocalDb(db);
    return gearItem;
  }

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
  if (!isLambda) {
    const db = readLocalDb();
    const bookings = db.bookings || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const isBlocked = bookings.some(b =>
      b.gearId === id &&
      b.status !== 'Returned' &&
      b.status !== 'Cancelled' &&
      b.endDate >= todayStr
    );
    if (isBlocked) throw new Error('Gear is currently rented out or overdue and cannot be deleted.');
    const index = (db.gear || []).findIndex(g => g.id === id);
    if (index === -1) return { success: false };
    db.gear.splice(index, 1);
    writeLocalDb(db);
    return { success: true };
  }

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
  if (!isLambda) {
    const db = readLocalDb();
    return db.clients || [];
  }

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

  if (!isLambda) {
    const db = readLocalDb();
    if (!db.clients) db.clients = [];
    db.clients.push(newClient);
    writeLocalDb(db);
    return newClient;
  }

  await docClient.send(new PutCommand({ TableName: CLIENTS_TABLE, Item: newClient }));
  return newClient;
}

async function updateClient(id, clientData) {
  if (!isLambda) {
    const db = readLocalDb();
    const client = (db.clients || []).find(c => c.id === id);
    if (!client) return null;
    if (clientData.name !== undefined) client.name = clientData.name;
    if (clientData.email !== undefined) client.email = clientData.email;
    if (clientData.phone !== undefined) client.phone = clientData.phone;
    writeLocalDb(db);
    return client;
  }

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
  if (!isLambda) {
    const db = readLocalDb();
    const bookings = db.bookings || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const hasActiveBookings = bookings.some(b =>
      b.clientId === id &&
      b.status !== 'Returned' &&
      b.status !== 'Cancelled' &&
      b.endDate >= todayStr
    );
    if (hasActiveBookings) throw new Error('Client has active or upcoming rentals and cannot be deleted.');
    const index = (db.clients || []).findIndex(c => c.id === id);
    if (index === -1) return { success: false };
    db.clients.splice(index, 1);
    writeLocalDb(db);
    return { success: true };
  }

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
  if (!isLambda) {
    const db = readLocalDb();
    return db.bookings || [];
  }

  const result = await docClient.send(new ScanCommand({ TableName: BOOKINGS_TABLE }));
  return result.Items || [];
}

async function createBooking(bookingData) {
  const gearIds = bookingData.gearIds || (bookingData.gearId ? [bookingData.gearId] : []);
  if (gearIds.length === 0) throw new Error('No gear items selected for checkout.');

  if (!isLambda) {
    const db = readLocalDb();
    const bookings = db.bookings || [];

    for (const gId of gearIds) {
      const hasOverlap = bookings.some(b => 
        b.gearId === gId && 
        b.status !== 'Returned' &&
        b.status !== 'Cancelled' &&
        bookingData.startDate <= b.endDate && 
        bookingData.endDate >= b.startDate
      );

      if (hasOverlap) {
        const item = (db.gear || []).find(g => g.id === gId);
        throw new Error(`Double-booking Alert: "${item ? item.name : 'Selected gear'}" is already reserved or checked out during this date range.`);
      }
    }

    const createdBookings = [];
    const timestamp = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    const isOutToday = bookingData.startDate <= todayStr;
    
    if (!db.bookings) db.bookings = [];
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

      if (isOutToday) {
        const gearItem = (db.gear || []).find(g => g.id === gId);
        if (gearItem && gearItem.status !== 'Maintenance') gearItem.status = 'Rented';
      }
      db.bookings.push(newBooking);
      createdBookings.push(newBooking);
    }
    writeLocalDb(db);
    return createdBookings[0];
  }

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
  if (!isLambda) {
    const db = readLocalDb();
    const booking = (db.bookings || []).find(b => b.id === bookingId);
    if (!booking) return { success: false, gearId: null };

    booking.status = 'Returned';
    const gearItem = (db.gear || []).find(g => g.id === booking.gearId);
    if (gearItem && gearItem.status !== 'Maintenance') gearItem.status = 'Available';
    writeLocalDb(db);
    return { success: true, gearId: booking.gearId };
  }

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
  if (!isLambda) {
    const db = readLocalDb();
    const booking = (db.bookings || []).find(b => b.id === bookingId);
    if (!booking) return { success: false, gearId: null };

    booking.status = 'Cancelled';
    const gearItem = (db.gear || []).find(g => g.id === booking.gearId);
    if (gearItem && gearItem.status !== 'Maintenance') gearItem.status = 'Available';
    writeLocalDb(db);
    return { success: true, gearId: booking.gearId };
  }

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

// --- USER LOGIC ---
async function getUsers() {
  if (!isLambda) {
    const db = readLocalDb();
    return (db.users || []).map(({ password, ...u }) => ({
      ...u,
      role: (u.role || u.accountType || 'Staff').toLowerCase(),
      accountType: (u.accountType || (u.role && u.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff'))
    }));
  }

  const result = await docClient.send(new ScanCommand({ TableName: USERS_TABLE }));
  return (result.Items || []).map(({ password, ...u }) => ({
    ...u,
    role: (u.role || u.accountType || 'Staff').toLowerCase(),
    accountType: (u.accountType || (u.role && u.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff'))
  }));
}

async function getUserByEmail(email) {
  if (!email) return null;

  if (!isLambda) {
    const db = readLocalDb();
    const user = (db.users || []).find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) return null;
    return {
      ...user,
      role: (user.role || user.accountType || 'Staff').toLowerCase(),
      accountType: (user.accountType || (user.role && user.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff'))
    };
  }

  const result = await docClient.send(new ScanCommand({ TableName: USERS_TABLE }));
  const user = (result.Items || []).find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return null;
  return {
    ...user,
    role: (user.role || user.accountType || 'Staff').toLowerCase(),
    accountType: (user.accountType || (user.role && user.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff'))
  };
}

async function loginUser({ email, password, accountType }) {
  if (!email || !password) throw new Error('Email and password are required');
  const user = await getUserByEmail(email);
  if (!user) throw new Error('Invalid email or password');
  if (user.status && user.status.toLowerCase() === 'inactive') {
    throw new Error('This account has been deactivated. Please contact an administrator.');
  }

  let validPassword = false;
  try {
    validPassword = await bcrypt.compare(password, user.password);
  } catch (e) {
    validPassword = false;
  }

  // Fallback for legacy plaintext passwords (e.g. from initial mock/seed data)
  if (!validPassword && user.password === password) {
    validPassword = true;
    try {
      const upgradedHash = await bcrypt.hash(password, 10);
      if (!isLambda) {
        const db = readLocalDb();
        const u = (db.users || []).find(x => x.id === user.id);
        if (u) {
          u.password = upgradedHash;
          writeLocalDb(db);
        }
      } else if (docClient) {
        await docClient.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { id: user.id },
          UpdateExpression: 'set password = :pw',
          ExpressionAttributeValues: { ':pw': upgradedHash }
        }));
      }
    } catch (err) {
      console.warn('Could not auto-upgrade password hash:', err.message);
    }
  }

  if (!validPassword) throw new Error('Invalid email or password');

  const role = (user.role || user.accountType || 'Staff').toLowerCase();
  const normalizedAccountType = role === 'admin' ? 'Admin' : 'Staff';

  if (accountType && normalizedAccountType.toLowerCase() !== accountType.toLowerCase()) {
    throw new Error(`This account is registered as ${normalizedAccountType}, not ${accountType}.`);
  }

  const { password: _, ...userSession } = user;
  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: role,
    accountType: normalizedAccountType,
    permissions: user.permissions || [
      'manage_clients',
      'create_rentals',
      'return_rentals',
      'cancel_rentals'
    ]
  };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

  return {
    ...userSession,
    role,
    accountType: normalizedAccountType,
    token
  };
}

async function addUser(userData) {
  if (!userData.email || !userData.name) {
    throw new Error('Name and email are required');
  }

  const existing = await getUserByEmail(userData.email);
  if (existing) throw new Error('A staff member with this email already exists.');

  const role = (userData.role || userData.accountType || 'Staff').toLowerCase();
  if (role === 'admin') {
    const allUsers = await getUsers();
    const hasAdmin = allUsers.some(u => (u.role || u.accountType || '').toLowerCase() === 'admin');
    if (hasAdmin) {
      throw new Error('Only one primary Administrator account is allowed.');
    }
  }

  const hashedPassword = await bcrypt.hash(userData.password || '12345', 10);
  const newUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: userData.name,
    email: userData.email.trim().toLowerCase(),
    password: hashedPassword,
    title: userData.title || (role === 'admin' ? 'Administrator' : 'Desk Specialist'),
    accountType: role === 'admin' ? 'Admin' : 'Staff',
    role: role,
    permissions: userData.permissions || (role === 'admin'
      ? ['manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals', 'manage_gear', 'manage_users']
      : ['manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals']),
    status: userData.status || 'Active',
    mustChangePassword: userData.mustChangePassword !== undefined ? userData.mustChangePassword : false,
    createdAt: new Date().toISOString()
  };

  if (!isLambda) {
    const db = readLocalDb();
    if (!db.users) db.users = [];
    db.users.push(newUser);
    writeLocalDb(db);
    const { password: _, ...savedUser } = newUser;
    return savedUser;
  }

  await docClient.send(new PutCommand({ TableName: USERS_TABLE, Item: newUser }));
  const { password: _, ...savedUser } = newUser;
  return savedUser;
}

async function updateUser(id, fields) {
  if (!isLambda) {
    const db = readLocalDb();
    if (!db.users) db.users = [];
    const user = db.users.find(u => u.id === id);
    if (!user) return null;
    if (fields.name !== undefined) user.name = fields.name;
    if (fields.email !== undefined) user.email = fields.email.trim();
    if (fields.title !== undefined) user.title = fields.title;
    if (fields.accountType !== undefined) {
      user.accountType = fields.accountType;
      user.role = fields.accountType.toLowerCase();
    }
    if (fields.role !== undefined) {
      user.role = fields.role.toLowerCase();
      user.accountType = fields.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff';
    }
    if (fields.permissions !== undefined) user.permissions = fields.permissions;
    if (fields.status !== undefined) user.status = fields.status;
    writeLocalDb(db);
    const { password: _, ...updatedUser } = user;
    return updatedUser;
  }

  const updateParts = [];
  const exprNames = {};
  const exprValues = {};

  if (fields.name !== undefined) { updateParts.push('#n = :name'); exprNames['#n'] = 'name'; exprValues[':name'] = fields.name; }
  if (fields.email !== undefined) { updateParts.push('email = :em'); exprValues[':em'] = fields.email.trim(); }
  if (fields.title !== undefined) { updateParts.push('title = :ti'); exprValues[':ti'] = fields.title; }
  if (fields.accountType !== undefined) {
    updateParts.push('accountType = :at'); exprValues[':at'] = fields.accountType;
    updateParts.push('role = :ro'); exprValues[':ro'] = fields.accountType.toLowerCase();
  }
  if (fields.role !== undefined) {
    updateParts.push('role = :ro'); exprValues[':ro'] = fields.role.toLowerCase();
    updateParts.push('accountType = :at'); exprValues[':at'] = fields.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff';
  }
  if (fields.permissions !== undefined) { updateParts.push('permissions = :pe'); exprValues[':pe'] = fields.permissions; }
  if (fields.status !== undefined) { updateParts.push('#s = :status'); exprNames['#s'] = 'status'; exprValues[':status'] = fields.status; }

  if (updateParts.length === 0) return { id, ...fields };

  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { id },
    UpdateExpression: 'set ' + updateParts.join(', '),
    ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
    ExpressionAttributeValues: exprValues
  }));

  const userRes = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { id } }));
  const { password: _, ...updatedUser } = userRes.Item || {};
  return updatedUser;
}

async function deleteUser(id) {
  const allUsers = await getUsers();
  const targetUser = allUsers.find(u => u.id === id);
  if (targetUser && ((targetUser.role || '').toLowerCase() === 'admin' || targetUser.accountType === 'Admin')) {
    const adminCount = allUsers.filter(u => (u.accountType || u.role || '').toLowerCase() === 'admin').length;
    if (adminCount <= 1) {
      throw new Error('Cannot delete the primary Administrator account.');
    }
  }

  if (!isLambda) {
    const db = readLocalDb();
    if (!db.users) db.users = [];
    const index = db.users.findIndex(u => u.id === id);
    if (index === -1) return { success: false };
    db.users.splice(index, 1);
    writeLocalDb(db);
    return { success: true };
  }

  await docClient.send(new DeleteCommand({ TableName: USERS_TABLE, Key: { id } }));
  return { success: true };
}

async function resetUserPassword(id) {
  const hashedPassword = await bcrypt.hash('12345', 10);
  if (!isLambda) {
    const db = readLocalDb();
    const user = (db.users || []).find(u => u.id === id);
    if (!user) throw new Error('User not found');
    user.password = hashedPassword;
    user.mustChangePassword = true;
    writeLocalDb(db);
    return { success: true, message: 'Password reset to 12345' };
  }

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
  if (!user) throw new Error('No user found with that email address.');
  const hashedPassword = await bcrypt.hash('12345', 10);

  if (!isLambda) {
    const db = readLocalDb();
    const found = (db.users || []).find(u => u.id === user.id);
    if (found) {
      found.password = hashedPassword;
      found.mustChangePassword = true;
      writeLocalDb(db);
    }
    return { success: true, message: 'Password has been reset to 12345' };
  }

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

  if (!isLambda) {
    const db = readLocalDb();
    const user = (db.users || []).find(u => u.id === id);
    if (!user) throw new Error('User not found');
    user.password = hashedPassword;
    user.mustChangePassword = false;
    writeLocalDb(db);
    const { password: _, ...updatedUser } = user;
    return updatedUser;
  }

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
  if (!isLambda) {
    const db = readLocalDb();
    const user = (db.users || []).find(u => u.id === id);
    if (!user) throw new Error('User not found');
    user.status = status;
    writeLocalDb(db);
    const { password: _, ...updatedUser } = user;
    return updatedUser;
  }

  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { id },
    UpdateExpression: 'set #s = :st',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':st': status }
  }));
  const userRes = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { id } }));
  const { password: _, ...updatedUser } = userRes.Item || {};
  return updatedUser;
}

// Auto-seed default accounts on start
async function seedInitialUsers() {
  try {
    const seeds = [
      {
        id: 'u_admin_gearflow',
        name: 'GearFlow Admin',
        email: 'admin@gearflow.com',
        plainPassword: 'Admin@123',
        title: 'System Administrator',
        accountType: 'Admin',
        role: 'admin',
        permissions: ['manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals', 'manage_gear', 'manage_users'],
        status: 'Active',
        mustChangePassword: false
      },
      {
        id: 'u_staff_gearflow',
        name: 'GearFlow Staff',
        email: 'staff@gearflow.com',
        plainPassword: 'Staff@123',
        title: 'Desk Specialist',
        accountType: 'Staff',
        role: 'staff',
        permissions: ['manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals'],
        status: 'Active',
        mustChangePassword: false
      },
      {
        id: 'u_admin_ek',
        name: 'EK Admin',
        email: 'admin@ekgearflow.com',
        plainPassword: 'admin123',
        title: 'Operations Manager',
        accountType: 'Admin',
        role: 'admin',
        permissions: ['manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals', 'manage_gear', 'manage_users'],
        status: 'Active',
        mustChangePassword: false
      },
      {
        id: 'u_sarah_ek',
        name: 'Sarah Adjei',
        email: 'sarah@ekgearflow.com',
        plainPassword: 'BerlinB1214@',
        title: 'Senior Desk Specialist',
        accountType: 'Staff',
        role: 'staff',
        permissions: ['manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals'],
        status: 'Active',
        mustChangePassword: false
      }
    ];

    if (!isLambda) {
      const db = readLocalDb();
      if (!db.users) db.users = [];
      for (const u of seeds) {
        const existing = db.users.find(x => x.email && x.email.toLowerCase() === u.email.toLowerCase());
        if (!existing) {
          const hashedPassword = await bcrypt.hash(u.plainPassword, 10);
          const { plainPassword: _, ...item } = u;
          db.users.push({
            ...item,
            password: hashedPassword,
            createdAt: new Date().toISOString()
          });
        }
      }
      writeLocalDb(db);
      return;
    }

    for (const u of seeds) {
      const existing = await getUserByEmail(u.email);
      if (!existing) {
        const hashedPassword = await bcrypt.hash(u.plainPassword, 10);
        const { plainPassword: _, ...item } = u;
        await docClient.send(new PutCommand({
          TableName: USERS_TABLE,
          Item: {
            ...item,
            password: hashedPassword,
            createdAt: new Date().toISOString()
          }
        }));
      }
    }
  } catch (err) {
    console.warn('[Seed] User seeding note:', err.message);
  }
}

// --- API SERVER ---
const app = express();
app.use(cors());
app.use(express.json());

// Equipment Routes
app.get('/api/gear', authenticate, async (req, res) => {
  try {
    res.json(await getGear());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gear', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    res.status(201).json(await addGear(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/gear/:id', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const updated = await updateGear(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Gear not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/gear/:id', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    res.json(await deleteGear(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Client Routes
app.get('/api/clients', authenticate, async (req, res) => {
  try {
    res.json(await getClients());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clients', authenticate, requirePermission('manage_clients'), async (req, res) => {
  try {
    res.status(201).json(await addClient(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/clients/:id', authenticate, requirePermission('manage_clients'), async (req, res) => {
  try {
    const updated = await updateClient(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Client not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/clients/:id', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    res.json(await deleteClient(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Booking Routes
app.get('/api/bookings', authenticate, async (req, res) => {
  try {
    res.json(await getBookings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', authenticate, requirePermission('create_rentals'), async (req, res) => {
  try {
    const booking = await createBooking(req.body);
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/bookings/:id/return', authenticate, requirePermission('return_rentals'), async (req, res) => {
  try {
    res.json(await returnBooking(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bookings/:id/cancel', authenticate, requirePermission('cancel_rentals'), async (req, res) => {
  try {
    res.json(await cancelBooking(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unified Authentication Routes
const handleLogin = async (req, res) => {
  try {
    const userSession = await loginUser(req.body);
    res.json(userSession);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};
app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);

// Current User Profile
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// User Management Routes (RBAC Protected)
app.get('/api/users', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    res.json(await getUsers());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const newUser = await addUser(req.body);
    res.status(201).json({ user: newUser, ...newUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own profile.' });
    }
    const updated = await updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own administrator account.' });
    }
    res.json(await deleteUser(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users/:id/reset-password', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    res.json(await resetUserPassword(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    res.json(await forgotPasswordReset(req.body.email));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users/:id/change-password', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden: You can only change your own password.' });
    }
    res.json(await changeUserPassword(req.params.id, req.body.newPassword));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id/status', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    if (req.user.id === req.params.id && req.body.status === 'Inactive') {
      return res.status(400).json({ error: 'Cannot deactivate your own administrator account.' });
    }
    res.json(await toggleUserStatus(req.params.id, req.body.status));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Seed default accounts asynchronously
seedInitialUsers();

if (require.main === module && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[API Server] Running at http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.seedInitialUsers = seedInitialUsers;
module.exports.handler = serverless(app);
