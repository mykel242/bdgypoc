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

// Optional auth - doesn't block if not authenticated
const optionalAuth = (req, res, next) => {
	// Just continue, routes can check req.session.userId themselves
	next();
};

module.exports = {
	requireAuth,
	optionalAuth,
};
