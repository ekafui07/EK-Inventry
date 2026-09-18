const {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  toggleUserStatus
} = require('../services/users.service');
const { recordAuditLog } = require('../services/audit.service');

async function getUsersHandler(req, res) {
  try {
    res.json(await getUsers());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createUserHandler(req, res) {
  try {
    const newUser = await addUser(req.body);
    await recordAuditLog({
      req,
      action: 'CREATE_USER',
      category: 'Staff',
      summary: `Created ${newUser.accountType} account for "${newUser.name}" (${newUser.email})`,
      details: { userId: newUser.id, name: newUser.name, email: newUser.email, accountType: newUser.accountType }
    });
    res.status(201).json({ user: newUser, ...newUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateUserHandler(req, res) {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own profile.' });
    }
    const updated = await updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    await recordAuditLog({
      req,
      action: 'UPDATE_USER',
      category: 'Staff',
      summary: `Updated profile for "${updated.name}" (${updated.email})`,
      details: { userId: updated.id, changes: req.body }
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteUserHandler(req, res) {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own administrator account.' });
    }
    const result = await deleteUser(req.params.id);
    await recordAuditLog({
      req,
      action: 'DELETE_USER',
      category: 'Staff',
      summary: `Deleted user account #${req.params.id}`,
      details: { userId: req.params.id }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function resetUserPasswordHandler(req, res) {
  try {
    const result = await resetUserPassword(req.params.id);
    await recordAuditLog({
      req,
      action: 'RESET_PASSWORD',
      category: 'Staff',
      summary: `Reset password for user #${req.params.id} to default 12345`,
      details: { userId: req.params.id }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function toggleUserStatusHandler(req, res) {
  try {
    const targetStatus = (req.body.status || '').toLowerCase();
    if (req.user.id === req.params.id && (targetStatus === 'inactive' || targetStatus === 'banned')) {
      return res.status(400).json({ error: 'Cannot deactivate or ban your own administrator account.' });
    }
    const result = await toggleUserStatus(req.params.id, req.body.status);
    await recordAuditLog({
      req,
      action: 'STATUS_CHANGE',
      category: 'Staff',
      summary: `Changed account status for user #${req.params.id} to ${req.body.status}`,
      details: { userId: req.params.id, status: req.body.status }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getUsersHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  resetUserPasswordHandler,
  toggleUserStatusHandler
};
