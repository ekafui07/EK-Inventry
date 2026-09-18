const { getClients, addClient, updateClient, deleteClient } = require('../services/clients.service');
const { recordAuditLog } = require('../services/audit.service');

async function getClientsHandler(req, res) {
  try {
    res.json(await getClients());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createClientHandler(req, res) {
  try {
    const client = await addClient(req.body);
    await recordAuditLog({
      req,
      action: 'ADD_CLIENT',
      category: 'Clients',
      summary: `Registered new client "${client.name}" (${client.email})`,
      details: { clientId: client.id, name: client.name, email: client.email, phone: client.phone }
    });
    res.status(201).json(client);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateClientHandler(req, res) {
  try {
    const updated = await updateClient(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Client not found' });
    await recordAuditLog({
      req,
      action: 'UPDATE_CLIENT',
      category: 'Clients',
      summary: `Updated client "${updated.name}" (${updated.email})`,
      details: { clientId: updated.id, changes: req.body }
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteClientHandler(req, res) {
  try {
    const result = await deleteClient(req.params.id);
    await recordAuditLog({
      req,
      action: 'DELETE_CLIENT',
      category: 'Clients',
      summary: `Deleted client #${req.params.id}`,
      details: { clientId: req.params.id }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getClientsHandler,
  createClientHandler,
  updateClientHandler,
  deleteClientHandler
};
