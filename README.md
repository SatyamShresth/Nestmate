# NestMate Backend

Full-stack REST API + real-time Socket.io server for the NestMate roommate finder app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express |
| Real-time | Socket.io |
| Database | MongoDB + Mongoose |
| Auth | JWT + Firebase Admin (Google / Phone OTP) |
| Images | Cloudinary + Multer |
| Security | Helmet, CORS, Rate limiting, Mongo sanitize |

---

## Project Structure

```
src/
├── server.js                   # Entry point – Express + Socket.io bootstrap
├── config/
│   ├── db.js                   # MongoDB connection
│   ├── cloudinary.js           # Multer-Cloudinary storage (avatar + listings)
│   └── firebase.js             # Firebase Admin SDK (Google / OTP)
├── middleware/
│   └── auth.js                 # JWT protect, adminOnly, signToken
├── models/
│   ├── User.js                 # User schema (lifestyle, budget, auth)
│   ├── Listing.js              # Listing schema (geo, amenities, images)
│   ├── Chat.js                 # Chat + embedded Message schema
│   └── Notification.js        # Notification + Report models
├── controllers/
│   ├── auth.controller.js      # register, login, firebase, getMe
│   ├── user.controller.js      # CRUD, save/unsave, block, avatar
│   ├── listing.controller.js   # CRUD, geo-search, images, save, enquire
│   ├── match.controller.js     # Ranked matches + score breakdown
│   ├── chat.controller.js      # Chats, messages (REST fallback)
│   ├── notification.controller.js # Get, mark read, report
│   └── admin.controller.js    # Dashboard stats, user/listing/report mgmt
├── routes/
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── listing.routes.js
│   ├── match.routes.js
│   ├── chat.routes.js
│   ├── notification.routes.js
│   ├── admin.routes.js
│   └── upload.routes.js
├── services/
│   └── match.service.js        # Weighted lifestyle compatibility algorithm
├── socket/
│   └── index.js               # Socket.io handlers (chat, typing, presence)
└── utils/
    └── seed.js                 # Dev seed script
```

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, Firebase, and Cloudinary credentials
```

### 3. Seed the database (optional, dev only)
```bash
npm run seed
```

### 4. Start the server
```bash
npm run dev    # development (nodemon)
npm start      # production
```

Server runs on `http://localhost:5000`

---

## API Reference

All protected routes require: `Authorization: Bearer <token>`

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | ✗ | Register with email + password |
| POST | `/login` | ✗ | Login, returns JWT |
| POST | `/firebase` | ✗ | Google Sign-In or Phone OTP (Firebase ID token) |
| GET | `/me` | ✓ | Get current user |

### Users — `/api/users`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | Browse users (filter: city, gender, budget, lifestyle) |
| GET | `/me/saved` | ✓ | Get saved profiles |
| PATCH | `/me` | ✓ | Update profile |
| POST | `/me/avatar` | ✓ | Upload avatar (multipart/form-data) |
| DELETE | `/me` | ✓ | Delete account |
| GET | `/:id` | ✓ | View a user profile |
| POST | `/:id/save` | ✓ | Save / unsave a profile |
| POST | `/:id/block` | ✓ | Block / unblock a user |

### Listings — `/api/listings`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✗ | Browse listings (city, rent, type, amenities, geo) |
| GET | `/me/all` | ✓ | My listings |
| GET | `/:id` | ✗ | View listing detail |
| POST | `/` | ✓ | Create listing |
| PATCH | `/:id` | ✓ | Update listing |
| DELETE | `/:id` | ✓ | Delete listing |
| POST | `/:id/images` | ✓ | Upload images (multipart, max 6) |
| DELETE | `/:id/images/:publicId` | ✓ | Delete a listing image |
| POST | `/:id/save` | ✓ | Save / unsave listing |
| POST | `/:id/enquire` | ✓ | Send enquiry notification to owner |

**Geo search:** `GET /api/listings?lat=12.97&lng=77.59&radius=5000`

### Matches — `/api/matches`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | Ranked compatible roommates (page, limit) |
| GET | `/:id` | ✓ | Score + field-by-field breakdown vs a user |

### Chats — `/api/chats`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | All conversations (no message bodies) |
| POST | `/` | ✓ | Start or find a chat `{ recipientId, listingId? }` |
| GET | `/:chatId/messages` | ✓ | Paginated message history |
| POST | `/:chatId/messages` | ✓ | Send message (REST fallback) |

### Notifications — `/api/notifications`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | Get notifications (unreadOnly=true) |
| PATCH | `/read-all` | ✓ | Mark all as read |
| PATCH | `/:id/read` | ✓ | Mark one as read |
| DELETE | `/` | ✓ | Clear all notifications |
| DELETE | `/:id` | ✓ | Delete one notification |
| POST | `/report` | ✓ | Submit a report `{ targetUser?, targetListing?, reason }` |

### Admin — `/api/admin` (admin JWT only)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/stats` | Dashboard: user/listing/report counts + city breakdown |
| GET | `/users` | Paginated user list (filter by status) |
| PATCH | `/users/:id` | Update status / isVerified / isAdmin |
| DELETE | `/users/:id` | Delete user + their listings |
| GET | `/listings` | Paginated listing list (filter by status) |
| PATCH | `/listings/:id` | Approve / reject / ban listing |
| DELETE | `/listings/:id` | Delete listing |
| GET | `/reports` | Open reports |
| PATCH | `/reports/:id` | Resolve or dismiss a report |

### Upload — `/api/upload`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/avatar` | ✓ | Upload avatar → returns `{ url, publicId }` |
| POST | `/listing-images` | ✓ | Upload up to 6 images → returns array |

---

## Socket.io Events

Client connects with: `{ auth: { token: '<JWT>' } }`

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `join_chat` | `{ chatId }` | Join a chat room |
| `leave_chat` | `{ chatId }` | Leave a chat room |
| `send_message` | `{ chatId, text }` | Send a message |
| `typing_start` | `{ chatId }` | Broadcast typing indicator |
| `typing_stop` | `{ chatId }` | Clear typing indicator |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `new_message` | `{ chatId, message }` | Incoming message |
| `typing_start` | `{ chatId, userId, name }` | Someone is typing |
| `typing_stop` | `{ chatId, userId }` | Typing stopped |
| `user_online` | `{ userId }` | User connected |
| `user_offline` | `{ userId, lastSeen }` | User disconnected |
| `notification` | `{ type }` | New notification badge |
| `error` | `{ message }` | Socket error |

---

## Match Algorithm

Scores two users 0–100 based on lifestyle compatibility:

| Field | Weight |
|---|---|
| Cleanliness | 20 |
| Smoking | 20 |
| Drinking | 15 |
| Pets | 15 |
| Sleep schedule | 15 |
| Food preference | 15 |

Partial matches (e.g. `flexible` sleep ≈ `early_bird`) earn 50% of the weight.
Budget overlap adds up to 5 bonus points.
City must match — cross-city matches are filtered out.

---

## Seed Test Accounts

After running `npm run seed` (password: `password123`):

| Email | Role | City |
|---|---|---|
| sanya@demo.com | **Admin** | Bangalore |
| akash@demo.com | User | Bangalore |
| priya@demo.com | User | Mumbai |
| naina@demo.com | User | Bangalore |
| dev@demo.com | User | Hyderabad |
| meera@demo.com | User | Chennai |
