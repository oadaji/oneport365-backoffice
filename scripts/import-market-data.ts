import mongoose from "mongoose";
import * as XLSX from "xlsx";
import dotenv from "dotenv";

dotenv.config();

// Define the schema inline to avoid module resolution issues
const marketCompanySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        "Freight Forwarder",
        "Importer / Shipper",
        "Exporter",
        "Haulage or Transport",
        "Air Cargo or Express",
        "Shipping Line",
        "Logistics Company",
        "Terminal or Port Operator",
        "Trade Services",
        "Other",
      ],
      required: true,
    },
    subCategory: { type: String, default: "" },
    companyName: { type: String, required: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    services: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    website: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const MarketCompany = mongoose.model("MarketCompany", marketCompanySchema);

// Category mapping from Excel to our enum
function mapCategory(excelCategory: string): string {
  const mapping: Record<string, string> = {
    "Freight Forwarder": "Freight Forwarder",
    "Importer / Shipper": "Importer / Shipper",
    "Importer/Shipper": "Importer / Shipper",
    "Exporter": "Exporter",
    "Haulage or Transport": "Haulage or Transport",
    "Haulage/Transport": "Haulage or Transport",
    "Air Cargo or Express": "Air Cargo or Express",
    "Air Cargo/Express": "Air Cargo or Express",
    "Shipping Line": "Shipping Line",
    "Logistics Company": "Logistics Company",
    "Terminal or Port Operator": "Terminal or Port Operator",
    "Terminal/Port Operator": "Terminal or Port Operator",
    "Trade Services": "Trade Services",
  };
  return mapping[excelCategory] || "Other";
}

async function importData() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");

  // Read Excel file
  const filePath = "/Users/okpanachi/Downloads/nigeria_companies_full_20260605-2.xlsx";
  console.log(`Reading ${filePath}...`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

  console.log(`Found ${data.length} rows`);

  // Clear existing data
  const existingCount = await MarketCompany.countDocuments();
  if (existingCount > 0) {
    console.log(`Clearing ${existingCount} existing records...`);
    await MarketCompany.deleteMany({});
  }

  // Transform and insert
  const companies = data.map((row) => {
    let companyName = row["Company Name"] || "";
    let address = row["Address"] || "";

    // Fix: Some rows have a number in Company Name and the actual name in Address
    // If Company Name is purely numeric, swap with Address
    if (/^\d+$/.test(companyName) && address && !/^\d+$/.test(address)) {
      companyName = address;
      address = "";
    }

    return {
      category: mapCategory(row["Category"] || ""),
      subCategory: row["Sub-Category"] || "",
      companyName,
      address,
      city: row["City"] || "",
      state: row["State"] || "",
      services: row["Services"] || "",
      contactEmail: row["Contact Email"] || "",
      contactPhone: row["Contact Phone"] || "",
      website: row["Website"] || "",
      notes: row["Notes"] || "",
    };
  });

  console.log("Inserting companies...");
  const result = await MarketCompany.insertMany(companies);
  console.log(`Successfully imported ${result.length} companies!`);

  // Show category breakdown
  const categories = await MarketCompany.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  console.log("\nCategory breakdown:");
  categories.forEach((c: any) => {
    console.log(`  ${c._id}: ${c.count}`);
  });

  await mongoose.disconnect();
  console.log("\nDone!");
}

importData().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
