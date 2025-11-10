const mongoose = require('mongoose');
 
const CredentialSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'technician'], default: 'technician' }
});
 
module.exports = mongoose.model('Credential', CredentialSchema);