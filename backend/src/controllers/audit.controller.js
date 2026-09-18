const { getAuditLogs } = require('../services/audit.service');

async function getAuditLogsHandler(req, res) {
  try {
    if (!req.user || req.user.email.toLowerCase() !== 'admin@ekgearflow.com') {
      return res.status(403).json({
        error: 'Forbidden: The Audit Trail is strictly restricted to the primary Administrator account.'
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
