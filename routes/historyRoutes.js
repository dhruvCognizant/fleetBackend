const express = require('express');
const router = express.Router();

const {  addServiceRecord, getAllHistories } = require('../controllers/historyController');

const { authenticate } = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/auth');

// Public endpoints remain public or can be protected as needed
router.post('/addService', authenticate, authorizeRole('admin'), addServiceRecord);
router.get('/allHistories', authenticate, authorizeRole('admin'), getAllHistories);

module.exports = router;