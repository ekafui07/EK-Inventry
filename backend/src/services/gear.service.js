const { GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { isLambda, docClient, TABLES, readLocalDb, writeLocalDb } = require('../config/db');

function recomputeGearStatusLocal(db, gearId) {
  const gearItem = (db.gear || []).find(g => g.id === gearId);
  if (!gearItem || gearItem.status === 'Maintenance') return;

  // Always use UTC ISO string for "now" — UTC equals Ghana (Africa/Accra) time permanently
  const nowUtc = new Date().toISOString();
  const todayUtcDate = nowUtc.split('T')[0]; // "YYYY-MM-DD" in UTC = Ghana date

  const isCurrentlyRented = (db.bookings || []).some(b => {
    if (b.gearId !== gearId) return false;
    // Only Active bookings make gear "Rented". Booked = reserved but not yet deployed.
    if (b.status !== 'Active') return false;
    // Normalise both sides to UTC ISO strings for comparison
    const startUtc = b.startDate.includes('T') ? b.startDate : `${b.startDate}T00:00:00.000Z`;
    const endUtc   = b.endDate.includes('T')   ? b.endDate   : `${b.endDate}T23:59:59.999Z`;
    return nowUtc >= startUtc && nowUtc <= endUtc;
  });
  gearItem.status = isCurrentlyRented ? 'Rented' : 'Available';
}

async function recomputeGearStatus(gearId) {
  if (!isLambda) {
    const db = readLocalDb();
    recomputeGearStatusLocal(db, gearId);
    writeLocalDb(db);
    return;
  }

  const nowUtc = new Date().toISOString();
  const gearRes = await docClient.send(new GetCommand({ TableName: TABLES.GEAR, Key: { id: gearId } }));
  const gearItem = gearRes.Item;
  if (!gearItem || gearItem.status === 'Maintenance') return;

  const bookingsRes = await docClient.send(new ScanCommand({ TableName: TABLES.BOOKINGS }));
  const isCurrentlyRented = (bookingsRes.Items || []).some(b => {
    if (b.gearId !== gearId) return false;
    if (b.status !== 'Active') return false;
    const startUtc = b.startDate.includes('T') ? b.startDate : `${b.startDate}T00:00:00.000Z`;
    const endUtc   = b.endDate.includes('T')   ? b.endDate   : `${b.endDate}T23:59:59.999Z`;
    return nowUtc >= startUtc && nowUtc <= endUtc;
  });

  await docClient.send(new UpdateCommand({
    TableName: TABLES.GEAR,
    Key: { id: gearId },
    UpdateExpression: 'set #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': isCurrentlyRented ? 'Rented' : 'Available' }
  }));
}

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

  const [gearRes, bookingsRes] = await Promise.all([
    docClient.send(new ScanCommand({ TableName: TABLES.GEAR })),
    docClient.send(new ScanCommand({ TableName: TABLES.BOOKINGS }))
  ]);
  const gear = gearRes.Items || [];
  const bookings = bookingsRes.Items || [];
  const nowUtc = new Date().toISOString();

  for (let g of gear) {
    if (g.status === 'Maintenance') continue;
    const isCurrentlyRented = bookings.some(b => {
      if (b.gearId !== g.id) return false;
      if (b.status !== 'Active') return false;
      const startUtc = b.startDate.includes('T') ? b.startDate : `${b.startDate}T00:00:00.000Z`;
      const endUtc   = b.endDate.includes('T')   ? b.endDate   : `${b.endDate}T23:59:59.999Z`;
      return nowUtc >= startUtc && nowUtc <= endUtc;
    });
    const targetStatus = isCurrentlyRented ? 'Rented' : 'Available';
    if (g.status !== targetStatus) {
      g.status = targetStatus;
      await docClient.send(new UpdateCommand({
        TableName: TABLES.GEAR,
        Key: { id: g.id },
        UpdateExpression: 'set #s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': targetStatus }
      }));
    }
  }
  return gear;
}

async function addGear(item) {
  if (!item.name || typeof item.name !== 'string' || item.name.trim().length < 2) throw new Error('Invalid Gear Name');
  if (!item.assetTag || typeof item.assetTag !== 'string' || item.assetTag.trim().length < 2) throw new Error('Invalid Asset Tag');
  if (!item.category || typeof item.category !== 'string' || item.category.trim().length < 2) throw new Error('Invalid Category');
  if (!item.serialNumber || typeof item.serialNumber !== 'string' || item.serialNumber.trim().length < 2) throw new Error('Invalid Serial Number');
  if (isNaN(item.dailyRate) || Number(item.dailyRate) <= 0) throw new Error('Invalid Daily Rate');

  const cleanName = item.name.trim();
  const cleanAssetTag = item.assetTag.trim().toUpperCase();
  const cleanCategory = item.category.trim();
  const cleanSerial = item.serialNumber.trim();
  const cleanRate = Number(item.dailyRate);

  const newGear = {
    id: item.id || 'g_' + Date.now(),
    name: cleanName,
    assetTag: cleanAssetTag,
    category: cleanCategory,
    serialNumber: cleanSerial,
    dailyRate: cleanRate,
    status: item.status || 'Available'
  };

  if (!isLambda) {
    const db = readLocalDb();
    if (!db.gear) db.gear = [];
    
    const tagConflict = db.gear.find(g => g.assetTag && g.assetTag.toUpperCase() === cleanAssetTag);
    if (tagConflict) {
      throw new Error('A gear item with this asset tag already exists.');
    }

    const serialConflict = db.gear.find(g => g.serialNumber && g.serialNumber.toLowerCase() === cleanSerial.toLowerCase());
    if (serialConflict) {
      throw new Error('A gear item with this serial number already exists.');
    }

    db.gear.push(newGear);
    writeLocalDb(db);
    return newGear;
  }

  const existingGear = await getGear();
  const tagConflict = existingGear.find(g => g.assetTag && g.assetTag.toUpperCase() === cleanAssetTag);
  if (tagConflict) {
    throw new Error('A gear item with this asset tag already exists.');
  }
  const serialConflict = existingGear.find(g => g.serialNumber && g.serialNumber.toLowerCase() === cleanSerial.toLowerCase());
  if (serialConflict) {
    throw new Error('A gear item with this serial number already exists.');
  }

  await docClient.send(new PutCommand({ TableName: TABLES.GEAR, Item: newGear }));
  return newGear;
}

