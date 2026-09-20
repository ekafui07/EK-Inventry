const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requirePermission, requireAnyPermission } = require('../../middleware/auth');
const {
  getGearHandler,
  createGearHandler,
  updateGearHandler,
  deleteGearHandler
} = require('../controllers/gear.controller');

router.get('/', authenticate, getGearHandler);
router.post('/', authenticate, requirePermission('manage_gear'), createGearHandler);
router.put('/:id', authenticate, requireAnyPermission('manage_gear', 'override_status'), updateGearHandler);
router.delete('/:id', authenticate, requirePermission('manage_gear'), deleteGearHandler);

module.exports = router;
