/**
 * Port name → "City (LOCODE/IATA)" mapping.
 * Used to post-process Claude's POL/POD output when it returns bare names.
 * Keys are lowercase for case-insensitive lookup.
 */

const PORT_MAP = new Map<string, string>([
  // Ocean — Nigeria
  ["apapa", "Apapa (NGAPP)"],
  ["lagos", "Apapa (NGAPP)"],
  ["lagos port", "Apapa (NGAPP)"],
  ["tin can", "Tin Can (NGTCN)"],
  ["tin can island", "Tin Can (NGTCN)"],
  ["onne", "Onne (NGONE)"],
  ["warri", "Warri (NGWAR)"],

  // Ocean — Europe
  ["rotterdam", "Rotterdam (NLRTM)"],
  ["hamburg", "Hamburg (DEHAM)"],
  ["antwerp", "Antwerp (BEANR)"],
  ["istanbul", "Ambarl\u0131 (TRIST)"],
  ["ambarli", "Ambarl\u0131 (TRIST)"],
  ["felixstowe", "Felixstowe (GBFXT)"],

  // Ocean — Asia
  ["shanghai", "Shanghai (CNSHA)"],
  ["qingdao", "Qingdao (CNTAO)"],
  ["ningbo", "Ningbo (CNNGB)"],
  ["shenzhen", "Yantian (CNYTN)"],
  ["yantian", "Yantian (CNYTN)"],
  ["busan", "Busan (KRPUS)"],
  ["singapore", "Singapore (SGSIN)"],

  // Ocean — Middle East
  ["dubai", "Jebel Ali (AEJEA)"],
  ["jebel ali", "Jebel Ali (AEJEA)"],

  // Ocean — Africa (non-Nigeria)
  ["tema", "Tema (GHTEM)"],
  ["accra", "Tema (GHTEM)"],
  ["mombasa", "Mombasa (KEMBA)"],
  ["durban", "Durban (ZADUR)"],

  // Ocean — Americas
  ["houston", "Houston (USHOU)"],
  ["los angeles", "Los Angeles (USLAX)"],
  ["san francisco", "Oakland (USOAK)"],
  ["oakland", "Oakland (USOAK)"],

  // Air
  ["lagos air", "Lagos (LOS)"],
  ["dubai air", "Dubai (DXB)"],
  ["london", "Heathrow (LHR)"],
  ["heathrow", "Heathrow (LHR)"],
  ["frankfurt", "Frankfurt (FRA)"],
  ["hong kong", "Hong Kong (HKG)"],
  ["shanghai air", "Pudong (PVG)"],
  ["nairobi", "Nairobi (NBO)"],
]);

/**
 * Resolve a bare port name to "City (LOCODE)" format.
 * Returns the original value if already formatted or not found.
 */
export function resolvePortCode(portValue: string): string {
  if (!portValue || portValue === "not specified") return portValue;

  // Already has a LOCODE/IATA in parentheses — return as-is
  if (/\([A-Z]{2,5}\)/.test(portValue)) return portValue;

  const normalized = portValue.toLowerCase().trim();
  const match = PORT_MAP.get(normalized);
  return match || portValue;
}

/**
 * Post-process extraction fields: resolve POL and POD port codes.
 */
export function postProcessPortCodes(
  fields: Array<{ k: string; v: string; ok: boolean; suggested?: boolean }>
): Array<{ k: string; v: string; ok: boolean; suggested?: boolean }> {
  return fields.map((f) => {
    if ((f.k === "POL" || f.k === "POD") && f.ok) {
      return { ...f, v: resolvePortCode(f.v) };
    }
    return f;
  });
}
