import { Router, Request, Response } from "express";
import { User } from "../models/user";

const router = Router();

// GET /api/users - list active users (for dropdowns)
router.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await User.find({ active: true }).sort({ name: 1 });
    res.json({ users, total: users.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to load users" });
  }
});

// GET /api/users/:id - get single user
router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

// POST /api/users - create user
router.post("/users", async (req: Request, res: Response) => {
  try {
    const { name, email, role } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: "name and email are required" });
      return;
    }
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ error: "User with this email already exists" });
      return;
    }
    const user = await User.create({ name, email, role });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PATCH /api/users/:id - update user
router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const { name, email, role, active } = req.body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = email;
    if (role !== undefined) patch.role = role;
    if (active !== undefined) patch.active = active;

    const updated = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/users/:id - soft delete (set active: false)
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export { router as usersRouter };
