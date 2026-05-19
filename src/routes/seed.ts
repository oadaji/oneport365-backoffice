import { Router, Request, Response } from "express";
import { Company } from "../models/company";
import { Contact } from "../models/contact";
import { Email } from "../models/email";
import { Rfq } from "../models/rfq";
import { Quote } from "../models/quote";
import { Partner } from "../models/partner";
import { OceanFreightRate, HaulageImportRate, HaulageExportRate, OtherCharge } from "../models/rate";
import { RateBenchmark } from "../models/market";

const router = Router();

// POST /api/clear — wipe all synced data (CRM, emails, RFQs, quotes)
router.post("/clear", async (_req: Request, res: Response) => {
  try {
    const [companies, contacts, emails, rfqs, quotes] = await Promise.all([
      Company.deleteMany({}),
      Contact.deleteMany({}),
      Email.deleteMany({}),
      Rfq.deleteMany({}),
      Quote.deleteMany({}),
    ]);
    res.json({
      cleared: {
        companies: companies.deletedCount,
        contacts: contacts.deletedCount,
        emails: emails.deletedCount,
        rfqs: rfqs.deletedCount,
        quotes: quotes.deletedCount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear data" });
  }
});

router.post("/seed", async (_req: Request, res: Response) => {
  try {
    // ── Companies ──────────────────────────────────────────────
    const companies = await Company.insertMany([
      { name: "Tamrose Procurement", domain: "tamrose.com", industry: "Mining", country: "Netherlands", status: "active", tradeCorridors: ["Europe-Nigeria"], cargoTypes: ["FCL"] },
      { name: "Sarten Shipping", domain: "sarten.com.tr", industry: "Manufacturing", country: "Turkey", status: "active", tradeCorridors: ["Med-Nigeria"], cargoTypes: ["FCL", "LCL"] },
      { name: "XPA Logistics", domain: "xpalogistics.com", industry: "Logistics", country: "China", status: "active", tradeCorridors: ["China-Nigeria"], cargoTypes: ["FCL"] },
      { name: "Dangote Industries", domain: "dangote.com", industry: "Conglomerate", country: "Nigeria", status: "active", tradeCorridors: ["China-Nigeria", "Europe-Nigeria"], cargoTypes: ["FCL", "Breakbulk"] },
      { name: "BUA Cement", domain: "buacement.com", industry: "Construction", country: "Nigeria", status: "active", tradeCorridors: ["China-Nigeria"], cargoTypes: ["FCL"] },
      { name: "Flour Mills Nigeria", domain: "fmnplc.com", industry: "Food & Beverage", country: "Nigeria", status: "lead", tradeCorridors: ["Americas-Nigeria"], cargoTypes: ["FCL", "Bulk"] },
      { name: "Al-Hassan Electronics", domain: "alhassan.ng", industry: "Electronics", country: "Nigeria", status: "active", tradeCorridors: ["China-Nigeria"], cargoTypes: ["FCL"] },
      { name: "Zenith Exports", domain: "zenithexports.ng", industry: "Export", country: "Nigeria", status: "lead", tradeCorridors: ["Nigeria-Europe"], cargoTypes: ["FCL", "LCL"] },
    ]);

    // ── Contacts ──────────────────────────────────────────────
    const contacts = await Contact.insertMany([
      { companyId: companies[0]._id, firstName: "Babatope", lastName: "Ayeni", email: "procurement@tamrose.com", source: "email", isPrimary: true, jobTitle: "Procurement Manager" },
      { companyId: companies[1]._id, firstName: "Demir", lastName: "Guzel", email: "demirguzel@sarten.com.tr", source: "email", isPrimary: true, jobTitle: "Export Manager" },
      { companyId: companies[2]._id, firstName: "Johnny", lastName: "Hong", email: "johnnyhong@xpalogistics.com", source: "email", isPrimary: true, jobTitle: "Sales Director" },
      { companyId: companies[3]._id, firstName: "Aminu", lastName: "Dantata", email: "aminu@dangote.com", source: "email", isPrimary: true, jobTitle: "Logistics Head" },
      { companyId: companies[4]._id, firstName: "Yusuf", lastName: "Rabiu", email: "yusuf@buacement.com", source: "email", isPrimary: true },
      { companyId: companies[5]._id, firstName: "Folake", lastName: "Okonkwo", email: "folake@fmnplc.com", source: "email", isPrimary: true },
      { companyId: companies[6]._id, firstName: "Fatima", lastName: "Al-Hassan", email: "fatima@alhassan.ng", source: "whatsapp", isPrimary: true, whatsappPhone: "+234 803 456 7890" },
      { companyId: companies[7]._id, firstName: "Chidi", lastName: "Nwosu", email: "chidi@zenithexports.ng", source: "email", isPrimary: true },
      { firstName: "Yovanka", lastName: "Appelgryn", email: "yovanka@savino.com", source: "email", isPrimary: true, jobTitle: "Freight Manager" },
      { firstName: "Daniel", lastName: "Willoughby", email: "daniel.w@globalfreight.co.uk", source: "email", isPrimary: true },
      { firstName: "Abu-Sufyan", lastName: "Abdullahi", email: "abusufyan@tradelink.se", source: "email", isPrimary: true },
    ]);

    // ── Emails ──────────────────────────────────────────────
    const emails = await Email.insertMany([
      { uid: "seed-001", fromName: "Tamrose PROCUREMENT", fromEmail: "procurement@tamrose.com", subject: "ZILOS26050023 Tamrose Request Aurora Diamond - Rotterdam stock shipment to Nigeria", body: "Dear Team,\n\nPlease find attached additional documents and info for booking ref ZILOS26050023.\n\nBest regards,\nBabatope Ayeni", emailType: "customer-rfq", receivedAt: new Date("2026-05-14T09:09:00Z"), receivedInbox: "sales inbox", contactId: contacts[0]._id },
      { uid: "seed-002", fromName: "Abu-Sufyan Abdullahi", fromEmail: "abusufyan@tradelink.se", subject: "Re: REQ- Door to Port (SWE to NIG) - Various Items", body: "Hi team,\n\nWe need a door to port quote from Sweden to Nigeria. Cargo: mixed machinery parts, 2x40HC containers. POL: Gothenburg, POD: Apapa.\n\nPlease advise rates and transit time.\n\nRegards,\nAbu-Sufyan", emailType: "customer-rfq", receivedAt: new Date("2026-05-14T08:30:00Z"), contactId: contacts[10]._id },
      { uid: "seed-003", fromName: "johnnyhong@xpalogistics.com", fromEmail: "johnnyhong@xpalogistics.com", subject: "Re: Re: TK EK ET from china to LOS, we need rate", body: "Hello,\n\nWe need FCL rates from Qingdao to Lagos for auto parts. 3x40ft containers. Commodity: automotive spare parts. HS Code: 8708.99.\n\nPlease send best rate.\n\nJohnny Hong\nXPA Logistics", emailType: "customer-rfq", receivedAt: new Date("2026-05-14T07:45:00Z"), contactId: contacts[2]._id },
      { uid: "seed-004", fromName: "Yovanka Appelgryn - Savino Del Bene", fromEmail: "yovanka@savino.com", subject: "RE: EXW Freight - DG 1×40' - Batteries - Istanbul to Lagos", body: "Good day,\n\nPlease quote for 1x40ft DG container from Istanbul to Lagos.\n\nCommodity: Lithium batteries (DG Class 9)\nWeight: 18 MT\nVolume: 55 CBM\nIncoterm: EXW\nPickup: Tuzla Industrial Zone, Istanbul\n\nRegards,\nYovanka", emailType: "customer-rfq", receivedAt: new Date("2026-05-14T06:15:00Z"), contactId: contacts[8]._id },
      { uid: "seed-005", fromName: "Daniel WILLOUGHBY", fromEmail: "daniel.w@globalfreight.co.uk", subject: "RFQ _DOOR-TO-DOOR FREIGHT ACTUATORS", body: "Hi OnePort team,\n\nWe need a door-to-door quote for actuators from Birmingham UK to Warri, Nigeria.\n\n2x20ft containers\nWeight: 22 MT per container\nHS Code: 8412.31\n\nPlease advise.\n\nDaniel Willoughby", emailType: "customer-rfq", receivedAt: new Date("2026-05-13T14:20:00Z"), contactId: contacts[9]._id },
      { uid: "seed-006", fromName: "Aminu Dantata", fromEmail: "aminu@dangote.com", subject: "Urgent: Cement plant equipment from China", body: "Dear OnePort,\n\nWe need to ship cement plant equipment from Shanghai to Apapa.\n\n5x40HC containers + 2 breakbulk pieces\nTotal weight: 180 MT\nCommodity: Industrial machinery\nHS Code: 8474.20\nIncoterm: FOB Shanghai\n\nNeed rates ASAP.\n\nAminu Dantata\nDangote Industries", emailType: "customer-rfq", receivedAt: new Date("2026-05-13T11:00:00Z"), contactId: contacts[3]._id },
      { uid: "seed-007", fromName: "Folake Okonkwo", fromEmail: "folake@fmnplc.com", subject: "Wheat import - US Gulf to Lagos", body: "Hello,\n\nWe are looking at importing wheat from US Gulf ports to Lagos.\n\nBulk cargo, approximately 25,000 MT\nPort of loading: Houston or New Orleans\nPort of discharge: Apapa\n\nPlease advise on vessel availability and rates.\n\nFolake Okonkwo\nFlour Mills of Nigeria", emailType: "customer-rfq", receivedAt: new Date("2026-05-12T16:00:00Z"), contactId: contacts[5]._id },
    ]);

    // ── RFQs ──────────────────────────────────────────────
    await Rfq.insertMany([
      {
        emailId: emails[0]._id, ref: "RFQ-2605-0587", emailType: "customer-rfq", status: "info_needed",
        companyId: companies[0]._id, contactId: contacts[0]._id,
        fields: [
          { k: "Company", v: "Tamrose PROCUREMENT", ok: true }, { k: "Contact", v: "Tamrose P...", ok: true }, { k: "Email", v: "procurement@tamrose.com", ok: true },
          { k: "Commodity", v: "Aurora Diamond", ok: true }, { k: "HS Code", v: "", ok: false }, { k: "Tonnage", v: "In attached (not extracted)", ok: true },
          { k: "Volume", v: "", ok: false }, { k: "POL", v: "Rotterdam (NLRTM)", ok: true }, { k: "POD", v: "Onne (NGONE)", ok: true }, { k: "Pick-up", v: "Marinrtrans Benelux...", ok: true },
          { k: "Container", v: "", ok: false }, { k: "Cargo class", v: "", ok: false }, { k: "Incoterm", v: "", ok: false }, { k: "Target Price", v: "", ok: false },
        ],
        missingFields: ["HS Code", "Volume", "Container", "Cargo class", "Incoterm"],
        followUpDraft: "Dear Tamrose Procurement,\n\nThank you for your booking request ref ZILOS26050023 for Aurora Diamond from Rotterdam to Onne.\n\nTo complete the quotation, could you kindly provide:\n- HS Code for Aurora Diamond\n- Total volume (CBM)\n- Container type and quantity required\n- Cargo classification (general/DG)\n- Preferred Incoterm\n\nBest regards,\nOnePort 365 Commercial Team",
      },
      {
        emailId: emails[1]._id, ref: "RFQ-2605-0588", emailType: "customer-rfq", status: "info_needed",
        contactId: contacts[10]._id,
        fields: [
          { k: "Contact", v: "Abu-Sufyan Abdullahi", ok: true }, { k: "Email", v: "abusufyan@tradelink.se", ok: true },
          { k: "Commodity", v: "Mixed machinery parts", ok: true }, { k: "POL", v: "Gothenburg (SEGOT)", ok: true }, { k: "POD", v: "Apapa (NGAPP)", ok: true },
          { k: "Container", v: "2x40HC", ok: true },
        ],
        missingFields: ["Company", "HS Code", "Tonnage", "Volume", "Incoterm"],
      },
      {
        emailId: emails[2]._id, ref: "RFQ-2605-0589", emailType: "customer-rfq", status: "info_needed",
        companyId: companies[2]._id, contactId: contacts[2]._id,
        fields: [
          { k: "Company", v: "XPA Logistics", ok: true }, { k: "Contact", v: "Johnny Hong", ok: true }, { k: "Email", v: "johnnyhong@xpalogistics.com", ok: true },
          { k: "Commodity", v: "Automotive spare parts", ok: true }, { k: "HS Code", v: "8708.99", ok: true },
          { k: "POL", v: "Qingdao (CNTAO)", ok: true }, { k: "POD", v: "Lagos (NGAPP)", ok: true }, { k: "Container", v: "3x40FT", ok: true },
        ],
        missingFields: ["Tonnage", "Volume", "Incoterm"],
      },
      {
        emailId: emails[3]._id, ref: "RFQ-2605-0590", emailType: "customer-rfq", status: "ready",
        contactId: contacts[8]._id,
        fields: [
          { k: "Contact", v: "Yovanka Appelgryn", ok: true }, { k: "Email", v: "yovanka@savino.com", ok: true },
          { k: "Commodity", v: "Lithium batteries (DG Class 9)", ok: true }, { k: "HS Code", v: "8507.60", ok: true },
          { k: "Tonnage", v: "18 MT", ok: true }, { k: "Volume", v: "55 CBM", ok: true },
          { k: "POL", v: "Istanbul (TRIST)", ok: true }, { k: "POD", v: "Lagos (NGAPP)", ok: true },
          { k: "Container", v: "1x40FT", ok: true }, { k: "Cargo class", v: "Dangerous Goods - Class 9", ok: true },
          { k: "Incoterm", v: "EXW", ok: true }, { k: "Pick-up", v: "Tuzla Industrial Zone, Istanbul", ok: true },
        ],
        missingFields: [],
      },
      {
        emailId: emails[4]._id, ref: "RFQ-2605-0591", emailType: "customer-rfq", status: "info_needed",
        contactId: contacts[9]._id,
        fields: [
          { k: "Contact", v: "Daniel Willoughby", ok: true }, { k: "Email", v: "daniel.w@globalfreight.co.uk", ok: true },
          { k: "Commodity", v: "Actuators", ok: true }, { k: "HS Code", v: "8412.31", ok: true },
          { k: "Tonnage", v: "22 MT per container", ok: true }, { k: "POL", v: "Birmingham, UK (GBFXT)", ok: true }, { k: "POD", v: "Warri (NGWAR)", ok: true },
          { k: "Container", v: "2x20FT", ok: true },
        ],
        missingFields: ["Company", "Volume", "Incoterm"],
      },
      {
        emailId: emails[5]._id, ref: "RFQ-2605-0592", emailType: "customer-rfq", status: "ready",
        companyId: companies[3]._id, contactId: contacts[3]._id,
        fields: [
          { k: "Company", v: "Dangote Industries", ok: true }, { k: "Contact", v: "Aminu Dantata", ok: true }, { k: "Email", v: "aminu@dangote.com", ok: true },
          { k: "Commodity", v: "Industrial machinery - cement plant equipment", ok: true }, { k: "HS Code", v: "8474.20", ok: true },
          { k: "Tonnage", v: "180 MT", ok: true }, { k: "Volume", v: "Est. 400 CBM", ok: true },
          { k: "POL", v: "Shanghai (CNSHA)", ok: true }, { k: "POD", v: "Apapa (NGAPP)", ok: true },
          { k: "Container", v: "5x40HC + 2 breakbulk", ok: true }, { k: "Incoterm", v: "FOB Shanghai", ok: true },
        ],
        missingFields: [],
      },
      {
        emailId: emails[6]._id, ref: "RFQ-2605-0593", emailType: "customer-rfq", status: "info_needed",
        companyId: companies[5]._id, contactId: contacts[5]._id,
        fields: [
          { k: "Company", v: "Flour Mills of Nigeria", ok: true }, { k: "Contact", v: "Folake Okonkwo", ok: true }, { k: "Email", v: "folake@fmnplc.com", ok: true },
          { k: "Commodity", v: "Wheat (bulk)", ok: true }, { k: "Tonnage", v: "25,000 MT", ok: true },
          { k: "POL", v: "Houston / New Orleans (USHOU)", ok: true }, { k: "POD", v: "Apapa (NGAPP)", ok: true },
        ],
        missingFields: ["HS Code", "Volume", "Container", "Incoterm"],
      },
    ]);

    // ── Partners ──────────────────────────────────────────────
    await Partner.insertMany([
      { name: "MSC Mediterranean", email: "rates@msc.com", categories: ["FCL", "LCL"], tradelanes: ["WAF", "EAF"], active: true },
      { name: "Maersk Line", email: "quotes@maersk.com", categories: ["FCL", "LCL", "Reefer"], tradelanes: ["WAF", "Global"], active: true },
      { name: "CMA CGM", email: "pricing@cmacgm.com", categories: ["FCL", "LCL"], tradelanes: ["WAF", "Med"], active: true },
      { name: "Hapag-Lloyd", email: "rates@hapag-lloyd.com", categories: ["FCL", "DG"], tradelanes: ["WAF", "N.Europe"], active: true },
      { name: "COSCO Shipping", email: "sales@cosco.com", categories: ["FCL"], tradelanes: ["China-WAF"], active: true },
      { name: "PIL Pacific", email: "nigeria@pilship.com", categories: ["FCL", "LCL"], tradelanes: ["Asia-WAF"], active: true },
      { name: "Grimaldi Lines", email: "roro@grimaldi.com", categories: ["RORO", "Breakbulk"], tradelanes: ["Europe-WAF"], active: true },
    ]);

    // ── Ocean Freight Rates ──────────────────────────────────────
    await OceanFreightRate.insertMany([
      // China → Nigeria
      { carrier: "MSC", polCode: "CNSHA", podCode: "NGAPP", originCountry: "China", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1850, amount40ft: 2950, amount40hc: 3100, expiryDate: new Date("2026-06-30"), transitTime: "35-40 days", freeTime: "14 days" },
      { carrier: "MSC", polCode: "CNSHA", podCode: "NGTCN", originCountry: "China", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1900, amount40ft: 3000, amount40hc: 3150, expiryDate: new Date("2026-06-30"), transitTime: "35-40 days", freeTime: "14 days" },
      { carrier: "Maersk", polCode: "CNSHA", podCode: "NGAPP", originCountry: "China", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 2100, amount40ft: 3400, amount40hc: 3550, expiryDate: new Date("2026-06-15"), transitTime: "32-35 days", freeTime: "14 days" },
      { carrier: "CMA CGM", polCode: "CNSHA", podCode: "NGAPP", originCountry: "China", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1950, amount40ft: 3100, amount40hc: 3250, expiryDate: new Date("2026-06-20"), transitTime: "33-38 days", freeTime: "14 days" },
      { carrier: "COSCO", polCode: "CNTAO", podCode: "NGAPP", originCountry: "China", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1750, amount40ft: 2800, amount40hc: 2950, expiryDate: new Date("2026-06-30"), transitTime: "36-42 days", freeTime: "14 days" },
      { carrier: "COSCO", polCode: "CNNGB", podCode: "NGAPP", originCountry: "China", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1800, amount40ft: 2900, amount40hc: 3050, expiryDate: new Date("2026-07-15"), transitTime: "34-38 days", freeTime: "14 days" },
      { carrier: "PIL", polCode: "CNYTN", podCode: "NGAPP", originCountry: "China", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "freight_only", currency: "USD", amount20ft: 1650, amount40ft: 2650, amount40hc: 2800, expiryDate: new Date("2026-07-31"), transitTime: "38-44 days", freeTime: "14 days" },
      { carrier: "Maersk", polCode: "CNTAO", podCode: "NGTCN", originCountry: "China", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 2050, amount40ft: 3300, amount40hc: 3450, expiryDate: new Date("2026-06-15"), transitTime: "34-38 days", freeTime: "14 days" },
      // Europe → Nigeria
      { carrier: "Hapag-Lloyd", polCode: "DEHAM", podCode: "NGAPP", originCountry: "Germany", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1600, amount40ft: 2600, amount40hc: 2750, expiryDate: new Date("2026-06-30"), transitTime: "21-25 days", freeTime: "14 days" },
      { carrier: "MSC", polCode: "NLRTM", podCode: "NGAPP", originCountry: "Netherlands", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1550, amount40ft: 2500, amount40hc: 2650, expiryDate: new Date("2026-06-30"), transitTime: "18-22 days", freeTime: "14 days" },
      { carrier: "MSC", polCode: "NLRTM", podCode: "NGONE", originCountry: "Netherlands", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1700, amount40ft: 2750, amount40hc: 2900, expiryDate: new Date("2026-07-15"), transitTime: "22-26 days", freeTime: "14 days" },
      { carrier: "Hapag-Lloyd", polCode: "BEANR", podCode: "NGAPP", originCountry: "Belgium", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1580, amount40ft: 2550, amount40hc: 2700, expiryDate: new Date("2026-07-31"), transitTime: "19-23 days", freeTime: "14 days" },
      { carrier: "Maersk", polCode: "GBFXT", podCode: "NGAPP", originCountry: "UK", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1700, amount40ft: 2800, amount40hc: 2950, expiryDate: new Date("2026-06-15"), transitTime: "16-20 days", freeTime: "14 days" },
      { carrier: "Maersk", polCode: "GBFXT", podCode: "NGWAR", originCountry: "UK", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1850, amount40ft: 3000, amount40hc: 3150, expiryDate: new Date("2026-06-15"), transitTime: "20-24 days", freeTime: "14 days" },
      // Turkey → Nigeria
      { carrier: "CMA CGM", polCode: "TRIST", podCode: "NGAPP", originCountry: "Turkey", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1400, amount40ft: 2200, amount40hc: 2350, expiryDate: new Date("2026-06-25"), transitTime: "14-18 days", freeTime: "14 days" },
      { carrier: "MSC", polCode: "TRIST", podCode: "NGAPP", originCountry: "Turkey", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1350, amount40ft: 2150, amount40hc: 2300, expiryDate: new Date("2026-07-20"), transitTime: "15-19 days", freeTime: "14 days" },
      { carrier: "Hapag-Lloyd", polCode: "TRIST", podCode: "NGTCN", originCountry: "Turkey", destCountry: "Nigeria", commodityType: "DG", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1800, amount40ft: 2900, amount40hc: 3100, expiryDate: new Date("2026-06-30"), transitTime: "15-20 days", freeTime: "14 days" },
      // India → Nigeria
      { carrier: "PIL", polCode: "INNSZ", podCode: "NGAPP", originCountry: "India", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1300, amount40ft: 2100, amount40hc: 2250, expiryDate: new Date("2026-06-30"), transitTime: "20-25 days", freeTime: "14 days" },
      { carrier: "MSC", polCode: "INMUN", podCode: "NGAPP", originCountry: "India", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1350, amount40ft: 2200, amount40hc: 2350, expiryDate: new Date("2026-07-15"), transitTime: "22-28 days", freeTime: "14 days" },
      // Middle East → Nigeria
      { carrier: "MSC", polCode: "AEJEA", podCode: "NGAPP", originCountry: "UAE", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1200, amount40ft: 1950, amount40hc: 2100, expiryDate: new Date("2026-07-31"), transitTime: "18-22 days", freeTime: "14 days" },
      { carrier: "CMA CGM", polCode: "AEJEA", podCode: "NGTCN", originCountry: "UAE", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1250, amount40ft: 2000, amount40hc: 2150, expiryDate: new Date("2026-07-15"), transitTime: "19-24 days", freeTime: "14 days" },
      // West Africa regional
      { carrier: "PIL", polCode: "GHTEM", podCode: "NGAPP", originCountry: "Ghana", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 650, amount40ft: 1050, amount40hc: 1150, expiryDate: new Date("2026-08-31"), transitTime: "5-7 days", freeTime: "7 days" },
      // East Africa
      { carrier: "MSC", polCode: "KEMBA", podCode: "NGAPP", originCountry: "Kenya", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1450, amount40ft: 2350, amount40hc: 2500, expiryDate: new Date("2026-07-31"), transitTime: "25-30 days", freeTime: "14 days" },
      // Singapore → Nigeria
      { carrier: "PIL", polCode: "SGSIN", podCode: "NGAPP", originCountry: "Singapore", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "all_in", currency: "USD", amount20ft: 1500, amount40ft: 2400, amount40hc: 2550, expiryDate: new Date("2026-07-15"), transitTime: "28-33 days", freeTime: "14 days" },
      // Spot rates (shorter validity)
      { carrier: "MSC", polCode: "CNSHA", podCode: "NGAPP", originCountry: "China", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "spot", currency: "USD", amount20ft: 1700, amount40ft: 2750, amount40hc: 2900, expiryDate: new Date("2026-05-31"), transitTime: "35-40 days", freeTime: "7 days" },
      { carrier: "Maersk", polCode: "NLRTM", podCode: "NGAPP", originCountry: "Netherlands", destCountry: "Nigeria", commodityType: "general", equipmentType: "40ft", rateType: "spot", currency: "USD", amount20ft: 1400, amount40ft: 2300, amount40hc: 2450, expiryDate: new Date("2026-05-28"), transitTime: "18-22 days", freeTime: "7 days" },
    ]);

    // ── Haulage Import Rates (NGN) ──────────────────────────────
    await HaulageImportRate.insertMany([
      // APM Terminals Apapa → various Lagos destinations
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Ikeja", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 450000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Ikeja", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 320000, shipmentType: "fcl", equipmentType: "20ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Victoria Island", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 380000, shipmentType: "fcl", equipmentType: "20ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Victoria Island", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 520000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Ikorodu", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 550000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Lekki", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 580000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Ajah", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 620000, shipmentType: "fcl", equipmentType: "40ft" },
      // APM Terminals Apapa → outside Lagos
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Sagamu", destState: "Ogun", destCity: "Sagamu", currency: "NGN", price: 750000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Ota", destState: "Ogun", destCity: "Ota", currency: "NGN", price: 680000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Ibadan North", destState: "Oyo", destCity: "Ibadan", currency: "NGN", price: 950000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Aba South", destState: "Abia", destCity: "Aba", currency: "NGN", price: 1800000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Onitsha North", destState: "Anambra", destCity: "Onitsha", currency: "NGN", price: 1650000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Kano Municipal", destState: "Kano", destCity: "Kano", currency: "NGN", price: 2800000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", destLga: "Abuja Municipal", destState: "FCT", destCity: "Abuja", currency: "NGN", price: 2200000, shipmentType: "fcl", equipmentType: "40ft" },
      // Tin Can Island
      { terminalName: "Tin Can Island", portCode: "NGTCN", destLga: "Apapa", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 320000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Tin Can Island", portCode: "NGTCN", destLga: "Ikeja", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 480000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Tin Can Island", portCode: "NGTCN", destLga: "Ikorodu", destState: "Lagos", destCity: "Lagos", currency: "NGN", price: 580000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Tin Can Island", portCode: "NGTCN", destLga: "Sagamu", destState: "Ogun", destCity: "Sagamu", currency: "NGN", price: 780000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Tin Can Island", portCode: "NGTCN", destLga: "Abuja Municipal", destState: "FCT", destCity: "Abuja", currency: "NGN", price: 2350000, shipmentType: "fcl", equipmentType: "40ft" },
      // Onne Port
      { terminalName: "Onne Port", portCode: "NGONE", destLga: "Trans Amadi", destState: "Rivers", destCity: "Port Harcourt", currency: "NGN", price: 280000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Onne Port", portCode: "NGONE", destLga: "Port Harcourt City", destState: "Rivers", destCity: "Port Harcourt", currency: "NGN", price: 350000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Onne Port", portCode: "NGONE", destLga: "Aba South", destState: "Abia", destCity: "Aba", currency: "NGN", price: 550000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Onne Port", portCode: "NGONE", destLga: "Onitsha North", destState: "Anambra", destCity: "Onitsha", currency: "NGN", price: 850000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Onne Port", portCode: "NGONE", destLga: "Enugu North", destState: "Enugu", destCity: "Enugu", currency: "NGN", price: 750000, shipmentType: "fcl", equipmentType: "40ft" },
      // Warri Port
      { terminalName: "Warri Port", portCode: "NGWAR", destLga: "Warri South", destState: "Delta", destCity: "Warri", currency: "NGN", price: 250000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Warri Port", portCode: "NGWAR", destLga: "Benin City", destState: "Edo", destCity: "Benin", currency: "NGN", price: 550000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Warri Port", portCode: "NGWAR", destLga: "Asaba", destState: "Delta", destCity: "Asaba", currency: "NGN", price: 450000, shipmentType: "fcl", equipmentType: "40ft" },
    ]);

    // ── Haulage Export Rates (NGN) ──────────────────────────────
    await HaulageExportRate.insertMany([
      // Lagos origins → Apapa
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Ikeja", originState: "Lagos", originCity: "Lagos", currency: "NGN", price: 420000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Ikeja", originState: "Lagos", originCity: "Lagos", currency: "NGN", price: 300000, shipmentType: "fcl", equipmentType: "20ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Lekki", originState: "Lagos", originCity: "Lagos", currency: "NGN", price: 550000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Ikorodu", originState: "Lagos", originCity: "Lagos", currency: "NGN", price: 520000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Victoria Island", originState: "Lagos", originCity: "Lagos", currency: "NGN", price: 480000, shipmentType: "fcl", equipmentType: "40ft" },
      // Outside Lagos → Apapa
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Ota", originState: "Ogun", originCity: "Ota", currency: "NGN", price: 650000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Sagamu", originState: "Ogun", originCity: "Sagamu", currency: "NGN", price: 720000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Ibadan North", originState: "Oyo", originCity: "Ibadan", currency: "NGN", price: 900000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Onitsha North", originState: "Anambra", originCity: "Onitsha", currency: "NGN", price: 1600000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Abuja Municipal", originState: "FCT", originCity: "Abuja", currency: "NGN", price: 2100000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "APM Terminals Apapa", portCode: "NGAPP", originLga: "Kano Municipal", originState: "Kano", originCity: "Kano", currency: "NGN", price: 2700000, shipmentType: "fcl", equipmentType: "40ft" },
      // Lagos origins → Tin Can
      { terminalName: "Tin Can Island", portCode: "NGTCN", originLga: "Ikeja", originState: "Lagos", originCity: "Lagos", currency: "NGN", price: 450000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Tin Can Island", portCode: "NGTCN", originLga: "Ikorodu", originState: "Lagos", originCity: "Lagos", currency: "NGN", price: 550000, shipmentType: "fcl", equipmentType: "40ft" },
      // Origins → Onne
      { terminalName: "Onne Port", portCode: "NGONE", originLga: "Trans Amadi", originState: "Rivers", originCity: "Port Harcourt", currency: "NGN", price: 260000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Onne Port", portCode: "NGONE", originLga: "Aba South", originState: "Abia", originCity: "Aba", currency: "NGN", price: 500000, shipmentType: "fcl", equipmentType: "40ft" },
      { terminalName: "Onne Port", portCode: "NGONE", originLga: "Enugu North", originState: "Enugu", originCity: "Enugu", currency: "NGN", price: 700000, shipmentType: "fcl", equipmentType: "40ft" },
    ]);

    // ── Other Charges ──────────────────────────────────────────
    await OtherCharge.insertMany([
      // Origin charges (USD)
      { itemName: "Terminal Handling (Origin)", itemCategory: "Origin", shipmentType: "fcl", currency: "USD", price: 185 },
      { itemName: "Container Loading/Stuffing", itemCategory: "Origin", shipmentType: "fcl", currency: "USD", price: 120 },
      { itemName: "Export Customs Documentation", itemCategory: "Origin", shipmentType: "both", currency: "USD", price: 95 },
      { itemName: "Container Seal", itemCategory: "Origin", shipmentType: "fcl", currency: "USD", price: 15 },
      // Freight surcharges (USD)
      { itemName: "Bunker Adjustment Factor (BAF)", itemCategory: "Freight", shipmentType: "fcl", currency: "USD", price: 350 },
      { itemName: "Currency Adjustment Factor (CAF)", itemCategory: "Freight", shipmentType: "fcl", currency: "USD", price: 75 },
      { itemName: "Peak Season Surcharge", itemCategory: "Freight", shipmentType: "fcl", currency: "USD", price: 200 },
      { itemName: "War Risk Surcharge", itemCategory: "Freight", shipmentType: "both", currency: "USD", price: 45 },
      { itemName: "Low Sulphur Surcharge", itemCategory: "Freight", shipmentType: "both", currency: "USD", price: 85 },
      { itemName: "IMO DG Surcharge", itemCategory: "Freight", shipmentType: "fcl", currency: "USD", price: 450 },
      // Destination charges (USD)
      { itemName: "Terminal Handling (Dest)", itemCategory: "Destination", shipmentType: "fcl", currency: "USD", price: 250 },
      { itemName: "Bill of Lading Fee", itemCategory: "Documentation", shipmentType: "both", currency: "USD", price: 75 },
      { itemName: "Telex Release Fee", itemCategory: "Documentation", shipmentType: "both", currency: "USD", price: 50 },
      // Destination charges (NGN)
      { itemName: "Customs Clearance", itemCategory: "Destination", shipmentType: "fcl", currency: "NGN", price: 185000 },
      { itemName: "NAFDAC Clearance", itemCategory: "Destination", shipmentType: "both", currency: "NGN", price: 120000 },
      { itemName: "SON Assessment", itemCategory: "Destination", shipmentType: "both", currency: "NGN", price: 95000 },
      { itemName: "Shipping Line DO", itemCategory: "Destination", shipmentType: "fcl", currency: "NGN", price: 150000 },
      { itemName: "Agency Fee", itemCategory: "Destination", shipmentType: "both", currency: "NGN", price: 75000 },
      { itemName: "Terminal Delivery Order", itemCategory: "Destination", shipmentType: "fcl", currency: "NGN", price: 85000 },
      { itemName: "Container Deposit (refundable)", itemCategory: "Destination", shipmentType: "fcl", currency: "NGN", price: 500000 },
      { itemName: "Duty Processing Fee", itemCategory: "Destination", shipmentType: "both", currency: "NGN", price: 65000 },
      { itemName: "Port Charges / PAAR", itemCategory: "Destination", shipmentType: "fcl", currency: "NGN", price: 110000 },
      { itemName: "Customs Examination Fee", itemCategory: "Destination", shipmentType: "fcl", currency: "NGN", price: 45000 },
      { itemName: "NPA Charges", itemCategory: "Destination", shipmentType: "fcl", currency: "NGN", price: 35000 },
      { itemName: "Gate Pass / Exit Fee", itemCategory: "Destination", shipmentType: "fcl", currency: "NGN", price: 25000 },
      // Insurance & miscellaneous
      { itemName: "Marine Cargo Insurance", itemCategory: "Insurance", shipmentType: "both", currency: "USD", price: 0, asPerReceipt: true },
      { itemName: "Demurrage (per day)", itemCategory: "Penalty", shipmentType: "fcl", currency: "NGN", price: 180000 },
      { itemName: "Storage (per day)", itemCategory: "Penalty", shipmentType: "fcl", currency: "NGN", price: 95000 },
    ]);

    // ── Market Benchmarks (ticker data) ──────────────────────
    await RateBenchmark.insertMany([
      { laneName: "Med \u2192 Lagos", polRegion: "Mediterranean", podRegion: "West Africa", equipType: "40ft", rate40ft: 1540, waAdjustmentPct: 10, validFrom: new Date("2026-05-01"), source: "benchmark" },
      { laneName: "Europe \u2192 Lagos", polRegion: "North Europe", podRegion: "West Africa", equipType: "40ft", rate40ft: 2016, waAdjustmentPct: 12, validFrom: new Date("2026-05-01"), source: "benchmark" },
      { laneName: "China \u2192 Lagos", polRegion: "East Asia", podRegion: "West Africa", equipType: "40ft", rate40ft: 3304, waAdjustmentPct: 18, validFrom: new Date("2026-05-01"), source: "benchmark" },
      { laneName: "Shanghai \u2192 Genoa", polRegion: "East Asia", podRegion: "Mediterranean", equipType: "40ft", rate40ft: 2000, validFrom: new Date("2026-05-01"), source: "drewry" },
      { laneName: "LA \u2192 Shanghai", polRegion: "US West", podRegion: "East Asia", equipType: "40ft", rate40ft: 2413, validFrom: new Date("2026-05-01"), source: "drewry" },
      { laneName: "Shanghai \u2192 LA", polRegion: "East Asia", podRegion: "US West", equipType: "40ft", rate40ft: 3701, validFrom: new Date("2026-05-01"), source: "drewry" },
      { laneName: "WCI Composite", polRegion: "Global", podRegion: "Global", equipType: "40ft", rate40ft: 2553, validFrom: new Date("2026-05-01"), source: "drewry" },
      { laneName: "Rotterdam \u2192 Shanghai", polRegion: "North Europe", podRegion: "East Asia", equipType: "40ft", rate40ft: 3357, validFrom: new Date("2026-05-01"), source: "drewry" },
      { laneName: "Shanghai \u2192 Rotterdam", polRegion: "East Asia", podRegion: "North Europe", equipType: "40ft", rate40ft: 4252, validFrom: new Date("2026-05-01"), source: "drewry" },
    ]);

    // ── Quotes ──────────────────────────────────────────────
    await Quote.insertMany([
      {
        quoteRef: "QUOTE-2605-1001", rfqRef: "RFQ-2605-0590", status: "sent", customerName: "Yovanka Appelgryn", companyName: "Savino Del Bene", customerEmail: "yovanka@savino.com",
        pol: "Istanbul", pod: "Lagos", polCode: "TRIST", podCode: "NGAPP", commodity: "Lithium batteries (DG)", containerType: "40FT", containerQty: 1, carrier: "CMA CGM",
        exchangeRate: 1600, marginPct: 15, totalCostUSD: 3850, sellPriceUSD: 4428, sentAt: new Date("2026-05-14T10:00:00Z"),
      },
      {
        quoteRef: "QUOTE-2605-1002", rfqRef: "RFQ-2605-0592", status: "draft", customerName: "Aminu Dantata", companyName: "Dangote Industries", customerEmail: "aminu@dangote.com",
        pol: "Shanghai", pod: "Apapa", polCode: "CNSHA", podCode: "NGAPP", commodity: "Cement plant equipment", containerType: "40HC", containerQty: 5, carrier: "MSC",
        exchangeRate: 1600, marginPct: 12, totalCostUSD: 18500, sellPriceUSD: 20720,
      },
      {
        quoteRef: "QUOTE-2605-1003", rfqRef: "RFQ-2605-0589", status: "draft", customerName: "Johnny Hong", companyName: "XPA Logistics", customerEmail: "johnnyhong@xpalogistics.com",
        pol: "Qingdao", pod: "Lagos", polCode: "CNTAO", podCode: "NGAPP", commodity: "Automotive spare parts", containerType: "40FT", containerQty: 3, carrier: "COSCO",
        exchangeRate: 1600, marginPct: 13, totalCostUSD: 9600, sellPriceUSD: 10848,
      },
    ]);

    res.json({ success: true, message: "Seed data created", counts: { companies: companies.length, contacts: contacts.length, emails: emails.length, rfqs: 7, partners: 7, oceanRates: 26, haulageImport: 27, haulageExport: 16, otherCharges: 28, quotes: 3 } });
  } catch (err: any) {
    if (err.code === 11000) {
      res.json({ success: true, message: "Seed data already exists (duplicate key)" });
      return;
    }
    res.status(500).json({ error: "Failed to seed data", details: err.message });
  }
});

// Clear all data
router.post("/seed/reset", async (_req: Request, res: Response) => {
  try {
    await Promise.all([
      Company.deleteMany({}), Contact.deleteMany({}), Email.deleteMany({}),
      Rfq.deleteMany({}), Quote.deleteMany({}), Partner.deleteMany({}),
      OceanFreightRate.deleteMany({}), HaulageImportRate.deleteMany({}), HaulageExportRate.deleteMany({}), OtherCharge.deleteMany({}), RateBenchmark.deleteMany({}),
    ]);
    res.json({ success: true, message: "All data cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset data" });
  }
});

export { router as seedRouter };
