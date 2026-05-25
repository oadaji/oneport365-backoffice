import { Email, IEmail } from "../models/email";
import { Types } from "mongoose";

/**
 * Find all reply emails for a given original email.
 * Matches on both parentEmailId and inReplyTo to catch replies
 * linked by either mechanism. Used by both /thread and /re-extract.
 */
export async function findThreadReplies(originalEmail: IEmail): Promise<IEmail[]> {
  return Email.find({
    $or: [
      { parentEmailId: originalEmail._id },
      ...(originalEmail.messageId ? [{ inReplyTo: originalEmail.messageId }] : []),
    ],
    _id: { $ne: originalEmail._id },
  }).sort({ receivedAt: 1 });
}
