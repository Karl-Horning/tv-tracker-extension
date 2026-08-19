/** @fileoverview Zips dist/ into a Chrome Web Store submission package. */

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(rootDir, "dist");
const releaseDir = resolve(rootDir, "release");

if (!existsSync(distDir)) {
    console.error("dist/ not found — run `npm run build` first.");
    process.exit(1);
}

const pkg = JSON.parse(
    await readFile(resolve(rootDir, "package.json"), "utf-8"),
);
const outputName = `tv-tracker-extension-v${pkg.version}.zip`;

mkdirSync(releaseDir, { recursive: true });

const outputPath = resolve(releaseDir, outputName);
const output = createWriteStream(outputPath);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on("close", () => {
    console.log(`Wrote release/${outputName} (${archive.pointer()} bytes).`);
});
archive.on("warning", (err) => {
    throw err;
});
archive.on("error", (err) => {
    throw err;
});

archive.pipe(output);
archive.glob("**/*", { cwd: distDir });
await archive.finalize();
