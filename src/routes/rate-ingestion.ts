import { Router, Request, Response } from "express";
import multer from "multer";
import {
  upsertCanonicalRates,
  queryCanonicalRates,
  archiveExpiredRates,
  getRateCountsBySource,
  deleteRatesBySource,
} from "../lib/rate-ingestion";
import { ratesheetConnector } from "../lib/connectors/ratesheet-connector";
import { searatesConnector, SEARATES_SAMPLE_FIXTURE } from "../lib/connectors/searates-connector";
import { Carrier, Port, ContainerType, ChargeCode } from "../models/reference-data";
import { ExpiryStatus } from "../lib/connectors/types";

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
      "application/vnd.ms-excel", // xls
      "text/csv",
    ];
    const allowedExtensions = [".xlsx", ".xls", ".csv"];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel (.xlsx, .xls) and CSV files are allowed"));
    }
  },
});

// ============================================================================
// Rate Ingestion Endpoints
// ============================================================================

/**
 * POST /api/rate-ingestion/import-ratesheet
 * Upload and import a rate sheet (Excel/CSV)
 */
router.post(
  "/rate-ingestion/import-ratesheet",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const result = await ratesheetConnector.fetchRates({
        type: "file",
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
      });

      if (!result.success && result.rates.length === 0) {
        res.status(400).json({
          error: "Failed to parse rate sheet",
          details: result.errors,
        });
        return;
      }

      // Upsert the parsed rates
      const ingestionResult = await upsertCanonicalRates(result.rates);

      res.json({
        success: true,
        parsed: result.rates.length,
        inserted: ingestionResult.inserted,
        updated: ingestionResult.updated,
        skipped: ingestionResult.skipped,
        parseWarnings: result.warnings,
        ingestionErrors: ingestionResult.errors.length > 0 ? ingestionResult.errors : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Import failed: ${msg}` });
    }
  }
);

/**
 * POST /api/rate-ingestion/sync/:source
 * Trigger a sync for a specific source
 */
router.post("/rate-ingestion/sync/:source", async (req: Request, res: Response) => {
  const { source } = req.params;

  try {
    switch (source) {
      case "searates": {
        // For Phase 1, test with fixture data (doesn't need API key)
        const useFixture = req.query.fixture === "true";
        if (useFixture) {
          const result = await searatesConnector.fetchFromFixture(SEARATES_SAMPLE_FIXTURE);
          const ingestionResult = await upsertCanonicalRates(result.rates);

          res.json({
            success: true,
            source: "searates",
            mode: "fixture",
            parsed: result.rates.length,
            inserted: ingestionResult.inserted,
            updated: ingestionResult.updated,
          });
          return;
        }

        // Live API requires configuration
        if (!searatesConnector.isConfigured()) {
          res.json({
            success: true,
            source: "searates",
            mode: "stub",
            message: "SeaRates API not configured. Use ?fixture=true to test with sample data.",
            hint: "Set SEARATES_API_KEY environment variable for live API",
          });
          return;
        }

        // Live API not yet implemented
        res.json({
          success: true,
          source: "searates",
          mode: "stub",
          message: "SeaRates live API sync not yet implemented (Phase 2)",
          hint: "Use ?fixture=true to test with sample data",
        });
        break;
      }

      case "maersk":
      case "freightify": {
        res.json({
          success: true,
          source,
          mode: "stub",
          message: `${source} connector not yet implemented`,
        });
        break;
      }

      default:
        res.status(400).json({ error: `Unknown source: ${source}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Sync failed: ${msg}` });
  }
});

/**
 * GET /api/rate-ingestion/canonical
 * Query canonical rates with filters
 */
router.get("/rate-ingestion/canonical", async (req: Request, res: Response) => {
  try {
    const filters = {
      source: req.query.source as string | undefined,
      origin: req.query.origin as string | undefined,
      destination: req.query.destination as string | undefined,
      equipment: req.query.equipment as string | undefined,
      carrier: req.query.carrier as string | undefined,
      expiryStatus: req.query.expiryStatus as ExpiryStatus | undefined,
      includeArchived: req.query.includeArchived === "true",
    };

    const rates = await queryCanonicalRates(filters);
    res.json(rates);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Query failed: ${msg}` });
  }
});

/**
 * GET /api/rate-ingestion/stats
 * Get rate counts by source
 */
