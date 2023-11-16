const ejs = require("ejs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { promisify } = require("util");
const jsonwebtoken = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const ejsRenderFile = promisify(ejs.renderFile);
const learnerModel = require("../models/learner");
const instructorModel = require("../models/instructor");
const adminModel = require("../models/admin");
const authModel = require("../models/auth");
const transporter = require("../configs/mail");
const sendResponse = require("../utils/commonResponse");
const HTTP_STATUS = require("../constants/statusCodes");

class AuthController {
	async signup(req, res, next) {
		try {
			const allowedProperties = ["name", "email", "password", "role"];
			const unexpectedProps = Object.keys(req.body).filter(
				(key) => !allowedProperties.includes(key)
			);
			if (unexpectedProps.length > 0) {
				return sendResponse(
					res,
					HTTP_STATUS.UNPROCESSABLE_ENTITY,
					"Failed to sign up",
					`Unexpected properties: ${unexpectedProps.join(", ")}`
				);
			}

			const validation = validationResult(req).array();
			if (validation.length > 0) {
				return sendResponse(
					res,
					HTTP_STATUS.UNPROCESSABLE_ENTITY,
					validation[0].msg,
					validation
				);
			}

			const { name, email, password, role } = req.body;

			const isEmailRegistered = await authModel.findOne({ email: email });
			if (isEmailRegistered) {
				return sendResponse(
					res,
					HTTP_STATUS.CONFLICT,
					"Email is already registered",
					"Conflict"
				);
			}

			const rolesToModel = {
				learner: learnerModel,
				instructor: instructorModel,
				admin: adminModel,
			};

			const userModel = rolesToModel[role];
			const user = await userModel.create({
				name: name,
				email: email,
			});

			const filteredInfo = user.toObject();
			delete filteredInfo.createdAt;
			delete filteredInfo.updatedAt;
			delete filteredInfo.__v;

			const hashedPassword = await bcrypt.hash(password, 10).then((hash) => {
				return hash;
			});

			const referenceProperty = `${role}Reference`;

			const authData = {
				learnerReference: null,
				instructorReference: null,
				adminReference: null,
				email: email,
				password: hashedPassword,
				role: role,
			};
			authData[referenceProperty] = user._id;

			await authModel.create(authData);
			next();
		} catch (error) {
			console.log(error);
			return sendResponse(
				res,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				"Internal server error",
				"Server error"
			);
		}
	}

	async signin(req, res) {
		try {
			const allowedProperties = ["email", "password"];
			const unexpectedProps = Object.keys(req.body).filter(
				(key) => !allowedProperties.includes(key)
			);
			if (unexpectedProps.length > 0) {
				return sendResponse(
					res,
					HTTP_STATUS.UNPROCESSABLE_ENTITY,
					"Failed to sign in",
					`Unexpected properties: ${unexpectedProps.join(", ")}`
				);
			}

			const validation = validationResult(req).array();
			if (validation.length > 0) {
				return sendResponse(
					res,
					HTTP_STATUS.UNPROCESSABLE_ENTITY,
					"Failed to sign in",
					validation
				);
			}

			const { email, password } = req.body;

			const auth = await authModel
				.findOne({ email: email })
				.populate("learnerReference", "-createdAt -updatedAt -__v ")
				.populate("instructorReference", "-createdAt -updatedAt -__v ")
				.populate("adminReference", "-createdAt -updatedAt -__v ")
				.select("-_id -email -forgotEmailSent -createdAt -updatedAt -__v");

			if (!auth) {
				return sendResponse(
					res,
					HTTP_STATUS.UNAUTHORIZED,
					"Email is not registered",
					"Unauthorized"
				);
			}

			const checkPassword = await bcrypt.compare(password, auth.password);

			if (!checkPassword) {
				auth.signInFailed += 1;

				if (auth.signInFailed < 5) {
					await auth.save();
					return sendResponse(
						res,
						HTTP_STATUS.UNAUTHORIZED,
						"Invalid credentials",
						"Unauthorized"
					);
				}

				const blockedDuration = 60 * 60 * 1000;
				auth.signInBlockedUntil = new Date(Date.now() + blockedDuration);
				await auth.save();
				return sendResponse(
					res,
					HTTP_STATUS.FORBIDDEN,
					"You have exceeded the maximum number of requests per hour",
					"Forbidden"
				);
			}

			if (
				auth.signInBlockedUntil &&
				auth.signInBlockedUntil > new Date(Date.now())
			) {
				return sendResponse(
					res,
					HTTP_STATUS.FORBIDDEN,
					"You have exceeded the maximum number of requests per hour",
					"Forbidden"
				);
			}

			if (auth.signInFailed > 0) {
				auth.signInFailed = 0;
				auth.signInBlockedUntil = null;
				await auth.save();
			}

			const responseAuth = auth.toObject();
			delete responseAuth.updatedAt;
			delete responseAuth.password;
			delete responseAuth.signInFailed;
			delete responseAuth.signInBlockedUntil;

			const jwt = jsonwebtoken.sign(responseAuth, process.env.SECRET_KEY, {
				expiresIn: "1h",
			});

			responseAuth.token = jwt;

			return sendResponse(
				res,
				HTTP_STATUS.OK,
				"Successfully signed in",
				responseAuth
			);
		} catch (error) {
			return sendResponse(
				res,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				"Internal server error",
				"Server error"
			);
		}
	}

	async sendVerificationEmail(req, res) {
		try {
			const allowedProperties = ["name", "email", "password", "role"];
			const unexpectedProps = Object.keys(req.body).filter(
				(key) => !allowedProperties.includes(key)
			);
			if (unexpectedProps.length > 0) {
				return sendResponse(
					res,
					HTTP_STATUS.UNPROCESSABLE_ENTITY,
					"Failed to send verification email",
					`Unexpected properties: ${unexpectedProps.join(", ")}`
				);
			}

			const validation = validationResult(req).array();
			if (validation.length > 0) {
				return sendResponse(
					res,
					HTTP_STATUS.UNPROCESSABLE_ENTITY,
					"Failed to send verification email",
					validation
				);
			}

			const { email } = req.body;

			const auth = await authModel
				.findOne({ email: email })
				.populate("learnerReference", "-createdAt -updatedAt -__v ")
				.populate("instructorReference", "-createdAt -updatedAt -__v ")
				.populate("adminReference", "-createdAt -updatedAt -__v ")
				.select("-email -createdAt -updatedAt -__v");

			if (!auth) {
				return sendResponse(
					res,
					HTTP_STATUS.UNAUTHORIZED,
					"Email is not registered",
					"Unauthorized"
				);
			}

			const emailVerificationToken = crypto.randomBytes(32).toString("hex");

			const emailVerificationURL = path.join(
				process.env.FRONTEND_URL,
				auth.role,
				"verify-email",
				emailVerificationToken,
				auth._id.toString()
			);

			const referenceField = `${auth.role}Reference`;
			const name = auth[referenceField].name;

			const htmlBody = await ejsRenderFile(
				path.join(__dirname, "..", "views", "verificationEmail.ejs"),
				{
					name: name,
					email: email,
					emailVerificationURL: emailVerificationURL,
				}
			);

			const result = await transporter.sendMail({
				from: "skillbase@system.com",
				to: `${name} ${email}`,
				subject: "Confirm your email at Skillbase",
				html: htmlBody,
			});

			if (result.messageId) {
				auth.emailVerificationToken = emailVerificationToken;
				auth.emailVerificationValidUntil = Date.now() + 60 * 60 * 1000;
				auth.verificationEmailSent += 1;
				await auth.save();
				return sendResponse(
					res,
					HTTP_STATUS.OK,
					"A verification email has been sent",
					auth
				);
			}
		} catch (error) {
			console.log(error);
			return sendResponse(
				res,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				"Internal server error",
				"Server error"
			);
		}
	}

	async verifyEmail(req, res) {
		try {
			const { token, id } = req.body;

			const auth = await authModel.findById({
				_id: id,
			});

			if (!auth) {
				return sendResponse(res, HTTP_STATUS.NOT_FOUND, "Invalid request");
			}

			if (auth.emailVerificationValidUntil < Date.now()) {
				return sendResponse(res, HTTP_STATUS.GONE, "Expired request");
			}

			if (
				auth.emailVerificationToken !== token ||
				auth.verificationEmailSent === 0
			) {
				return sendResponse(res, HTTP_STATUS.UNAUTHORIZED, "Invalid request");
			}

			const result = await authModel.findByIdAndUpdate(
				{ _id: id },
				{
					verificationEmailSent: 0,
					emailVerificationValidUntil: null,
					emailVerificationToken: null,
				},
				{ new: true }
			);

			if (result.isModified) {
				return sendResponse(res, HTTP_STATUS.OK, "Email has been verified");
			}
		} catch (error) {
			console.log(error);
			return sendResponse(
				res,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				"Internal server error",
				"Server error"
			);
		}
	}

	async sendForgotPasswordEmail(req, res) {
		try {
			const allowedProperties = ["email"];
			const unexpectedProps = Object.keys(req.body).filter(
				(key) => !allowedProperties.includes(key)
			);
			if (unexpectedProps.length > 0) {
				return sendResponse(
					res,
					HTTP_STATUS.UNPROCESSABLE_ENTITY,
					"Failed to reset password",
					`Unexpected properties: ${unexpectedProps.join(", ")}`
				);
			}

			const validation = validationResult(req).array();
			if (validation.length > 0) {
				return sendResponse(
					res,
					HTTP_STATUS.UNPROCESSABLE_ENTITY,
					"Failed to reset password",
					validation
				);
			}

			const { email } = req.body;

			const auth = await authModel
				.findOne({ email: email })
				.populate("learnerReference", "-createdAt -updatedAt -__v ")
				.populate("instructorReference", "-createdAt -updatedAt -__v ")
				.populate("adminReference", "-createdAt -updatedAt -__v ")
				.select("-_id -email -createdAt -updatedAt -__v");

			if (!auth) {
				return sendResponse(
					res,
					HTTP_STATUS.UNAUTHORIZED,
					"Email is not registered",
					"Unauthorized"
				);
			}

			if (auth.forgotEmailSent >= 5) {
				return sendResponse(
					res,
					HTTP_STATUS.FORBIDDEN,
					"Something went wrong. Please try again later"
				);
			}

			const emailVerificationToken = crypto.randomBytes(32).toString("hex");
			const emailVerificationURL = path.join(
				process.env.FRONTEND_URL,
				"reset-password",
				emailVerificationToken,
				auth._id.toString()
			);

			const referenceField = `${auth.role}Reference`;
			const name = auth[referenceField].name;

			const htmlBody = await ejsRenderFile(
				path.join(__dirname, "..", "views", "forgotPasswordEmail.ejs"),
				{
					name: name,
					emailVerificationURL: emailVerificationURL,
				}
			);

			const result = await transporter.sendMail({
				from: "skillbase@system.com",
				to: `${name} ${email}`,
				subject: "Forgot password?",
				html: htmlBody,
			});

			if (result.messageId) {
				auth.forgotEmailSent += 1;
				auth.resetPasswordToken = emailVerificationToken;
				auth.resetPasswordValidUntil = Date.now() + 60 * 60 * 1000;
				await auth.save();
				return sendResponse(res, HTTP_STATUS.OK, "Reset password email sent");
			}

			return sendResponse(
				res,
				HTTP_STATUS.UNPROCESSABLE_ENTITY,
				"Something went wrong. Please try again later"
			);
		} catch (error) {
			return sendResponse(
				res,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				"Internal server error",
				"Server error"
			);
		}
	}

	async resetPassword(req, res) {
		try {
			const { token, id, newPassword, confirmPassword } = req.body;

			const auth = await authModel.findById({
				_id: id,
			});

			if (!auth) {
				return sendResponse(res, HTTP_STATUS.NOT_FOUND, "Invalid request");
			}

			if (auth.resetPasswordValidUntil < Date.now()) {
				return sendResponse(res, HTTP_STATUS.GONE, "Expired request");
			}

			if (auth.resetPasswordToken !== token || auth.forgotEmailSent === 0) {
				return sendResponse(res, HTTP_STATUS.UNAUTHORIZED, "Invalid request");
			}

			if (newPassword !== confirmPassword) {
				return sendResponse(
					res,
					HTTP_STATUS.NOT_FOUND,
					"Passwords do not match"
				);
			}

			if (await bcrypt.compare(newPassword, auth.password)) {
				return sendResponse(
					res,
					HTTP_STATUS.NOT_FOUND,
					"Password cannot be same as the old password"
				);
			}

			const hashedPassword = await bcrypt.hash(newPassword, 10).then((hash) => {
				return hash;
			});

			const result = await authModel.findByIdAndUpdate(
				{ _id: id },
				{
					password: hashedPassword,
					forgotEmailSent: 0,
					resetPasswordValidUntil: null,
					resetPasswordToken: null,
				},
				{ new: true }
			);

			if (result.isModified) {
				return sendResponse(
					res,
					HTTP_STATUS.OK,
					"Successfully updated password"
				);
			}
		} catch (error) {
			return sendResponse(
				res,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				"Internal server error",
				"Server error"
			);
		}
	}
}

module.exports = new AuthController();
