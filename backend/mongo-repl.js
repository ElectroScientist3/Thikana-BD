const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');

async function startRepl() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('No MONGO_URI or MONGODB_URI found in environment');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to MongoDB via Mongoose');

  const repl = require('repl');
  const { ObjectId } = require('mongodb');

  const server = repl.start({ prompt: 'mongo-repl> ' });
  server.context.db = mongoose.connection.db;
  server.context.mongoose = mongoose;
  server.context.ObjectId = ObjectId;

  console.log('REPL ready. `db` is the native MongoDB Db instance. Use `ObjectId("...")` to create ids.');

  server.on('exit', async () => {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  });
}

startRepl().catch(err => {
  console.error('Failed to start REPL:', err);
  process.exit(1);
});
