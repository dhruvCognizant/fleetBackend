const request = require("supertest");
const chai = require("chai");
const bcrypt = require("bcrypt");
const app = require("../app");
const Credential = require("../models/Credential");
const { expect } = chai;

const ADMIN_USER = {
  email: "admin@admin.com", 
  password: "Admin@123",
  role: "admin",
};

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await Credential.deleteMany({});
    const hashedPassword = await bcrypt.hash(ADMIN_USER.password, 10);
    await Credential.create({
      email: ADMIN_USER.email.toLowerCase(),
      password: hashedPassword,
      role: ADMIN_USER.role,
    });
  });

  it("should return 400 if email is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({
      password: ADMIN_USER.password,
    });
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
    // Check if any error message mentions email validation
    const hasEmailError = res.body.errors.some((e) =>
      e.msg.toLowerCase().includes("email")
    );
    expect(hasEmailError).to.be.true;
  });

  it("should return 400 if password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: ADMIN_USER.email,
    });
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("errors");
    const messages = res.body.errors.map((e) => e.msg);
    expect(messages.some((msg) => msg.toLowerCase().includes("password"))).to.be
      .true;
  });

  it("should return 400 for invalid email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "notfound@admin.com", // valid format, not in DB
      password: ADMIN_USER.password,
    });
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("error", "Invalid credentials");
  });

  it("should return 400 for incorrect password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: ADMIN_USER.email,
      password: "WrongPassword123",
    });
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("error", "Invalid credentials");
  });

  it("should return token on successful login", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: ADMIN_USER.email,
      password: ADMIN_USER.password,
    });
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("message", "Login successful");
    expect(res.body).to.have.property("token");
    expect(res.body.token).to.be.a("string");
  });
});