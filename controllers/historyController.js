const Service = require("../models/Service");
const Vehicle = require("../models/Vehicle");
const History = require("../models/History");

// POST /api/history/addService
// creates a history entry if paid, and updates vehicle info.
exports.addServiceRecord = async (req, res) => {
  try {
    const { serviceId, paymentStatus, cost } = req.body; // Extract from request body
    if (!serviceId || !paymentStatus) {
      // Validate required input
      return res
        .status(400)
        .json({ message: "serviceId and paymentStatus are required" });
    }

    // Find the service record by ID
    const service = await Service.findById(serviceId);
    if (!service) return res.status(400).json({ message: "Service not found" });

    const now = new Date();

    // Ensure payment object exists
    service.payment = service.payment || {};

    // Update payment status
    service.payment.paymentStatus = paymentStatus;

    // Update cost if provided
    if (typeof cost === "number") {
      service.payment.cost = cost;
    }

    // If payment status is "Paid"
    let historyDoc = null;
    if (String(paymentStatus).toLowerCase() === "paid") {
      if (!service.completedOn) service.completedOn = now; // Mark service as completed if not already

      // Create a new history record for this service
      historyDoc = new History({
        serviceId: service._id,
        vehicleVIN: service.vehicleVIN,
        technicianId: service.technicianId || null,
        technicianName: service.technicianName || "",
        serviceType: service.serviceType || "",
        dueServiceDate: service.dueServiceDate || null,
        paymentStatus: "Paid",
        cost: typeof cost === "number" ? cost : service.payment.cost || 0,
        workStatus: service.status || "Completed",
      });

      // Save history record
      await historyDoc.save();

      // Update service payment details with history reference
      service.payment.paymentStatus = "Paid";
      service.payment.cost = cost;
      service.payment.historyId = historyDoc._id;
    }

    // Update vehicle record
    const vehicle = await Vehicle.findOne({ VIN: service.vehicleVIN });
    if (vehicle) {
      vehicle.lastServiceDate = now; // Update last service date
      vehicle.serviceDetails = vehicle.serviceDetails || []; // Ensure serviceDetails array exists

      // Push new service detail entry
      vehicle.serviceDetails.push({
        serviceId: service._id,
        serviceType: service.serviceType,
        technicianId: service.technicianId || null,
        serviceCompletedOn: now,
        cost: service.payment.cost || 0,
      });
      await vehicle.save();
    }

    // Save updated vehicle record
    await service.save();

    // Respond with success message and IDs
    return res.status(200).json({
      message: "Payment status updated",
      serviceId: service._id,
      historyId: historyDoc ? historyDoc._id : null,
    });
  } catch (err) {
    console.error("addServiceRecord error", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// GET /api/history/serviceHistory
// Fetch all service history records from MongoDB
exports.getAllHistories = async (req, res) => {
  try {
    const History = require("../models/History");
    const histories = await History.find().lean();
    res.status(200).json(histories);
  } catch (err) {
    console.error("Error fetching histories:", err);
    res.status(500).json({ message: "Failed to fetch service histories" });
  }
};
