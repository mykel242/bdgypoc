const express = require('express');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Single-user deployment: registration, login and logout were removed along
// with the login UI. requireAuth now fills the session in rather than
// rejecting, so there is nothing to log in to and nothing to log out of.
// Password validation below is retained for the change-password endpoint,
// which still works even though the password no longer gates anything.

// GET /api/auth/me - Get current user info
router.get('/me', requireAuth, async (req, res) => {
	try {
		const user = await User.findByPk(req.session.userId);

		if (!user) {
			return res.status(404).json({
				error: 'User not found',
				message: 'Your user account no longer exists',
			});
		}

		res.json({
			user: {
				id: user.id,
				uuid: user.uuid,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				is_admin: user.is_admin,
				created_at: user.created_at,
			},
		});
	} catch (error) {
		console.error('Get user error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to get user information',
		});
	}
});

// GET /api/auth/check - Establish and report the single-user session.
// Single-user deployment: requireAuth fills the session in rather than
// rejecting, so this always answers `authenticated: true`. It is kept
// because the frontend calls it on init to learn who it is talking to.
router.get('/check', requireAuth, (req, res) => {
	res.json({
		authenticated: true,
		userId: req.session.userId,
		userUuid: req.session.userUuid,
		userEmail: req.session.userEmail,
	});
});

// Password validation for change password
const changePasswordValidation = [
	body('current_password')
		.notEmpty()
		.withMessage('Current password is required'),
	body('new_password')
		.isLength({ min: 8 })
		.withMessage('New password must be at least 8 characters long')
		.matches(/[A-Z]/)
		.withMessage('New password must contain at least one uppercase letter')
		.matches(/[a-z]/)
		.withMessage('New password must contain at least one lowercase letter')
		.matches(/[0-9]/)
		.withMessage('New password must contain at least one number'),
];

// POST /api/auth/change-password - Change user's password
router.post('/change-password', requireAuth, changePasswordValidation, async (req, res) => {
	try {
		// Check validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const { current_password, new_password } = req.body;

		// Get current user
		const user = await User.findByPk(req.session.userId);

		if (!user) {
			return res.status(404).json({
				error: 'User not found',
				message: 'Your user account no longer exists',
			});
		}

		// Verify current password
		const isCurrentPasswordValid = await user.validatePassword(current_password);

		if (!isCurrentPasswordValid) {
			return res.status(401).json({
				error: 'Authentication failed',
				message: 'Current password is incorrect',
			});
		}

		// Update password (will be hashed by beforeUpdate hook)
		user.password_hash = new_password;
		await user.save();

		res.json({
			message: 'Password changed successfully',
		});
	} catch (error) {
		console.error('Change password error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to change password',
		});
	}
});

module.exports = router;
