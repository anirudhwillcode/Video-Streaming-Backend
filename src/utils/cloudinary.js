// Import the Cloudinary v2 SDK as 'cloudinary' alias
import {v2 as cloudinary} from "cloudinary"

// Import the 'fs' module for file system operations like read, write, etc.
import fs from "fs"

// Configure Cloudinary with your credentials from environment variables
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Define an asynchronous function to upload a file to Cloudinary
const uploadOnCloudinary = async (localFilePath) => {
    try {
        // Check if the localFilePath is empty or null, if so return null
        if (!localFilePath) return null
        
        // Upload the file to Cloudinary with the specified options
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto" // Automatically detect the resource type
        })
        
        // Log a success message with the URL of the uploaded file
        console.log("File is uploaded", response.url);
        
        // Return the response object from Cloudinary
        return response;
    } catch(error) {
        // If an error occurs during the upload process
        // Remove the locally saved temporary file
        fs.unlinkSync(localFilePath);
    }
}

// Export the 'uploadOnCloudinary' function for use in other modules
export { uploadOnCloudinary };
