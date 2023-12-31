const express = require("express");
const authRoutes = express();
const authValidator = require("../middleware/authValidation.js");
const authController = require("../controllers/authController.js");

authRoutes.post(
	"/signup",
	authValidator.signup,
	authController.signup,
	authController.sendVerificationEmail
);
authRoutes.post("/signin", authValidator.signin, authController.signin);
authRoutes.post(
	"/verification-email",
	authValidator.submitEmail,
	authController.sendVerificationEmail
);
authRoutes.post(
	"/verify-email",
	authValidator.emailVerification,
	authController.verifyEmail
);
authRoutes.post(
	"/forgot-password",
	authValidator.submitEmail,
	authController.sendForgotPasswordEmail
);
authRoutes.post(
	"/reset-password",
	authValidator.resetPassword,
	authController.resetPassword
);

module.exports = authRoutes;
