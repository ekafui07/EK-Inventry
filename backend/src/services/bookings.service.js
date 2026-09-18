const { GetCommand, PutCommand, ScanCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { isLambda, docClient, TABLES, readLocalDb, writeLocalDb } = require('../config/db');
const { bookingLock } = require('../utils/lock');
const { recomputeGearStatus, recomputeGearStatusLocal, updateGear } = require('./gear.service');

async function getBookingsByGearId(gearId) {
  if (!gearId) return [];
  if (!isLambda) {
    const db = readLocalDb();
    return (db.bookings || []).filter(b => b.gearId === gearId);
  }
  try {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLES.BOOKINGS,
      IndexName: 'GearIdIndex',
      KeyConditionExpression: 'gearId = :gId',
      ExpressionAttributeValues: { ':gId': gearId }
    }));
    return res.Items || [];
  } catch (err) {
    // Fallback to filtered scan if GSI is provisioning or not created
    const scanRes = await docClient.send(new ScanCommand({
      TableName: TABLES.BOOKINGS,
      FilterExpression: 'gearId = :gId',
      ExpressionAttributeValues: { ':gId': gearId }
    })).catch(() => ({ Items: [] }));
    return scanRes.Items || [];
  }
}

async function getBookingsByClientId(clientId) {
  if (!clientId) return [];
  if (!isLambda) {
    const db = readLocalDb();
    return (db.bookings || []).filter(b => b.clientId === clientId);
  }
  try {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLES.BOOKINGS,
      IndexName: 'ClientIdIndex',
      KeyConditionExpression: 'clientId = :cId',
      ExpressionAttributeValues: { ':cId': clientId }
    }));
    return res.Items || [];
  } catch (err) {
    // Fallback to filtered scan if GSI is provisioning or not created
    const scanRes = await docClient.send(new ScanCommand({
      TableName: TABLES.BOOKINGS,
      FilterExpression: 'clientId = :cId',
      ExpressionAttributeValues: { ':cId': clientId }
    })).catch(() => ({ Items: [] }));
    return scanRes.Items || [];
  }
}

async function getBookings() {
  if (!isLambda) {
    const db = readLocalDb();
    return db.bookings || [];
  }

  const result = await docClient.send(new ScanCommand({ TableName: TABLES.BOOKINGS }));
  return result.Items || [];
}

async function createBooking(bookingData) {
  // Acquire concurrency serialization lock to prevent race conditions on simultaneous checkouts
  return bookingLock.acquire(async () => {
    const rawGearIds = bookingData.gearIds || (bookingData.gearId ? [bookingData.gearId] : []);
    const gearIds = [...new Set(rawGearIds.map(g => (typeof g === 'string' ? g.trim() : g)).filter(Boolean))];
    if (gearIds.length === 0) throw new Error('No gear items selected for checkout.');
    if (!bookingData.clientId) throw new Error('Client selection is required for checkout.');
    if (!bookingData.startDate || !bookingData.endDate) throw new Error('Start date and end date are required.');
    if (bookingData.startDate > bookingData.endDate) throw new Error('Rental start date cannot be after the return date.');

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

    // DynamoDB Mode: Query each gear item's bookings directly via GSI lookup
    for (const gId of gearIds) {
      const gearBookings = await getBookingsByGearId(gId);
      const hasOverlap = gearBookings.some(b => 
        b.status !== 'Returned' &&
        b.status !== 'Cancelled' &&
        bookingData.startDate <= b.endDate && 
        bookingData.endDate >= b.startDate
      );

      if (hasOverlap) {
        const gearRes = await docClient.send(new GetCommand({ TableName: TABLES.GEAR, Key: { id: gId } }));
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
      await docClient.send(new PutCommand({ TableName: TABLES.BOOKINGS, Item: newBooking }));
      createdBookings.push(newBooking);
    }

    return createdBookings[0];
  });
}

async function returnBooking(bookingId) {
  if (!isLambda) {
    const db = readLocalDb();
    const booking = (db.bookings || []).find(b => b.id === bookingId);
    if (!booking) return { success: false, gearId: null };

    booking.status = 'Returned';
    recomputeGearStatusLocal(db, booking.gearId);
    writeLocalDb(db);
    return { success: true, gearId: booking.gearId };
  }

  const bookingRes = await docClient.send(new GetCommand({ TableName: TABLES.BOOKINGS, Key: { id: bookingId } }));
  const booking = bookingRes.Item;
  if (!booking) return { success: false, gearId: null };

  await docClient.send(new UpdateCommand({
    TableName: TABLES.BOOKINGS,
    Key: { id: bookingId },
    UpdateExpression: 'set #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': 'Returned' }
  }));
  await recomputeGearStatus(booking.gearId);
  return { success: true, gearId: booking.gearId };
}

async function cancelBooking(bookingId) {
  if (!isLambda) {
    const db = readLocalDb();
    const booking = (db.bookings || []).find(b => b.id === bookingId);
    if (!booking) return { success: false, gearId: null };

    booking.status = 'Cancelled';
    recomputeGearStatusLocal(db, booking.gearId);
    writeLocalDb(db);
    return { success: true, gearId: booking.gearId };
  }

  const bookingRes = await docClient.send(new GetCommand({ TableName: TABLES.BOOKINGS, Key: { id: bookingId } }));
  const booking = bookingRes.Item;
  if (!booking) return { success: false, gearId: null };

  await docClient.send(new UpdateCommand({
    TableName: TABLES.BOOKINGS,
    Key: { id: bookingId },
    UpdateExpression: 'set #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': 'Cancelled' }
  }));
  await recomputeGearStatus(booking.gearId);
  return { success: true, gearId: booking.gearId };
}

module.exports = {
  getBookings,
  getBookingsByGearId,
  getBookingsByClientId,
  createBooking,
  returnBooking,
  cancelBooking
};
