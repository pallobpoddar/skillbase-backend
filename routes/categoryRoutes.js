const express = require("express");
const categoryRoutes = express();
const categoryController = require("../controllers/categoryController");
const categoryValidator = require("../middleware/categoryValidation");
const { isAuthenticated, isAdmin } = require("../middleware/tokenValidation");

categoryRoutes.post(
	"/create",
	isAuthenticated,
	isAdmin,
	categoryValidator.create,
	categoryController.create
);

module.exports = categoryRoutes;
