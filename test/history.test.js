const request = require("supertest");
const chai = require("chai");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken"); 
const app = require("../app");
const Credential = require("../models/Credential");
const Vehicle = require("../models/Vehicle"); 
const Service = require("../models/Service"); 
const History = require("../models/History"); 
const Technician = require("../models/TechnicianRegister"); 
const { expect } = chai;

const BASE = "/api/history";

const ADMIN_USER = {
  email: "admin@admin.com",
  password: "Admin@123",
  role: "admin",
};

let token;
let testService;
let testVehicle;
let dummyTechnician; 

describe("History API (/api/history)", () => {
  beforeEach(async () => {
    // Clear all relevant collections
    await Credential.deleteMany({});
    await Vehicle.deleteMany({});
    await Service.deleteMany({});
    await History.deleteMany({});
    await Technician.deleteMany({}); 

    // 1. Create Admin User and Token
    const hashedPassword = await bcrypt.hash(ADMIN_USER.password, 10);
    const admin = await Credential.create({
      email: ADMIN_USER.email.toLowerCase(),
      password: hashedPassword,
      role: ADMIN_USER.role,
    });

    // Generate a token with 'jti' as your passport config uses it
    token = jwt.sign(
      { id: admin._id, role: admin.role, jti: "test-jti-history" },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "15m" }
    );

    // 2. Create a Vehicle
    testVehicle = await Vehicle.create({
      VIN: "TESTVIN123",
      type: "Car",
      make: "Toyota",
      model: "Camry",
      year: 2020,
      lastServiceDate: new Date("2023-01-01"),
    });

    // 3. Create a dummy Technician
    dummyTechnician = await Technician.create({
      firstName: "Dummy",
      lastName: "Tech",
      email: "dummy@fleet.com",
      skills: ["Oil Change"],
      availability: ["monday"],
    });

    // 4. Create a Service record to be updated
    testService = await Service.create({
      vehicleVIN: testVehicle.VIN,
      serviceType: "Oil Change",
      status: "Completed", // Assume service is done, just needs payment
      technicianId: dummyTechnician._id, // Attach the technician
      technicianName: "Dummy Tech", // Add the name
      payment: {
        paymentStatus: "Unpaid",
        cost: 0,
      },
    });
  });

  // Test 1: Validation failure (serviceId missing)
  it("should return 400 if serviceId is missing", async () => {
    const invalidHistory = {
      // serviceId is missing
      paymentStatus: "Paid",
      cost: 1500,
    };

    const res = await request(app)
      .post(`${BASE}/addService`)
      .set("Authorization", `Bearer ${token}`)
      .send(invalidHistory);

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("message");
    expect(res.body.message.toLowerCase()).to.include("serviceid");
  });

  // Test 2: Auth failure (invalid token)
  it("should return 401 if token is invalid", async () => {
    const validHistory = {
      serviceId: testService._id.toString(), // Use a valid ID
      paymentStatus: "Paid",
      cost: 1500,
    };

    const res = await request(app)
      .post(`${BASE}/addService`)
      .set("Authorization", `Bearer invalidtoken`)
      .send(validHistory);

    expect(res.status).to.equal(401); // Passport's default for invalid token is 401
  });

  // Test 3: Success case (the one that was broken/missing)
  it("should return 200 and create a history record on success", async () => {
    const body = {
      serviceId: testService._id.toString(),
      paymentStatus: "Paid",
      cost: 120.5,
    };

    const res = await request(app)
      .post(`${BASE}/addService`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    // Check response
    expect(res.status).to.equal(200);
    expect(res.body.message.toLowerCase()).to.include("payment status updated");
    expect(res.body).to.have.property("serviceId", testService._id.toString());
    expect(res.body).to.have.property("historyId").that.is.not.null;

    // Check Service document was updated in DB
    const updatedService = await Service.findById(testService._id);
    expect(updatedService.payment.paymentStatus).to.equal("Paid");
    expect(updatedService.payment.cost).to.equal(120.5);
    expect(updatedService.payment.historyId.toString()).to.equal(
      res.body.historyId
    );

    // Check History document was created in DB
    const newHistory = await History.findById(res.body.historyId);
    expect(newHistory).to.exist;
    expect(newHistory.serviceId.toString()).to.equal(
      testService._id.toString()
    );
    expect(newHistory.paymentStatus).to.equal("Paid");
    expect(newHistory.cost).to.equal(120.5);

    // Check Vehicle document was updated in DB
    const updatedVehicle = await Vehicle.findOne({ VIN: testVehicle.VIN });
    expect(updatedVehicle.lastServiceDate).to.be.a("date");
    expect(updatedVehicle.serviceDetails).to.have.lengthOf(1);
    expect(updatedVehicle.serviceDetails[0].serviceType).to.equal(
      testService.serviceType
    );
  });

  // Test 4: Get all histories
  it("should return 200 and all history records", async () => {
    // First, create a history record to fetch
    await request(app)
      .post(`${BASE}/addService`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        serviceId: testService._id.toString(),
        paymentStatus: "Paid",
        cost: 120.5,
      });

    const res = await request(app)
      .get(`${BASE}/allHistories`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.be.an("array");
    expect(res.body).to.have.lengthOf(1);
    expect(res.body[0].serviceId).to.equal(testService._id.toString());
  });
});