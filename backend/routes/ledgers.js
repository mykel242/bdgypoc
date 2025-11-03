const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Ledger, Transaction } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Validation middleware
const createLedgerValidation = [
	body('name')
		.trim()
		.notEmpty()
		.withMessage('Ledger name is required')
		.isLength({ max: 255 })
		.withMessage('Ledger name must be less than 255 characters'),
	body('starting_balance')
		.optional()
		.isDecimal()
		.withMessage('Starting balance must be a valid decimal number'),
	body('starting_balance_date')
		.optional()
		.isISO8601()
		.withMessage('Starting balance date must be a valid date'),
];

const updateLedgerValidation = [
	param('id')
		.isInt()
		.withMessage('Invalid ledger ID'),
	body('name')
		.optional()
		.trim()
		.notEmpty()
		.withMessage('Ledger name cannot be empty')
		.isLength({ max: 255 })
		.withMessage('Ledger name must be less than 255 characters'),
	body('starting_balance')
		.optional()
		.isDecimal()
		.withMessage('Starting balance must be a valid decimal number'),
	body('starting_balance_date')
		.optional()
		.isISO8601()
		.withMessage('Starting balance date must be a valid date'),
];

const ledgerIdValidation = [
	param('id')
		.isInt()
		.withMessage('Invalid ledger ID'),
];

// GET /api/ledgers - Get all ledgers for the current user
router.get('/', async (req, res) => {
	try {
		const ledgers = await Ledger.findAll({
			where: { user_id: req.session.userId },
			order: [['created_at', 'ASC']],
			include: [{
				model: Transaction,
				as: 'transactions',
				attributes: ['id'],
			}],
		});

		// Add transaction count to each ledger
		const ledgersWithCount = ledgers.map(ledger => ({
			...ledger.toJSON(),
			transaction_count: ledger.transactions ? ledger.transactions.length : 0,
			transactions: undefined, // Remove the transactions array, keep only count
		}));

		res.json({
			ledgers: ledgersWithCount,
			count: ledgers.length,
		});
	} catch (error) {
		console.error('Get ledgers error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to retrieve ledgers',
		});
	}
});

// GET /api/ledgers/:id - Get a specific ledger
router.get('/:id', ledgerIdValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const ledger = await Ledger.findOne({
			where: {
				id: req.params.id,
				user_id: req.session.userId,
			},
			include: [{
				model: Transaction,
				as: 'transactions',
				order: [['date', 'DESC'], ['sort_order', 'ASC']],
			}],
		});

		if (!ledger) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Ledger not found or you do not have access to it',
			});
		}

		res.json({ ledger });
	} catch (error) {
		console.error('Get ledger error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to retrieve ledger',
		});
	}
});

// POST /api/ledgers - Create a new ledger
router.post('/', createLedgerValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const { name, starting_balance, starting_balance_date } = req.body;

		// Check if ledger with same name already exists for this user
		const existingLedger = await Ledger.findOne({
			where: {
				user_id: req.session.userId,
				name,
			},
		});

		if (existingLedger) {
			return res.status(409).json({
				error: 'Conflict',
				message: 'A ledger with this name already exists',
			});
		}

		// Create ledger
		const ledger = await Ledger.create({
			user_id: req.session.userId,
			name,
			starting_balance: starting_balance || 0.00,
			starting_balance_date: starting_balance_date || null,
		});

		res.status(201).json({
			message: 'Ledger created successfully',
			ledger,
		});
	} catch (error) {
		console.error('Create ledger error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to create ledger',
		});
	}
});

// PUT /api/ledgers/:id - Update a ledger
router.put('/:id', updateLedgerValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const ledger = await Ledger.findOne({
			where: {
				id: req.params.id,
				user_id: req.session.userId,
			},
		});

		if (!ledger) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Ledger not found or you do not have access to it',
			});
		}

		const { name, starting_balance, starting_balance_date } = req.body;

		// If name is being changed, check for conflicts
		if (name && name !== ledger.name) {
			const existingLedger = await Ledger.findOne({
				where: {
					user_id: req.session.userId,
					name,
				},
			});

			if (existingLedger) {
				return res.status(409).json({
					error: 'Conflict',
					message: 'A ledger with this name already exists',
				});
			}
		}

		// Update ledger
		if (name !== undefined) ledger.name = name;
		if (starting_balance !== undefined) ledger.starting_balance = starting_balance;
		if (starting_balance_date !== undefined) ledger.starting_balance_date = starting_balance_date;

		await ledger.save();

		res.json({
			message: 'Ledger updated successfully',
			ledger,
		});
	} catch (error) {
		console.error('Update ledger error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to update ledger',
		});
	}
});

// DELETE /api/ledgers/:id - Delete a ledger
router.delete('/:id', ledgerIdValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const ledger = await Ledger.findOne({
			where: {
				id: req.params.id,
				user_id: req.session.userId,
			},
		});

		if (!ledger) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Ledger not found or you do not have access to it',
			});
		}

		await ledger.destroy();

		res.json({
			message: 'Ledger deleted successfully',
		});
	} catch (error) {
		console.error('Delete ledger error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to delete ledger',
		});
	}
});

// GET /api/ledgers/:id/balance - Calculate current balance for a ledger
router.get('/:id/balance', ledgerIdValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const ledger = await Ledger.findOne({
			where: {
				id: req.params.id,
				user_id: req.session.userId,
			},
			include: [{
				model: Transaction,
				as: 'transactions',
			}],
		});

		if (!ledger) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Ledger not found or you do not have access to it',
			});
		}

		// Calculate balance
		let balance = parseFloat(ledger.starting_balance) || 0;

		if (ledger.transactions) {
			ledger.transactions.forEach(transaction => {
				balance += parseFloat(transaction.credit_amount) || 0;
				balance -= parseFloat(transaction.debit_amount) || 0;
			});
		}

		// Calculate cleared balance (only cleared transactions)
		let clearedBalance = parseFloat(ledger.starting_balance) || 0;

		if (ledger.transactions) {
			ledger.transactions.forEach(transaction => {
				if (transaction.is_cleared) {
					clearedBalance += parseFloat(transaction.credit_amount) || 0;
					clearedBalance -= parseFloat(transaction.debit_amount) || 0;
				}
			});
		}

		res.json({
			ledger_id: ledger.id,
			ledger_name: ledger.name,
			starting_balance: parseFloat(ledger.starting_balance) || 0,
			current_balance: parseFloat(balance.toFixed(2)),
			cleared_balance: parseFloat(clearedBalance.toFixed(2)),
			transaction_count: ledger.transactions ? ledger.transactions.length : 0,
		});
	} catch (error) {
		console.error('Calculate balance error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to calculate balance',
		});
	}
});

module.exports = router;
