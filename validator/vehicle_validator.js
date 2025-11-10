const { checkSchema, param } = require("express-validator");
const Vehicle = require("../models/Vehicle");

const VALID_BRANDS = [
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
const VALID_TYPES = ["Car", "Truck"];

exports.validateVehicle = checkSchema({
  type: {
    in: ["body"],
    notEmpty: { errorMessage: "Vehicle type is required" },
    isString: { errorMessage: "Type must be a string" },
    customSanitizer: {
      options: (value) => {
        if (typeof value !== "string" || value.length === 0) return value;
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      },
    },
    isIn: {
      options: [VALID_TYPES],
      errorMessage: 'Invalid vehicle type. Must be "Car" or "Truck".',
    },
  },

  make: {
    in: ["body"],
    notEmpty: { errorMessage: "Vehicle make is required" },
    isString: { errorMessage: "Make must be a string" },
    isIn: {
      options: [VALID_BRANDS],
      errorMessage: "Unsupported vehicle brand",
    },
  },

  model: {
    in: ["body"],
    notEmpty: { errorMessage: "Model is required" },
    isString: { errorMessage: "Model must be a string" },
    trim: true,
  },

  year: {
    in: ["body"],
    notEmpty: { errorMessage: "Registration year is required" },
    isInt: {
      options: { min: 1990, max: new Date().getFullYear() },
      errorMessage: `Year must be a valid integer between 1990 and ${new Date().getFullYear()}`,
    },
  },

  VIN: {
    in: ["body"],
    notEmpty: { errorMessage: "VIN is required" },
    isString: { errorMessage: "VIN must be a string" },
    trim: true,
    custom: {
      options: async (value) => {
        const existing = await Vehicle.findOne({ VIN: value });
        if (existing) {
          throw new Error("Vehicle with this VIN already exists");
        }
        return true;
      },
    },
  },

  LastServiceDate: {
    in: ["body"],
    notEmpty: { errorMessage: "Last Service Date is required" },
    isISO8601: {
      errorMessage: "LastServiceDate must be a valid date (YYYY-MM-DD)",
    },
    custom: {
      options: (value) => {
        const inputDate = new Date(value);
        const today = new Date();
        inputDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        if (inputDate > today) {
          throw new Error("Last Service Date cannot be in the future");
        }
        return true;
      },
    },
  },
});

exports.validateGetVehicle = [
  param("id")
    .notEmpty()
    .withMessage("Vehicle VIN (id) is required in the URL")
    .isString()
    .withMessage("Vehicle VIN (id) must be a string"),
];
