import { Company } from "../models/company";
import { Contact } from "../models/contact";

const GENERIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk",
  "hotmail.com", "outlook.com", "live.com", "aol.com",
  "icloud.com", "me.com", "mail.com", "protonmail.com",
  "zoho.com", "yandex.com", "proton.me",
]);

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase();
  return GENERIC_DOMAINS.has(domain) ? null : domain;
}

function parseName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || fullName,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function domainToCompanyName(domain: string): string {
  const base = domain.replace(/\.(com|co|org|net|io|ng|uk|de|cn|sg|ae|in|za)(\.\w+)?$/i, "");
  return base
    .split(/[-_.]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function resolveContact(params: {
  email?: string;
  phone?: string;
  name: string;
  source: "email" | "whatsapp";
}): Promise<{ contactId: string; companyId: string | null }> {
  const { email, phone, name, source } = params;

  // Find existing contact
  if (email) {
    const existing = await Contact.findOne({ email });
    if (existing) {
      existing.lastContactedAt = new Date();
      await existing.save();
      return { contactId: existing.id as string, companyId: existing.companyId?.toString() || null };
    }
  }

  if (phone) {
    const existing = await Contact.findOne({ whatsappPhone: phone });
    if (existing) {
      existing.lastContactedAt = new Date();
      await existing.save();
      return { contactId: existing.id as string, companyId: existing.companyId?.toString() || null };
    }
  }

  // Find or create company
  let companyId: string | null = null;
  if (email) {
    const domain = extractDomain(email);
    if (domain) {
      let company = await Company.findOne({ domain });
      if (!company) {
        company = await Company.create({
          name: domainToCompanyName(domain),
          domain,
          status: "lead",
        });
      }
      companyId = (company._id as any).toString();
    }
  }

  // Create contact
  const { firstName, lastName } = parseName(name);
  const contactDoc = await Contact.create({
    companyId: companyId || undefined,
    firstName,
    lastName: lastName || undefined,
    email: email || undefined,
    whatsappPhone: phone || undefined,
    source,
    isPrimary: true,
    lastContactedAt: new Date(),
  });

  return { contactId: contactDoc.id as string, companyId };
}
