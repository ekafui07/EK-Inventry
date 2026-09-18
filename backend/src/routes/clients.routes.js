const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requirePermission } = require('../../middleware/auth');
const {
  getClientsHandler,
  createClientHandler,
  updateClientHandler,
  deleteClientHandler
} = require('../controllers/clients.controller');

router.get('/', authenticate, getClientsHandler);
router.post('/', authenticate, requirePermission('manage_clients'), createClientHandler);
router.put('/:id', authenticate, requirePermission('manage_clients'), updateClientHandler);
router.delete('/:id', authenticate, requireRole('Admin'), deleteClientHandler);

module.exports = router;
