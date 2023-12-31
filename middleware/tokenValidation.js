const jsonwebtoken = require("jsonwebtoken");
const sendResponse = require("../utils/commonResponse");
const HTTP_STATUS = require("../constants/statusCodes");

const isAuthenticated = (req, res, next) => {
	try {
		if (!req.headers.authorization) {
			return sendResponse(
				res,
				HTTP_STATUS.UNAUTHORIZED,
				"Unauthorized access",
				"Unauthorized"
			);
		}

		const jwt = req.headers.authorization.split(" ")[1];

		const validation = jsonwebtoken.verify(jwt, process.env.SECRET_KEY);
		if (validation) {
			next();
		} else {
			throw new Error();
		}
	} catch (error) {
		if (error instanceof jsonwebtoken.TokenExpiredError) {
			return sendResponse(
				res,
				HTTP_STATUS.UNAUTHORIZED,
				"Token expired",
				"Unauthorized"
			);
		}

		if (error instanceof jsonwebtoken.JsonWebTokenError) {
			return sendResponse(
				res,
				HTTP_STATUS.UNAUTHORIZED,
				"Token invalid",
				"Unauthorized"
			);
		}
	}
};

const isAdmin = (req, res, next) => {
	try {
		const jwt = req.headers.authorization.split(" ")[1];

		const user = jsonwebtoken.decode(jwt);

		if (user.role !== "admin") {
			return sendResponse(
				res,
				HTTP_STATUS.UNAUTHORIZED,
				"Access denied",
				"Unauthorized"
			);
		}
		next();
	} catch (error) {
		return sendResponse(
			res,
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
			"Internal server error",
			"Server error"
		);
	}
};

const isLearnerOrAdmin = (req, res, next) => {
	try {
		const jwt = req.headers.authorization.split(" ")[1];

		const user = jsonwebtoken.decode(jwt);

		if (user.role !== "learner" && user.role !== "admin") {
			return sendResponse(
				res,
				HTTP_STATUS.UNAUTHORIZED,
				"Access denied",
				"Unauthorized"
			);
		}
		next();
	} catch (error) {
		return sendResponse(
			res,
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
			"Internal server error",
			"Server error"
		);
	}
};

const isInstructorOrAdmin = (req, res, next) => {
	try {
		const jwt = req.headers.authorization.split(" ")[1];

		const user = jsonwebtoken.decode(jwt);

		if (user.instructorReference !== null && user.adminReference !== null) {
			return sendResponse(
				res,
				HTTP_STATUS.UNAUTHORIZED,
				"Access denied",
				"Unauthorized"
			);
		}
		next();
	} catch (error) {
		return sendResponse(
			res,
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
			"Internal server error",
			"Server error"
		);
	}
};

module.exports = {
	isAuthenticated,
	isAdmin,
	isLearnerOrAdmin,
	isInstructorOrAdmin,
};
