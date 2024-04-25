import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"; // [3] check if user there
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
const generateAccessAndRefreshTokens = async (userId) => {
  // Define an asynchronous function that generates access and refresh tokens for a given user ID
  try {
    const user = await User.findById(userId); // Find the user by their ID
    const accessToken = user.generateAccessToken(); // Generate an access token for the user
    const refreshToken = user.generateRefreshToken(); // Generate a refresh token for the user

    user.refreshToken = refreshToken; // Assign the refresh token to the user object
    await user.save({ validateBeforeSave: false }); // Save the user object without validating before saving

    return { accessToken, refreshToken }; // Return the generated access and refresh tokens
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating ref and access tokens"
    ); // If an error occurs, throw an ApiError with status code 500 and a descriptive message
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // [1] Get user details from frontend
  // [2] Validation - Check if any required fields are empty
  // [3] Check if user already exists
  // [4] Check for avatar and cover image, and upload them to Cloudinary
  // [5] Create user object and entry in the database
  // [6] Remove password and refresh token fields from the response
  // [7] Check for user creation and return response

  // [1]
  const { fullName, email, username, password } = req.body;

  // [2]
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // [3]
  const existUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // [4]
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath && !coverImageLocalPath) {
    throw new ApiError(400, "Please provide avatar or cover image");
  }

  let avatar, coverImage;

  if (avatarLocalPath) {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
      throw new ApiError(400, "Error uploading avatar");
    }
  }

  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage) {
      throw new ApiError(400, "Error uploading cover image");
    }
  }

  // [5]
  const user = await User.create({
    fullName,
    avatar: avatar ? avatar.url : "",
    coverImage: coverImage ? coverImage.url : "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // [6]
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // [7]
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // [1] Get user credentials from the request body
  // [2] Check if the user is registered
  // [3] Validate the user's credentials
  // [4] Generate access and refresh tokens for the user
  // [5] Set cookies with access and refresh tokens
  // [6] Return response indicating successful login

  // [1]
  const { email, username, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  // [2]
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // [3]
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // [4]
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true, // Set secure option to true for production
  };

  // [5]
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // [1] Remove refresh token from the user document
  // [2] Clear cookies containing access and refresh tokens
  // [3] Return response indicating successful logout

  // [1]
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  // [2]
  const options = {
    httpOnly: true,
    secure: true, // Set secure option to true for production
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "invalid refersh Token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Expired refresh Token");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accesstoken", accessToken, options)
      .cookie("refreshToken", refreshToken.options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // Extract oldpassword and newPassword from request body
  const { oldpassword, newPassword } = req.body;
  // Find user by ID
  const user = await User.findById(req.user?._id);
  // Check if old password matches user's current password
  const isPasswordCorrect = await user.isPasswordCorrect(oldpassword);

  // If old password is incorrect, throw an error
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old Password");
  }

  // Update user's password with new password
  user.password = newPassword;
  // Save user with new password (skip validation)
  await user.save({ validateBeforeSave: false });

  // Return success response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asynchandler(async (req, res) => {
  // Return current user's information
  return res
    .status(200)
    .json(200, req.user, "Current user fetched successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  // Extract fullName and email from request body
  const { fullName, email } = req.body;

  // Check if fullName and email are provided
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  // Update user's fullName and email
  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName: fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  // Return success response with updated user information
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // Get local path of uploaded avatar file
  const avatarLocalPath = req.file?.path;
  // Check if avatar file exists
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }
  // Upload avatar to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // If there's an error while uploading avatar, throw an error
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar");
  }

  // Update user's avatar URL
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  // Return success response with updated user information
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar has been updated"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file is missing");
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading coverimg");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image has been updated "));
});
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
