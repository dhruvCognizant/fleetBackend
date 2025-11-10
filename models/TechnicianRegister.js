const mongoose = require('mongoose');
 
const TechnicianSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  credential: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Credential',
    required: false
  },
  skills: {
    type: [String],
    enum: ['Oil Change', 'Brake Repair', 'Battery Test'],
    default: []
  },
  availability: {
    type: [String],
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true,
    default: []

  },
  email: { type: String, required: true, unique: true }
}, { timestamps: true });
 
module.exports = mongoose.model('TechnicianRegister', TechnicianSchema);