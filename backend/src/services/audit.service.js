const { PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { isLambda, docClient, TABLES, readLocalDb, writeLocalDb } = require('../config/db');

/**
 * Record a system activity in the audit trail.
 */
async function recordAuditLog({ req, user, action, category, summary, details = {} }) {
  try {
    const actor = user || (req && req.user) || {
      id: 'system',
      name: 'System',
      email: 'system@ekgearflow.com',
      role: 'admin',
      accountType: 'Admin'
    };

    const auditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId: actor.id || 'system',
      userName: actor.name || (actor.email ? actor.email.split('@')[0] : 'User'),
      userEmail: actor.email || 'system@ekgearflow.com',
      userRole: (actor.role || 'staff').toLowerCase(),
      accountType: actor.accountType || (actor.role === 'admin' ? 'Admin' : 'Staff'),
      action,
      category, // 'Inventory' | 'Rentals' | 'Clients' | 'Staff' | 'Auth'
      summary,
      details,
      ip: (req && (req.headers['x-forwarded-for'] || req.socket?.remoteAddress)) || '127.0.0.1'
    };

    if (!isLambda) {
      const db = readLocalDb();
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift(auditEntry);
      if (db.auditLogs.length > 500) {
        db.auditLogs = db.auditLogs.slice(0, 500);
      }
      writeLocalDb(db);
    } else if (docClient) {
      const AUDIT_TABLE = TABLES.AUDIT;
      await docClient.send(new PutCommand({ TableName: AUDIT_TABLE, Item: auditEntry })).catch(() => {});
    }
    return auditEntry;
  } catch (err) {
    console.warn('[Audit Log] Failed to write audit record:', err.message);
    return null;
  }
}

/**
 * Query audit logs with category filtering, text search, and pagination limits.
 */
async function getAuditLogs({ category, search, limit = 100 } = {}) {
  let logs = [];
  if (!isLambda) {
    const db = readLocalDb();
    logs = db.auditLogs || [];
  } else if (docClient) {
    const AUDIT_TABLE = TABLES.AUDIT;
    const res = await docClient.send(new ScanCommand({ TableName: AUDIT_TABLE })).catch(() => ({ Items: [] }));
    logs = res.Items || [];
  }

  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (category && category !== 'All' && category !== 'all') {
    logs = logs.filter(l => l.category && l.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(l =>
      (l.summary && l.summary.toLowerCase().includes(q)) ||
      (l.userName && l.userName.toLowerCase().includes(q)) ||
      (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q))
    );
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  return {
    total: logs.length,
    auditLogs: logs.slice(0, parsedLimit)
  };
}

module.exports = {
  recordAuditLog,
  getAuditLogs
};
