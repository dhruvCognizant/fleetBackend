const { checkSchema } = require("express-validator");
const Credential = require("../models/Credential");
const VALID_SKILLS = ["Oil Change", "Brake Repair", "Battery Test"];

const VALID_DAYS_LOWERCASE = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

exports.validateRegistration = checkSchema({
  firstName: {
    in: ["body"],
    isString: { errorMessage: "First name must be a string" },
    notEmpty: { errorMessage: "First name is required" },
    matches: {
      options: /^[a-zA-Z0-9 ]+$/,
      errorMessage: "First name can only contain letters, numbers, and spaces",
    },
    trim: true,
  },
  lastName: {
    in: ["body"],
    isString: { errorMessage: "Last name must be a string" },
    notEmpty: { errorMessage: "Last name is required" },
    matches: {
      options: /^[a-zA-Z0-9 ]+$/,
      errorMessage: "Last name can only contain letters, numbers, and spaces",
    },
    trim: true,
  },

  email: {
    in: ["body"],
    // isEmail: { errorMessage: "Must provide a valid email address" },
    normalizeEmail: true,
    matches: {
      options: /@fleet\.com$/,
      errorMessage: "Email must be a @fleet.com address",
    },
    custom: {
      options: async (value) => {
        const user = await Credential.findOne({ email: value });
        if (user) {
          throw new Error("Email address is already in use");
        }
        return true;
      },
    },
  },
  password: {
    in: ["body"],
    isString: { errorMessage: "Password must be a string" },
    isLength: {
      options: { min: 8 },
      errorMessage: "Password must be at least 8 characters long",
    },
    matches: {
      options: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])/,
      errorMessage:
        "Password must contain at least one letter, one number and one special character",
    },
  },
  confirmPassword: {
    in: ["body"],
    isString: { errorMessage: "Confirm Password must be a string" },
    custom: {
      options: (value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Password confirmation does not match password");
        }
        return true;
      },
    },
  },

  availability: {
    in: ["body"],
    isArray: { errorMessage: "Availability must be an array" },
    notEmpty: { errorMessage: "Availability is required" },
    custom: {
      options: (availabilityArray) => {
        if (!Array.isArray(availabilityArray)) {
          throw new Error("Availability must be an array of days");
        }
        return availabilityArray.every((day) => {
          if (typeof day !== "string") return false;
          return VALID_DAYS_LOWERCASE.includes(day.trim().toLowerCase());
        });
      },
      errorMessage: `Invalid day. Must be an array of: ${VALID_DAYS_LOWERCASE.join(
        ", "
      )}`,
    },
  },
  skills: {
    in: ["body"],
    isArray: { errorMessage: "Skills must be an array" },
    notEmpty: { errorMessage: "Skills are required" },
    custom: {
      options: (skillsArray) => {
        if (!Array.isArray(skillsArray)) {
          throw new Error("Skills must be an array of strings");
        }
        return skillsArray.every((skill) => {
          if (typeof skill !== "string") return false;
          return VALID_SKILLS.includes(skill.trim());
        });
      },
      errorMessage: `Invalid skill. Must be an array of: ${VALID_SKILLS.join(
        ", "
      )}`,
    },
  },
});
