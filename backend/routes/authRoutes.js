const express = require('express');
const router = express.Router();
const { ssoLogin } = require('../controllers/authController');

// @route   POST /api/auth/sso-login
// @desc    Exchange a portal token for a GSO-specific token
router.post('/sso-login', ssoLogin);

module.exports = router;