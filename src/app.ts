import express from "express";
import cors from "cors";
import path from "path";
import routes from "./routes";
import { authMiddleware, generateToken } from "./middleware/auth";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Login endpoint (before auth middleware)
app.post("/api/auth/login", (req, res) => {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    res.json({ token: "no-auth" });
    return;
  }
  const { password } = req.body;
  if (password === appPassword) {
    res.json({ token: generateToken(appPassword) });
  } else {
    res.status(401).json({ error: "Wrong password" });
  }
});

// Auth middleware — protects all API routes
app.use(authMiddleware);

app.use("/api", routes);

// Serve React frontend in production
const clientBuild = path.join(__dirname, "..", "client", "build");
app.use(express.static(clientBuild));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(clientBuild, "index.html"));
});

export default app;
