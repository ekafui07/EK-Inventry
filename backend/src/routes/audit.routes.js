const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { getAuditLogsHandler } = require('../controllers/audit.controller');

router.get('/', authenticate, getAuditLogsHandler);

module.exports = router;
