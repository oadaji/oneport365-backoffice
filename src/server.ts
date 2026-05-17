import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "./app";

// Only load .env file in development — in production Railway injects env vars directly
if (!process.env.RAILWAY_ENVIRONMENT) {
  dotenv.config();
}

const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/oneport365";

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
