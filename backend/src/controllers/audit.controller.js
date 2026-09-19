const { getAuditLogs } = require('../services/audit.service');

async function getAuditLogsHandler(req, res) {
  try {
    // Allow any Administrator account to access the audit trail (role-based, not email-based)
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.accountType === 'Admin');
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden: The Audit Trail is restricted to Administrator accounts only.'
      });
    }

    const { category, search, limit } = req.query;
    const result = await getAuditLogs({ category, search, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAuditLogsHandler
};
