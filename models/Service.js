const mongoose = require('mongoose');
 
const ServiceAssignmentSchema = new mongoose.Schema({
  vehicleVIN: { type: String, required: true, index: true },
  serviceType: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  dueServiceDate: { type: Date, default: null },
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'TechnicianRegister', default: null },
  technicianName: { type: String, default: null },
  status: {
    type: String,
    enum: ['Unassigned', 'Assigned', 'Work In Progress', 'Completed'],
    default: 'Unassigned'
  },
  assignmentDate: { type: Date, default: null },
  completedOn: { type: Date, default: null },
  payment: {
    paymentStatus: { type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' },
    cost: { type: Number, default: 0 },
    historyId: { type: mongoose.Schema.Types.ObjectId, ref: 'History', default: null }
  }
}, { timestamps: true });

ServiceAssignmentSchema.index({ vehicleVIN: 1, serviceType: 1 });

module.exports = mongoose.model('ServiceAssignment', ServiceAssignmentSchema);