router.get("/rate-ingestion/stats", async (_req: Request, res: Response) => {
  try {
    const counts = await getRateCountsBySource();
    res.json({ counts });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

/**
 * POST /api/rate-ingestion/archive-expired
 * Archive rates that have expired
 */
router.post("/rate-ingestion/archive-expired", async (_req: Request, res: Response) => {
  try {
    const archived = await archiveExpiredRates();
    res.json({ success: true, archived });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive expired rates" });
  }
});

/**
 * DELETE /api/rate-ingestion/source/:source
 * Delete all rates from a specific source (for re-import)
 */
router.delete("/rate-ingestion/source/:source", async (req: Request, res: Response) => {
  try {
    const source = String(req.params.source);
    const deleted = await deleteRatesBySource(source);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete rates" });
  }
});

// ============================================================================
// Reference Data Endpoints
// ============================================================================

/**
 * GET /api/reference/carriers
 */
router.get("/reference/carriers", async (_req: Request, res: Response) => {
  try {
    const carriers = await Carrier.find({ active: true }).sort({ name: 1 });
    res.json(carriers);
  } catch (err) {
    res.status(500).json({ error: "Failed to load carriers" });
  }
});

/**
 * POST /api/reference/carriers
 */
router.post("/reference/carriers", async (req: Request, res: Response) => {
  try {
    const carrier = await Carrier.create(req.body);
    res.status(201).json(carrier);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to create carrier: ${msg}` });
  }
});

/**
 * GET /api/reference/ports
 */
router.get("/reference/ports", async (req: Request, res: Response) => {
  try {
    const query: Record<string, unknown> = { active: true };
    if (req.query.country) {
      query.country = req.query.country;
    }
    if (req.query.type) {
      query.type = req.query.type;
    }
    const ports = await Port.find(query).sort({ code: 1 });
    res.json(ports);
  } catch (err) {
    res.status(500).json({ error: "Failed to load ports" });
  }
});

/**
 * POST /api/reference/ports
 */
router.post("/reference/ports", async (req: Request, res: Response) => {
  try {
    const port = await Port.create(req.body);
    res.status(201).json(port);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to create port: ${msg}` });
  }
});

/**
 * GET /api/reference/container-types
 */
router.get("/reference/container-types", async (_req: Request, res: Response) => {
  try {
    const types = await ContainerType.find({ active: true }).sort({ code: 1 });
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: "Failed to load container types" });
  }
});

/**
 * GET /api/reference/charge-codes
 */
router.get("/reference/charge-codes", async (_req: Request, res: Response) => {
  try {
    const codes = await ChargeCode.find({ active: true }).sort({ code: 1 });
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: "Failed to load charge codes" });
  }
});

/**
 * POST /api/reference/seed
 * Seed reference data (carriers, ports, container types, charge codes)
 */
