const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requirePermission } = require('../../middleware/auth');
const {
  getGearHandler,
  createGearHandler,
  updateGearHandler,
  deleteGearHandler
} = require('../controllers/gear.controller');

router.get('/', authenticate, getGearHandler);
router.post('/', authenticate, requirePermission('manage_gear'), createGearHandler);
router.put('/:id', authenticate, requirePermission('manage_gear'), updateGearHandler);
router.delete('/:id', authenticate, requireRole('Admin'), deleteGearHandler);

module.exports = router;
