const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const {
  getGearHandler,
  createGearHandler,
  updateGearHandler,
  deleteGearHandler
} = require('../controllers/gear.controller');

router.get('/', authenticate, getGearHandler);
router.post('/', authenticate, requireRole('Admin'), createGearHandler);
router.put('/:id', authenticate, requireRole('Admin'), updateGearHandler);
router.delete('/:id', authenticate, requireRole('Admin'), deleteGearHandler);

module.exports = router;
