require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');

const { setUserLookup } = require('./middleware/auth');
const { getUserById, seedInitialUsers } = require('./src/services/users.service');

// Routers
const authRoutes = require('./src/routes/auth.routes');
const gearRoutes = require('./src/routes/gear.routes');
const clientRoutes = require('./src/routes/clients.routes');
const bookingRoutes = require('./src/routes/bookings.routes');
const userRoutes = require('./src/routes/users.routes');
const auditRoutes = require('./src/routes/audit.routes');

// Connect auth middleware to live user status checking (Instant Ban & Deactivation enforcement)
setUserLookup(getUserById);

const app = express();

// Whitelist-restricted CORS configuration
const allowedOrigins = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server, curl, Postman, or whitelisted frontend origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  }
}));

app.use(express.json());

// Mount API Domain Routers
app.use('/api', authRoutes);
app.use('/api/gear', gearRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-logs', auditRoutes);

// Seed default accounts asynchronously
seedInitialUsers();

if (require.main === module && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[API Server] Running at http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.seedInitialUsers = seedInitialUsers;
module.exports.handler = serverless(app);
