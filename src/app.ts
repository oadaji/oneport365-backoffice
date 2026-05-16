import express from "express";
import cors from "cors";
import path from "path";
import routes from "./routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", routes);

// Serve React frontend in production
const clientBuild = path.join(__dirname, "..", "client", "build");
app.use(express.static(clientBuild));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientBuild, "index.html"));
});

export default app;
