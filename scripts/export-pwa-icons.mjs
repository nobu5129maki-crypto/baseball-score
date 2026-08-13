import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "assets", "app-icon-master.png");
const outDir = join(root, "public");
mkdirSync(outDir, { recursive: true });

const bg = { r: 10, g: 16, b: 12, alpha: 1 };

async function square(size, name) {
  await sharp(src)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, name));
}

async function maskable(size, name) {
  const inner = Math.round(size * 0.8);
  const innerBuf = await sharp(src)
    .resize(inner, inner, { fit: "cover" })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: innerBuf, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, name));
}

await square(192, "icon-192.png");
await square(512, "icon-512.png");
await square(180, "apple-touch-icon.png");
await maskable(512, "icon-512-maskable.png");
await square(512, "icon.png");

console.log("exported PWA PNGs from master icon");
