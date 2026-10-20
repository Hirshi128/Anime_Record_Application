import { parseRecordId } from "../src/lib/record-id.ts";
import { parseCredentials } from "../src/lib/auth-input.ts";
import { hashPassword } from "../src/lib/password.ts";

export class ProvisionError extends Error {}

export function parseOwner({ userId, username, email }) {
  const id = parseRecordId(userId);
  const data = new FormData();
  data.set("email", email ?? "");
  data.set("password", "validation-only");
  const parsed = parseCredentials(data);
  if (!id || typeof username !== "string" || !username || !parsed.data) {
    throw new ProvisionError("Invalid user ID, exact username, or email.");
  }
  return { id, username, email: parsed.data.email };
}

async function checkOwner(connection, owner, lock = false) {
  const { rows } = await connection.query(
    `SELECT "id", "username" FROM "User" WHERE "id" = $1${lock ? " FOR UPDATE" : ""}`,
    [owner.id],
  );
  if (rows.length !== 1 || rows[0].username !== owner.username) {
    throw new ProvisionError("Existing user ID and username do not match. Nothing changed.");
  }
  const credentials = await connection.query(
    'SELECT "userId" FROM "UserCredential" WHERE "userId" = $1 OR LOWER("email") = $2',
    [owner.id, owner.email],
  );
  if (credentials.rows.length) {
    throw new ProvisionError("This user already has credentials or the email is in use. Nothing changed.");
  }
}

// The caller owns the dedicated connection and transaction lifecycle.
export async function provisionLegacyOwner(connection, options) {
  const owner = parseOwner(options);
  if (!options.apply) {
    await checkOwner(connection, owner);
    return { applied: false, userId: owner.id };
  }
  if (options.ownerVerified !== true || options.emailVerified !== true) {
    throw new ProvisionError("Confirm ownership and mailbox ownership before applying.");
  }
  const data = new FormData();
  data.set("email", owner.email);
  data.set("password", options.password ?? "");
  data.set("passwordConfirmation", options.passwordConfirmation ?? "");
  if (!parseCredentials(data, true).data) {
    throw new ProvisionError("Passwords must match and contain 12 to 128 characters.");
  }
  const passwordHash = await hashPassword(options.password);
  await connection.query("BEGIN");
  try {
    await checkOwner(connection, owner, true);
    await connection.query(
      'INSERT INTO "UserCredential" ("userId", "email", "passwordHash") VALUES ($1, $2, $3)',
      [owner.id, owner.email, passwordHash],
    );
    await connection.query('DELETE FROM "AuthSession" WHERE "userId" = $1', [owner.id]);
    await connection.query("COMMIT");
    return { applied: true, userId: owner.id };
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  }
}
