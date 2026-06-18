# Fox Group AI Hub

Central portal hub for Fox Group AI tools. Built on Node.js + Express + PostgreSQL.

## Stack
- Node.js / Express
- PostgreSQL
- Session-based auth (bcrypt)
- Deployed via Coolify on Hetzner

---

## Setup

### 1. Database
Run the schema against your Postgres instance:
```
psql -d your_database -f db/schema.sql
```

### 2. Environment variables
Copy `.env.example` to `.env` and fill in:
```
DATABASE_URL=postgresql://user:password@host:5432/fox_hub
SESSION_SECRET=a-long-random-string-at-least-32-characters
PORT=3000
NODE_ENV=production
```

### 3. Install and run
```
npm install
npm start
```

---

## Default admin account
Email: `admin@foxgroup.ai`
Password: `Admin1234!`

**Change this password immediately after first login** via the admin panel.

---

## Deploying on Coolify

1. Push this repo to GitHub
2. In Coolify, create a new service → select your GitHub repo
3. Set build pack to **Dockerfile**
4. Add environment variables (DATABASE_URL, SESSION_SECRET, PORT, NODE_ENV)
5. Make sure your Postgres service is running and the DATABASE_URL points to it
6. Deploy

---

## Adding portals
Portals are seeded in `db/schema.sql`. To add more, either:
- Insert directly into the `portals` table
- Or extend the admin panel (portal management coming next)

---

## Structure
```
fox-hub/
├── server.js          # Express app + all API routes
├── middleware/
│   └── auth.js        # requireAuth + requireAdmin guards
├── public/
│   ├── login.html     # Login page
│   ├── hub.html       # Portal tile grid
│   └── admin.html     # User + permission management
├── db/
│   └── schema.sql     # Tables + seed data
├── Dockerfile
├── .env.example
└── package.json
```
