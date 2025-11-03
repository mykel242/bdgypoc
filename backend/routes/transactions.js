const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { Transaction, Ledger } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Helper function to verify ledger ownership
const verifyLedgerOwnership = async (ledgerId, userId) => {
	const ledger = await Ledger.findOne({
		where: {
			id: ledgerId,
			user_id: userId,
		},
	});
	return ledger !== null;
};

// Validation middleware
const createTransactionValidation = [
	body('ledger_id')
		.isInt()
		.withMessage('Ledger ID must be an integer'),
	body('date')
		.isISO8601()
		.withMessage('Date must be a valid date'),
	body('description')
		.trim()
		.notEmpty()
		.withMessage('Description is required')
		.isLength({ max: 500 })
		.withMessage('Description must be less than 500 characters'),
	body('credit_amount')
		.optional()
		.isDecimal()
		.withMessage('Credit amount must be a valid decimal number'),
	body('debit_amount')
		.optional()
		.isDecimal()
		.withMessage('Debit amount must be a valid decimal number'),
	body('is_paid')
		.optional()
		.isBoolean()
		.withMessage('is_paid must be a boolean'),
	body('is_cleared')
		.optional()
		.isBoolean()
		.withMessage('is_cleared must be a boolean'),
	body('sort_order')
		.optional()
		.isInt()
		.withMessage('sort_order must be an integer'),
];

const updateTransactionValidation = [
	param('id')
		.isInt()
		.withMessage('Invalid transaction ID'),
	body('date')
		.optional()
		.isISO8601()
		.withMessage('Date must be a valid date'),
	body('description')
		.optional()
		.trim()
		.notEmpty()
		.withMessage('Description cannot be empty')
		.isLength({ max: 500 })
		.withMessage('Description must be less than 500 characters'),
	body('credit_amount')
		.optional()
		.isDecimal()
		.withMessage('Credit amount must be a valid decimal number'),
	body('debit_amount')
		.optional()
		.isDecimal()
		.withMessage('Debit amount must be a valid decimal number'),
	body('is_paid')
		.optional()
		.isBoolean()
		.withMessage('is_paid must be a boolean'),
	body('is_cleared')
		.optional()
		.isBoolean()
		.withMessage('is_cleared must be a boolean'),
	body('sort_order')
		.optional()
		.isInt()
		.withMessage('sort_order must be an integer'),
];

const transactionIdValidation = [
	param('id')
		.isInt()
		.withMessage('Invalid transaction ID'),
];

// GET /api/transactions - Get all transactions for user's ledgers
router.get('/', async (req, res) => {
	try {
		const { ledger_id, start_date, end_date, is_paid, is_cleared } = req.query;

		// Build where clause
		const where = {};
		if (ledger_id) where.ledger_id = ledger_id;
		if (start_date) where.date = { ...where.date, [require('sequelize').Op.gte]: start_date };
		if (end_date) where.date = { ...where.date, [require('sequelize').Op.lte]: end_date };
		if (is_paid !== undefined) where.is_paid = is_paid === 'true';
		if (is_cleared !== undefined) where.is_cleared = is_cleared === 'true';

		// Get transactions, but only for ledgers owned by the user
		const transactions = await Transaction.findAll({
			where,
			include: [{
				model: Ledger,
				as: 'ledger',
				where: { user_id: req.session.userId },
				attributes: ['id', 'name'],
			}],
			order: [['date', 'DESC'], ['sort_order', 'ASC']],
		});

		res.json({
			transactions,
			count: transactions.length,
		});
	} catch (error) {
		console.error('Get transactions error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to retrieve transactions',
		});
	}
});

// GET /api/transactions/:id - Get a specific transaction
router.get('/:id', transactionIdValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const transaction = await Transaction.findOne({
			where: { id: req.params.id },
			include: [{
				model: Ledger,
				as: 'ledger',
				where: { user_id: req.session.userId },
				attributes: ['id', 'name'],
			}],
		});

		if (!transaction) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Transaction not found or you do not have access to it',
			});
		}

		res.json({ transaction });
	} catch (error) {
		console.error('Get transaction error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to retrieve transaction',
		});
	}
});

