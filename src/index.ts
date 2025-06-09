import { Hono } from "hono";
import { logger } from "hono/logger";
import apiRoutes from "./routes";

const app = new Hono();

// Middleware
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
