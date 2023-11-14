const express = require("express");
const assignmentRoutes = express();
const assignmentController = require("../controllers/assignmentController");
const assignmentValidator = require("../middleware/assignmentValidation");
const fileValidator = require("../middleware/fileValidation");
const { upload } = require("../configs/file");
const {
	isAuthenticated,
	isAdmin,
	isInstructorOrAdmin,
} = require("../middleware/tokenValidation");

assignmentRoutes.post(
	"/create",
	isAuthenticated,
	isInstructorOrAdmin,
	upload.single("fileInput"),
	fileValidator.uploadFile,
	assignmentValidator.create,
	assignmentController.create
);

module.exports = assignmentRoutes;