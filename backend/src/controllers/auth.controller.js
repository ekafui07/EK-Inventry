const { loginUser, forgotPasswordReset, changeUserPassword } = require('../services/users.service');
const { recordAuditLog } = require('../services/audit.service');

async function loginHandler(req, res) {
  try {
    const userSession = await loginUser(req.body);
    await recordAuditLog({
      user: userSession,
      action: 'USER_LOGIN',
      category: 'Auth',
      summary: `User "${userSession.name}" logged in as ${userSession.accountType}`,
      details: { userId: userSession.id, email: userSession.email, role: userSession.role }
    });
    res.json(userSession);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

function meHandler(req, res) {
  res.json({ user: req.user });
}

async function forgotPasswordHandler(req, res) {
  try {
    res.json(await forgotPasswordReset(req.body.email));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function changePasswordHandler(req, res) {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden: You can only change your own password.' });
    }
    const result = await changeUserPassword(req.params.id, req.body.newPassword);
    await recordAuditLog({
      req,
      action: 'CHANGE_PASSWORD',
      category: 'Auth',
      summary: `Changed password for user #${req.params.id}`,
      details: { userId: req.params.id }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  loginHandler,
  meHandler,
  forgotPasswordHandler,
  changePasswordHandler
};
