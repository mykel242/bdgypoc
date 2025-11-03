const User = require('./User');
const Ledger = require('./Ledger');
const Transaction = require('./Transaction');

// Define relationships
User.hasMany(Ledger, {
	foreignKey: 'user_id',
	as: 'ledgers',
	onDelete: 'CASCADE',
});

Ledger.belongsTo(User, {
	foreignKey: 'user_id',
	as: 'user',
});

Ledger.hasMany(Transaction, {
	foreignKey: 'ledger_id',
	as: 'transactions',
	onDelete: 'CASCADE',
});

Transaction.belongsTo(Ledger, {
	foreignKey: 'ledger_id',
	as: 'ledger',
});

// Export models
module.exports = {
	User,
	Ledger,
	Transaction,
};
