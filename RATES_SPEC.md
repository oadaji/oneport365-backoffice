# Rates Page — Technical Reference (from Replit)

> Saved as implementation reference. See the full spec in the user's handover doc.

## Core Features (build now)
- 4 tabs: Ocean Freight, Haulage Import, Haulage Export, Other Charges
- Filter bar per tab (search, equipment, rate type, carrier, country, status)
- Rate table with all columns, sort by column header
- Expiry indicators (green/amber/red)
- Add/Edit/Delete rates (modal form)
- CSV export (client-side, respects filters)
- Pagination (50 per page)

## Future Features
- Market Pulse benchmark strip
- Contact Partner 3-step wizard
- Quick Spot Rate modal
- Carrier API tiles (Maersk, CMA CGM)
- Market Intelligence scraping (Xeneta, Drewry)
- CSV Import
- Bulk operations (multi-select delete)
- VS Market comparison column
- Benchmarks modal

## Endpoints
```
GET/POST/PUT/DELETE /api/rates/ocean-freight[/:id]
GET/POST/PUT/DELETE /api/rates/haulage-import[/:id]
GET/POST/PUT/DELETE /api/rates/haulage-export[/:id]
GET/POST/PUT/DELETE /api/rates/other-charges[/:id]
```

## Filter fields per tab
- Ocean: search, equipment, rateType, carrier, originCountry, destCountry, status
- Haulage Import: search (terminal/LGA/state), equipment, type (FCL/LCL)
- Haulage Export: search (terminal/LGA/state), equipment
- Other Charges: search (name/category), type (import/export/both)
