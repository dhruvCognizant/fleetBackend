const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service");

const pad = (num) => String(num).padStart(3, "0");

// POST /api/vehicles/new/odometer
// Adds a new odometer reading for a vehicle and may trigger a new service record
exports.addOdometerReading = async (req, res) => {
  try {
    const { mileage, serviceType } = req.body; // mileage and service type from request body
    const vin = req.params.id; // vehicle VIN from URL parameter

    // Validate mileage input
    if (typeof mileage !== "number") {
      return res.status(400).json({ message: "mileage must be a number" });
    }

    // Find vehicle by VIN
    const vehicle = await Vehicle.findOne({ VIN: vin });
    if (!vehicle)
      return res.status(400).json({ message: "Vehicle VIN does not exist." });

    // Find the latest odometer reading by date (if any exist)
    let latest = null;
    if (vehicle.odometerReadings && vehicle.odometerReadings.length > 0) {
      latest = vehicle.odometerReadings.reduce((a, b) =>
        new Date(a.date) > new Date(b.date) ? a : b
      );
    }

    const now = new Date();

    // Validate against latest reading
    if (latest) {
      if (mileage <= latest.mileage) {
        return res
          .status(400)
          .json({
            message: "Mileage must be greater than the last recorded value.",
          });
      }
      if (now < new Date(latest.date)) {
        return res
          .status(400)
          .json({ message: "Request can't be processed right now." });
      }
    }

    // Decide service interval increment based on vehicle type
    // Trucks: 20,000 km, Cars: 10,000 km
    const increment =
      vehicle.type && String(vehicle.type).toLowerCase() === "truck"
        ? 20000
        : 10000;
    const computedNextServiceMileage = mileage + increment;

    // Prevent adding a reading if there is an existing unpaid/open service
    const existingUnpaidService = await Service.findOne({
      vehicleVIN: vin,
      status: { $ne: "Completed" },
      $or: [
        { "payment.paymentStatus": { $exists: false } },
        { "payment.paymentStatus": { $ne: "Paid" } },
      ],
    });

    if (existingUnpaidService) {
      return res
        .status(400)
        .json({
          message:
            "Existing unpaid service present; cannot add odometer reading until service is paid or completed",
          serviceId: existingUnpaidService._id,
        });
    }

    // Prepare new reading (not saved yet)
    const nextIndex =
      vehicle.odometerReadings && vehicle.odometerReadings.length
        ? vehicle.odometerReadings.length + 1
        : 1;
    const newReadingId = "R" + pad(nextIndex);
    const newReading = { readingId: newReadingId, mileage, date: now };

    // Decide whether to create a new service
    let createdService = null;
    const hasNextServiceMileage =
      vehicle.nextServiceMileage !== undefined &&
      vehicle.nextServiceMileage !== null &&
      vehicle.nextServiceMileage !== 0;

    if (!hasNextServiceMileage) {
      // Case 1: Initial reading (no nextServiceMileage set yet)
      if (mileage <= 0) {
        return res
          .status(400)
          .json({ message: "Invalid mileage for initial reading" });
      }

      if (!serviceType || !String(serviceType).trim()) {
        return res
          .status(400)
          .json({
            message: "serviceType is required when creating an initial service",
          });
      }

      // Create a new service record
      const svcType = String(serviceType).trim();
      const svc = new Service({
        vehicleVIN: vin,
        serviceType: svcType,
        status: "Unassigned",
        createdAt: now,
        readingId: newReading.readingId,
      });
      createdService = await svc.save();

      /// Save reading and set nextServiceMileage
      vehicle.odometerReadings = vehicle.odometerReadings || [];
      vehicle.odometerReadings.push(newReading);
      vehicle.nextServiceMileage = computedNextServiceMileage;
    } else {
      // Case 2: Vehicle already has a nextServiceMileage set
      if (mileage < vehicle.nextServiceMileage) {
        return res
          .status(400)
          .json({
            message:
              "Mileage is less than nextServiceMileage; reading not added until due",
          });
      }

      if (!serviceType || !String(serviceType).trim()) {
        return res
          .status(400)
          .json({
            message:
              "serviceType is required when mileage meets or exceeds nextServiceMileage",
          });
      }

      // Create a new service record
      const svcType = String(serviceType).trim();
      const svc = new Service({
        vehicleVIN: vin,
        serviceType: svcType,
        status: "Unassigned",
        createdAt: now,
        readingId: newReading.readingId,
      });
      createdService = await svc.save();

      // Save reading and update nextServiceMileage
      vehicle.odometerReadings = vehicle.odometerReadings || [];
      vehicle.odometerReadings.push(newReading);
      vehicle.nextServiceMileage = computedNextServiceMileage;
    }

    // Save updated vehicle record
    await vehicle.save();

    // Build response object
    const resp = {
      reading: newReading,
      nextServiceMileage: vehicle.nextServiceMileage,
    };
    if (createdService) {
      resp.serviceId = createdService._id;
    }

    return res.status(200).json(resp);
  } catch (err) {
    console.error("addOdometerReading error", err);
    return res
      .status(500)
      .json({ message: "Error adding odometer reading", error: err.message });
  }
};

// GET /api/vehicles/new/odometer
// Fetch all odometer readings for a vehicle
exports.getodometerReading = async (req, res) => {
  try {
    const vin = req.params.id; // Extract VIN from request URL parameter

    // Look up the vehicle in the database by VIN
    // .lean() returns a plain JS object instead of a full Mongoose document (faster for read-only)
    const vehicle = await Vehicle.findOne({ VIN: vin }).lean();
    // If no vehicle found
    if (!vehicle)
      return res
        .status(400)
        .json({ message: "No entries available for this vehicle." });

    // Get odometer readings array (or empty if not set)
    const readings = vehicle.odometerReadings || [];

    // If no readings exist
    if (readings.length === 0)
      return res
        .status(400)
        .json({ message: "No entries available for this vehicle." });

    // Success: return all odometer readings as JSON
    res.status(200).json(readings);
  } catch (err) {
    console.error("getodometerReading error", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
