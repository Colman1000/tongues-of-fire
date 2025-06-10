import { Hono } from "hono";
import { sign } from "hono/jwt";

const app = new Hono();

app.post("/login", async (c) => {
  const { username, password } = await c.req.json();

  // 1. Validate credentials against environment variables
  const isValid =
    username === process.env.API_USERNAME &&
    password === process.env.API_PASSWORD;

  if (!isValid) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  // 2. Create the JWT payload
  const payload = {
    sub: username, // Subject (the user)
    // Issued at (in seconds)
    iat: Math.floor(Date.now() / 1000),
    // Expiration time (24 hours from now, in seconds)
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  };

  // 3. Sign the token with the secret
  const token = await sign(payload, process.env.JWT_SECRET!);

  return c.json({ token });
});

export default app;
