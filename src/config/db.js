// src/config/db.js
// import mongoose from 'mongoose';

// export default async function connectDB() {
//   try {
//     console.log("DB URI =", process.env.MONGO_URI);
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log('✅ MongoDB connected');
//   } catch (err) {
//     console.error('❌ MongoDB connection error:', err.message);
//     process.exit(1);
//   }
// }


// src/config/db.js
import mongoose from 'mongoose';
import dns from 'dns';

// Node 24 changed the default DNS result order. This forces the legacy
// behaviour that mongoose's SRV lookup expects.
dns.setDefaultResultOrder('ipv4first');

export default async function connectDB() {
  try {
    console.log("DB URI =", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      family: 4,                  // force IPv4 — prevents Node 24 IPv6 ECONNREFUSED
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}
