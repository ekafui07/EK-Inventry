const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const {
  loginHandler,
  meHandler,
  forgotPasswordHandler
} = require('../controllers/auth.controller');

router.post('/auth/login', loginHandler);
router.post('/login', loginHandler);
router.get('/auth/me', authenticate, meHandler);
router.post('/forgot-password', forgotPasswordHandler);

module.exports = router;
