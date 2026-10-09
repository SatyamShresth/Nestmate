// src/config/firebase.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  
  console.log("PROJECT_ID =", process.env.FIREBASE_PROJECT_ID);
  console.log("CLIENT_EMAIL =", process.env.FIREBASE_CLIENT_EMAIL);
  console.log("PRIVATE_KEY =", process.env.FIREBASE_PRIVATE_KEY ? "FOUND" : "MISSING");
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

/**
 * Verifies a Firebase ID token (from Google Sign-In or OTP)
 * @param {string} idToken – token sent from the client
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
export async function verifyFirebaseToken(idToken) {
  return admin.auth().verifyIdToken(idToken);
}

export default admin;
