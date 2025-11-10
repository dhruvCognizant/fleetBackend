const request = require("supertest");
const chai = require("chai");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = require("../app");

// Import all necessary models
const Credential = require("../models/Credential");
const Technician = require("../models/TechnicianRegister");
const Service = require("../models/Service");
const Vehicle = require("../models/Vehicle");

const { expect } = chai;

// Helper to get today's weekday name in lowercase (e.g., "monday")
const getTodayWeekday = () => {
  return new Date()
    .toLocaleString("en-US", { weekday: "long" })
    .toLowerCase();
};
const todayWeekday = getTodayWeekday();

let adminToken, technicianToken;
let techUser, techCredential;
let serviceToAssign, serviceToUpdate, serviceNoTech;

describe("Technician API (/api/technician)", () => {
  beforeEach(async () => {
    // Clear all relevant collections
    await Credential.deleteMany({});
    await Technician.deleteMany({});
    await Service.deleteMany({});
    await Vehicle.deleteMany({});

    // 1. Create Admin User and Token
    const hashedPassword = await bcrypt.hash("Admin@123", 10);
    const adminCred = await Credential.create({
      email: "admin@admin.com",
      password: hashedPassword,
      role: "admin",
    });
    adminToken = jwt.sign(
      { id: adminCred._id, role: "admin", jti: "admin-jti" },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "15m" }
    );

    // 2. Create Technician User, Credential, and Token
    techCredential = await Credential.create({
      email: "tech@fleet.com",
      password: hashedPassword,
      role: "technician",
    });
    techUser = await Technician.create({
      firstName: "Test",
      lastName: "Tech",
      email: "tech@fleet.com",
      credential: techCredential._id,
      skills: ["Oil Change"],
      availability: [todayWeekday], // Available today
    });
    technicianToken = jwt.sign(
      { id: techCredential._id, role: "technician", jti: "tech-jti" },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "15m" }
    );

    // 3. Create a Vehicle
    await Vehicle.create({
      VIN: "TECH-TEST-VIN",
      type: "Car",
      make: "Honda",
      model: "Civic",
      year: 2020,
    });

    // 4. Create Services for testing
    // A service scheduled (by admin) and ready for assignment
    serviceToAssign = await Service.create({
      vehicleVIN: "TECH-TEST-VIN",
      serviceType: "Oil Change",
      status: "Unassigned",
      technicianId: techUser._id, // Admin already pre-selected tech
      technicianName: "Test Tech",
    });

    // A service already assigned to our tech
    serviceToUpdate = await Service.create({
      vehicleVIN: "TECH-TEST-VIN-2",
      serviceType: "Oil Change",
      status: "Completed", 
      technicianId: techUser._id,
      technicianName: "Test Tech",
      assignmentDate: new Date(),
    });

    // A service that has no technician
    serviceNoTech = await Service.create({
      vehicleVIN: "TECH-TEST-VIN-3",
      serviceType: "Brake Repair",
      status: "Unassigned",
      technicianId: null, // No tech assigned
    });
  });

  // Test Suite 1: POST /api/technician/assignments
  describe("POST /api/technician/assignments", () => {
    it("should return 400 if serviceId is missing", async () => {
      const res = await request(app)
        .post("/api/technician/assignments")
        .set("Authorization", `Bearer ${adminToken}`) // Admin assigns
        .send({}); // no serviceId

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal("Service ID is required.");
    });

    it("should return 400 if service is not found", async () => {
      const nonExistentId = new Technician()._id; // A valid but non-existent Mongo ID
      const res = await request(app)
        .post("/api/technician/assignments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ serviceId: nonExistentId });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal(
        "Corresponding service schedule not found."
      );
    });

    it("should return 400 if service has no technicianId set", async () => {
      const res = await request(app)
        .post("/api/technician/assignments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ serviceId: serviceNoTech._id }); // This service has technicianId: null

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include(
        "No technician specified on this service"
      );
    });

    it("should return 200 and set status to 'Assigned'", async () => {
      const res = await request(app)
        .post("/api/technician/assignments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ serviceId: serviceToAssign._id }); // This service is ready

      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal("Service assigned");
      expect(res.body.serviceId).to.equal(serviceToAssign._id.toString());

      // Verify in DB
      const updatedService = await Service.findById(serviceToAssign._id);
      expect(updatedService.status).to.equal("Assigned");
      expect(updatedService.assignmentDate).to.be.a("date");
    });
  });

  // Test Suite 2: PATCH /api/technician/assignments/:id/status
  describe("PATCH /api/technician/assignments/:id/status", () => {
    it("should return 400 if called by user not assigned to the service", async () => {
      // Admin token is used, but service is assigned to techUser
      const res = await request(app)
        .patch(`/api/technician/assignments/${serviceToUpdate._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`) // Admin token
        .send({ status: "Work In Progress" });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal(
        "You are not assigned to this service"
      );
    });

    it("should return 400 if status is missing", async () => {
      const res = await request(app)
        .patch(`/api/technician/assignments/${serviceToUpdate._id}/status`)
        .set("Authorization", `Bearer ${technicianToken}`) // Correct tech token
        .send({}); // Missing status

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal("status is required");
    });

    it("should return 200 and update status when called by assigned tech", async () => {
      const res = await request(app)
        .patch(`/api/technician/assignments/${serviceToUpdate._id}/status`)
        .set("Authorization", `Bearer ${technicianToken}`) // Correct tech token
        .send({ status: "Work In Progress" });

      expect(res.status).to.equal(200);
      expect(res.body.status).to.equal("Work In Progress");

      // Verify in DB
      const updatedService = await Service.findById(serviceToUpdate._id);
      expect(updatedService.status).to.equal("Work In Progress");
    });
  });

  // Test Suite 3: GET /api/technician/assignments
  describe("GET /api/technician/assignments", () => {
    it("should return 200 and all assigned services for an Admin", async () => {
      const res = await request(app)
        .get("/api/technician/assignments")
        .set("Authorization", `Bearer ${adminToken}`); // Admin token

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
      expect(res.body.length).to.equal(1);
      expect(res.body[0]._id).to.equal(serviceToUpdate._id.toString());
    });

    it("should return 200 and only the tech's assigned services", async () => {
      const res = await request(app)
        .get("/api/technician/assignments")
        .set("Authorization", `Bearer ${technicianToken}`); // Tech token

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
      expect(res.body.length).to.equal(1);
      expect(res.body[0]._id).to.equal(serviceToUpdate._id.toString());
      expect(res.body[0].technicianId.firstName).to.equal("Test"); // Check populate
    });
  });

  // Test Suite 4: GET /api/technician/unassigned-services
  describe("GET /api/technician/unassigned-services", () => {
    it("should return 200 and services that are 'Unassigned' but HAVE a technicianId", async () => {
      const res = await request(app)
        .get("/api/technician/unassigned-services")
        .set("Authorization", `Bearer ${adminToken}`); // Auth is required

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
      // serviceToAssign matches: { status: 'Unassigned', technicianId: NOT null }
      expect(res.body.length).to.equal(1);
      expect(res.body[0]._id).to.equal(serviceToAssign._id.toString());
      // serviceNoTech is NOT returned: { status: 'Unassigned', technicianId: null }
    });
  });
});