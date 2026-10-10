import mongoose from 'mongoose';

export async function clearCollections() {
  if (mongoose.connection.readyState === 0) {
    throw new Error('Not connected to MongoDB in test helper');
  }
  const collections = Object.values(mongoose.connection.collections);
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}
