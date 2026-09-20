const { PutCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { isLambda, docClient, TABLES, readLocalDb, writeLocalDb } = require('../config/db');
const { getBookingsByClientId } = require('./bookings.service');

async function getClients() {
  if (!isLambda) {
    const db = readLocalDb();
    return db.clients || [];
  }

  const result = await docClient.send(new ScanCommand({ TableName: TABLES.CLIENTS }));
  return result.Items || [];
}

async function addClient(clientData) {
  if (!clientData.name || typeof clientData.name !== 'string' || clientData.name.trim().length < 2) {
    throw new Error('Client Name must be at least 2 characters long');
  }
  if (!clientData.email || typeof clientData.email !== 'string' || !clientData.email.includes('@')) {
    throw new Error('Valid client email is required');
  }
  if (!clientData.phone || typeof clientData.phone !== 'string' || clientData.phone.trim().length < 5) {
    throw new Error('Valid client phone number is required');
  }
  if (!clientData.ghanaCardNumber || typeof clientData.ghanaCardNumber !== 'string' || clientData.ghanaCardNumber.trim().length < 5) {
    throw new Error('Valid Ghana Card Number is required');
  }
  if (!clientData.guarantorName || typeof clientData.guarantorName !== 'string' || clientData.guarantorName.trim().length < 2) {
    throw new Error('Valid Guarantor Name is required');
  }
  if (!clientData.guarantorGhanaCard || typeof clientData.guarantorGhanaCard !== 'string' || clientData.guarantorGhanaCard.trim().length < 5) {
    throw new Error('Valid Guarantor Ghana Card is required');
  }
  if (!clientData.guarantorPhone || typeof clientData.guarantorPhone !== 'string' || clientData.guarantorPhone.trim().length < 5) {
    throw new Error('Valid Guarantor Phone number is required');
  }

  const cleanName = clientData.name.trim();
  const cleanEmail = clientData.email.trim().toLowerCase();
  const cleanPhone = clientData.phone.trim();
  const normPhone = cleanPhone.replace(/\D/g, '');

  const newClient = {
    id: clientData.id || 'c_' + Date.now(),
    name: cleanName,
    companyName: clientData.companyName ? clientData.companyName.trim() : '',
    email: cleanEmail,
    phone: cleanPhone,
    ghanaCardNumber: clientData.ghanaCardNumber.trim().toUpperCase(),
    guarantorName: clientData.guarantorName.trim(),
    guarantorGhanaCard: clientData.guarantorGhanaCard.trim().toUpperCase(),
    guarantorPhone: clientData.guarantorPhone.trim()
  };

  if (!isLambda) {
    const db = readLocalDb();
    if (!db.clients) db.clients = [];

    const emailConflict = db.clients.find(c => c.email && c.email.trim().toLowerCase() === cleanEmail);
    if (emailConflict) {
      throw new Error('A client with this email address already exists.');
    }

    const phoneConflict = db.clients.find(c => {
      if (!c.phone) return false;
      const cNorm = c.phone.replace(/\D/g, '');
      return (normPhone && cNorm && normPhone === cNorm) || c.phone.trim() === cleanPhone;
    });
    if (phoneConflict) {
      throw new Error('A client with this phone number already exists.');
    }

    const ghanaCardConflict = db.clients.find(c => c.ghanaCardNumber && c.ghanaCardNumber.toUpperCase() === newClient.ghanaCardNumber);
    if (ghanaCardConflict) {
      throw new Error('A client with this Ghana Card Number already exists.');
    }

    const guarantorMatch = db.clients.find(c => 
      c.guarantorGhanaCard === newClient.guarantorGhanaCard || 
      c.guarantorPhone === newClient.guarantorPhone
    );
    if (guarantorMatch) {
      const gBookings = await getBookingsByClientId(guarantorMatch.id);
      const hasActive = gBookings.some(b => b.status === 'Active' || b.status === 'Booked' || b.status === 'Overdue' || !b.status);
      if (hasActive) {
        throw new Error('This Guarantor is linked to another client who currently has active reservations or unchecked gear. They must return all gear before acting as a guarantor again.');
      }
    }

    db.clients.push(newClient);
    writeLocalDb(db);
    return newClient;
  }

  const allClients = await getClients();
  const emailConflict = allClients.find(c => c.email && c.email.trim().toLowerCase() === cleanEmail);
  if (emailConflict) {
    throw new Error('A client with this email address already exists.');
  }
  const phoneConflict = allClients.find(c => {
    if (!c.phone) return false;
    const cNorm = c.phone.replace(/\D/g, '');
    return (normPhone && cNorm && normPhone === cNorm) || c.phone.trim() === cleanPhone;
  });
  if (phoneConflict) {
    throw new Error('A client with this phone number already exists.');
  }

  const ghanaCardConflict = allClients.find(c => c.ghanaCardNumber && c.ghanaCardNumber.toUpperCase() === newClient.ghanaCardNumber);
  if (ghanaCardConflict) {
    throw new Error('A client with this Ghana Card Number already exists.');
  }

  const guarantorMatch = allClients.find(c => 
    c.guarantorGhanaCard === newClient.guarantorGhanaCard || 
    c.guarantorPhone === newClient.guarantorPhone
  );
  if (guarantorMatch) {
    const gBookings = await getBookingsByClientId(guarantorMatch.id);
    const hasActive = gBookings.some(b => b.status === 'Active' || b.status === 'Booked' || b.status === 'Overdue' || !b.status);
    if (hasActive) {
      throw new Error('This Guarantor is linked to another client who currently has active reservations or unchecked gear. They must return all gear before acting as a guarantor again.');
    }
  }

  await docClient.send(new PutCommand({ TableName: TABLES.CLIENTS, Item: newClient }));
  return newClient;
}

async function updateClient(id, clientData) {
  const cleanEmail = clientData.email !== undefined ? clientData.email.trim().toLowerCase() : undefined;
  const cleanPhone = clientData.phone !== undefined ? clientData.phone.trim() : undefined;
  const cleanGhanaCard = clientData.ghanaCardNumber !== undefined ? clientData.ghanaCardNumber.trim().toUpperCase() : undefined;
  const normPhone = cleanPhone !== undefined ? cleanPhone.replace(/\D/g, '') : undefined;

  if (!isLambda) {
    const db = readLocalDb();
    const client = (db.clients || []).find(c => c.id === id);
    if (!client) return null;

    if (cleanEmail !== undefined) {
      const emailConflict = db.clients.find(c => c.id !== id && c.email && c.email.trim().toLowerCase() === cleanEmail);
      if (emailConflict) throw new Error('A client with this email address already exists.');
      client.email = cleanEmail;
    }

    if (cleanPhone !== undefined) {
      const phoneConflict = db.clients.find(c => {
        if (c.id === id || !c.phone) return false;
        const cNorm = c.phone.replace(/\D/g, '');
        return (normPhone && cNorm && normPhone === cNorm) || c.phone.trim() === cleanPhone;
      });
      if (phoneConflict) throw new Error('A client with this phone number already exists.');
      client.phone = cleanPhone;
    }

    if (cleanGhanaCard !== undefined) {
      const ghanaCardConflict = db.clients.find(c => c.id !== id && c.ghanaCardNumber && c.ghanaCardNumber.toUpperCase() === cleanGhanaCard);
      if (ghanaCardConflict) throw new Error('A client with this Ghana Card Number already exists.');
    }

    if (clientData.name !== undefined) client.name = clientData.name.trim();
    if (clientData.companyName !== undefined) client.companyName = clientData.companyName.trim();
    if (clientData.ghanaCardNumber !== undefined) client.ghanaCardNumber = clientData.ghanaCardNumber.trim().toUpperCase();
    if (clientData.guarantorName !== undefined) client.guarantorName = clientData.guarantorName.trim();
    if (clientData.guarantorGhanaCard !== undefined) client.guarantorGhanaCard = clientData.guarantorGhanaCard.trim().toUpperCase();
    if (clientData.guarantorPhone !== undefined) client.guarantorPhone = clientData.guarantorPhone.trim();
    writeLocalDb(db);
    return client;
  }

  if (cleanEmail !== undefined || cleanPhone !== undefined || cleanGhanaCard !== undefined) {
    const allClients = await getClients();
    if (cleanEmail !== undefined) {
      const emailConflict = allClients.find(c => c.id !== id && c.email && c.email.trim().toLowerCase() === cleanEmail);
      if (emailConflict) throw new Error('A client with this email address already exists.');
    }
    if (cleanPhone !== undefined) {
      const phoneConflict = allClients.find(c => {
        if (c.id === id || !c.phone) return false;
        const cNorm = c.phone.replace(/\D/g, '');
        return (normPhone && cNorm && normPhone === cNorm) || c.phone.trim() === cleanPhone;
      });
      if (phoneConflict) throw new Error('A client with this phone number already exists.');
    }
    if (cleanGhanaCard !== undefined) {
      const ghanaCardConflict = allClients.find(c => c.id !== id && c.ghanaCardNumber && c.ghanaCardNumber.toUpperCase() === cleanGhanaCard);
      if (ghanaCardConflict) throw new Error('A client with this Ghana Card Number already exists.');
    }
  }

  const updateParts = [];
  const exprNames = {};
  const exprValues = {};

  if (clientData.name !== undefined) { updateParts.push('#n = :name'); exprNames['#n'] = 'name'; exprValues[':name'] = clientData.name.trim(); }
  if (clientData.companyName !== undefined) { updateParts.push('companyName = :cn'); exprValues[':cn'] = clientData.companyName.trim(); }
  if (clientData.ghanaCardNumber !== undefined) { updateParts.push('ghanaCardNumber = :gcn'); exprValues[':gcn'] = clientData.ghanaCardNumber.trim().toUpperCase(); }
  if (clientData.guarantorName !== undefined) { updateParts.push('guarantorName = :gn'); exprValues[':gn'] = clientData.guarantorName.trim(); }
  if (clientData.guarantorGhanaCard !== undefined) { updateParts.push('guarantorGhanaCard = :ggc'); exprValues[':ggc'] = clientData.guarantorGhanaCard.trim().toUpperCase(); }
  if (clientData.guarantorPhone !== undefined) { updateParts.push('guarantorPhone = :gp'); exprValues[':gp'] = clientData.guarantorPhone.trim(); }
  if (cleanEmail !== undefined) { updateParts.push('email = :em'); exprValues[':em'] = cleanEmail; }
  if (cleanPhone !== undefined) { updateParts.push('phone = :ph'); exprValues[':ph'] = cleanPhone; }

  if (updateParts.length === 0) return { id, ...clientData };

  await docClient.send(new UpdateCommand({
    TableName: TABLES.CLIENTS,
    Key: { id },
    UpdateExpression: 'set ' + updateParts.join(', '),
    ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
    ExpressionAttributeValues: exprValues
  }));
  return { id, ...clientData };
}

async function deleteClient(id) {
  // Late require to avoid circular dependency
  const { getBookingsByClientId } = require('./bookings.service');

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

  const clientBookings = await getBookingsByClientId(id);
  const todayStr = new Date().toISOString().split('T')[0];
  const hasActiveBookings = clientBookings.some(b =>
    b.status !== 'Returned' &&
    b.status !== 'Cancelled' &&
    b.endDate >= todayStr
  );

  if (hasActiveBookings) throw new Error('Client has active or upcoming rentals and cannot be deleted.');

  await docClient.send(new DeleteCommand({ TableName: TABLES.CLIENTS, Key: { id } }));
  return { success: true };
}

module.exports = {
  getClients,
  addClient,
  updateClient,
  deleteClient
};
