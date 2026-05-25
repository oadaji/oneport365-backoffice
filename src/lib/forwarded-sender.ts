/**
 * Layer 1 of @oneport365.com rule: If the email is from an internal
 * @oneport365.com address, scan the body for the original external sender.
 *
 * Patterns matched:
 *   From: Name <ext@domain.com>          — standard angle-bracket
 *   From: Name [mailto:ext@domain.com]   — Outlook-style mailto
 */
export function extractForwardedSender(
  fromEmail: string,
  fromName: string,
  body: string
): { fromEmail: string; fromName: string } {
  if (!fromEmail.toLowerCase().endsWith("@oneport365.com")) {
    return { fromEmail, fromName };
  }

  // Pattern 1: From: Name <email@domain.com>
  const angleMatch = body.match(
    /From:\s*([^<\n\r]+?)\s*<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/i
  );
  if (angleMatch && !angleMatch[2].toLowerCase().endsWith("@oneport365.com")) {
    return { fromName: angleMatch[1].trim(), fromEmail: angleMatch[2].toLowerCase() };
  }

  // Pattern 2: From: Name [mailto:email@domain.com]
  const mailtoMatch = body.match(
    /From:\s*([^[\n\r]+?)\s*\[mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\]/i
  );
  if (mailtoMatch && !mailtoMatch[2].toLowerCase().endsWith("@oneport365.com")) {
    return { fromName: mailtoMatch[1].trim(), fromEmail: mailtoMatch[2].toLowerCase() };
  }

  return { fromEmail, fromName };
}
