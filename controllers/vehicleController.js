const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service");

const brands = [
  "Toyota",
  "Honda",
  "Ford",
  "Chevrolet",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Hyundai",
  "Kia",
  "Volkswagen",
  "Nissan",
  "Tata",
  "Mahindra",
  "Suzuki",
  "Renault",
];
const vehicleTypes = ["Car", "Truck"];

// POST /api/vehicles
// Create a new vehicle record
exports.createVehicle = async (req, res) => {
  try {
    const { type, make, model, year, VIN, LastServiceDate } = req.body;

    // Validate brand
    if (!make || !brands.includes(make)) {
      return res
        .status(400)
        .json({ message: "Service not available for this brand" });
    }

    // Validate type
    if (!type)
      return res.status(400).json({ message: "Vehicle type is required" });
    const normalizedType =
      type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    if (!vehicleTypes.includes(normalizedType)) {
      return res
        .status(400)
        .json({ message: "Service not available for this vehicle type" });
    }

    // Validate last service date (must not be invalid or in the future)
    const parsedDate = LastServiceDate ? new Date(LastServiceDate) : null;
    const today = new Date();
    if (parsedDate && (isNaN(parsedDate.getTime()) || parsedDate > today)) {
      return res
        .status(400)
        .json({ message: "Invalid or future last service date" });
    }

    // Validate VIN
    if (!VIN) return res.status(400).json({ message: "VIN is required" });

    // Check for duplicate VIN
    const existing = await Vehicle.findOne({ VIN });
    if (existing)
      return res
        .status(400)
        .json({ message: "Vehicle with this VIN already exists" });

    // Create new vehicle document
    const vehicleDoc = new Vehicle({
      VIN,
      type: normalizedType,
      make,
      model,
      year,
      lastServiceDate: parsedDate || null,
      odometerReadings: [], // initialize empty readings
      serviceDetails: [], // initialize empty service details
    });

    // Save to DB
    const saved = await vehicleDoc.save();
    res.status(200).json(saved);
  } catch (err) {
    console.error("createVehicle error", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/vehicles
// Fetch all vehicles (only supported brands/types) and enrich with service info
exports.getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find().lean();

    // Filter only supported brands and types
    const filtered = vehicles.filter(
      (v) => brands.includes(v.make) && vehicleTypes.includes(v.type)
    );

    if (filtered.length === 0) {
      return res
        .status(400)
        .json({ message: "No Vehicles Available for supported brands/types" });
    }

    // Enrich each vehicle:
    // - nextServiceMileage (if set)
    // - hasOpenUnpaidService (true if unpaid/open service exists)
    const enriched = await Promise.all(
      filtered.map(async (v) => {
        const unpaid = await Service.findOne({
          vehicleVIN: v.VIN,
          status: { $ne: "Completed" },
          $or: [
            { "payment.paymentStatus": { $exists: false } },
            { "payment.paymentStatus": { $ne: "Paid" } },
          ],
        }).lean();

        return {
          ...v,
          nextServiceMileage:
            v.nextServiceMileage !== undefined && v.nextServiceMileage !== null
              ? v.nextServiceMileage
              : null,
          hasOpenUnpaidService: Boolean(unpaid),
        };
      })
    );

    res.status(200).json(enriched);
  } catch (err) {
    console.error("getVehicles error", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET 
// Fetch a single vehicle by VIN
exports.getVehicle = async (req, res) => {
  try {
    const vin = req.params.id;
    const vehicle = await Vehicle.findOne({ VIN: vin }).lean();

    if (!vehicle) {
      return res.status(400).json({ message: "Vehicle not found" });
    }

    // Ensure brand and type are supported
    if (
      !brands.includes(vehicle.make) ||
      !vehicleTypes.includes(vehicle.type)
    ) {
      return res
        .status(400)
        .json({ message: "Vehicle type or brand not supported" });
    }

    res.status(200).json(vehicle);
  } catch (err) {
    console.error("getVehicle error", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
