require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { Gear, Client, Booking, User } = require('./models');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgearflow';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Read db-mock.json
    const rawData = fs.readFileSync('./db-mock.json', 'utf8');
    const dbMock = JSON.parse(rawData);

    console.log('Clearing old collections...');
    await Gear.deleteMany({});
    await Client.deleteMany({});
    await Booking.deleteMany({});
    await User.deleteMany({});

    console.log('Seeding Gear...');
    if (dbMock.gear) await Gear.insertMany(dbMock.gear);

    console.log('Seeding Clients...');
    if (dbMock.clients) await Client.insertMany(dbMock.clients);

    console.log('Seeding Bookings...');
    if (dbMock.bookings) await Booking.insertMany(dbMock.bookings);

    console.log('Seeding Users and hashing passwords...');
    if (dbMock.users) {
      for (const user of dbMock.users) {
        user.password = await bcrypt.hash(user.password || '12345', 10);
        await User.create(user);
      }
    }

    console.log('Data migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

seed();
