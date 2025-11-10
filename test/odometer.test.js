const request = require("supertest");
const chai = require("chai");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Credential = require("../models/Credential");
const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service"); 
const { expect } = chai;

const BASE = "/api/vehicles";
const VIN = "ABC123XYZ";

const ADMIN_USER = {
  email: "admin@admin.com",
  password: "Admin@123",
  role: "admin",
};

let token;

const VALID_VEHICLE = {
  type: "Car",
  make: "Hyundai",
  model: "i20",
  year: 2023,
  VIN,
  LastServiceDate: "2023-10-10", // Using YYYY-MM-DD for consistency
};

describe("Odometer API Tests", () => {
  beforeEach(async () => {
    // Clear all relevant collections
    await Credential.deleteMany({});
    await Vehicle.deleteMany({});
    await Service.deleteMany({}); // Clear services as controller checks them

    // 1. Create Admin User
    const hashedPassword = await bcrypt.hash(ADMIN_USER.password, 10);
    const admin = await Credential.create({
      email: ADMIN_USER.email.toLowerCase(),
      password: hashedPassword,
      role: ADMIN_USER.role,
    });

    // 2. Generate Token (with jti)
    token = jwt.sign(
      { id: admin._id, role: admin.role, jti: "test-jti-odometer" },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "15m" }
    );

    // 3. Create a clean vehicle for each test
    await Vehicle.create(VALID_VEHICLE);
  });

  describe("POST /api/vehicles/:id/odometer", () => {
    it("should return 400 if vehicle VIN does not exist", async () => {
      const res = await request(app)
        .post(`${BASE}/INVALIDVIN/odometer`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          mileage: 1500,
          serviceType: "Oil Change",
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal("Vehicle VIN does not exist.");
    });

    it("should return 400 if serviceType is missing on first entry", async () => {
      const res = await request(app)
        .post(`${BASE}/${VIN}/odometer`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          mileage: 1500,
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal(
        "serviceType is required when creating an initial service"
      );
    });

    it("should return 401 if token is invalid", async () => {
      const res = await request(app)
        .post(`${BASE}/${VIN}/odometer`)
        .set("Authorization", `Bearer invalidtoken`)
        .send({
          mileage: 1500,
          serviceType: "Oil Change",
        });

      expect(res.status).to.equal(401);
    });

    it("should return 200 and create service if mileage is valid and serviceType provided", async () => {
      const res = await request(app)
        .post(`${BASE}/${VIN}/odometer`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          mileage: 1500,
          serviceType: "Oil Change",
        });

      expect(res.status).to.equal(200);
      expect(res.body.reading).to.have.property("readingId");
      expect(res.body).to.have.property("nextServiceMileage");
      expect(res.body).to.have.property("serviceId");

      // Check that the service was actually created
      const service = await Service.findById(res.body.serviceId);
      expect(service).to.exist;
      expect(service.vehicleVIN).to.equal(VIN);
      expect(service.serviceType).to.equal("Oil Change");
    });
  });

  describe("GET /api/vehicles/:id/odometer", () => {
    it("should return 400 if VIN does not exist", async () => {
      const res = await request(app)
        .get(`${BASE}/INVALIDVIN/odometer`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal(
        "No entries available for this vehicle."
      );
    });

    it("should return 400 if VIN exists but has no readings", async () => {
      // The vehicle is created in beforeEach with an empty odometerReadings array
      const res = await request(app)
        .get(`${BASE}/${VIN}/odometer`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal(
        "No entries available for this vehicle."
      );
    });

    it("should return 200 with readings if VIN has odometer entries", async () => {
      // Manually add a reading to the vehicle for this test
      await Vehicle.updateOne(
        { VIN },
        {
          $push: {
            odometerReadings: {
              readingId: "R001",
              mileage: 1500,
              date: new Date(),
            },
          },
        }
      );

      const res = await request(app)
        .get(`${BASE}/${VIN}/odometer`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array").with.lengthOf(1);
      expect(res.body[0]).to.have.property("readingId", "R001");
    });
  });
});