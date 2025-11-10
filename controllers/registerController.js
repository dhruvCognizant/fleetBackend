const bcrypt = require("bcrypt");
const TechnicianModel = require("../models/TechnicianRegister");
const CredentialModel = require("../models/Credential");

// GET all technicians from MongoDB
exports.getTechnicians = async (req, res) => {
  try {
    const technicians = await TechnicianModel.find().lean(); // Retrieve all technicians as plain JS objects
    if (!technicians.length) { // If no technicians found
      return res.status(400).json({ message: "No Technicians Available" });
    }

    // Remove sensitive fields (like password) before sending response
    const sanitized = technicians.map((tech) => {
      const copy = { ...tech };
      delete copy.password;
      return copy;
    });

    // Return sanitized list of technicians
    res.status(200).json(sanitized);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching technicians", error: err.message });
  }
};

// POST /api/register
// Create a new technician account
exports.createTechnician = async (req, res) => {
  console.log("POST /api/register called with body:", req.body);
  try { // Extract fields from request body
    const {
      firstName,
      lastName,
      skill, // single skill string 
      skills, // array of skills (optional)
      availability, // availability days
      email,
      password,
      isAssigned, // whether technician is currently assigned
    } = req.body;

    // Normalize email (trim spaces + lowercase)
    const emailLower = email.trim().toLowerCase();

    // Check if email already exists in Credential collection
    const existingCredential = await CredentialModel.findOne({
      email: emailLower,
    });
    if (existingCredential) {
      return res
        .status(400)
        .json({ message: "User with this email already exists." });
    }

    // Normalize skills: accept either array or comma-separated string
    const skillsArray = Array.isArray(skills)
      ? skills.map((s) => s.trim())
      : skill
      ? String(skill)
          .split(",")
          .map((s) => s.trim())
      : [];

    // Normalize availability: accept either array or comma-separated string
    const availabilityArray = Array.isArray(availability)
      ? availability.map((d) => d.trim().toLowerCase())
      : String(availability)
          .split(",")
          .map((d) => d.trim().toLowerCase());

    // Basic validation: ensure required fields are present
    if (
      !firstName ||
      !lastName ||
      skillsArray.length === 0 ||
      availabilityArray.length === 0 ||
      !email ||
      !password
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create credential record (stores login info)
    const hashedPassword = await bcrypt.hash(password, 10);
    const credential = new CredentialModel({
      email: emailLower,
      password: hashedPassword,
      role: "technician",
    });
    await credential.save();

    // Create technician record (stores profile info)
    const technician = new TechnicianModel({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: emailLower,
      skills: skillsArray,
      availability: availabilityArray,
      isAssigned: typeof isAssigned === "boolean" ? isAssigned : false,
      credential: credential._id, // link to credential record
    });

    // Save technician record
    const savedTechnician = await technician.save();

    // Optional: generate JWT token if authentication is needed
    const responseBody = savedTechnician.toObject();
    delete responseBody.credential;

    // Return technician data with role
    res.status(200).json({
      ...responseBody,
      role: "technician",
      // token // include if using JWT
    });
  } catch (err) {
    console.error("Error in createTechnician:", err.message || err);
    res
      .status(500)
      .json({ message: "Error creating technician", error: err.message });
  }
};
