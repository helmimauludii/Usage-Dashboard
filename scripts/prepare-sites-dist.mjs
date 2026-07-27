import fs from "node:fs";
import path from "node:path";

const distServer = path.resolve("dist/server");
fs.mkdirSync(distServer, { recursive: true });

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function collectFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (fullPath.startsWith(distServer)) continue;
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const files = Object.fromEntries(
  collectFiles(path.resolve("dist")).map((filePath) => {
    const route = `/${path.relative(path.resolve("dist"), filePath).split(path.sep).join("/")}`;
    return [
      route,
      {
        contentType: contentType(filePath),
        body: fs.readFileSync(filePath).toString("base64"),
      },
    ];
  }),
);

const worker = `const files = ${JSON.stringify(files)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function responseFor(pathname) {
  const file = files[pathname] || (pathname === "/" ? files["/index.html"] : null);
  if (!file) return null;
  return new Response(decodeBase64(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": pathname.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    return responseFor(url.pathname) || responseFor("/index.html") || new Response("Not found", { status: 404 });
  },
};
`;

fs.writeFileSync(path.join(distServer, "index.js"), worker);
