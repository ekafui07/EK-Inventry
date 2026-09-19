const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { isLambda, docClient, TABLES, readLocalDb, writeLocalDb } = require('../config/db');
const { JWT_SECRET } = require('../../middleware/auth');

async function getUsers() {
  if (!isLambda) {
    const db = readLocalDb();
    return (db.users || []).map(({ password, ...u }) => ({
      ...u,
      role: (u.role || u.accountType || 'Staff').toLowerCase(),
      accountType: (u.accountType || (u.role && u.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff'))
    }));
  }

  const result = await docClient.send(new ScanCommand({ TableName: TABLES.USERS }));
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

  const result = await docClient.send(new ScanCommand({ TableName: TABLES.USERS }));
  const user = (result.Items || []).find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return null;
  return {
    ...user,
    role: (user.role || user.accountType || 'Staff').toLowerCase(),
    accountType: (user.accountType || (user.role && user.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff'))
  };
}

async function getUserById(id, email) {
  if (!isLambda) {
    const db = readLocalDb();
    const user = (db.users || []).find(u => 
      (id && u.id === id) || 
      (email && u.email && u.email.toLowerCase() === email.trim().toLowerCase())
    );
    if (!user) return null;
    return {
      ...user,
      role: (user.role || user.accountType || 'Staff').toLowerCase(),
      accountType: (user.accountType || (user.role && user.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff'))
    };
  }

  if (id) {
    const res = await docClient.send(new GetCommand({ TableName: TABLES.USERS, Key: { id } })).catch(() => null);
    if (res && res.Item) {
      const u = res.Item;
      return {
        ...u,
        role: (u.role || u.accountType || 'Staff').toLowerCase(),
        accountType: (u.accountType || (u.role && u.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff'))
      };
    }
  }

  if (email) {
    return getUserByEmail(email);
  }
  return null;
}

async function loginUser({ email, password, accountType }) {
  if (!email || !password) throw new Error('Email and password are required');
  const user = await getUserByEmail(email);
  if (!user) throw new Error('Invalid email or password');
  if (user.status && (user.status.toLowerCase() === 'inactive' || user.status.toLowerCase() === 'banned')) {
    throw new Error('This account has been deactivated or banned. Please contact an administrator.');
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
          TableName: TABLES.USERS,
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
      'manage_gear',
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
  const normalizedAccountType = role === 'admin' ? 'Admin' : 'Staff';
  let assignedPermissions = userData.permissions || (role === 'admin'
    ? ['manage_gear', 'manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals', 'manage_users']
    : ['manage_gear', 'manage_clients', 'create_rentals', 'return_rentals', 'cancel_rentals']);
  if (role !== 'admin') {
    assignedPermissions = assignedPermissions.filter(p => p !== 'manage_users');
  }

  const hashedPassword = await bcrypt.hash(userData.password || '12345', 10);
  const newUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: userData.name,
    email: userData.email.trim().toLowerCase(),
    password: hashedPassword,
    title: userData.title || (role === 'admin' ? 'Administrator' : 'Desk Specialist'),
    accountType: normalizedAccountType,
    role: role,
    permissions: assignedPermissions,
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

  await docClient.send(new PutCommand({ TableName: TABLES.USERS, Item: newUser }));
  const { password: _, ...savedUser } = newUser;
  return savedUser;
}

async function updateUser(id, fields) {
  const cleanEmail = fields.email !== undefined ? fields.email.trim().toLowerCase() : undefined;

  if (!isLambda) {
    const db = readLocalDb();
    if (!db.users) db.users = [];
    const user = db.users.find(u => u.id === id);
    if (!user) return null;

    if (cleanEmail !== undefined) {
      const emailConflict = db.users.find(u => u.id !== id && u.email && u.email.trim().toLowerCase() === cleanEmail);
      if (emailConflict) throw new Error('A staff member with this email already exists.');
      user.email = cleanEmail;
    }

    if (fields.name !== undefined) user.name = fields.name.trim();
    if (fields.title !== undefined) user.title = fields.title.trim();
    if (fields.accountType !== undefined) {
      user.accountType = fields.accountType;
      user.role = fields.accountType.toLowerCase();
    }
    if (fields.role !== undefined) {
      user.role = fields.role.toLowerCase();
      user.accountType = fields.role.toLowerCase() === 'admin' ? 'Admin' : 'Staff';
    }
    const targetRole = user.role || 'staff';
    if (fields.permissions !== undefined) {
      user.permissions = targetRole === 'admin' 
        ? fields.permissions 
        : fields.permissions.filter(p => p !== 'manage_users');
    }
    if (fields.status !== undefined) user.status = fields.status;
    writeLocalDb(db);
    const { password: _, ...updatedUser } = user;
    return updatedUser;
  }

  if (cleanEmail !== undefined) {
    const allUsers = await getUsers();
    const emailConflict = allUsers.find(u => u.id !== id && u.email && u.email.trim().toLowerCase() === cleanEmail);
    if (emailConflict) throw new Error('A staff member with this email already exists.');
  }

  const updateParts = [];
  const exprNames = {};
  const exprValues = {};

  if (fields.name !== undefined) { updateParts.push('#n = :name'); exprNames['#n'] = 'name'; exprValues[':name'] = fields.name.trim(); }
  if (cleanEmail !== undefined) { updateParts.push('#em = :em'); exprNames['#em'] = 'email'; exprValues[':em'] = cleanEmail; }
  if (fields.title !== undefined) { updateParts.push('#ti = :ti'); exprNames['#ti'] = 'title'; exprValues[':ti'] = fields.title.trim(); }

  let accountTypeVal = fields.accountType;
  let roleVal = fields.role;
  if (accountTypeVal !== undefined && roleVal === undefined) {
    roleVal = accountTypeVal.toLowerCase();
  } else if (roleVal !== undefined && accountTypeVal === undefined) {
    accountTypeVal = roleVal.toLowerCase() === 'admin' ? 'Admin' : 'Staff';
  }

  if (accountTypeVal !== undefined) {
    updateParts.push('#at = :at'); exprNames['#at'] = 'accountType'; exprValues[':at'] = accountTypeVal;
    updateParts.push('#ro = :ro'); exprNames['#ro'] = 'role'; exprValues[':ro'] = (roleVal || accountTypeVal.toLowerCase());
  }

  if (fields.permissions !== undefined) {
    const isTargetAdmin = (roleVal && roleVal.toLowerCase() === 'admin') || (accountTypeVal && accountTypeVal.toLowerCase() === 'admin');
    const safePerms = isTargetAdmin ? fields.permissions : fields.permissions.filter(p => p !== 'manage_users');
    updateParts.push('#pe = :pe'); exprNames['#pe'] = 'permissions'; exprValues[':pe'] = safePerms;
  }
  if (fields.status !== undefined) { updateParts.push('#s = :status'); exprNames['#s'] = 'status'; exprValues[':status'] = fields.status; }

  if (updateParts.length === 0) return { id, ...fields };

  await docClient.send(new UpdateCommand({
    TableName: TABLES.USERS,
    Key: { id },
    UpdateExpression: 'set ' + updateParts.join(', '),
    ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
    ExpressionAttributeValues: exprValues
  }));

  const userRes = await docClient.send(new GetCommand({ TableName: TABLES.USERS, Key: { id } }));
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

  await docClient.send(new DeleteCommand({ TableName: TABLES.USERS, Key: { id } }));
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
    TableName: TABLES.USERS,
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
    TableName: TABLES.USERS,
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

  let targetUser = null;
  if (!isLambda) {
    const db = readLocalDb();
    const user = (db.users || []).find(u => u.id === id);
    if (!user) throw new Error('User not found');
    user.password = hashedPassword;
    user.mustChangePassword = false;
    writeLocalDb(db);
    targetUser = user;
  } else {
    await docClient.send(new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { id },
      UpdateExpression: 'set password = :pw, mustChangePassword = :mc',
      ExpressionAttributeValues: { ':pw': hashedPassword, ':mc': false }
    }));
    const userRes = await docClient.send(new GetCommand({ TableName: TABLES.USERS, Key: { id } }));
    targetUser = userRes.Item || {};
  }

  const role = (targetUser.role || targetUser.accountType || 'staff').toLowerCase();
  const normalizedAccountType = role === 'admin' ? 'Admin' : 'Staff';
  const tokenPayload = {
    id: targetUser.id,
    email: targetUser.email,
    role: role,
    accountType: normalizedAccountType,
    permissions: targetUser.permissions || [
      'manage_clients',
      'create_rentals',
      'return_rentals',
      'cancel_rentals'
    ]
  };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
  const { password: _, ...updatedUser } = targetUser;
  return {
    ...updatedUser,
    role,
    accountType: normalizedAccountType,
    token
  };
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
    TableName: TABLES.USERS,
    Key: { id },
    UpdateExpression: 'set #s = :st',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':st': status }
  }));
  const userRes = await docClient.send(new GetCommand({ TableName: TABLES.USERS, Key: { id } }));
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
        title: 'Admin',
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
          TableName: TABLES.USERS,
          Item: {
            ...item,
            password: hashedPassword,
            createdAt: new Date().toISOString()
          }
        }));
      }
    }
  } catch (err) {
    console.error('Error seeding initial accounts:', err);
  }
}

module.exports = {
  getUsers,
  getUserByEmail,
  getUserById,
  loginUser,
  addUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  forgotPasswordReset,
  changeUserPassword,
  toggleUserStatus,
  seedInitialUsers
};