// POST /api/transactions - Create a new transaction
router.post('/', createTransactionValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const {
			ledger_id,
			date,
			description,
			credit_amount,
			debit_amount,
			is_paid,
			is_cleared,
			sort_order,
		} = req.body;

		// Verify ledger ownership
		const hasAccess = await verifyLedgerOwnership(ledger_id, req.session.userId);
		if (!hasAccess) {
			return res.status(403).json({
				error: 'Forbidden',
				message: 'You do not have access to this ledger',
			});
		}

		// Create transaction
		const transaction = await Transaction.create({
			ledger_id,
			date,
			description,
			credit_amount: credit_amount || 0.00,
			debit_amount: debit_amount || 0.00,
			is_paid: is_paid !== undefined ? is_paid : false,
			is_cleared: is_cleared !== undefined ? is_cleared : false,
			sort_order: sort_order || 0,
		});

		// Fetch the transaction with ledger info
		const newTransaction = await Transaction.findOne({
			where: { id: transaction.id },
			include: [{
				model: Ledger,
				as: 'ledger',
				attributes: ['id', 'name'],
			}],
		});

		res.status(201).json({
			message: 'Transaction created successfully',
			transaction: newTransaction,
		});
	} catch (error) {
		console.error('Create transaction error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to create transaction',
		});
	}
});

// PUT /api/transactions/:id - Update a transaction
router.put('/:id', updateTransactionValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		// Find transaction and verify ownership
		const transaction = await Transaction.findOne({
			where: { id: req.params.id },
			include: [{
				model: Ledger,
				as: 'ledger',
				where: { user_id: req.session.userId },
			}],
		});

		if (!transaction) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Transaction not found or you do not have access to it',
			});
		}

		const {
			date,
			description,
			credit_amount,
			debit_amount,
			is_paid,
			is_cleared,
			sort_order,
		} = req.body;

		// Update transaction
		if (date !== undefined) transaction.date = date;
		if (description !== undefined) transaction.description = description;
		if (credit_amount !== undefined) transaction.credit_amount = credit_amount;
		if (debit_amount !== undefined) transaction.debit_amount = debit_amount;
		if (is_paid !== undefined) transaction.is_paid = is_paid;
		if (is_cleared !== undefined) transaction.is_cleared = is_cleared;
		if (sort_order !== undefined) transaction.sort_order = sort_order;

		await transaction.save();

		// Reload with ledger info
		await transaction.reload({
			include: [{
				model: Ledger,
				as: 'ledger',
				attributes: ['id', 'name'],
			}],
		});

		res.json({
			message: 'Transaction updated successfully',
			transaction,
		});
	} catch (error) {
		console.error('Update transaction error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to update transaction',
		});
	}
});

// DELETE /api/transactions/:id - Delete a transaction
router.delete('/:id', transactionIdValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		// Find transaction and verify ownership
		const transaction = await Transaction.findOne({
			where: { id: req.params.id },
			include: [{
				model: Ledger,
				as: 'ledger',
				where: { user_id: req.session.userId },
			}],
		});

		if (!transaction) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Transaction not found or you do not have access to it',
			});
		}

		await transaction.destroy();

		res.json({
			message: 'Transaction deleted successfully',
		});
	} catch (error) {
		console.error('Delete transaction error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to delete transaction',
		});
	}
});

// POST /api/transactions/:id/toggle-paid - Toggle paid status
router.post('/:id/toggle-paid', transactionIdValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const transaction = await Transaction.findOne({
			where: { id: req.params.id },
			include: [{
				model: Ledger,
				as: 'ledger',
				where: { user_id: req.session.userId },
			}],
		});

		if (!transaction) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Transaction not found or you do not have access to it',
			});
		}

		transaction.is_paid = !transaction.is_paid;
		await transaction.save();

		res.json({
			message: 'Transaction paid status toggled',
			transaction,
		});
	} catch (error) {
		console.error('Toggle paid error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to toggle paid status',
		});
	}
});

// POST /api/transactions/:id/toggle-cleared - Toggle cleared status
router.post('/:id/toggle-cleared', transactionIdValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'Validation failed',
				details: errors.array(),
			});
		}

		const transaction = await Transaction.findOne({
			where: { id: req.params.id },
			include: [{
				model: Ledger,
				as: 'ledger',
				where: { user_id: req.session.userId },
			}],
		});

		if (!transaction) {
			return res.status(404).json({
				error: 'Not found',
				message: 'Transaction not found or you do not have access to it',
			});
		}

		transaction.is_cleared = !transaction.is_cleared;
		await transaction.save();

		res.json({
			message: 'Transaction cleared status toggled',
			transaction,
		});
	} catch (error) {
		console.error('Toggle cleared error:', error);
		res.status(500).json({
			error: 'Internal server error',
			message: 'Failed to toggle cleared status',
		});
	}
});

module.exports = router;
