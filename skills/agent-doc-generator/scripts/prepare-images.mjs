import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const projectRequire = createRequire(path.join(process.cwd(), "package.json"));

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
}

function resolveInside(baseDir, relativePath, label) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, relativePath);
  const relative = path.relative(resolvedBase, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`${label} must stay inside ${resolvedBase}.`);
  }
  return resolvedPath;
}

function readPngSize(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== signature) {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }
    if (offset + 1 >= buffer.length) {
      break;
    }
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      break;
    }
    if (startOfFrameMarkers.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function readImageSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  const size = readPngSize(buffer) || readJpegSize(buffer);
  if (!size) {
    fail(`Unsupported image format for dimension detection: ${filePath}. Use PNG or JPEG.`);
  }
  return size;
}

function normalizeImageType(filePath) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  if (["jpg", "jpeg", "png"].includes(extension)) {
    return extension;
  }
  fail(`Unsupported image extension: ${filePath}. Use PNG or JPEG.`);
}

function loadPlaywright() {
  const candidates = [
    [require, process.env.PLAYWRIGHT_PATH],
    [projectRequire, "playwright"],
    [projectRequire, "playwright-core"],
    [require, "playwright"],
    [require, "playwright-core"],
  ].filter(([, candidate]) => Boolean(candidate));
  for (const [load, candidate] of candidates) {
    try {
      const module = load(candidate);
      if (module.chromium) {
        return module;
      }
    } catch {
      // Try the next candidate.
    }
  }
  fail(
    "Playwright is required for screenshot sources. Install it with " +
      "`npm install -D playwright` or set PLAYWRIGHT_PATH to a playwright/playwright-core package directory."
  );
}

function resolveTargetUrl(item, plan, planDir) {
  const target = item.url;
  if (!target || typeof target !== "string") {
    fail(`Screenshot item ${item.id} requires a url.`);
  }
  if (/^(https?|file):\/\//i.test(target)) {
    return target;
  }
  if (plan.baseUrl) {
    return new URL(target, plan.baseUrl).href;
  }
  const localPath = path.resolve(planDir, target);
  if (fs.existsSync(localPath)) {
    return pathToFileURL(localPath).href;
  }
  fail(`Cannot resolve screenshot URL for ${item.id}: ${target}`);
}

function outputFileFor(item, outputDir, defaultExtension) {
  const fileName = item.file || `${item.id}.${defaultExtension}`;
  return resolveInside(outputDir, fileName, `Output file for ${item.id}`);
}

function manifestEntry(item, outputPath, manifestDir, size) {
  return {
    id: item.id,
    path: path.relative(manifestDir, outputPath).split(path.sep).join("/"),
    type: normalizeImageType(outputPath),
    width: size.width,
    height: size.height,
    caption: item.caption || "",
    alt: item.alt || item.caption || item.id,
    origin: item.source,
    required: item.required !== false,
  };
}

async function copyImage(item, planDir, outputDir, manifestDir) {
  if (!item.path || typeof item.path !== "string") {
    fail(`${item.source} item ${item.id} requires a path.`);
  }
  const sourcePath = path.resolve(planDir, item.path);
  if (!fs.existsSync(sourcePath)) {
    fail(`Image source does not exist: ${sourcePath}`);
  }
  const defaultExtension = normalizeImageType(sourcePath);
  const outputPath = outputFileFor(item, outputDir, defaultExtension);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
  return manifestEntry(item, outputPath, manifestDir, readImageSize(outputPath));
}

async function captureScreenshot(item, plan, planDir, outputDir, manifestDir, browser) {
  const viewport = item.viewport || plan.viewport || { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const targetUrl = resolveTargetUrl(item, plan, planDir);
  const outputPath = outputFileFor(item, outputDir, "png");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  try {
    await page.goto(targetUrl, {
      waitUntil: item.waitUntil || "networkidle",
      timeout: item.timeoutMs || 30000,
    });
    if (item.waitForSelector) {
      await page.locator(item.waitForSelector).waitFor({ state: "visible" });
    }
    if (item.delayMs) {
      await page.waitForTimeout(item.delayMs);
    }
    const screenshotOptions = {
      path: outputPath,
      type: "png",
      animations: "disabled",
      caret: "hide",
    };
    if (item.selector) {
      await page.locator(item.selector).screenshot(screenshotOptions);
    } else {
      await page.screenshot({ ...screenshotOptions, fullPage: item.fullPage === true });
    }
  } finally {
    await context.close();
  }
  return manifestEntry(item, outputPath, manifestDir, readImageSize(outputPath));
}

async function main() {
  const planPath = path.resolve(process.argv[2] || "image-plan.json");
  if (!fs.existsSync(planPath)) {
    fail(`Image plan does not exist: ${planPath}`);
  }
  const plan = readJson(planPath);
  assertObject(plan, "Image plan");
  if (!Array.isArray(plan.images) || plan.images.length === 0) {
    fail("Image plan must contain a non-empty images array.");
  }

  const planDir = path.dirname(planPath);
  const outputDir = path.resolve(planDir, plan.outputDir || "doc-assets");
  const manifestPath = resolveInside(outputDir, plan.manifest || "images.json", "Manifest path");
  const manifestDir = path.dirname(manifestPath);
  fs.mkdirSync(manifestDir, { recursive: true });

  const ids = new Set();
  for (const item of plan.images) {
    assertObject(item, "Image item");
    if (!item.id || typeof item.id !== "string") {
      fail("Every image item requires a string id.");
    }
    if (ids.has(item.id)) {
      fail(`Duplicate image id: ${item.id}`);
    }
    ids.add(item.id);
  }

  const needsBrowser = plan.images.some((item) => item.source === "screenshot");
  let browser = null;
  if (needsBrowser) {
    const { chromium } = loadPlaywright();
    const launchOptions = { headless: true };
    if (plan.browserExecutable) {
      launchOptions.executablePath = path.resolve(planDir, plan.browserExecutable);
    } else if (plan.browserChannel) {
      launchOptions.channel = plan.browserChannel;
    }
    browser = await chromium.launch(launchOptions);
  }

  const images = [];
  try {
    for (const item of plan.images) {
      if (item.source === "file" || item.source === "generated") {
        images.push(await copyImage(item, planDir, outputDir, manifestDir));
      } else if (item.source === "screenshot") {
        images.push(await captureScreenshot(item, plan, planDir, outputDir, manifestDir, browser));
      } else {
        fail(`Unsupported image source for ${item.id}: ${item.source}`);
      }
      console.log(`Prepared image: ${item.id}`);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  const manifest = { version: 1, generatedAt: new Date().toISOString(), images };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Image manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
