const express = require('express')
const app = express();
require('dotenv').config();
const connectDB = require("./config/db.config")
const vehicleRoute = require('./routes/vehicleRoutes')
const odometerRoute = require('./routes/odometerRoutes')
const schedulingRoutes  = require('./routes/schedulingRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const historyRoutes=  require("./routes/historyRoutes")
const registerRoutes = require('./routes/registerRoutes')
const getSummary = require("./routes/dashboardRoutes")
const { logger } = require('./middlewares/logger');
const { headerSet , Security } = require('./middlewares/header');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const cors = require('cors');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);
app.use(headerSet);
if (process.env.NODE_ENV !== "test") {
  app.use(Security);
}
app.use(cookieParser());
require('./config/passport')(passport);
app.use(passport.initialize());

// CORS - allow frontend to communicate and include cookies
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200', credentials: true }));

// MongoDB connection (only attempt if MONGO_URI is set)
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/fleetProject';

if (mongoUri) {
  connectDB(mongoUri);
} else {
  console.warn('MONGO_URI not set — skipping DB connection');
}

// Public routes (no auth required)
app.use('/auth', authRoutes); // login/logout
app.use('/api/register', registerRoutes);


// expose auth also under /api/auth for convenience
// app.use('/api/auth', authRoutes);
// Protect all remaining /api routes
app.use('/api', passport.authenticate('jwt', { session: false }));

// Protected routes
app.use('/api', vehicleRoute);
app.use('/api/vehicles', odometerRoute);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/technician', technicianRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/dashboard', getSummary);


module.exports = app;