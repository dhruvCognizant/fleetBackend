const mongoose = require('mongoose');
 
const ServiceHistorySchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceAssignment', required: true },
  vehicleVIN: { type: String, required: false },
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'TechnicianRegister', required: false },
  technicianName: { type: String, default: '' },
  serviceType: { type: String, required: true },
  dueServiceDate: { type: Date, default: null },
  paymentStatus: { type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' },
  cost: { type: Number, default: 0 },
  workStatus: { type: String, enum: ['Completed', 'Work In Progress', 'Pending'], required: true }
}, { timestamps: true });
 
module.exports = mongoose.model('History', ServiceHistorySchema);