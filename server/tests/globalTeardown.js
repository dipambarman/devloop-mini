import mongoose from 'mongoose';

export default async function globalTeardown() {
  if (mongoose.connection.readyState !== 0) {
    const db = mongoose.connection.db;
    const collections = await db.collections();
    for (const collection of collections) {
      await collection.drop();
    }
    await mongoose.disconnect();
  }
}
