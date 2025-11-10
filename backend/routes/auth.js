const express = require('express');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const registerValidation = [
	body('email')
		.trim()
		.isEmail()
		.normalizeEmail()
		.withMessage('Must be a valid email address'),
	body('first_name')
		.trim()
		.isLength({ min: 1, max: 100 })
		.withMessage('First name is required and must be less than 100 characters')
		.notEmpty()
		.withMessage('First name is required'),
	body('last_name')
		.trim()
		.isLength({ min: 1, max: 100 })
		.withMessage('Last name is required and must be less than 100 characters')
		.notEmpty()
		.withMessage('Last name is required'),
	body('password')
		.isLength({ min: 8 })
		.withMessage('Password must be at least 8 characters long')
		.matches(/[A-Z]/)
		.withMessage('Password must contain at least one uppercase letter')
		.matches(/[a-z]/)
		.withMessage('Password must contain at least one lowercase letter')
		.matches(/[0-9]/)
		.withMessage('Password must contain at least one number'),
];

const loginValidation = [
	body('email')
		.trim()
		.isEmail()
		.withMessage('Must be a valid email address')
		.notEmpty()
		.withMessage('Email is required'),
	body('password')
		.notEmpty()
		.withMessage('Password is required'),
];

// POST /api/auth/register - Register a new user
router.post('/register', registerValidation, async (req, res) => {
	try {
		// Check validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const { email, first_name, last_name, password } = req.body;

		// Check if email already exists
		const existingUser = await User.findOne({
			where: { email },
		});

		if (existingUser) {
			return res.status(409).json({
				error: 'User already exists',
				message: 'Email is already registered',
				details: [{ param: 'email', msg: 'Email is already registered' }],
			});
		}

		// Create new user (password will be hashed by the model hook)
		const user = await User.create({
			email,
			first_name,
			last_name,
			password_hash: password, // Will be hashed by beforeCreate hook
		});

		// Set up session
		req.session.userId = user.id;
		req.session.userUuid = user.uuid;
		req.session.userEmail = user.email;

		res.status(201).json({
			message: 'User registered successfully',
			user: {
				id: user.id,
				uuid: user.uuid,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
			},
		});
	} catch (error) {
		console.error('Registration error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to register user',
		});
	}
});

// POST /api/auth/login - Login user
router.post('/login', loginValidation, async (req, res) => {
	try {
		// Check validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const { email, password } = req.body;

		// Find user
		const user = await User.findOne({ where: { email } });

		if (!user) {
			return res.status(401).json({
				error: 'Authentication failed',
				message: 'Invalid email or password',
			});
		}

		// Validate password
		const isValid = await user.validatePassword(password);

		if (!isValid) {
			return res.status(401).json({
				error: 'Authentication failed',
				message: 'Invalid email or password',
			});
		}

		// Set up session
		req.session.userId = user.id;
		req.session.userUuid = user.uuid;
		req.session.userEmail = user.email;

		res.json({
			message: 'Login successful',
			user: {
				id: user.id,
				uuid: user.uuid,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
			},
		});
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to login',
		});
	}
});

// POST /api/auth/logout - Logout user
router.post('/logout', (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error('Logout error:', err);
			return res.status(500).json({
				error: 'Internal server error',
				message: 'Failed to logout',
			});
		}

		res.clearCookie('connect.sid');
		res.json({
			message: 'Logout successful',
		});
	});
});

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

// GET /api/auth/check - Check if user is logged in (no auth required)
router.get('/check', (req, res) => {
	if (req.session && req.session.userId) {
		res.json({
			authenticated: true,
			userId: req.session.userId,
			userUuid: req.session.userUuid,
			userEmail: req.session.userEmail,
		});
	} else {
		res.json({
			authenticated: false,
		});
	}
});

module.exports = router;
