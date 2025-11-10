const Vehicle = require("../models/Vehicle");
const Technician = require("../models/TechnicianRegister");
const Service = require("../models/Service");
const History = require("../models/History");

// GET /api/scheduling/vehicle/:id
// Fetch a vehicle by VIN
exports.getVehicle = async (req, res) => {
  const vin = req.params.id;
  const vehicle = await Vehicle.findOne({ VIN: vin }).lean();
  if (!vehicle) return res.status(400).json({ error: "Vehicle not found" });
  res.json({ vehicle });
};

// GET /api/scheduling/available-technicians
exports.getTechnitian = async (req, res) => {
  // Get current weekday name (e.g., "monday")
  const curr_day = new Date()
    .toLocaleString("en-US", { weekday: "long" })
    .toLowerCase();

  const { serviceType } = req.query; // optional filter by service type

  // Build query: technicians available today
  const query = {
    availability: curr_day,
  };

  if (serviceType) {
    query.skills = serviceType; // filter by skill if provided
  }

  const technicians = await Technician.find(query).lean();

  // Filter out technicians who already have an active unpaid service
  const filtered = await Promise.all(
    technicians.map(async (tech) => {
      const activeService = await Service.findOne({
        technicianId: tech._id,
        status: { $ne: "Completed" },
        "payment.paymentStatus": { $ne: "Paid" },
      });
      return activeService ? null : tech;
    })
  );

  // Return only available technicians with basic info
  res.json({
    technician: filtered.filter(Boolean).map((tech) => ({
      _id: tech._id,
      name: `${tech.firstName} ${tech.lastName}`.trim(),
      skills: tech.skills,
      availability: tech.availability,
    })),
  });
};

