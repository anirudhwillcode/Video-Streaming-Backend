import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"; // [3] check if user there
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation-not empty
  // check if user already exists
  // check for images,avatar
  // upload them to cloudinary
  // create user object-create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return response

  // [1]

  const { fullName, email, username, password } = req.body;
  console.log("email: ", email);

  // [2]

  // you can also write like this  also
  //    if(fullName===""){
  //     throw new ApiError(400,"Full Name is Required")
  //    }
  if (
    //This code checks if any of the fields (fullName, email, username, password) are empty. If any field is empty, it returns `true`; otherwise, it returns `false`.
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //[3]

  const existUser = User.findOne({
    $or: [{ username }, { email }],
  });

  if (existUser) {
    throw new ApiError(409, "User With email or username already exists");
  }

  //[4]
  /* even though req.body ( req.body is given by express) all user data milti he but hum middle ware 
      define kardiya hena so middleware gives us extra fields to work with */

  /* req.files is given by MULTER as you can see there is a wierd looking ? in this code its called optional 
       we do not know if there exists or not thats why we are using ? optional */

  /* all these are coming from the user.router.js where we have defined the upload fields section from there
     we are obtaining avatar and we are obtaining the first property using [0] */

  /* WHATS WITH THE PATH BRO -- avatar se first property me ek method milti he us method ko use karke jo bhi uska 
       poora path he ph multer me upload kiya he woh apko miljayega
       --- MULTER ALREADY HAS TAKEN THE FILE TO THE SERVER WHEN WE PRESS SUBMIT------   
       - HOW??-- 
       - in multer.middleware.js as you can see we have told the multer that take the destination and there 
          is a complete path there where u keep the file */

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "BRO give Avatar bro");
  }

  //[5]

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "BRO give Avatar bro");
  }

  //[6]
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});

export { registerUser };

/*

1.get all the user data such as name,dob,username,password
2.add restrictions to the setting of password
3.store user data and password
4.print message that a user has been registered into the website
6.provide access to the user the contents of the website
7.allow user to login to the website



*/
