Fleet Management Backend

Summary
- Simple Express backend for fleet maintenance: technicians, assignments, odometer readings, scheduling, and authentication (JWT via cookie).

Quick start
1. Copy environment variables: create a file named `.env` from `.env.example` and set values.
2. Install dependencies:
   npm install
3. Seed test users (creates admin and technician with known passwords):
   npm run seed
4. Start server:
   npm run dev

Default test accounts (created by `scripts/hashPasswords.js`)
- Admin: email `admin@admin.com` password `adminPass`
- Technician: email `tech@fleet.com` password `techPass`

Important endpoints
- POST /auth/login  -> body: { email, password }
- POST /api/register -> create technician (public)
- GET /api/dashboard/summary -> protected (technician or admin)
- PATCH /api/technician/assignments/:id/status -> protected (admin or owning technician)

Testing with Postman
- Import `postman_collection.json` in this repo.
- Login request saves the JWT cookie into an environment variable `token`.
- Use Cookie Jar or set Authorization: Bearer {{token}} for protected requests.

Notes
- For local development you can either run a MongoDB instance or leave DB disconnected (the app will still run for file-based features).
- Keep real secrets out of repo; use environment variables for production.

Next improvements (ideas)
- Convert file-based storage to MongoDB collections.
- Add input validation and more unit tests.
- Add CI pipeline and Dockerfile for easier deployment.
