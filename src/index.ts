import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import apiRoutes from "./routes";
import authRoutes from "./routes/auth";

// Fail-fast if required secrets are not set
if (
  !process.env.API_USERNAME ||
  !process.env.API_PASSWORD ||
  !process.env.JWT_SECRET
) {
  throw new Error(
    "API_USERNAME, API_PASSWORD, and JWT_SECRET environment variables are required.",
  );
}

const app = new Hono();

// Apply global middleware
app.use("*", logger());
app.use("*", cors({ origin: "*" }));

// --- Public Routes ---
// The health check and auth routes are NOT protected by JWT middleware.
app.get("/", (c) => {
  return c.text("SRT/VTT Translation Service API is operational.");
});
app.route("/auth", authRoutes);

// --- Protected API Routes ---
const api = new Hono();

// 3. Apply the JWT middleware to this sub-router
api.use(
  "*",
  jwt({
    secret: process.env.JWT_SECRET,
  }),
);

// 4. Register the protected routes within the JWT-guarded router
api.route("/", apiRoutes);

// 5. Mount the protected router under the /api path
app.route("/api", api);

const port = parseInt(process.env.PORT || "3000");
console.log(`🚀 Server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
