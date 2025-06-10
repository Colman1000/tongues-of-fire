import { Hono } from "hono";
import upload from "./upload";
import process from "./process";
import report from "./report";
import download from "./download";
import dashboard from "./dashboard";

const app = new Hono();

// Register all the routes
app.route("/upload", upload);
app.route("/process", process);
app.route("/report", report);
app.route("/download", download);
app.route("/dashboard", dashboard);

export default app;
