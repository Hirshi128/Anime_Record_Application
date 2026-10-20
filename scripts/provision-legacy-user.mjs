import { parseArgs } from "node:util";
import { Pool } from "@neondatabase/serverless";
import { parseOwner, provisionLegacyOwner, ProvisionError } from "./legacy-credentials.mjs";

function hiddenPassword(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = "";
    const cleanup = () => {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003" || char === "\u0004") {
          cleanup(); reject(new ProvisionError("Cancelled. Nothing changed.")); return;
        }
        if (char === "\r" || char === "\n") {
          cleanup(); resolve(value); return;
        }
        if (char === "\u007f" || char === "\b") value = Array.from(value).slice(0, -1).join("");
        else if (char >= " " && value.length < 129) value += char;
      }
    };
    process.stdout.write(prompt);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.on("data", onData);
    input.resume();
  });
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({ options: {
      "user-id": { type: "string" }, username: { type: "string" }, email: { type: "string" },
      apply: { type: "boolean" }, "owner-verified": { type: "boolean" },
      "email-verified": { type: "boolean" }, help: { type: "boolean" },
    } }));
  } catch { throw new ProvisionError("Invalid arguments. Use --help; passwords must never be arguments."); }
  if (values.help) {
    console.log("users:provision -- --user-id ID --username EXACT_NAME --email EMAIL\nDefault: read-only check. Apply: --apply --owner-verified --email-verified\nRequires dedicated LEGACY_SETUP_DATABASE_URL (never reads .env). Node 24+.\nThe verified owner must enter and confirm a password privately in an interactive terminal.");
    return;
  }
  const options = {
    userId: values["user-id"], username: values.username, email: values.email,
    apply: values.apply === true, ownerVerified: values["owner-verified"] === true,
    emailVerified: values["email-verified"] === true,
  };
  parseOwner(options);
  if (options.apply && (!options.ownerVerified || !options.emailVerified)) {
    throw new ProvisionError("Confirm ownership and mailbox ownership before applying.");
  }
  if (options.apply && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new ProvisionError("Apply requires a private interactive terminal. Piped passwords are not accepted.");
  }
  const connectionString = process.env.LEGACY_SETUP_DATABASE_URL;
  let url;
  try { url = new URL(connectionString); } catch { /* Never echo a connection URL. */ }
  if (!url || !["postgres:", "postgresql:"].includes(url.protocol) || url.searchParams.get("sslmode") !== "require") {
    throw new ProvisionError("Set LEGACY_SETUP_DATABASE_URL explicitly to the intended staging DB with sslmode=require.");
  }
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  pool.on("error", () => {});
  let client;
  try {
    client = await pool.connect();
    await provisionLegacyOwner(client, { ...options, apply: false });
    if (options.apply) {
      options.password = await hiddenPassword("Owner's password (hidden, 12-128 characters): ");
      options.passwordConfirmation = await hiddenPassword("Confirm password (hidden): ");
      await provisionLegacyOwner(client, options);
      console.log("Credentials attached to the existing user. Previous sessions revoked; records and friends unchanged.");
    } else console.log("Eligible. Read-only check completed; no credentials or data changed.");
  } finally {
    delete options.password;
    delete options.passwordConfirmation;
    client?.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof ProvisionError ? error.message : "Setup failed. Check the staging connection and migration status privately; no database details are printed. Re-run the read-only check before retrying.");
  process.exitCode = 1;
});
