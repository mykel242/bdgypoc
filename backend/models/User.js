const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	username: {
		type: DataTypes.STRING(50),
		allowNull: false,
		unique: true,
		validate: {
			len: [3, 50],
			notEmpty: true,
		},
	},
	email: {
		type: DataTypes.STRING(255),
		allowNull: false,
		unique: true,
		validate: {
			isEmail: true,
			notEmpty: true,
		},
	},
	password_hash: {
		type: DataTypes.STRING(255),
		allowNull: false,
	},
}, {
	tableName: 'users',
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: 'updated_at',
	hooks: {
		beforeCreate: async (user) => {
			if (user.password_hash) {
				const salt = await bcrypt.genSalt(10);
				user.password_hash = await bcrypt.hash(user.password_hash, salt);
			}
		},
		beforeUpdate: async (user) => {
			if (user.changed('password_hash')) {
				const salt = await bcrypt.genSalt(10);
				user.password_hash = await bcrypt.hash(user.password_hash, salt);
			}
		},
	},
});

// Instance method to validate password
User.prototype.validatePassword = async function(password) {
	return await bcrypt.compare(password, this.password_hash);
};

// Don't send password hash in JSON responses
User.prototype.toJSON = function() {
	const values = { ...this.get() };
	delete values.password_hash;
	return values;
};

module.exports = User;
