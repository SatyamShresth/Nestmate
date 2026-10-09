// src/utils/seed.js
// Run with: npm run seed
// Populates the DB with sample users and listings for local development.

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import connectDB from '../config/db.js';

const USERS = [
  {
    name: 'Sanya Arora', email: 'sanya@demo.com', password: 'password123',
    age: 26, gender: 'female', occupation: 'UX Designer',
    bio: "Hey! I'm a 26-year-old UX designer who loves cooking, weekend hikes, and art galleries. Looking for a clean, friendly roommate in Bangalore. Early bird, non-smoker.",
    city: 'Bangalore', areas: ['Koramangala', 'HSR Layout'],
    budgetMin: 12000, budgetMax: 20000,
    lifestyle: { smoking: 'no', drinking: 'occasionally', pets: 'love', sleep: 'early_bird', cleanliness: 'very_clean', food: 'veg' },
    isVerified: true, isAdmin: true,  // admin for testing
  },
  {
    name: 'Akash Kumar', email: 'akash@demo.com', password: 'password123',
    age: 28, gender: 'male', occupation: 'Software Engineer',
    bio: 'Chill, clean, and respectful. Love weekend treks and homemade food. WFH 3 days a week.',
    city: 'Bangalore', areas: ['Koramangala', 'Indiranagar'],
    budgetMin: 15000, budgetMax: 25000,
    lifestyle: { smoking: 'no', drinking: 'occasionally', pets: 'love', sleep: 'early_bird', cleanliness: 'very_clean', food: 'non_veg' },
    isVerified: true,
  },
  {
    name: 'Priya Sharma', email: 'priya@demo.com', password: 'password123',
    age: 25, gender: 'female', occupation: 'Marketing Manager',
    bio: 'Social butterfly but respectful of personal space. Non-smoker, social drinker, loves Bollywood.',
    city: 'Mumbai', areas: ['Bandra', 'Andheri'],
    budgetMin: 20000, budgetMax: 35000,
    lifestyle: { smoking: 'no', drinking: 'occasionally', pets: 'no_pets', sleep: 'night_owl', cleanliness: 'moderate', food: 'non_veg' },
    isVerified: true,
  },
  {
    name: 'Naina Joshi', email: 'naina@demo.com', password: 'password123',
    age: 24, gender: 'female', occupation: 'Graphic Designer',
    bio: 'Creative soul, minimalist lifestyle. Looking for chill, artsy roommate.',
    city: 'Bangalore', areas: ['Whitefield', 'Marathahalli'],
    budgetMin: 10000, budgetMax: 18000,
    lifestyle: { smoking: 'no', drinking: 'no', pets: 'love', sleep: 'night_owl', cleanliness: 'moderate', food: 'vegan' },
    isVerified: true,
  },
  {
    name: 'Dev Patel', email: 'dev@demo.com', password: 'password123',
    age: 27, gender: 'male', occupation: 'Data Scientist',
    bio: 'Fitness enthusiast, early riser. Non-smoker, very organized.',
    city: 'Hyderabad', areas: ['HITEC City', 'Gachibowli'],
    budgetMin: 18000, budgetMax: 28000,
    lifestyle: { smoking: 'no', drinking: 'occasionally', pets: 'no_pets', sleep: 'early_bird', cleanliness: 'very_clean', food: 'non_veg' },
    isVerified: true,
  },
  {
    name: 'Meera Iyer', email: 'meera@demo.com', password: 'password123',
    age: 29, gender: 'female', occupation: 'Doctor',
    bio: 'Homebody, loves cooking South Indian food. Clean, responsible, quiet.',
    city: 'Chennai', areas: ['Adyar', 'Mylapore'],
    budgetMin: 25000, budgetMax: 40000,
    lifestyle: { smoking: 'no', drinking: 'no', pets: 'love', sleep: 'early_bird', cleanliness: 'very_clean', food: 'veg' },
    isVerified: true,
  },
];

