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
	body('is_locked')
		.optional()
		.isBoolean()
		.withMessage('is_locked must be a boolean'),
	body('is_archived')
		.optional()
		.isBoolean()
		.withMessage('is_archived must be a boolean'),
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
				attributes: ['id', 'credit_amount', 'debit_amount'],
			}],
		});

		// Add transaction count and current balance to each ledger
		const ledgersWithCount = ledgers.map(ledger => {
			const ledgerJSON = ledger.toJSON();
			const transactionCount = ledger.transactions ? ledger.transactions.length : 0;

			// Calculate current balance
			let currentBalance = parseFloat(ledger.starting_balance) || 0;
			if (ledger.transactions) {
				ledger.transactions.forEach(tx => {
					currentBalance += parseFloat(tx.credit_amount) || 0;
					currentBalance -= parseFloat(tx.debit_amount) || 0;
				});
			}

			return {
				...ledgerJSON,
				transaction_count: transactionCount,
				current_balance: parseFloat(currentBalance.toFixed(2)),
				transactions: undefined, // Remove the transactions array
			};
		});

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

		const { name, starting_balance, starting_balance_date, is_locked, is_archived } = req.body;

		// Check if ledger is locked and user is trying to change restricted fields
		if (ledger.is_locked && (name !== undefined || starting_balance !== undefined || starting_balance_date !== undefined)) {
			return res.status(403).json({
				error: 'Forbidden',
				message: 'Cannot modify a locked ledger. Please unlock it first.',
			});
		}

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
		if (is_locked !== undefined) ledger.is_locked = is_locked;
		if (is_archived !== undefined) ledger.is_archived = is_archived;

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

		// Check if ledger is locked
		if (ledger.is_locked) {
			return res.status(403).json({
				error: 'Forbidden',
				message: 'Cannot delete a locked ledger. Please unlock it first.',
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

// POST /api/ledgers/:id/copy - Copy a ledger with all its transactions
router.post('/:id/copy', ledgerIdValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		// Find the original ledger with all its transactions
		const originalLedger = await Ledger.findOne({
			where: {
				id: req.params.id,
				user_id: req.session.userId,
			},
			include: [{
				model: Transaction,
				as: 'transactions',
			}],
		});

		if (!originalLedger) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Ledger not found or you do not have access to it',
			});
		}

		// Generate a unique name for the copy
		let copyName = `${originalLedger.name} (Copy)`;
		let counter = 1;

		// Check if a ledger with this name already exists
		while (await Ledger.findOne({
			where: {
				user_id: req.session.userId,
				name: copyName,
			},
		})) {
			counter++;
			copyName = `${originalLedger.name} (Copy ${counter})`;
		}

		// Create the new ledger
		const newLedger = await Ledger.create({
			user_id: req.session.userId,
			name: copyName,
			starting_balance: originalLedger.starting_balance,
			starting_balance_date: originalLedger.starting_balance_date,
			is_locked: false, // New copy should be unlocked
			is_archived: false, // New copy should not be archived
		});

		// Copy all transactions if they exist
		if (originalLedger.transactions && originalLedger.transactions.length > 0) {
			const transactionCopies = originalLedger.transactions.map(tx => ({
				ledger_id: newLedger.id,
				date: tx.date,
				description: tx.description,
				credit_amount: tx.credit_amount,
				debit_amount: tx.debit_amount,
				is_cleared: tx.is_cleared,
				is_paid: tx.is_paid,
				sort_order: tx.sort_order,
			}));

			await Transaction.bulkCreate(transactionCopies);
		}

		// Fetch the new ledger with transaction count
		const ledgerWithTransactions = await Ledger.findOne({
			where: { id: newLedger.id },
			include: [{
				model: Transaction,
				as: 'transactions',
				attributes: ['id'],
			}],
		});

		res.status(201).json({
			message: 'Ledger copied successfully',
			ledger: {
				...ledgerWithTransactions.toJSON(),
				transaction_count: ledgerWithTransactions.transactions ? ledgerWithTransactions.transactions.length : 0,
				transactions: undefined,
			},
		});
	} catch (error) {
		console.error('Copy ledger error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to copy ledger',
		});
	}
});

module.exports = router;
