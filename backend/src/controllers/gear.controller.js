const { getGear, addGear, updateGear, deleteGear } = require('../services/gear.service');
const { recordAuditLog } = require('../services/audit.service');

async function getGearHandler(req, res) {
  try {
    res.json(await getGear());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createGearHandler(req, res) {
  try {
    const item = await addGear(req.body);
    await recordAuditLog({
      req,
      action: 'ADD_GEAR',
      category: 'Inventory',
      summary: `Added gear item "${item.name}" (${item.assetTag || item.serialNumber || 'No Tag'})`,
      details: { gearId: item.id, name: item.name, category: item.category, dailyRate: item.dailyRate }
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateGearHandler(req, res) {
  try {
    const updated = await updateGear(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Gear not found' });
    const isMaintToggle = req.body.status !== undefined && Object.keys(req.body).length === 1;
    await recordAuditLog({
      req,
      action: isMaintToggle ? 'MAINTENANCE_TOGGLE' : 'UPDATE_GEAR',
      category: 'Inventory',
      summary: isMaintToggle
        ? `Toggled gear "${updated.name}" status to "${updated.status}"`
        : `Updated gear "${updated.name}" (${updated.assetTag || updated.serialNumber || ''})`,
      details: { gearId: updated.id, changes: req.body }
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteGearHandler(req, res) {
  try {
    const result = await deleteGear(req.params.id);
    await recordAuditLog({
      req,
      action: 'DELETE_GEAR',
      category: 'Inventory',
      summary: `Deleted gear item #${req.params.id}`,
      details: { gearId: req.params.id }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getGearHandler,
  createGearHandler,
  updateGearHandler,
  deleteGearHandler
};
