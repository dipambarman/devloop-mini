import mongoose from 'mongoose';

export default async function globalSetup() {
  const uri = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/devloop-mini-test';
  await mongoose.connect(uri);
}
