import fs from "node:fs";
import path from "node:path";

const distServer = path.resolve("dist/server");
fs.mkdirSync(distServer, { recursive: true });
fs.copyFileSync(path.resolve("worker/index.js"), path.join(distServer, "index.js"));
