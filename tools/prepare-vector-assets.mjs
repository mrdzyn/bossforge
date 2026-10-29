import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const archivePath = resolve(repositoryRoot, "assets/source/bossforge-vecsyniq-source-assets.zip");
const outputRoot = resolve(repositoryRoot, "apps/web/public/assets");
const expectedAssets = ["Golem.svg", "Wraith.svg", "Drake.svg", "Mimic.svg", "Bossforge-logo.svg"];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function archiveMember(path) {
  return execFileSync("unzip", ["-p", archivePath, path], { maxBuffer: 16 * 1024 * 1024 });
}

export function assertSafeSvg(source, label = "SVG") {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source))
    throw new Error(`${label}: DTD/entities are forbidden`);
  if (/<\s*(?:script|foreignObject|iframe|object|embed|image|audio|video)\b/i.test(source))
    throw new Error(`${label}: active or externally sourced elements are forbidden`);
  if (/\s+on[a-z][\w:.-]*\s*=/i.test(source))
    throw new Error(`${label}: event handlers are forbidden`);
  if (/@import\b|expression\s*\(/i.test(source))
    throw new Error(`${label}: executable CSS constructs are forbidden`);

  for (const match of source.matchAll(/\b(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi)) {
    if (!match[2].trim().startsWith("#"))
      throw new Error(`${label}: only local fragment references are allowed`);
  }
  for (const match of source.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    if (!match[2].trim().startsWith("#"))
      throw new Error(`${label}: only local fragment URLs are allowed`);
  }
}

function addViewBox(source, label) {
  const root = source.match(/<svg\b([^>]*)>/i);
  if (!root) throw new Error(`${label}: SVG root element is missing`);
  if (/\bviewBox\s*=/.test(root[1])) return source;

  const dimensions = ["width", "height"].map((dimension) => {
    const value = root[1].match(
      new RegExp(`\\b${dimension}\\s*=\\s*(["'])([0-9.]+)(?:px)?\\1`, "i"),
    );
    if (!value) throw new Error(`${label}: cannot derive a viewBox without numeric dimensions`);
    return Number(value[2]);
  });
  if (dimensions.some((dimension) => !Number.isFinite(dimension) || dimension <= 0))
    throw new Error(`${label}: invalid SVG dimensions`);
  const viewBox = `viewBox="0 0 ${dimensions[0]} ${dimensions[1]}"`;
  return source.replace(root[0], `<svg ${viewBox}${root[1]}>`);
}

export function optimizeOriginalSvg(buffer, label, floatPrecision = 1) {
  const source = buffer.toString("utf8");
  assertSafeSvg(source, label);
  const withViewBox = addViewBox(source, label);
  const result = optimize(withViewBox, {
    path: label,
    multipass: false,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            convertPathData: { floatPrecision },
          },
        },
      },
      "removeDimensions",
    ],
  });
  assertSafeSvg(result.data, `${label} optimized`);
  return Buffer.from(result.data, "utf8");
}

export function prepareProductionAssets() {
  const manifest = JSON.parse(archiveMember("ASSET-MANIFEST.json").toString("utf8"));
  if (!Array.isArray(manifest.files)) throw new Error("Source asset manifest is invalid");
  const byName = new Map(manifest.files.map((item) => [item.name, item]));
  if (byName.size !== expectedAssets.length || expectedAssets.some((name) => !byName.has(name)))
    throw new Error("Source asset manifest does not contain the five expected originals");

  const outputs = [];
  for (const name of expectedAssets) {
    const item = byName.get(name);
    if (item.path !== `vecsyniq-originals/${name}`)
      throw new Error(`${name}: unexpected archive path`);
    const original = archiveMember(item.path);
    if (original.length !== item.bytes || sha256(original) !== item.sha256)
      throw new Error(`${name}: source integrity check failed`);
    const optimized = optimizeOriginalSvg(original, name);
    const destination =
      name === "Bossforge-logo.svg"
        ? "branding/bossforge-logo.svg"
        : `bosses/${name.toLowerCase()}`;
    outputs.push({
      name,
      destination,
      originalBytes: original.length,
      originalSha256: item.sha256,
      optimizedBytes: optimized.length,
      optimizedSha256: sha256(optimized),
      content: optimized,
    });
  }

  const fullLogo = outputs.find((output) => output.name === "Bossforge-logo.svg");
  const iconViewport = "280 0 1448 1450";
  const croppedLogo = fullLogo.content
    .toString("utf8")
    .replace('viewBox="0 0 2048 2048"', `viewBox="${iconViewport}"`);
  const iconResult = optimize(croppedLogo, {
    path: "Bossforge-logo.svg icon crop",
    multipass: false,
    plugins: [
      {
        name: "preset-default",
        params: { overrides: { convertPathData: { floatPrecision: 0 } } },
      },
      "removeOffCanvasPaths",
    ],
  });
  assertSafeSvg(iconResult.data, "Bossforge logo icon crop");
  const iconBytes = Buffer.from(iconResult.data, "utf8");
  outputs.push({
    name: "Bossforge-logo-mark.svg",
    destination: "branding/bossforge-mark.svg",
    originalBytes: fullLogo.originalBytes,
    originalSha256: fullLogo.originalSha256,
    optimizedBytes: iconBytes.length,
    optimizedSha256: sha256(iconBytes),
    content: iconBytes,
  });

  const generatedManifest = {
    schemaVersion: 1,
    sourceArchive: "assets/source/bossforge-vecsyniq-source-assets.zip",
    optimizer: "svgo@4.0.0",
    assets: outputs.map(
      ({ name, destination, originalBytes, originalSha256, optimizedBytes, optimizedSha256 }) => ({
        name,
        destination: `assets/${destination}`,
        originalBytes,
        originalSha256,
        optimizedBytes,
        optimizedSha256,
        ...(name === "Bossforge-logo-mark.svg"
          ? { derivedFrom: "Bossforge-logo.svg", viewBox: iconViewport }
          : {}),
      }),
    ),
  };
  outputs.push({
    name: "asset-manifest.json",
    destination: "asset-manifest.json",
    content: Buffer.from(`${JSON.stringify(generatedManifest, null, 2)}\n`, "utf8"),
  });
  return outputs;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const outputs = prepareProductionAssets();
  let failed = false;
  for (const output of outputs) {
    const path = resolve(outputRoot, output.destination);
    if (checkOnly) {
      let current;
      try {
        current = await readFile(path);
      } catch {
        current = null;
      }
      if (!current || !current.equals(output.content)) {
        process.stderr.write(`STALE ${output.destination}\n`);
        failed = true;
      }
    } else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, output.content);
      if (output.originalBytes)
        process.stdout.write(
          `${output.name}: ${output.originalBytes} → ${output.optimizedBytes} bytes (${Math.round((1 - output.optimizedBytes / output.originalBytes) * 100)}% smaller)\n`,
        );
    }
  }
  if (failed) process.exitCode = 1;
  else
    process.stdout.write(
      checkOnly ? "Vector assets are reproducible and current.\n" : "Vector assets prepared.\n",
    );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
