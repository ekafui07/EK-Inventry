const { getBookings, createBooking, returnBooking, cancelBooking, checkoutBooking } = require('../services/bookings.service');
const { recordAuditLog } = require('../services/audit.service');

async function getBookingsHandler(req, res) {
  try {
    res.json(await getBookings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createBookingHandler(req, res) {
  try {
    const booking = await createBooking(req.body);
    await recordAuditLog({
      req,
      action: 'CREATE_RENTAL',
      category: 'Rentals',
      summary: `Created rental checkout for client #${req.body.clientId} (${req.body.startDate} to ${req.body.endDate})`,
      details: { booking }
    });
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function returnBookingHandler(req, res) {
  try {
    const result = await returnBooking(req.params.id);
    await recordAuditLog({
      req,
      action: 'RETURN_RENTAL',
      category: 'Rentals',
      summary: `Checked in / returned gear for rental #${req.params.id}`,
      details: { bookingId: req.params.id }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function cancelBookingHandler(req, res) {
  try {
    const result = await cancelBooking(req.params.id);
    await recordAuditLog({
      req,
      action: 'CANCEL_RENTAL',
      category: 'Rentals',
      summary: `Voided / cancelled rental reservation #${req.params.id}`,
      details: { bookingId: req.params.id }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function checkoutBookingHandler(req, res) {
  try {
    const result = await checkoutBooking(req.params.id);
    await recordAuditLog({
      req,
      action: 'CHECKOUT_RENTAL',
      category: 'Rentals',
      summary: `Checked out reserved rental #${req.params.id}`,
      details: { bookingId: req.params.id }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getBookingsHandler,
  createBookingHandler,
  returnBookingHandler,
  cancelBookingHandler,
  checkoutBookingHandler
};
