import mongoose from "mongoose";

const connDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected Succesfully");
  } catch (error) {
    console.log("Database not connected", error);
  }
};

export default connDB;
