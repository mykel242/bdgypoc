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

// GET /api/ledgers/:id/export - Export a ledger with all transactions
router.get('/:id/export', ledgerIdValidation, async (req, res) => {
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
				order: [['date', 'ASC'], ['sort_order', 'ASC']],
			}],
		});

		if (!ledger) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Ledger not found or you do not have access to it',
			});
		}

		// Build export data in old app format
		const exportData = {
			name: ledger.name,
			startingBalance: parseFloat(ledger.starting_balance) || 0,
			startingBalanceDate: ledger.starting_balance_date,
			transactions: (ledger.transactions || [])
				.sort((a, b) => {
					const dateCompare = a.date.localeCompare(b.date);
					if (dateCompare !== 0) return dateCompare;
					return a.sort_order - b.sort_order;
				})
				.map((tx, index) => ({
					id: tx.id.toString(),
					sequence: tx.sort_order ?? index,
					date: tx.date,
					description: tx.description,
					credit: parseFloat(tx.credit_amount) || 0,
					debit: parseFloat(tx.debit_amount) || 0,
					isPaid: tx.is_paid,
					isCleared: tx.is_cleared,
					createdAt: tx.created_at,
				})),
			exportDate: new Date().toISOString(),
			version: '1.0',
		};

		// Base64 encode for compatibility with old app
		const jsonString = JSON.stringify(exportData);
		const base64Data = Buffer.from(jsonString).toString('base64');

		res.json({
			data: base64Data,
			filename: `${ledger.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.txt`,
		});
	} catch (error) {
		console.error('Export ledger error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to export ledger',
		});
	}
});

// POST /api/ledgers/import - Import a ledger from export data
router.post('/import', async (req, res) => {
	try {
		const { data, shiftMonth } = req.body;

		if (!data) {
			return res.status(400).json({
				error: 'Validation failed',
				message: 'Export data is required',
			});
		}

		// Try to parse the data - could be base64 or plain JSON
		let importData;
		try {
			// First try base64 decode
			const decoded = Buffer.from(data, 'base64').toString('utf-8');
			importData = JSON.parse(decoded);
		} catch {
			// If that fails, try parsing as plain JSON
			try {
				importData = typeof data === 'string' ? JSON.parse(data) : data;
			} catch {
				return res.status(400).json({
					error: 'Validation failed',
					message: 'Invalid export data format. Expected base64-encoded JSON or plain JSON.',
				});
			}
		}

		// Validate required fields
		if (!importData.name) {
			return res.status(400).json({
				error: 'Validation failed',
				message: 'Export data must include a ledger name',
			});
		}

		// Generate a unique name for the imported ledger
		let ledgerName = importData.name;
		if (shiftMonth) {
			// If shifting month, generate new name based on target month
			const today = new Date();
			const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
				'July', 'August', 'September', 'October', 'November', 'December'];
			ledgerName = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
		}

		// Check for name conflicts and generate unique name
		let finalName = ledgerName;
		let counter = 1;
		while (await Ledger.findOne({
			where: {
				user_id: req.session.userId,
				name: finalName,
			},
		})) {
			counter++;
			finalName = `${ledgerName} (${counter})`;
		}

		// Calculate date shift if needed
		let dateShiftDays = 0;
		if (shiftMonth && importData.transactions && importData.transactions.length > 0) {
			// Find the earliest date in transactions
			const dates = importData.transactions.map(tx => new Date(tx.date));
			const earliestDate = new Date(Math.min(...dates));

			// Calculate shift to move to current month
			const today = new Date();
			const targetDate = new Date(today.getFullYear(), today.getMonth(), earliestDate.getDate());
			dateShiftDays = Math.round((targetDate - earliestDate) / (1000 * 60 * 60 * 24));
		}

		// Helper function to shift a date
		const shiftDate = (dateStr) => {
			if (!shiftMonth || !dateStr) return dateStr;
			const date = new Date(dateStr);
			date.setDate(date.getDate() + dateShiftDays);
			return date.toISOString().split('T')[0];
		};

		// Create the new ledger
		const newLedger = await Ledger.create({
			user_id: req.session.userId,
			name: finalName,
			starting_balance: importData.startingBalance ?? importData.starting_balance ?? 0,
			starting_balance_date: shiftDate(importData.startingBalanceDate ?? importData.starting_balance_date),
			is_locked: false,
			is_archived: false,
		});

		// Import transactions if they exist
		let transactionCount = 0;
		if (importData.transactions && importData.transactions.length > 0) {
			const transactions = importData.transactions.map((tx, index) => ({
				ledger_id: newLedger.id,
				date: shiftDate(tx.date),
				description: tx.description,
				credit_amount: tx.credit ?? tx.credit_amount ?? 0,
				debit_amount: tx.debit ?? tx.debit_amount ?? 0,
				is_paid: shiftMonth ? false : (tx.isPaid ?? tx.is_paid ?? false),
				is_cleared: shiftMonth ? false : (tx.isCleared ?? tx.is_cleared ?? false),
				sort_order: tx.sequence ?? tx.sort_order ?? index,
			}));

			await Transaction.bulkCreate(transactions);
			transactionCount = transactions.length;
		}

		res.status(201).json({
			message: 'Ledger imported successfully',
			ledger: {
				...newLedger.toJSON(),
				transaction_count: transactionCount,
			},
			dateShifted: shiftMonth,
			daysShifted: dateShiftDays,
		});
	} catch (error) {
		console.error('Import ledger error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to import ledger',
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
