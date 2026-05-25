/**
 * Resolve the effective sender of an RFQ email.
 * Implements the 4-step priority chain from EMAIL_DETAIL_SPEC.md:
 *
 * 1. If email.fromEmail does NOT end in @oneport365.com → use it
 * 2. Else, find extracted field k="Email" with ok=true → use that
 * 3. Else, find extracted field k="Customer" or k="Company" → use name, fallback email
 * 4. Else, fall back to email.fromName/fromEmail
 */
export function resolveSender(
  email: { fromName: string; fromEmail: string; body?: string },
  extractedFields: Array<{ k: string; v: string; ok: boolean }>
): { name: string; email: string } {
  // Step 1: External sender — use directly
  if (!email.fromEmail.toLowerCase().endsWith("@oneport365.com")) {
    return { name: email.fromName || email.fromEmail, email: email.fromEmail };
  }

  // Step 2: Claude extracted an Email field
  const emailField = extractedFields.find(
    (f) => f.k.toLowerCase() === "email" && f.ok && f.v && f.v !== "not specified"
  );
  if (emailField) {
    // Try to also get the customer name
    const customerField = extractedFields.find(
      (f) => (f.k === "Customer" || f.k === "Company") && f.ok && f.v && f.v !== "not specified"
    );
    return { name: customerField?.v || emailField.v, email: emailField.v };
  }

  // Step 3: Claude extracted Customer or Company name but no separate Email
  const customerField = extractedFields.find(
    (f) => (f.k === "Customer" || f.k === "Contact") && f.ok && f.v && f.v !== "not specified"
  );
  if (customerField) {
    // Try to find an email in the body via regex as last resort
    const bodyMatch = email.body?.match(
      /From:\s*[^<\n\r]*?<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/i
    );
    const resolvedEmail = bodyMatch && !bodyMatch[1].toLowerCase().endsWith("@oneport365.com")
      ? bodyMatch[1].toLowerCase()
      : email.fromEmail;
    return { name: customerField.v, email: resolvedEmail };
  }

  // Step 4: Fallback
  return { name: email.fromName || email.fromEmail, email: email.fromEmail };
}
