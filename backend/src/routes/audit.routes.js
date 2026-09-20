const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { getAuditLogsHandler, createAuditLogHandler } = require('../controllers/audit.controller');

router.get('/', authenticate, getAuditLogsHandler);
router.post('/log', authenticate, createAuditLogHandler);

module.exports = router;
