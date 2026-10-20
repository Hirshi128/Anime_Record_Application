import type { Prisma } from "@/generated/prisma/client";

export async function lockUsers(
  tx: Pick<Prisma.TransactionClient, "$queryRaw">,
  firstId: number,
  secondId = firstId,
) {
  // A consistent row order serializes per-user limits and avoids crossed-request deadlocks.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${firstId}, ${secondId}) ORDER BY "id" FOR UPDATE`;
}
