const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Ledger = sequelize.define('Ledger', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	user_id: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'users',
			key: 'id',
		},
		onDelete: 'CASCADE',
	},
	name: {
		type: DataTypes.STRING(255),
		allowNull: false,
		validate: {
			notEmpty: true,
		},
	},
	starting_balance: {
		type: DataTypes.DECIMAL(12, 2),
		defaultValue: 0.00,
		validate: {
			isDecimal: true,
		},
	},
	starting_balance_date: {
		type: DataTypes.DATEONLY,
		allowNull: true,
	},
	is_locked: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
		allowNull: false,
	},
	is_archived: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
		allowNull: false,
	},
}, {
	tableName: 'ledgers',
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: 'updated_at',
	indexes: [
		{
			unique: true,
			fields: ['user_id', 'name'],
		},
		{
			fields: ['user_id'],
		},
	],
});

module.exports = Ledger;
