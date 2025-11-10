const Vehicle = require('../models/Vehicle');
const Service = require('../models/Service');
const Technician = require('../models/TechnicianRegister');

// GET /api/dashboard/summary
// This endpoint computes and returns a summary of key statistics
exports.getSummary = async (req, res) => {
  try {
    const totalVehicals = await Vehicle.countDocuments(); // Count total number of vehicles
    const scheduledServices = await Service.countDocuments(); // // Count total number of services scheduled
    const inProgress = await Service.countDocuments({ //Count services that are currently in progress or assigned
      status: { $in: ['Work In Progress', 'Assigned'] }, 
    });

    // Count services that have been completed
    const completed = await Service.countDocuments({ status: 'Completed' });

    // Find distinct technician IDs who are currently assigned or working
    const activeTechnicianIds = await Service.distinct('technicianId', {
      status: { $in: ['Work In Progress', 'Assigned'] },
    });

    // Filter out null/undefined values and count active technicians
    const activeTechnicians = activeTechnicianIds.filter(Boolean).length;

    // Count total number of technicians registered in the system
    const totalTechnicians = await Technician.countDocuments();

    // Respond with a JSON object containing all summary statistics
    res.json({
      totalVehicals,
      scheduledServices,
      inProgress,
      completed,
      activeTechnicians,
      totalTechnicians
    });
  } catch (err) {
    console.error('Error reading summary data', err);
    res.status(500).json({ error: 'Failed to compute dashboard summary' });
  }
};
