import { ApiError } from "../utils/ApiError.js"; // Import the ApiError class for handling API errors
import { asyncHandler } from "../utils/asynchandler.js"; // Import the asyncHandler utility function
import jwt from "jsonwebtoken"; // Import the jsonwebtoken library for JWT operations
import { User } from "../models/user.model.js"; // Import the User model

export const verifyJWT = asyncHandler(async (req, res, next) => {
  // Define an asynchronous function to verify JWT tokens using asyncHandler middleware
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer", ""); // Extract the JWT token from either cookies or the Authorization header

    if (!token) {
      // If token is not present
      throw new ApiError(401, "Unauthorized request"); // Throw an API error with status code 401 and message
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET); // Verify the JWT token using the secret key

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    ); // Find the user by the decoded token's ID, excluding password and refreshToken

    if (!user) {
      // If user is not found
      // TODO: Discuss about frontend handling
      throw new ApiError(401, "Invalid Access Token"); // Throw an API error with status code 401 and message
    }

    req.user = user; // Set the user in the request object
    next(); // Move to the next middleware
  } catch (error) {
    // Catch any errors that occur during token verification or user retrieval
    throw new ApiError(401, error?.message || "Invalid access token"); // Throw an API error with status code 401 and either the error message or a default message
  }
});
