import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const names = new Set(["cat-idle-768.webp","cat-attention-768.webp","cat-wrong-768.webp","cat-won-640.webp","cat-surrendered-640.webp","safe-open-720.webp","safe-closed-720.webp","safe-dial-256.webp","hint-lamp-on-96.webp","hint-lamp-off-96.webp","cat-hint-reward-lying-1448.png","operator-add-256.png","operator-subtract-256.png","operator-multiply-256.png","operator-divide-256.png","operator-random-256.png","hint-popup-cat-thinking-new-1448.png","hint-popup-cat-encouraging-1448.png","hint-popup-cat-sad-give-up-1448.png","hint-popup-cat-success-1448.png","hint-popup-cat-thinking-640.png","hint-popup-cat-concerned-640.png","hint-popup-cat-sad-640.png","hint-popup-cat-happy-640.png","hint-popup-background-1327.png","hint-popup-narrow-background-1254.png","hint-popup-close-paw-128.png","hint-popup-lamp-320.png","hint-popup-key-128.png","hint-popup-calculator-320.png","history-paw-192.webp","scene-background-wide.webp","scene-background-tall.webp","cat-long-idle-800.webp","cat-pet-hover-800.webp","cat-hint-attention-800.webp","cat-playing-800.webp","cat-wrong-800.webp","cat-pet-prompt-800.webp","cat-pet-success-800.webp","cat-surrendered-800.webp","cat-won-800.webp"]);
const insensitive = (value: string) => path.resolve(value).replace(/\\\\/g, "/").toLowerCase();
const typeFor = (name: string) => name.endsWith(".png") ? "image/png" : "image/webp";
const failure = (status: 404 | 503) => new NextResponse(status === 404 ? "Not found" : "Asset unavailable", { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

async function roots() {
  const harness = await realpath(process.cwd());
  const app = path.resolve(harness, "../../../..");
  const expectedHarness = path.resolve(app, "tests/acceptance/safe-cat-07/harness");
  if (insensitive(harness) !== insensitive(expectedHarness)) throw new Error("isolated harness cwd mismatch");
  const assetRoot = await realpath(path.join(app, "public", "safe-cat"));
  if (insensitive(path.dirname(assetRoot)) !== insensitive(path.resolve(app, "public"))) throw new Error("asset root escape");
  return assetRoot;
}

async function findAsset(name: string, assetRoot: string) {
  if (!names.has(name) || name !== path.basename(name)) return null;
  const lexical = path.resolve(assetRoot, name), relative = path.relative(assetRoot, lexical);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  let canonical: string;
  try {
    canonical = await realpath(lexical);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (insensitive(path.dirname(canonical)) !== insensitive(assetRoot) || insensitive(canonical) !== insensitive(lexical)) return null;
  const info = await stat(canonical);
  if (!info.isFile() || info.size < 1 || info.size > 16 * 1024 * 1024) return null;
  const bytes = await readFile(canonical), png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), webp = bytes.subarray(0, 4).equals(Buffer.from("RIFF")) && bytes.subarray(8, 12).equals(Buffer.from("WEBP"));
  if ((typeFor(name) === "image/png" && !png) || (typeFor(name) === "image/webp" && !webp)) return null;
  return { bytes, size: info.size, type: typeFor(name) };
}

async function respond(request: Request, context: { params: Promise<{ asset: string }> }) {
  const requestUrl = new URL(request.url);
  if (requestUrl.search || !requestUrl.pathname.startsWith("/safe-cat/")) return failure(404);
  let assetRoot: string;
  try { assetRoot = await roots(); } catch { return failure(503); }
  const { asset: name } = await context.params;
  let asset;
  try { asset = await findAsset(name, assetRoot); } catch { return failure(503); }
  if (!asset) return failure(404);
  return new NextResponse(request.method === "HEAD" ? null : asset.bytes, { status: 200, headers: { "Content-Type": asset.type, "Content-Length": String(asset.size), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export const GET = respond;
export const HEAD = respond;
