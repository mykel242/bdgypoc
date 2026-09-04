const User = require('../models/User');

// Budgie runs as a single-user deployment on the LAN. There is no login flow
// and no second account to distinguish from, so "authentication" reduces to
// resolving the one user that exists and attaching it to the session.
//
// The session machinery is deliberately kept: express-session still issues a
// cookie and the `sessions` table still works, so per-browser state (and any
// future return to real auth) has somewhere to live. What changed is that a
// missing session is now filled in rather than rejected with a 401.

// The sole user's identity, resolved once on first use. Cached because every
// request goes through here and the answer cannot change without a manual
// database edit.
let cachedUser = null;

async function soleUser() {
	if (cachedUser !== null) return cachedUser;
	// Lowest id wins if a stray row ever appears, so the choice is stable
	// rather than dependent on row order.
	const user = await User.findOne({ order: [['id', 'ASC']] });
	if (!user) {
		throw new Error(
			'no user row found — budgie expects exactly one account to exist',
		);
	}
	cachedUser = user;
	return cachedUser;
}

// Populate the same three session fields the old login handler set, so
// /api/auth/check and /api/auth/me see a session identical to a logged-in one.
async function ensureSession(req) {
	if (req.session.userId) return;
	const user = await soleUser();
	req.session.userId = user.id;
	req.session.userUuid = user.uuid;
	req.session.userEmail = user.email;
}

// Ensure the request carries the single user's session. Never rejects.
const requireAuth = async (req, res, next) => {
	try {
		await ensureSession(req);
		next();
	} catch (error) {
		next(error);
	}
};

// Same resolution, plus the loaded user on req.user. The single user is the
// administrator by definition, so there is no is_admin gate left to apply.
const requireAdmin = async (req, res, next) => {
	try {
		await ensureSession(req);
		req.user = await User.findByPk(req.session.userId);
		if (!req.user) {
			return res.status(500).json({
				error: 'Server Error',
				message: 'Session references a user that no longer exists',
			});
		}
		next();
	} catch (error) {
		next(error);
	}
};

// Retained for call-site compatibility; it was already a pass-through.
const optionalAuth = (req, res, next) => {
	next();
};

module.exports = {
	requireAuth,
	requireAdmin,
	optionalAuth,
};
