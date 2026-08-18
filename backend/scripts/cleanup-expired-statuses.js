// scripts/cleanup-expired-statuses.js
const mongoose = require('mongoose');
const Listing = require('../models/Listing');

require('dotenv').config({ path: '../.env' });

/**
 * This script should be run as a scheduled job (e.g., cron)
 * to automatically clean up expired statuses
 */
async function cleanupExpiredStatuses() {
  try {
    console.log('Starting cleanup of expired statuses...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find expired on-hold listings
    const expiredHolds = await Listing.find({
      status: 'on_hold',
      hold_expiry_date: { $lt: new Date() }
    });

    // Find expired reservations
    const expiredReservations = await Listing.find({
      status: 'reserved',
      reservation_expiry_date: { $lt: new Date() }
    });

    console.log(`Found ${expiredHolds.length} expired holds and ${expiredReservations.length} expired reservations`);

    // Update expired holds to available
    for (const listing of expiredHolds) {
      // Use the system user ID or a special ID for automated updates
      const systemUserId = process.env.SYSTEM_USER_ID || '000000000000000000000000';
      await listing.updateStatus('available_now', systemUserId, 'Auto-expired: Hold period ended');
      console.log(`Updated listing ${listing._id} from on_hold to available_now`);
    }

    // Update expired reservations to available
    for (const listing of expiredReservations) {
      const systemUserId = process.env.SYSTEM_USER_ID || '000000000000000000000000';
      await listing.updateStatus('available_now', systemUserId, 'Auto-expired: Reservation period ended');
      console.log(`Updated listing ${listing._id} from reserved to available_now`);
    }

    console.log('Cleanup completed successfully');
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    return {
      success: true,
      expiredHolds: expiredHolds.length,
      expiredReservations: expiredReservations.length
    };
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  cleanupExpiredStatuses()
    .then(result => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = cleanupExpiredStatuses;