async function updateGear(id, fields) {
  const cleanAssetTag = fields.assetTag !== undefined ? fields.assetTag.trim().toUpperCase() : undefined;
  const cleanSerial = fields.serialNumber !== undefined ? fields.serialNumber.trim() : undefined;

  if (!isLambda) {
    const db = readLocalDb();
    if (!db.gear) db.gear = [];
    const gearItem = db.gear.find(g => g.id === id);
    if (!gearItem) return null;

    if (cleanAssetTag !== undefined) {
      const tagConflict = db.gear.find(g => g.id !== id && g.assetTag && g.assetTag.toUpperCase() === cleanAssetTag);
      if (tagConflict) throw new Error('A gear item with this asset tag already exists.');
      gearItem.assetTag = cleanAssetTag;
    }
    if (cleanSerial !== undefined) {
      const serialConflict = db.gear.find(g => g.id !== id && g.serialNumber && g.serialNumber.toLowerCase() === cleanSerial.toLowerCase());
      if (serialConflict) throw new Error('A gear item with this serial number already exists.');
      gearItem.serialNumber = cleanSerial;
    }
    if (fields.name !== undefined) gearItem.name = fields.name.trim();
    if (fields.category !== undefined) gearItem.category = fields.category.trim();
    if (fields.dailyRate !== undefined) gearItem.dailyRate = Number(fields.dailyRate);
    if (fields.status !== undefined) gearItem.status = fields.status;
    writeLocalDb(db);
    return gearItem;
  }

  if (cleanAssetTag !== undefined || cleanSerial !== undefined) {
    const allGear = await getGear();
    if (cleanAssetTag !== undefined) {
      const tagConflict = allGear.find(g => g.id !== id && g.assetTag && g.assetTag.toUpperCase() === cleanAssetTag);
      if (tagConflict) throw new Error('A gear item with this asset tag already exists.');
    }
    if (cleanSerial !== undefined) {
      const serialConflict = allGear.find(g => g.id !== id && g.serialNumber && g.serialNumber.toLowerCase() === cleanSerial.toLowerCase());
      if (serialConflict) throw new Error('A gear item with this serial number already exists.');
    }
  }

  const updateParts = [];
  const exprNames = {};
  const exprValues = {};

  if (fields.name !== undefined) { updateParts.push('#n = :name'); exprNames['#n'] = 'name'; exprValues[':name'] = fields.name.trim(); }
  if (cleanAssetTag !== undefined) { updateParts.push('assetTag = :at'); exprValues[':at'] = cleanAssetTag; }
  if (fields.category !== undefined) { updateParts.push('category = :cat'); exprValues[':cat'] = fields.category.trim(); }
  if (cleanSerial !== undefined) { updateParts.push('serialNumber = :sn'); exprValues[':sn'] = cleanSerial; }
  if (fields.dailyRate !== undefined) { updateParts.push('dailyRate = :dr'); exprValues[':dr'] = Number(fields.dailyRate); }
  if (fields.status !== undefined) { updateParts.push('#s = :status'); exprNames['#s'] = 'status'; exprValues[':status'] = fields.status; }

  if (updateParts.length === 0) return { id, ...fields };

  await docClient.send(new UpdateCommand({
    TableName: TABLES.GEAR,
    Key: { id },
    UpdateExpression: 'set ' + updateParts.join(', '),
    ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
    ExpressionAttributeValues: exprValues
  }));
  return { id, ...fields };
}

async function deleteGear(id) {
  // Late require to avoid circular dependency
  const { getBookingsByGearId } = require('./bookings.service');

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

  const itemBookings = await getBookingsByGearId(id);
  const todayStr = new Date().toISOString().split('T')[0];
  const isBlocked = itemBookings.some(b =>
    b.status !== 'Returned' &&
    b.status !== 'Cancelled' &&
    b.endDate >= todayStr
  );

  if (isBlocked) throw new Error('Gear is currently rented out or overdue and cannot be deleted.');

  await docClient.send(new DeleteCommand({ TableName: TABLES.GEAR, Key: { id } }));
  return { success: true };
}

module.exports = {
  getGear,
  addGear,
  updateGear,
  deleteGear,
  recomputeGearStatus,
  recomputeGearStatusLocal
};
