const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db-mock.json');
const formattedGearPath = path.join(__dirname, 'rentdecam-formatted-gear.json');

// Read existing DB to preserve user accounts
let currentDb = { users: [] };
if (fs.existsSync(dbPath)) {
  try {
    currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch (e) {
    console.warn('Could not parse existing db-mock.json');
  }
}

// Ensure standard users exist
const defaultUsers = [
  {
    id: "u_admin_ek",
    email: "admin@ekgearflow.com",
    name: "EK Admin",
    role: "admin",
    passwordHash: "$2b$10$wT1.58iZfR.h4xGZ8p1hveqQJ8T8z5gqZ1I.K0W9h1sT5M0s6m3Q6", // admin123
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z"
  },
  {
    id: "u_sarah_ek",
    email: "sarah@ekgearflow.com",
    name: "Sarah Mensah",
    role: "staff",
    passwordHash: "$2a$10$iGq1W8e7oN0XoD5Fv3Y2/.d7zWkC3zM1kIe9zV4r0vH1iE5mP0wO6",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z"
  },
  {
    id: "u_admin_gearflow",
    email: "admin@gearflow.com",
    name: "GearFlow Admin",
    role: "admin",
    passwordHash: "$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z"
  },
  {
    id: "u_staff_gearflow",
    email: "staff@gearflow.com",
    name: "GearFlow Staff",
    role: "staff",
    passwordHash: "$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z"
  }
];

const usersToSave = currentDb.users && currentDb.users.length > 0 ? currentDb.users : defaultUsers;
const gearList = JSON.parse(fs.readFileSync(formattedGearPath, 'utf-8'));

// Backup current db-mock.json
if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, path.join(__dirname, 'db-mock.backup.json'));
}

// RentdeCam demo clients — 3 real-world Ghana-based production companies
const rdcClients = [
  {
    id: "c_rdc_001",
    name: "Kofi Mensah",
    companyName: "Accra Visuals Media",
    email: "kofi.mensah@accravisuals.com",
    phone: "+233 24 456 7890",
    ghanaCardNumber: "GHA-712345678-1",
    guarantorName: "Dr. Samuel Okyere",
    guarantorGhanaCard: "GHA-112233445-9",
    guarantorPhone: "+233 24 999 1122",
    status: "Active",
    createdAt: "2026-09-20T18:00:00.000Z"
  },
  {
    id: "c_rdc_002",
    name: "Ama Serwaa Darko",
    companyName: "Golden Lens Productions",
    email: "ama.darko@goldenlensmedia.gh",
    phone: "+233 20 876 5432",
    ghanaCardNumber: "GHA-823456789-2",
    guarantorName: "Nana Kwame Frimpong",
    guarantorGhanaCard: "GHA-223344556-8",
    guarantorPhone: "+233 20 888 3344",
    status: "Active",
    createdAt: "2026-09-20T18:00:00.000Z"
  },
  {
    id: "c_rdc_003",
    name: "Emmanuel Osei",
    companyName: "Horizon Creative Agency",
    email: "emmanuel@horizoncreatives.com",
    phone: "+233 55 987 6543",
    ghanaCardNumber: "GHA-934567890-3",
    guarantorName: "Elizabeth Addo",
    guarantorGhanaCard: "GHA-334455667-7",
    guarantorPhone: "+233 55 777 5566",
    status: "Active",
    createdAt: "2026-09-20T18:00:00.000Z"
  }
];

const newDb = {
  gear: gearList,
  clients: rdcClients,
  bookings: [],
  users: usersToSave,
  auditLogs: [
    {
      id: "log_rdc_init",
      action: "INVENTORY_INITIALIZED",
      details: "Imported 131 inventory items and 3 demo clients from RentdeCam catalog into local database.",
      performedBy: "admin@ekgearflow.com",
      timestamp: new Date().toISOString()
    }
  ]
};

fs.writeFileSync(dbPath, JSON.stringify(newDb, null, 2), 'utf-8');
console.log(`Successfully updated db-mock.json!`);
console.log(`- Gear items:       ${newDb.gear.length}`);
console.log(`- Users preserved:  ${newDb.users.length}`);
console.log(`- Clients seeded:   ${newDb.clients.length}`);
console.log(`- Bookings:         ${newDb.bookings.length}`);
