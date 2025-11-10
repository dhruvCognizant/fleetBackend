const express = require("express");
const router = express.Router();
const { createTechnician } = require("../controllers/registerController");
 
router.post("/", createTechnician);
 
module.exports = router;
 
 