#!/usr/bin/env node
/**
 * Skrypt aktualizujący URL buildu Android we wszystkich plikach dokumentacji.
 *
 * Użycie:
 *   node scripts/update-build-url.js <new-build-id>
 *   node scripts/update-build-url.js           # automatycznie pobiera ostatni build z EAS
 *
 * Po aktualizacji kopiuje pliki z docs/ do public/docs/.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DOCS_DIR = path.join(__dirname, "..", "docs");
const PUBLIC_DOCS_DIR = path.join(__dirname, "..", "public", "docs");
const BUILD_URL_PATTERN = /expo\.dev\/accounts\/pmb\.proud\/projects\/BSapp\/builds\/[a-f0-9-]{36}/g;

// Get new build ID
let newBuildId = process.argv[2];

if (!newBuildId) {
  console.log("No build ID provided, fetching latest from EAS...");
  try {
    const output = execSync("npx eas-cli build:list --platform android --limit 1 --non-interactive --json", {
      encoding: "utf-8",
      timeout: 30000,
    });
    const builds = JSON.parse(output);
    if (builds && builds.length > 0) {
      newBuildId = builds[0].id;
      console.log(`Latest build: ${newBuildId}`);
    } else {
      console.error("No builds found.");
      process.exit(1);
    }
  } catch (e) {
    console.error("Failed to fetch builds from EAS:", e.message);
    process.exit(1);
  }
}

// Validate UUID format
if (!/^[a-f0-9-]{36}$/.test(newBuildId)) {
  console.error(`Invalid build ID format: ${newBuildId}`);
  process.exit(1);
}

const newUrl = `expo.dev/accounts/pmb.proud/projects/BSapp/builds/${newBuildId}`;

// Update all HTML files in docs/
const htmlFiles = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".html"));
let updatedCount = 0;

for (const file of htmlFiles) {
  const filePath = path.join(DOCS_DIR, file);
  const content = fs.readFileSync(filePath, "utf-8");
  const updated = content.replace(BUILD_URL_PATTERN, newUrl);

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, "utf-8");
    console.log(`✔ Updated: docs/${file}`);
    updatedCount++;
  } else {
    console.log(`  Skipped (no change): docs/${file}`);
  }
}

// Copy to public/docs/
if (!fs.existsSync(PUBLIC_DOCS_DIR)) {
  fs.mkdirSync(PUBLIC_DOCS_DIR, { recursive: true });
}

for (const file of htmlFiles) {
  fs.copyFileSync(path.join(DOCS_DIR, file), path.join(PUBLIC_DOCS_DIR, file));
}
console.log(`✔ Copied ${htmlFiles.length} files to public/docs/`);

console.log(`\nDone! Updated ${updatedCount} file(s) with build ${newBuildId}`);
