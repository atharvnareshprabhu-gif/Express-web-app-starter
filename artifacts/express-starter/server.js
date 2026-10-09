import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const publicDirectory = fileURLToPath(new URL("./public/", import.meta.url));

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

app.use(express.static(publicDirectory));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    message: "The Express server is running.",
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, "0.0.0.0", () => {
  process.stdout.write(`Express starter listening on port ${port}\n`);
});