// POST /api/scheduling/schedule
// Schedule a service for a vehicle (update existing unassigned service or create new one)
exports.specificScheduleService = async (req, res) => {
  try {
    const {
      vehicleVIN,
      vehicleId,
      serviceType,
      dueServiceDate,
      description,
      technicianId,
    } = req.body;

    // Resolve vehicle by VIN or ID
    let vin = vehicleVIN || vehicleId;
    if (!vin)
      return res
        .status(400)
        .json({ error: "vehicleVIN or vehicleId is required" });

    let vehicle = null;
    if (vehicleVIN) vehicle = await Vehicle.findOne({ VIN: vehicleVIN });
    else vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(400).json({ error: "Vehicle not found" });

    // Determine serviceType: prefer provided, else fallback to existing unassigned service
    let svcType = serviceType;
    const existingUnassigned = await Service.findOne({
      vehicleVIN: vehicle.VIN,
      status: "Unassigned",
    }).sort({ createdAt: -1 });
    if (!svcType && existingUnassigned)
      svcType = existingUnassigned.serviceType;
    if (!svcType)
      return res.status(400).json({ error: "serviceType is required" });

    // If an unassigned service exists, update it instead of creating new
    if (existingUnassigned) {
      // Validate technician if provided (skills, availability, not busy)
      if (technicianId) {
        const tech = await Technician.findById(technicianId).lean();
        if (!tech)
          return res.status(400).json({ error: "Technician not found" });

        // Check skill match
        const hasSkill =
          Array.isArray(tech.skills) &&
          tech.skills.some(
            (s) => String(s).toLowerCase() === String(svcType).toLowerCase()
          );
        if (!hasSkill)
          return res
            .status(400)
            .json({ error: "Technician does not have the required skill" });

        // Check availability for today
        const weekdayNames = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ];
        const todayDay = weekdayNames[new Date().getDay()];
        const availabilityArray = Array.isArray(tech.availability)
          ? tech.availability.map((d) => String(d).toLowerCase())
          : [String(tech.availability || "").toLowerCase()];
        if (!availabilityArray.includes(todayDay))
          return res
            .status(400)
            .json({ error: `Technician is not available today (${todayDay})` });

        // Check if technician already busy
        const busy = await Service.findOne({
          technicianId: technicianId,
          status: { $ne: "Completed" },
          _id: { $ne: existingUnassigned._id },
        });
        if (busy)
          return res
            .status(400)
            .json({ error: "Technician already has an active assignment" });

        // Attach technician info
        existingUnassigned.technicianId = technicianId;
        existingUnassigned.technicianName = (
          (tech.firstName || "") +
          " " +
          (tech.lastName || "")
        ).trim();
      }

      // Update service fields
      existingUnassigned.serviceType = svcType;
      existingUnassigned.description =
        description || existingUnassigned.description;
      existingUnassigned.dueServiceDate =
        dueServiceDate || existingUnassigned.dueServiceDate;
      await existingUnassigned.save();

      return res.status(200).json({
        message: "Service updated",
        serviceId: existingUnassigned._id,
      });
    }

    // Otherwise, create a new service document
    const serviceDoc = new Service({
      vehicleVIN: vehicle.VIN,
      serviceType: svcType,
      description: description || "",
      dueServiceDate: dueServiceDate || null,
      status: "Unassigned",
      createdAt: new Date(),
    });

    // If technicianId provided, validate and attach technician info
    if (technicianId) {
      const tech = await Technician.findById(technicianId).lean();
      if (!tech) return res.status(400).json({ error: "Technician not found" });

      // Check skill
      const hasSkill =
        Array.isArray(tech.skills) &&
        tech.skills.some(
          (s) => String(s).toLowerCase() === String(svcType).toLowerCase()
        );
      if (!hasSkill)
        return res
          .status(400)
          .json({ error: "Technician does not have the required skill" });

      // Check availability for today
      const weekdayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const todayDay = weekdayNames[new Date().getDay()];
      const availabilityArray = Array.isArray(tech.availability)
        ? tech.availability.map((d) => String(d).toLowerCase())
        : [String(tech.availability || "").toLowerCase()];
      if (!availabilityArray.includes(todayDay))
        return res
          .status(400)
          .json({ error: `Technician is not available today (${todayDay})` });

      // Check if technician already busy
      const busy = await Service.findOne({
        technicianId: technicianId,
        status: { $ne: "Completed" },
      });
      if (busy)
        return res
          .status(400)
          .json({ error: "Technician already has an active assignment" });

      // Attach technician info
      serviceDoc.technicianId = technicianId;
      serviceDoc.technicianName = (
        (tech.firstName || "") +
        " " +
        (tech.lastName || "")
      ).trim();
    }

    const saved = await serviceDoc.save();
    return res
      .status(200)
      .json({ message: "Service scheduled", serviceId: saved._id });
  } catch (err) {
    console.error("specificScheduleService error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/scheduling/scheduledServices
// Fetch all scheduled services
exports.getSchechuledServices = async (req, res) => {
  const services = await Service.find().lean();
  res.json({ scheduled_services: services });
};

// POST 
// Mark a service as completed and optionally mark payment as paid
exports.completeService = async (req, res) => {
  try {
    const { serviceId, paymentStatus, cost } = req.body;
    if (!serviceId)
      return res.status(400).json({ error: "serviceId is required" });

    const service = await Service.findById(serviceId);
    if (!service) return res.status(400).json({ error: "Service not found" });

    // Mark service as completed
    const now = new Date();
    if (!service.completedOn) service.completedOn = now;
    service.status = "Completed";

    // Handle payment if marked as paid
    if (paymentStatus && String(paymentStatus).toLowerCase() === "paid") {
      service.payment.paymentStatus = "Paid";
      service.payment.cost =
        typeof cost === "number"
          ? cost
          : Number(cost) || service.payment.cost || 0;
    }

    await service.save();

    let historyDoc = null;
    // If payment is paid, create history record and update vehicle
    if (service.payment.paymentStatus === "Paid") {
      historyDoc = new History({
        serviceId: service._id,
        vehicleVIN: service.vehicleVIN,
        technicianId: service.technicianId,
        technicianName: service.technicianName || "",
        serviceType: service.serviceType,
        dueServiceDate: service.dueServiceDate || null,
        paymentStatus: "Paid",
        cost: service.payment.cost || 0,
        workStatus: "Completed",
      });

      // Save the newly created history document to the database
      await historyDoc.save();

      // Update the related vehicle record
      const vehicle = await Vehicle.findOne({ VIN: service.vehicleVIN });
      if (vehicle) {
        // Ensure serviceDetails array exists
        vehicle.serviceDetails = vehicle.serviceDetails || [];

        // Add a new entry for this completed service
        vehicle.serviceDetails.push({
          serviceCompletedOn: service.completedOn, // when the service was completed
          serviceType: service.serviceType, // type of service performed
          technicianId: service.technicianId, // technician who performed it
        });

        // Update the vehicle's lastServiceDate to this service's completion date
        vehicle.lastServiceDate = service.completedOn;

        // Save updated vehicle record
        await vehicle.save();
      }

      // Link the history record back to the service
      service.payment.historyId = historyDoc._id; // store reference to history
      await service.save(); // persist changes to service
    }

    // Send response back to client
    res.json({
      message: "Service marked completed",
      serviceId: service._id.toString(),
      completedOn: service.completedOn,
      historyId: historyDoc ? historyDoc._id.toString() : null,
    });
  } catch (err) {
    console.error("completeService error", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET api/scheduling/unassigned
// Fetch all unassigned services (only accessible by admins)
exports.getUnassignedServices = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") { // Authorization check: only admins can access
      return res.status(400).json({ error: "Access denied. Admins only." });
    }

    // Find services that have no technician assigned
    const unassignedServices = await Service.find({
      technicianId: null,
      technicianName: null,
    }).lean();

    // For each unassigned service, fetch related vehicle details
    const enriched = await Promise.all(
      unassignedServices.map(async (svc) => {
        const vehicle = await Vehicle.findOne({ VIN: svc.vehicleVIN }).lean();
        return {
          ...svc,
          vehicleType: vehicle?.type || "",
          vehicleMake: vehicle?.make || "",
          vehicleModel: vehicle?.model || "",
          vehicleYear: vehicle?.year || null,
          lastServiceDate: vehicle?.lastServiceDate || null,
        };
      })
    );

    // Return enriched list of unassigned services with vehicle info
    res.json({ unassigned_services: enriched });
  } catch (err) {
    console.error("getUnassignedServices error", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
