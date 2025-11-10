const request = require("supertest");
const chai = require("chai");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Credential = require("../models/Credential");
const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service");
const Technician = require("../models/TechnicianRegister");
const { expect } = chai;

// Helper to get today's weekday name in lowercase (e.g., "monday")
const getTodayWeekday = () => {
  return new Date()
    .toLocaleString("en-US", { weekday: "long" })
    .toLowerCase();
};

const ADMIN_USER = {
  email: "admin@admin.com",
  password: "Admin@123",
  role: "admin",
};

let token;
let testVehicle;
let validTechnician, busyTechnician;
let busyService;
const todayWeekday = getTodayWeekday();

describe("POST /api/scheduling/schedule", () => {
  beforeEach(async () => {
    // Clear all relevant collections
    await Credential.deleteMany({});
    await Vehicle.deleteMany({});
    await Service.deleteMany({});
    await Technician.deleteMany({});

    // 1. Create Admin User and Token
    const hashedPassword = await bcrypt.hash(ADMIN_USER.password, 10);
    const admin = await Credential.create({
      email: ADMIN_USER.email.toLowerCase(),
      password: hashedPassword,
      role: ADMIN_USER.role,
    });

    token = jwt.sign(
      { id: admin._id, role: admin.role, jti: "test-jti-schedule" },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "15m" }
    );

    // 2. Create a Vehicle
    testVehicle = await Vehicle.create({
      VIN: "VIN123456",
      type: "Car",
      make: "Hyundai",
      model: "i20",
      year: 2023,
      lastServiceDate: "2023-01-01",
    });

    // 3. Create Technicians for various scenarios
    const [cred1, cred4] = await Credential.create([
      {
        email: "valid@fleet.com",
        password: hashedPassword,
        role: "technician",
      },
      {
        email: "busy@fleet.com",
        password: hashedPassword,
        role: "technician",
      },
    ]);

    validTechnician = await Technician.create({
      firstName: "Valid",
      lastName: "Tech",
      email: "valid@fleet.com",
      credential: cred1._id,
      skills: ["Oil Change"],
      availability: [todayWeekday], // Available today
    });

    busyTechnician = await Technician.create({
      firstName: "Busy",
      lastName: "Tech",
      email: "busy@fleet.com",
      credential: cred4._id,
      skills: ["Oil Change"],
      availability: [todayWeekday],
    });

    // 4. Create an active service to make 'busyTechnician' busy
    busyService = await Service.create({
      vehicleVIN: "OTHERVIN",
      serviceType: "Oil Change",
      status: "Work In Progress", // Active status
      technicianId: busyTechnician._id,
    });
  });

  it("should return 400 if vehicleVIN is missing", async () => {
    const res = await request(app)
      .post("/api/scheduling/schedule")
      .set("Authorization", `Bearer ${token}`)
      .send({
        // vehicleVIN: testVehicle.VIN,
        serviceType: "Oil Change",
      });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.include("vehicleVIN or vehicleId is required");
  });

  it("should return 400 if vehicle is not found", async () => {
    const res = await request(app)
      .post("/api/scheduling/schedule")
      .set("Authorization", `Bearer ${token}`)
      .send({
        vehicleVIN: "INVALIDVIN",
        serviceType: "Oil Change",
      });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.include("Vehicle not found");
  });

  it("should create a new service and assign a valid technician", async () => {
    const res = await request(app)
      .post("/api/scheduling/schedule")
      .set("Authorization", `Bearer ${token}`)
      .send({
        vehicleVIN: testVehicle.VIN,
        serviceType: "Oil Change",
        technicianId: validTechnician._id.toString(),
      });

    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal("Service scheduled");
    expect(res.body).to.have.property("serviceId");

    const newService = await Service.findById(res.body.serviceId);
    expect(newService).to.exist;
    expect(newService.technicianId.toString()).to.equal(
      validTechnician._id.toString()
    );
    expect(newService.technicianName).to.equal("Valid Tech");
    expect(newService.status).to.equal("Unassigned");
  });

  it("should return 400 if technician is already busy", async () => {
    // 'busyTechnician' was made busy in the beforeEach block
    const res = await request(app)
      .post("/api/scheduling/schedule")
      .set("Authorization", `Bearer ${token}`)
      .send({
        vehicleVIN: testVehicle.VIN,
        serviceType: "Oil Change",
        technicianId: busyTechnician._id.toString(), // Is already busy
      });

    expect(res.status).to.equal(400);
    expect(res.body.error).to.equal(
      "Technician already has an active assignment"
    );
  });

  it("should UPDATE an existing 'Unassigned' service instead of creating a new one", async () => {
    // 1. Create an existing unassigned service
    const existingService = await Service.create({
      vehicleVIN: testVehicle.VIN,
      serviceType: "Old Service Type",
      status: "Unassigned",
      description: "Original description",
    });
    const initialServiceCount = await Service.countDocuments();

    // 2. Call schedule endpoint again for the same vehicle
    const res = await request(app)
      .post("/api/scheduling/schedule")
      .set("Authorization", `Bearer ${token}`)
      .send({
        vehicleVIN: testVehicle.VIN,
        serviceType: "Oil Change", // CHANGED: Was "New Service Type"
        description: "New description", // Update description
        technicianId: validTechnician._id.toString(), // Add a technician
      });

    // 3. Check response
    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal("Service updated");
    // Ensure it's the *same* service ID
    expect(res.body.serviceId).to.equal(existingService._id.toString());

    // 4. Check DB
    const finalServiceCount = await Service.countDocuments();
    expect(finalServiceCount).to.equal(initialServiceCount); // No new service created

    const updatedService = await Service.findById(existingService._id);
    expect(updatedService.serviceType).to.equal("Oil Change"); 
    expect(updatedService.description).to.equal("New description");
    expect(updatedService.technicianId.toString()).to.equal(
      validTechnician._id.toString()
    );
  });
});