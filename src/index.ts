import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors"; // 1. Import the CORS middleware
import apiRoutes from "./routes";

const app = new Hono();

// 2. Apply the CORS middleware to all /api/* routes
// This should come before the logger and route registration for best results.
app.use(
  "/api/*",
  cors({
    // For development, allowing all origins is fine.
    // For production, you should restrict this to your frontend's domain.
    // Example: origin: 'https://your-frontend-app.com'
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 600, // Optional: Cache preflight response for 10 minutes
  }),
);

// Logger middleware
app.use("*", logger());

// Health check endpoint
app.get("/", (c) => {
  return c.text("SRT/VTT Translation Service API is operational.");
});

// Register API routes
app.route("/api", apiRoutes);

const port = parseInt(process.env.PORT || "3000");
console.log(`🚀 Server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
