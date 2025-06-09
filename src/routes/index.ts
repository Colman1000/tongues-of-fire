import { Hono } from "hono";
import upload from "./upload";
import process from "./process";
import report from "./report";
import download from "./download";

const app = new Hono();

// Register all the routes under the /api prefix
app.route("/upload", upload);
app.route("/process", process);
app.route("/report", report);
app.route("/download", download);

export default app;
