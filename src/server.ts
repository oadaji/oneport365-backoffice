import mongoose from "mongoose";
import app from "./app";

// In development, run: node -r dotenv/config dist/server.js
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/oneport365";

console.log("PORT:", PORT);
console.log("MONGODB_URI:", MONGODB_URI.substring(0, 30) + "...");

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
