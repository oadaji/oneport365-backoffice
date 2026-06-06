import { Router, Request, Response } from "express";
import { MarketCompany } from "../models/market-company";
import XLSX from "xlsx";
import multer from "multer";

const router = Router();

// Multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/market/companies — list all with optional filters
router.get("/market/companies", async (req: Request, res: Response) => {
  try {
    const { category, state, search, page = "1", limit = "50" } = req.query;
    const query: any = {};

    if (category) query.category = category;
    if (state) query.state = state;
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { services: { $regex: search, $options: "i" } },
        { contactEmail: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [companies, total] = await Promise.all([
      MarketCompany.find(query)
        .sort({ companyName: 1 })
        .skip(skip)
        .limit(limitNum),
      MarketCompany.countDocuments(query),
    ]);

    res.json({
      companies,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/market/companies/stats — category counts
router.get("/market/companies/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await MarketCompany.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const total = await MarketCompany.countDocuments();
    res.json({ stats, total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/market/companies/:id — single company
router.get("/market/companies/:id", async (req: Request, res: Response) => {
  try {
    const company = await MarketCompany.findById(req.params.id);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(company);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/market/companies — create single company
router.post("/market/companies", async (req: Request, res: Response) => {
  try {
    const company = await MarketCompany.create(req.body);
    res.status(201).json(company);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/market/companies/:id — update company
router.patch("/market/companies/:id", async (req: Request, res: Response) => {
  try {
    const company = await MarketCompany.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(company);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/market/companies/:id — delete single company
router.delete("/market/companies/:id", async (req: Request, res: Response) => {
  try {
    const result = await MarketCompany.findByIdAndDelete(req.params.id);
    if (!result) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/market/companies/import — import from Excel file
router.post(
  "/market/companies/import",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (rows.length === 0) {
        res.status(400).json({ error: "Excel file is empty" });
        return;
      }

      // Map Excel columns to model fields
      const companies = rows.map((row) => ({
        category: row["Category"] || "Other",
        subCategory: row["Sub-Category"] || undefined,
        companyName: row["Company Name"] || "Unknown",
        address: row["Address"] || undefined,
        city: row["City"] || undefined,
        state: row["State"] || undefined,
        services: row["Services"] || undefined,
        contactEmail: row["Contact Email"] || undefined,
        contactPhone: row["Contact Phone"] || undefined,
        website: row["Website"] || undefined,
        notes: row["Notes"] || undefined,
      }));

      // Clear existing and insert new (or use insertMany for append)
      const clearExisting = req.query.clear === "true";
      if (clearExisting) {
        await MarketCompany.deleteMany({});
      }

      const result = await MarketCompany.insertMany(companies, { ordered: false });

      res.json({
        ok: true,
        imported: result.length,
        cleared: clearExisting,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/market/companies — delete all
router.delete("/market/companies", async (_req: Request, res: Response) => {
  try {
    const result = await MarketCompany.deleteMany({});
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as marketRouter };
