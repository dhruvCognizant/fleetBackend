const request = require("supertest");
const chai = require("chai");
const bcrypt = require("bcrypt");
const app = require("../app");

const TechnicianModel = require("../models/TechnicianRegister");
const CredentialModel = require("../models/Credential");

const { expect } = chai;

const SAMPLE_TECHNICIAN = {
  firstName: "John",
  lastName: "Doe",
  skill: "Oil Change", 
  availability: "monday", 
  email: "john.doe@fleet.com",
  password: "ValidPass@123",
};

describe("Technician Registration API", () => {
  beforeEach(async () => {
    // Clear collections before each test
    await TechnicianModel.deleteMany({});
    await CredentialModel.deleteMany({});
  });

  describe("POST /api/register", () => {
    it("should create a new technician and credential with valid data", async () => {
      const res = await request(app)
        .post("/api/register")
        .send(SAMPLE_TECHNICIAN)
        .set("Accept", "application/json");

      // Check response status and body
      expect(res.status).to.equal(200);
      expect(res.body.firstName).to.equal(SAMPLE_TECHNICIAN.firstName);
      expect(res.body.lastName).to.equal(SAMPLE_TECHNICIAN.lastName);
      expect(res.body.email).to.equal(SAMPLE_TECHNICIAN.email.toLowerCase());
      expect(res.body.skills).to.include(SAMPLE_TECHNICIAN.skill);
      expect(res.body.availability).to.include(
        SAMPLE_TECHNICIAN.availability.toLowerCase()
      );
      expect(res.body.role).to.equal("technician");
      expect(res.body).to.not.have.property("password"); // Ensure password is not returned
    });

    it("should hash password in Credential model and not expose it in response", async () => {
      const res = await request(app)
        .post("/api/register")
        .send(SAMPLE_TECHNICIAN)
        .set("Accept", "application/json");

      expect(res.status).to.equal(200);
      expect(res.body).to.not.have.property("password");

      // Find the created credential in the database
      const credential = await CredentialModel.findOne({
        email: SAMPLE_TECHNICIAN.email.toLowerCase(),
      });
      expect(credential).to.exist;
      expect(credential.role).to.equal("technician");

      // Verify the password was hashed
      const isMatch = await bcrypt.compare(
        SAMPLE_TECHNICIAN.password,
        credential.password
      );
      expect(isMatch).to.be.true;

      // Verify the technician document was created and linked
      const technician = await TechnicianModel.findOne({
        email: SAMPLE_TECHNICIAN.email.toLowerCase(),
      });
      expect(technician).to.exist;
      expect(technician.credential.toString()).to.equal(
        credential._id.toString()
      );
    });

    it("should return 400 if required fields are missing", async () => {
      const res = await request(app)
        .post("/api/register")
        .send({ email: "missing@fleet.com", password: "12345678" }) // Missing name, skills, avail
        .set("Accept", "application/json");

      expect(res.status).to.equal(400);
      expect(res.body.message.toLowerCase()).to.include("missing required fields");
    });

    it("should return 400 if email already exists", async () => {
      // Create the first technician
      await request(app)
        .post("/api/register")
        .send(SAMPLE_TECHNICIAN)
        .set("Accept", "application/json");

      // Attempt to create with the same email
      const res = await request(app)
        .post("/api/register")
        .send({
          ...SAMPLE_TECHNICIAN,
          firstName: "Jane", // Different person, same email
        })
        .set("Accept", "application/json");

      expect(res.status).to.equal(400);
      expect(res.body.message.toLowerCase()).to.include("already exists");
    });
  });
});