router.post("/reference/seed", async (_req: Request, res: Response) => {
  try {
    const results = {
      carriers: 0,
      ports: 0,
      containerTypes: 0,
      chargeCodes: 0,
    };

    // Seed carriers
    const carriers = [
      { name: "Maersk Line", scac: "MAEU", aliases: ["Maersk", "MAERSK LINE", "A.P. Moller-Maersk"] },
      { name: "MSC", scac: "MSCU", aliases: ["Mediterranean Shipping Company", "MSC Mediterranean"] },
      { name: "CMA CGM", scac: "CMDU", aliases: ["CMA-CGM", "CMA CGM SA"] },
      { name: "Hapag-Lloyd", scac: "HLCU", aliases: ["Hapag Lloyd", "HAPAG-LLOYD AG"] },
      { name: "ONE", scac: "ONEY", aliases: ["Ocean Network Express", "ONE Line"] },
      { name: "Evergreen", scac: "EGLV", aliases: ["Evergreen Marine", "EVERGREEN LINE"] },
      { name: "COSCO", scac: "COSU", aliases: ["COSCO Shipping", "COSCO SHIPPING LINES"] },
      { name: "Yang Ming", scac: "YMLU", aliases: ["Yang Ming Marine", "YANG MING LINE"] },
      { name: "HMM", scac: "HDMU", aliases: ["Hyundai Merchant Marine", "HMM Co Ltd"] },
      { name: "ZIM", scac: "ZIMU", aliases: ["ZIM Integrated Shipping", "ZIM LINE"] },
      { name: "PIL", scac: "PCIU", aliases: ["Pacific International Lines"] },
    ];

    for (const c of carriers) {
      await Carrier.findOneAndUpdate({ scac: c.scac }, c, { upsert: true });
      results.carriers++;
    }

    // Seed ports (Nigeria-relevant)
    const ports = [
      { code: "NGAPP", name: "Apapa", city: "Lagos", country: "NG", countryName: "Nigeria", type: "ocean", aliases: ["Lagos Port", "Lagos"] },
      { code: "NGTCN", name: "Tin Can Island", city: "Lagos", country: "NG", countryName: "Nigeria", type: "ocean", aliases: ["Tin Can", "TCI"] },
      { code: "NGONE", name: "Onne", city: "Port Harcourt", country: "NG", countryName: "Nigeria", type: "ocean", aliases: [] },
      { code: "NGWAR", name: "Warri", city: "Warri", country: "NG", countryName: "Nigeria", type: "ocean", aliases: [] },
      { code: "CNSHA", name: "Shanghai", city: "Shanghai", country: "CN", countryName: "China", type: "ocean", aliases: [] },
      { code: "CNNGB", name: "Ningbo", city: "Ningbo", country: "CN", countryName: "China", type: "ocean", aliases: ["Ningbo-Zhoushan"] },
      { code: "CNTAO", name: "Qingdao", city: "Qingdao", country: "CN", countryName: "China", type: "ocean", aliases: [] },
      { code: "CNYTN", name: "Yantian", city: "Shenzhen", country: "CN", countryName: "China", type: "ocean", aliases: ["Shenzhen"] },
      { code: "SGSIN", name: "Singapore", city: "Singapore", country: "SG", countryName: "Singapore", type: "ocean", aliases: [] },
      { code: "AEJEA", name: "Jebel Ali", city: "Dubai", country: "AE", countryName: "United Arab Emirates", type: "ocean", aliases: ["Dubai"] },
      { code: "NLRTM", name: "Rotterdam", city: "Rotterdam", country: "NL", countryName: "Netherlands", type: "ocean", aliases: [] },
      { code: "DEHAM", name: "Hamburg", city: "Hamburg", country: "DE", countryName: "Germany", type: "ocean", aliases: [] },
      { code: "BEANR", name: "Antwerp", city: "Antwerp", country: "BE", countryName: "Belgium", type: "ocean", aliases: [] },
      { code: "GHTEM", name: "Tema", city: "Tema", country: "GH", countryName: "Ghana", type: "ocean", aliases: ["Accra"] },
      { code: "KEMBA", name: "Mombasa", city: "Mombasa", country: "KE", countryName: "Kenya", type: "ocean", aliases: [] },
    ];

    for (const p of ports) {
      await Port.findOneAndUpdate({ code: p.code }, p, { upsert: true });
      results.ports++;
    }

    // Seed container types
    const containerTypes = [
      { code: "20GP", description: "20ft General Purpose", category: "dry", teuFactor: 1, aliases: ["20DV", "20ST", "20'GP"] },
      { code: "40GP", description: "40ft General Purpose", category: "dry", teuFactor: 2, aliases: ["40DV", "40ST", "40'GP"] },
      { code: "40HC", description: "40ft High Cube", category: "dry", teuFactor: 2, aliases: ["40HQ", "40HI", "40'HC"] },
      { code: "20RF", description: "20ft Reefer", category: "reefer", teuFactor: 1, aliases: ["20RE", "20'RF"] },
      { code: "40RF", description: "40ft Reefer", category: "reefer", teuFactor: 2, aliases: ["40RE", "40RH", "40'RF"] },
      { code: "20OT", description: "20ft Open Top", category: "open_top", teuFactor: 1, aliases: ["20'OT"] },
      { code: "40OT", description: "40ft Open Top", category: "open_top", teuFactor: 2, aliases: ["40'OT"] },
      { code: "20FR", description: "20ft Flat Rack", category: "flat_rack", teuFactor: 1, aliases: ["20FL", "20'FR"] },
      { code: "40FR", description: "40ft Flat Rack", category: "flat_rack", teuFactor: 2, aliases: ["40FL", "40'FR"] },
    ];

    for (const ct of containerTypes) {
      await ContainerType.findOneAndUpdate({ code: ct.code }, ct, { upsert: true });
      results.containerTypes++;
    }

    // Seed charge codes
    const chargeCodes = [
      { code: "OFR", description: "Ocean Freight", category: "freight", defaultBasis: "per_container", aliases: ["FREIGHT", "BASIC FREIGHT"] },
      { code: "THC", description: "Terminal Handling Charge", category: "terminal", defaultBasis: "per_container", aliases: ["TERMINAL HANDLING", "THD"] },
      { code: "DOC", description: "Documentation Fee", category: "documentation", defaultBasis: "per_bl", aliases: ["DOCUMENTATION", "BL FEE"] },
      { code: "BAF", description: "Bunker Adjustment Factor", category: "surcharge", defaultBasis: "per_container", aliases: ["BUNKER", "FUEL SURCHARGE"] },
      { code: "CAF", description: "Currency Adjustment Factor", category: "surcharge", defaultBasis: "percentage", aliases: ["CURRENCY SURCHARGE"] },
      { code: "ISPS", description: "ISPS Security Charge", category: "surcharge", defaultBasis: "per_container", aliases: ["SECURITY", "ISPS FEE"] },
      { code: "EMS", description: "Equipment Management Surcharge", category: "surcharge", defaultBasis: "per_container", aliases: ["EQUIPMENT SURCHARGE"] },
      { code: "SEAL", description: "Seal Fee", category: "other", defaultBasis: "per_container", aliases: ["CONTAINER SEAL"] },
      { code: "AMS", description: "AMS/ENS Filing", category: "documentation", defaultBasis: "per_bl", aliases: ["ENS", "MANIFEST FEE"] },
      { code: "LSS", description: "Low Sulphur Surcharge", category: "surcharge", defaultBasis: "per_container", aliases: ["IMO 2020"] },
    ];

    for (const cc of chargeCodes) {
      await ChargeCode.findOneAndUpdate({ code: cc.code }, cc, { upsert: true });
      results.chargeCodes++;
    }

    res.json({
      success: true,
      seeded: results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Seed failed: ${msg}` });
  }
});

export { router as rateIngestionRouter };
