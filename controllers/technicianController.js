const ServiceModel = require("../models/Service");
const TechnicianModel = require("../models/TechnicianRegister");
const jwt = require("jsonwebtoken");

// GET /api/technician/unassigned-services
// Fetch list of services that are scheduled but not yet assigned
exports.getUnassignedServices = async (req, res) => {
  try {
    const services = await ServiceModel.find({
      status: "Unassigned",
      technicianId: { $ne: null }, // services with no technician assigned
    }).lean();

    console.log("Unassigned services fetched:", services);

    if (!services.length) {
      return res.status(400).json({ message: "No Unassigned Services" });
    }

    res.status(200).json(services);
  } catch (err) {
    console.error("getUnassignedServices error", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/technician/assignments
// Creates an official task assignment for a scheduled service
exports.createAssignment = async (req, res) => {
  try {
    const { serviceId } = req.body;
    if (!serviceId) {
      return res.status(400).json({ message: "Service ID is required." });
    }

    // Find service in DB
    const service = await ServiceModel.findById(serviceId);
    if (!service)
      return res
        .status(400)
        .json({ message: "Corresponding service schedule not found." });

    // Technician must already be set on the service
    const techIdToUse = service.technicianId;
    if (!techIdToUse)
      return res.status(400).json({
        message:
          "No technician specified on this service. Provide technicianId when scheduling or call assignment with technicianId.",
      });

    // Find technician in DB
    const tech = await TechnicianModel.findById(techIdToUse).lean();
    if (!tech) return res.status(400).json({ message: "Technician not found" });

    // Check required skill
    const requiredServiceType = service.serviceType;
    if (!requiredServiceType)
      return res
        .status(400)
        .json({ message: "Service record missing serviceType" });
    const hasSkill =
      Array.isArray(tech.skills) &&
      tech.skills.some(
        (s) =>
          String(s).toLowerCase() === String(requiredServiceType).toLowerCase()
      );
    if (!hasSkill)
      return res.status(400).json({
        message: "Technician does not have the required skill for this service",
      });

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
    if (!availabilityArray.includes(todayDay)) {
      return res
        .status(400)
        .json({ message: `Technician is not available today (${todayDay})` });
    }

    // Prevent double-booking
    const busy = await ServiceModel.findOne({
      technicianId: techIdToUse,
      status: { $ne: "Completed" },
      _id: { $ne: service._id },
    });
    if (busy)
      return res
        .status(400)
        .json({ message: "Technician already has an active assignment" });

    // Set status to Assigned and record assignmentDate
    service.status = "Assigned";
    service.assignmentDate = new Date();
    await service.save();

    return res.status(200).json({
      message: "Service assigned",
      serviceId: service._id,
      technicianName: `${tech.firstName} ${tech.lastName}`.trim(),
    });
  } catch (err) {
    console.error("createAssignment error", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// PATCH /api/technician/assignments/:id/status
// Allows a technician to update the status of their assigned task
exports.updateAssignmentStatus = async (req, res) => {
  try {
    const serviceId = req.params.id; // Service._id from URL
    const { status } = req.body;
    const technicianId = req.user && (req.user.id || req.user._id); // authenticated technician

    if (!status) return res.status(400).json({ message: "status is required" });

    const service = await ServiceModel.findById(serviceId);
    if (!service) return res.status(400).json({ message: "Service not found" });

    // Ensure requester is the assigned technician
    if (
      !service.technicianId ||
      String(service.technicianId) !== String(technicianId)
    ) {
      return res
        .status(400)
        .json({ message: "You are not assigned to this service" });
    }

    // Update status
    service.status = status;
    if (String(status).toLowerCase() === "completed") {
      service.technicianCompletedOn = new Date();
      service.completedOn = new Date();
    }

    await service.save();

    return res.status(200).json({
      message: "Assignment status updated",
      serviceId: service._id,
      status: service.status,
      technicianCompletedOn: service.technicianCompletedOn || null,
    });
  } catch (err) {
    console.error("updateAssignmentStatus error", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// GET /api/technician/assignments
// Fetch list of assignments for a specific technician or all if admin
exports.getAllTechnicianAssignments = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(400).json({ message: "Missing token" });

    // Verify token and extract payload
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const credentialId = payload.id;
    const role = payload.role; // role must be included in token

    // Admin: fetch all services with status Assigned or Completed
    if (role === "admin") {
      const allServices = await ServiceModel.find({
        status: { $in: ["Assigned", "Completed"] },
      })
        .populate("technicianId", "firstName lastName") 
        .lean(); // include technician details
      return res.status(200).json(allServices);
    }

    if (role === "technician") {
      // Technician: fetch only their own assignments
      const technician = await TechnicianModel.findOne({
        credential: credentialId,
      });
      if (!technician)
        return res.status(400).json({ message: "Technician not found" });

      const services = await ServiceModel.find({
        technicianId: technician._id,
        status: { $in: ["Assigned", "Completed"] },
      })
        .populate("technicianId", "firstName lastName")
        .lean();

      if (!services.length) {
        return res
          .status(400)
          .json({ message: "No assignments found for this technician" });
      }

      return res.status(200).json(services);
    }

    // Unauthorized role
    return res.status(400).json({ message: "Unauthorized role" });
  } catch (err) {
    console.error("getAllTechnicianAssignments error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
