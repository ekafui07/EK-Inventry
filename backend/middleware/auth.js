const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_ek_key';

let userLookupFn = null;

function setUserLookup(fn) {
  userLookupFn = fn;
}

/**
 * Authentication middleware:
 * Validates the JWT Bearer token, verifies active status against database, and attaches req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({ error: 'Malformed authorization header. Expected Bearer <token>' });
  }

  const token = parts[1];
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Active User & Instant Ban Enforcement Check
    if (userLookupFn && (decoded.id || decoded.email)) {
      try {
        const liveUser = await userLookupFn(decoded.id, decoded.email);
        if (liveUser) {
          const status = (liveUser.status || '').toLowerCase();
          if (status === 'banned' || status === 'inactive') {
            return res.status(403).json({
              error: 'This account has been banned or deactivated. Session terminated.'
            });
          }
          // Synchronize latest live role, accountType, and permissions
          if (liveUser.accountType) decoded.accountType = liveUser.accountType;
          if (liveUser.role) decoded.role = liveUser.role;
          if (liveUser.permissions) decoded.permissions = liveUser.permissions;
        }
      } catch (lookupErr) {
        console.warn('[Auth Middleware] Live user status lookup notice:', lookupErr.message);
      }
    }

    const role = (decoded.role || decoded.accountType || 'staff').toLowerCase();
    const accountType = role === 'admin' ? 'Admin' : 'Staff';

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: role,
      accountType: accountType,
      permissions: decoded.permissions || []
    };
    req.authData = decoded; // backwards compatibility

    next();
  });
}

/**
 * Role-Based Access Control (RBAC) middleware:
 * Requires user to have one of the specified roles (e.g. 'admin', 'staff').
 */
function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (normalizedAllowed.includes(req.user.role.toLowerCase())) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Requires one of [${allowedRoles.join(', ')}] role privileges.`
    });
  };
}

/**
 * Permission-Based Access Control middleware:
 * Admin bypasses automatically. Staff must possess the required permission.
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admins have full access
    if (req.user.role === 'admin') {
      return next();
    }

    const userPerms = req.user.permissions || [];
    const hasAll = requiredPermissions.every(perm => userPerms.includes(perm));

    if (hasAll) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Missing required permissions: ${requiredPermissions.join(', ')}`
    });
  };
}

/**
 * Permission-Based Access Control middleware:
 * Admin bypasses automatically. Staff must possess AT LEAST ONE of the required permissions.
 */
function requireAnyPermission(...allowedPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const userPerms = req.user.permissions || [];
    const hasAny = allowedPermissions.some(perm => userPerms.includes(perm));

    if (hasAny) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Missing required permissions: requires one of ${allowedPermissions.join(', ')}`
    });
  };
}

module.exports = {
  authenticate,
  verifyToken: authenticate, // backwards compatibility alias
  requireRole,
  requirePermission,
  requireAnyPermission,
  setUserLookup,
  JWT_SECRET
};
