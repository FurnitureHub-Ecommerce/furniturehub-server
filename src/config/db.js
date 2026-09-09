/*
@Author: Minh Truong

connectDB function to connect to MongoDB using Mongoose

step 1: Import mongoose
step 2: Create connectDB function
step 3: Export connectDB
*/

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;