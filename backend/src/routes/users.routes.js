const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const {
  getUsersHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  resetUserPasswordHandler,
  toggleUserStatusHandler
} = require('../controllers/users.controller');
const { changePasswordHandler } = require('../controllers/auth.controller');

router.get('/', authenticate, requireRole('Admin'), getUsersHandler);
router.post('/', authenticate, requireRole('Admin'), createUserHandler);
router.put('/:id', authenticate, updateUserHandler);
router.delete('/:id', authenticate, requireRole('Admin'), deleteUserHandler);
router.post('/:id/reset-password', authenticate, requireRole('Admin'), resetUserPasswordHandler);
router.post('/:id/change-password', authenticate, changePasswordHandler);
router.put('/:id/status', authenticate, requireRole('Admin'), toggleUserStatusHandler);

module.exports = router;
