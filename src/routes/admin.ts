import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { db } from "@/db";
import { systemCredits } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";

const app = new Hono();

// Custom middleware to verify the hardcoded recharge token
const verifyRechargeToken: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const expectedToken = `Bearer ${process.env.RECHARGE_SECRET_TOKEN}`;

  if (!authHeader || authHeader !== expectedToken) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
};

app.post("/recharge", verifyRechargeToken, async (c) => {
  const { amount } = await c.req.json<{ amount: number }>();

  if (typeof amount !== "number" || amount <= 0) {
    return c.json({ error: "Invalid amount specified." }, 400);
  }

  // Add the credits to the system balance
  await db
    .update(systemCredits)
    .set({
      availableUnits: sql`${systemCredits.availableUnits} + ${amount}`,
    })
    .where(eq(systemCredits.id, 1));

  // Log this privileged action
  await logAuditEvent({
    actor: "admin_recharge", // A special actor for this action
    action: "CREDITS_RECHARGED",
    details: { amount },
  });

  const [newBalance] = await db.select().from(systemCredits).limit(1);

  return c.json({
    message: "Credits recharged successfully.",
    newAvailableUnits: newBalance.availableUnits,
  });
});

export default app;
