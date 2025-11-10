const mongoose = require('mongoose');
 
const OdometerReadingSchema = new mongoose.Schema({
  readingId: { type: String },
  mileage: { type: Number, required: true },
  date: { type: Date, required: true }
});
 
const ServiceDetailSchema = new mongoose.Schema({ // one to many with services requests
  serviceCompletedOn: { type: Date, required: true }, // take from completedOn of service and use sort to get latest date and store in LastServiceDate
  serviceType: { type: String, required: true },
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'TechnicianRegister', required: true }
});
 
const VehicleSchema = new mongoose.Schema({
  // vehicleId: { type: String, unique: true, required: true },
  VIN: { type: String, unique: true, required: true }, // use this as vehicleId as its unique
  type: {
    type: String,
    required: true,
    enum: ['Car', 'Truck'],  
  },  
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  lastServiceDate: { type: Date, default: null },
  nextServiceMileage: { type: Number, default: null },
  // nextServiceDate: { type: Date, default: null }, // use only mileage updates
  dueServiceDate: { type: Date, default: null },
  ownerName: { type: String, default: '' },
  odometerReadings: [OdometerReadingSchema],
  serviceDetails: [ServiceDetailSchema] // make this embedded or object whatever is easy
});
 
 
module.exports = mongoose.model('Vehicle', VehicleSchema);