const LISTINGS_DATA = (ownerIds) => [
  {
    owner: ownerIds[1],
    title: 'Spacious 1BHK near Indiranagar Metro',
    description: 'Bright, fully furnished 1BHK on the 3rd floor. Close to metro, cafes, and restaurants.',
    rent: 16000, deposit: 32000, roomType: 'single', furnishing: 'furnished',
    address: '14th Cross, Indiranagar', city: 'Bangalore', area: 'Indiranagar',
    coords: { type: 'Point', coordinates: [77.6408, 12.9784] },
    amenities: ['wifi', 'ac', 'furnished', 'parking'],
    availableFrom: new Date('2025-08-01'),
    preferredGender: 'any', status: 'active',
  },
  {
    owner: ownerIds[2],
    title: 'Modern Studio Apartment, Bandra West',
    description: 'Premium studio with sea-facing balcony. Fully furnished. Building has gym and pool.',
    rent: 28000, deposit: 56000, roomType: 'entire_flat', furnishing: 'furnished',
    address: 'Hill Road, Bandra West', city: 'Mumbai', area: 'Bandra',
    coords: { type: 'Point', coordinates: [72.8264, 19.0596] },
    amenities: ['wifi', 'gym', 'pool', 'security', 'balcony'],
    availableFrom: new Date('2025-07-15'),
    preferredGender: 'female', status: 'active',
  },
  {
    owner: ownerIds[0],
    title: 'Furnished Room in 3BHK, Koramangala',
    description: 'Private room in a friendly 3-person flat. Shared kitchen and living area. Very safe locality.',
    rent: 14000, deposit: 28000, roomType: 'single', furnishing: 'furnished',
    address: '5th Block, Koramangala', city: 'Bangalore', area: 'Koramangala',
    coords: { type: 'Point', coordinates: [77.6272, 12.9352] },
    amenities: ['wifi', 'ac', 'washing_machine', 'furnished'],
    availableFrom: new Date('2025-08-01'),
    preferredGender: 'female', status: 'active',
  },
  {
    owner: ownerIds[3],
    title: 'Premium Room with Garden View, Whitefield',
    description: 'Large room in a gated community with beautiful garden views. All amenities included.',
    rent: 22000, deposit: 44000, roomType: 'single', furnishing: 'furnished',
    address: 'EPIP Zone, Whitefield', city: 'Bangalore', area: 'Whitefield',
    coords: { type: 'Point', coordinates: [77.7480, 12.9698] },
    amenities: ['wifi', 'ac', 'balcony', 'gym', 'security'],
    availableFrom: new Date('2025-09-01'),
    preferredGender: 'any', status: 'active',
  },
  {
    owner: ownerIds[4],
    title: 'Shared Room, HITEC City',
    description: 'Clean shared room for two working professionals. Walking distance to Cyberabad offices.',
    rent: 9000, deposit: 18000, roomType: 'shared', furnishing: 'furnished',
    address: 'Madhapur, HITEC City', city: 'Hyderabad', area: 'HITEC City',
    coords: { type: 'Point', coordinates: [78.3741, 17.4473] },
    amenities: ['wifi', 'ac', 'washing_machine'],
    availableFrom: new Date('2025-07-01'),
    preferredGender: 'male', status: 'active',
  },
  {
    owner: ownerIds[5],
    title: 'Quiet PG with Meals, Adyar',
    description: 'Homely PG with South Indian meals included. Ideal for working women.',
    rent: 8500, deposit: 17000, roomType: 'shared', furnishing: 'furnished',
    address: 'LB Road, Adyar', city: 'Chennai', area: 'Adyar',
    coords: { type: 'Point', coordinates: [80.2522, 13.0067] },
    amenities: ['wifi', 'meals', 'furnished'],
    availableFrom: new Date('2025-08-01'),
    preferredGender: 'female', status: 'active',
  },
];

async function seed() {
  console.log("SEED MONGO_URI =", process.env.MONGO_URI);
  await connectDB();
  console.log('🌱 Starting seed...');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Listing.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // Create users
  const createdUsers = await Promise.all(
    USERS.map(async (u) => {
      const hashed = await bcrypt.hash(u.password, 12);
      return User.create({ ...u, password: hashed, authProvider: 'local' });
    })
  );
  console.log(`👤 Created ${createdUsers.length} users`);

  // Create listings
  const ownerIds = createdUsers.map(u => u._id);
  const createdListings = await Listing.insertMany(LISTINGS_DATA(ownerIds));
  console.log(`🏠 Created ${createdListings.length} listings`);

  console.log('\n✅ Seed complete!\n');
  console.log('─────────────────────────────────────');
  console.log('Test accounts (password: password123)');
  console.log('─────────────────────────────────────');
  USERS.forEach(u => {
    console.log(`  ${u.isAdmin ? '[ADMIN] ' : '        '}${u.email}  (${u.city})`);
  });
  console.log('─────────────────────────────────────\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
