// migrate_chats.js
// Run ONCE to fix old Chat documents that stored unreadCounts as a Map.
// Command: node migrate_chats.js
//
// Place this file in nestmate-backend/ root and run:
//   node migrate_chats.js

import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

await mongoose.connect(process.env.MONGO_URI, { family: 4 });
console.log('✅ Connected');

const db   = mongoose.connection.db;
const coll = db.collection('chats');

const chats = await coll.find({}).toArray();
let fixed = 0;

for (const chat of chats) {
  let uc = chat.unreadCounts;
  let needsFix = false;
  let newUc = {};

  if (!uc) {
    needsFix = true;
    newUc = {};
  } else if (uc && typeof uc === 'object' && !Array.isArray(uc)) {
    // Check if it looks like a serialized Mongoose Map: { '$__LazyLoader': ... }
    // or has non-userId keys
    const keys = Object.keys(uc);
    const looksLikeMap = keys.some(k => k.startsWith('$') || k === '_doc');
    if (looksLikeMap) {
      needsFix = true;
      newUc = {};
    }
    // If all keys look like MongoDB ObjectIds (24 hex chars), it's already fine
  }

  if (needsFix) {
    // Build new unreadCounts with 0 for each participant
    if (Array.isArray(chat.participants)) {
      chat.participants.forEach(p => { newUc[p.toString()] = 0; });
    }
    await coll.updateOne(
      { _id: chat._id },
      { $set: { unreadCounts: newUc } }
    );
    fixed++;
    console.log(`  Fixed chat ${chat._id}`);
  }
}

console.log(`\n✅ Done — fixed ${fixed} of ${chats.length} chats`);
process.exit(0);
