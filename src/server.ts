import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "./app";

dotenv.config({ override: false });

const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/oneport365";

console.log("MONGODB_URI:", MONGODB_URI.replace(/\/\/.*@/, "//*****@"));

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
