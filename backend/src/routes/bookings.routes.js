const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../../middleware/auth');
const {
  getBookingsHandler,
  createBookingHandler,
  returnBookingHandler,
  cancelBookingHandler
} = require('../controllers/bookings.controller');

router.get('/', authenticate, getBookingsHandler);
router.post('/', authenticate, requirePermission('create_rentals'), createBookingHandler);
router.put('/:id/return', authenticate, requirePermission('return_rentals'), returnBookingHandler);
router.put(
  '/:id/cancel',
  authenticate,
  (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    const perms = (req.user && req.user.permissions) || [];
    if (perms.includes('cancel_rentals') || perms.includes('return_rentals')) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Missing permission return_rentals or cancel_rentals' });
  },
  cancelBookingHandler
);

module.exports = router;
