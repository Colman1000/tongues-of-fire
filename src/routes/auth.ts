import { Hono } from "hono";
import { sign } from "hono/jwt";
import { logAuditEvent } from "@/services/audit";

const app = new Hono();

app.post("/login", async (c) => {
  const { username, password } = await c.req.json();

  const isValid =
    username === process.env.API_USERNAME &&
    password === process.env.API_PASSWORD;

  if (!isValid) {
    // Log failed login attempt
    await logAuditEvent({
      actor: username || "unknown",
      action: "USER_LOGIN_FAILED",
    });
    return c.json({ error: "Invalid username or password" }, 401);
  }

  // Log successful login
  await logAuditEvent({ actor: username, action: "USER_LOGIN" });

  const payload = {
    sub: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  };

  const token = await sign(payload, process.env.JWT_SECRET!);

  return c.json({ token });
});

export default app;
