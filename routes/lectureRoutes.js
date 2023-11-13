const express = require("express");
const lectureRoutes = express();
const lectureController = require("../controllers/lectureController");
const lectureValidator = require("../middleware/lectureValidation");
const fileValidator = require("../middleware/fileValidation");
const { upload } = require("../configs/file");
const {
	isAuthenticated,
	isAdmin,
	isInstructorOrAdmin,
} = require("../middleware/tokenValidation");

lectureRoutes.post(
	"/create",
	isAuthenticated,
	isInstructorOrAdmin,
	upload.single("fileInput"),
	fileValidator.uploadFile,
	lectureValidator.create,
	lectureController.create
);

module.exports = lectureRoutes;
