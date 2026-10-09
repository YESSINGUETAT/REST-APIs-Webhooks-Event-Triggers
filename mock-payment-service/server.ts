// Placeholder server
import express from "express";
const app = express();
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.listen(4000, () => console.log("Mock Payment Service running on port 4000"));