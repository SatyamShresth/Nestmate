// src/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
 
const lifestyleSchema = new mongoose.Schema({
  smoking:    { type: String, enum: ['yes', 'no'],                    default: 'no' },
  drinking:   { type: String, enum: ['yes', 'occasionally', 'no'],    default: 'no' },
  pets:       { type: String, enum: ['love', 'allergic', 'no_pets'],  default: 'love' },
  sleep:      { type: String, enum: ['early_bird', 'night_owl', 'flexible'], default: 'flexible' },
  cleanliness:{ type: String, enum: ['very_clean', 'moderate', 'relaxed'],   default: 'moderate' },
  food:       { type: String, enum: ['veg', 'non_veg', 'vegan', 'any'],      default: 'any' },
}, { _id: false });
 
const userSchema = new mongoose.Schema({
  // ─── Auth ────────────────────────────────────────────
  email:         { type: String, required: true, unique: true, lowercase: true },
  password:      { type: String, select: false },       // null for OAuth users
  phone:         { type: String, sparse: true },
  firebaseUid:   { type: String, sparse: true },        // for Google / OTP auth
  authProvider:  { type: String, enum: ['local', 'google', 'phone'], default: 'local' },
 
  // ─── Basic profile ───────────────────────────────────
  name:          { type: String, required: true },
  age:           { type: Number, min: 18, max: 80 },
  gender:        { type: String, enum: ['male', 'female', 'non_binary', 'prefer_not_to_say'] },
  occupation:    String,
  bio:           { type: String, maxlength: 500 },
  avatar:        String,                                // Cloudinary URL
  avatarPublicId:String,
 
  // ─── Location & budget ───────────────────────────────
  city:          String,
  areas:         [String],
  budgetMin:     Number,
  budgetMax:     Number,
 
  // ─── Lifestyle ───────────────────────────────────────
  lifestyle:     { type: lifestyleSchema, default: () => ({}) },
 
  // ─── Social ──────────────────────────────────────────
  savedProfiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
  blockedUsers:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
 
  // ─── Status ──────────────────────────────────────────
  isVerified:    { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: {type: String,select: false},
  emailVerificationExpires: {type: Date,select: false},
  isAdmin:       { type: Boolean, default: false },
  status:        { type: String, enum: ['active', 'pending', 'banned'], default: 'active' },
  lastSeen:      Date,
  matchScore:    { type: Number, default: 0 },
 
  // ─── Password reset ───────────────────────────────────
  resetPasswordToken:   { type: String, select: false },
  resetPasswordExpires: { type: Date,   select: false },  // pre-computed for sorting
 
}, { timestamps: true });
 
// ─── Hash password before save ───────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
 
// ─── Compare passwords ───────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};
 
// ─── Public profile (strip sensitive fields) ─────────
userSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.firebaseUid;
  delete obj.blockedUsers;
  return obj;
};
 
// ─── Full-text search index ──────────────────────────
userSchema.index({ name: 'text', city: 'text', occupation: 'text' });
userSchema.index({ city: 1, budgetMin: 1, budgetMax: 1 });
 
export default mongoose.model('User', userSchema);
