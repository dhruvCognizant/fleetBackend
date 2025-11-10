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
  VIN: "ABC123XYZ",
  LastServiceDate: "2023-10-10",
};

describe("Vehicle API (/api/vehicles)", () => {
  beforeEach(async () => {
    await Credential.deleteMany({});
    await Vehicle.deleteMany({});
    await Service.deleteMany({}); // Clear services

    const hashedPassword = await bcrypt.hash(ADMIN_USER.password, 10);
    const admin = await Credential.create({
      email: ADMIN_USER.email.toLowerCase(),
      password: hashedPassword,
      role: ADMIN_USER.role,
    });

    token = jwt.sign(
      { id: admin._id, role: admin.role, jti: "test-jti-vehicle" },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "15m" }
    );
  });

  describe("POST /api/vehicles", () => {
    it("should create vehicle with valid data", async () => {
      const res = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(VALID_VEHICLE);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("VIN", VALID_VEHICLE.VIN);
      expect(res.body).to.have.property("make", "Hyundai");
    });

    it("should return 400 if vehicle with VIN already exists", async () => {
      // Create the first vehicle
      await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(VALID_VEHICLE);

      // Attempt to create it again
      const res = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(VALID_VEHICLE);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors");
      const hasVinError = res.body.errors.some((e) =>
        e.msg.toLowerCase().includes("vin already exists")
      );
      expect(hasVinError).to.be.true;
    });

    it("should return 400 if last service date is in the future", async () => {
      const futureVehicle = {
        ...VALID_VEHICLE,
        VIN: "FUTUREVIN",
        LastServiceDate: "2099-10-10", 
      };

      const res = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(futureVehicle);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("errors");
      const hasDateError = res.body.errors.some((e) =>
        e.msg.toLowerCase().includes("cannot be in the future")
      );
      expect(hasDateError).to.be.true;
    });
  });

  describe("GET /api/vehicles", () => {
    it("should return 200 and all supported vehicles (with enrichment)", async () => {
      // 1. Create a vehicle with no open service
      await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(VALID_VEHICLE);

      // 2. Create a second vehicle that WILL have an open service
      const vehicleWithService = {
        ...VALID_VEHICLE,
        VIN: "VIN_WITH_SERVICE",
      };
      await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleWithService);

      // 3. Create an open service for the second vehicle
      await Service.create({
        vehicleVIN: "VIN_WITH_SERVICE",
        serviceType: "Oil Change",
        status: "Work In Progress", // Not "Completed"
        payment: { paymentStatus: "Unpaid" },
      });

      // 4. Act: Get all vehicles
      const res = await request(app)
        .get(BASE)
        .set("Authorization", `Bearer ${token}`);

      // 5. Assert
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array").with.lengthOf(2);

      const v1 = res.body.find((v) => v.VIN === "ABC123XYZ");
      const v2 = res.body.find((v) => v.VIN === "VIN_WITH_SERVICE");

      // Check enrichment
      expect(v1).to.exist;
      expect(v1.hasOpenUnpaidService).to.be.false;

      expect(v2).to.exist;
      expect(v2.hasOpenUnpaidService).to.be.true;
    });

    it("should return 400 if no supported vehicles are available", async () => {
      // DB is cleared by beforeEach, so no vehicles exist
      const res = await request(app)
        .get(BASE)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include(
        "No Vehicles Available for supported brands/types"
      );
    });
  });
});