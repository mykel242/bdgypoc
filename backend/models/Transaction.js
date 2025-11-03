const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	ledger_id: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'ledgers',
			key: 'id',
		},
		onDelete: 'CASCADE',
	},
	date: {
		type: DataTypes.DATEONLY,
		allowNull: false,
		validate: {
			isDate: true,
			notEmpty: true,
		},
	},
	description: {
		type: DataTypes.STRING(500),
		allowNull: false,
		validate: {
			notEmpty: true,
		},
	},
	credit_amount: {
		type: DataTypes.DECIMAL(12, 2),
		defaultValue: 0.00,
		validate: {
			isDecimal: true,
			min: 0,
		},
	},
	debit_amount: {
		type: DataTypes.DECIMAL(12, 2),
		defaultValue: 0.00,
		validate: {
			isDecimal: true,
			min: 0,
		},
	},
	is_paid: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
	is_cleared: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
	sort_order: {
		type: DataTypes.INTEGER,
		defaultValue: 0,
	},
}, {
	tableName: 'transactions',
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: 'updated_at',
	indexes: [
		{
			fields: ['ledger_id'],
		},
		{
			fields: ['date'],
		},
		{
			fields: ['ledger_id', 'date', 'sort_order'],
		},
	],
});

// Virtual field for calculated balance effect
Transaction.prototype.getBalanceEffect = function() {
	return parseFloat(this.credit_amount) - parseFloat(this.debit_amount);
};

module.exports = Transaction;
