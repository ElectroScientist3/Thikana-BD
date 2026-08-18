const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const User = require('../models/User');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error('MONGO_URI or MONGODB_URI is required');

mongoose.connect(mongoUri)
  .then(async () => {
    const result = await User.updateMany({ role: { $exists: false } }, { $set: { role: 'tenant' } });
    console.log(`Backfilled ${result.modifiedCount} users as tenants`);
    await mongoose.disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
