const { body, param } = require("express-validator");

const courseValidator = {
	create: [
		body("instructorReference")
			.exists()
			.withMessage("Instructor reference is required")
			.bail()
			.isMongoId()
			.withMessage("Invalid MongoDB Id"),
		body("title")
			.exists()
			.withMessage("Title is required")
			.bail()
			.isString()
			.withMessage("Invalid title")
			.bail()
			.trim()
			.notEmpty()
			.withMessage("Title is required")
			.bail()
			.isLength({ max: 100 })
			.withMessage("Character limit exceeded"),
		body("categoryReference")
			.exists()
			.withMessage("Category reference is required")
			.bail()
			.isMongoId()
			.withMessage("Invalid MongoDB Id"),
	],

	getAllByInstructorReference: [
		param("instructorReference")
			.exists()
			.withMessage("Instructor reference is required")
			.bail()
			.isMongoId()
			.withMessage("Invalid MongoDB Id"),
	],

	getOneByCourseReference: [
		param("courseReference")
			.exists()
			.withMessage("Course reference is required")
			.bail()
			.isMongoId()
			.withMessage("Invalid MongoDB Id"),
	],

	updateOneByCourseReference: [
		body("courseReference")
			.exists()
			.withMessage("Course reference is required")
			.bail()
			.isMongoId()
			.withMessage("Invalid MongoDB Id"),
		body("title")
			.optional()
			.bail()
			.isString()
			.withMessage("Invalid title")
			.bail()
			.trim()
			.notEmpty()
			.withMessage("Title is required")
			.bail()
			.isLength({ max: 100 })
			.withMessage("Character limit exceeded"),
		body("categoryReference")
			.optional()
			.bail()
			.isMongoId()
			.withMessage("Invalid MongoDB Id"),
	],

	uploadFile: [
		body("courseReference")
			.exists()
			.withMessage("Course reference is required")
			.bail()
			.isMongoId()
			.withMessage("Invalid MongoDB Id"),
	],

	publishCourse: [
		body("courseReference")
			.exists()
			.withMessage("Course reference is required")
			.bail()
			.isMongoId()
			.withMessage("Invalid MongoDB Id"),
	],
};

module.exports = courseValidator;
