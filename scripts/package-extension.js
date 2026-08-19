/** @fileoverview Zips dist/ into store submission packages for each browser. */

import { execFileSync } from "node:child_process";
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
const baseManifest = JSON.parse(
    await readFile(resolve(distDir, "manifest.json"), "utf-8"),
);

mkdirSync(releaseDir, { recursive: true });

/**
 * Zips dist/ into a store package using the given manifest.
 *
 * @param {string} suffix - Appended to the output filename, for example "-firefox".
 * @param {object} manifest - The manifest.json content to package.
 * @returns {Promise<void>}
 */
function writePackage(suffix, manifest) {
    const outputName = `tv-tracker-extension-v${pkg.version}${suffix}.zip`;
    const outputPath = resolve(releaseDir, outputName);
    const output = createWriteStream(outputPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    return new Promise((resolvePromise, reject) => {
        output.on("close", () => {
            console.log(
                `Wrote release/${outputName} (${archive.pointer()} bytes).`,
            );
            resolvePromise();
        });
        archive.on("warning", reject);
        archive.on("error", reject);

        archive.pipe(output);
        archive.glob("**/*", { cwd: distDir, ignore: ["manifest.json"] });
        archive.append(JSON.stringify(manifest, null, 2), {
            name: "manifest.json",
        });
        archive.finalize();
    });
}

const firefoxManifest = {
    ...baseManifest,
    background: {
        ...baseManifest.background,
        scripts: [baseManifest.background.service_worker],
    },
    browser_specific_settings: {
        gecko: {
            id: "tv-tracker@karlhorning.dev",
            data_collection_permissions: { required: ["none"] },
        },
    },
};

await writePackage("", baseManifest);
await writePackage("-firefox", firefoxManifest);

const sourceOutputName = `tv-tracker-extension-v${pkg.version}-source.zip`;
execFileSync(
    "git",
    ["archive", "--format=zip", "-o", resolve(releaseDir, sourceOutputName), "HEAD"],
    { cwd: rootDir },
);
console.log(`Wrote release/${sourceOutputName}.`);
