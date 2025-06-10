import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import apiRoutes from "./routes";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin"; // 1. Import admin routes

// Fail-fast if required secrets are not set
if (
  !process.env.API_USERNAME ||
  !process.env.API_PASSWORD ||
  !process.env.JWT_SECRET ||
  !process.env.CREDIT_COST_PER_BLOCK ||
  !process.env.CREDIT_BLOCK_DURATION_MINUTES ||
  !process.env.RECHARGE_SECRET_TOKEN // 2. Add check for new token
) {
  throw new Error(
    "All required environment variables (API, JWT, CREDITS, RECHARGE) must be set.",
  );
}

const app = new Hono();

// Apply global middleware
app.use("*", logger());
app.use("*", cors({ origin: "*" }));

// --- Public and Privileged Routes ---
app.get("/", (c) => {
  return c.text("SRT/VTT Translation Service API is operational.");
});
app.route("/auth", authRoutes);
app.route("/admin", adminRoutes); // 3. Register admin routes (not behind JWT)

// --- Protected API Routes ---
const api = new Hono();

api.use(
  "*",
  jwt({
    secret: process.env.JWT_SECRET,
  }),
);

api.route("/", apiRoutes);

app.route("/api", api);

const port = parseInt(process.env.PORT || "3000");
console.log(`🚀 Server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
