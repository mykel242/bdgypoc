const User = require('../models/User');

// Authentication middleware
const requireAuth = (req, res, next) => {
	if (!req.session || !req.session.userId) {
		return res.status(401).json({
			error: 'Unauthorized',
			message: 'You must be logged in to access this resource',
		});
	}
	next();
};

// Admin authentication middleware - requires login AND admin flag
const requireAdmin = async (req, res, next) => {
	if (!req.session || !req.session.userId) {
		return res.status(401).json({
			error: 'Unauthorized',
			message: 'You must be logged in to access this resource',
		});
	}

	try {
		const user = await User.findByPk(req.session.userId);
		if (!user || !user.is_admin) {
			return res.status(403).json({
				error: 'Forbidden',
				message: 'You must be an administrator to access this resource',
			});
		}
		req.user = user;
		next();
	} catch (error) {
		return res.status(500).json({
			error: 'Server Error',
			message: 'Failed to verify admin status',
		});
	}
};

// Optional auth - doesn't block if not authenticated
const optionalAuth = (req, res, next) => {
	// Just continue, routes can check req.session.userId themselves
	next();
};

module.exports = {
	requireAuth,
	requireAdmin,
	optionalAuth,
};
