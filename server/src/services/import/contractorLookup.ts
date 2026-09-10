import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User, IUser } from "../../models/User";

export interface ContractorLookupResult {
  user: IUser;
  created: boolean;
  tempPassword?: string;
}

function generateTempPassword(): string {
  return crypto.randomBytes(6).toString("base64url"); // e.g. "k3f9-ZQ1a2B"
}

/**
 * Finds an existing CONTRACTOR user by email, or creates one with a random temporary
 * password. There is no email-delivery infrastructure in this prototype, so a newly created
 * contractor's temp password is returned in the plain import summary for the importing officer
 * to relay out-of-band — it is never logged or persisted anywhere in plain text.
 */
export async function findOrCreateContractor(input: {
  name: string;
  email: string;
  phone?: string;
}): Promise<ContractorLookupResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "CONTRACTOR") {
      throw new Error(`Email ${email} is already registered as ${existing.role}, not CONTRACTOR`);
    }
    return { user: existing, created: false };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await User.create({
    name: input.name,
    email,
    passwordHash,
    role: "CONTRACTOR",
    phone: input.phone,
  });
  return { user, created: true, tempPassword };
}
