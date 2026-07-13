const fs = require("node:fs");
const path = require("node:path");
const {
  AlignmentType,
  ImageRun,
  Paragraph,
  ShadingType,
  TextRun,
} = require("docx");

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

function probeImageSize(buffer, filePath) {
  const size = readPngSize(buffer) || readJpegSize(buffer);
  if (!size) {
    throw new Error(`Cannot detect image dimensions: ${filePath}`);
  }
  return size;
}

function imageType(filePath) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  if (["png", "jpg", "jpeg"].includes(extension)) {
    return extension;
  }
  throw new Error(`Unsupported DOCX image type: ${filePath}`);
}

function fitWithin(width, height, maxWidth, maxHeight, allowUpscale) {
  const scale = Math.min(maxWidth / width, maxHeight / height, allowUpscale ? Infinity : 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function placeholder(label) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { fill: "FFF8E1", type: ShadingType.CLEAR },
    indent: { left: 240, right: 240 },
    children: [
      new TextRun({
        text: `[Image unavailable: ${label}]`,
        italics: true,
        color: "777777",
        size: 20,
      }),
    ],
  });
}

function createImageHelpers(options = {}) {
  const manifestPath = path.resolve(options.manifestPath || "doc-assets/images.json");
  const maxWidth = options.maxWidth || 620;
  const maxHeight = options.maxHeight || 430;
  const allowUpscale = options.allowUpscale === true;
  const missingBehavior = options.missingBehavior || "placeholder";
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Image manifest does not exist: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.images)) {
    throw new Error(`Invalid image manifest: ${manifestPath}`);
  }
  const manifestDir = path.dirname(manifestPath);
  const byId = new Map(manifest.images.map((entry) => [entry.id, entry]));

  function imageBlock(id, overrides = {}) {
    const entry = byId.get(id);
    const required = overrides.required ?? entry?.required ?? false;
    if (!entry) {
      if (required || missingBehavior === "error") {
        throw new Error(`Image id not found in manifest: ${id}`);
      }
      return [placeholder(id)];
    }

    const filePath = path.resolve(manifestDir, entry.path);
    if (!fs.existsSync(filePath)) {
      if (required || missingBehavior === "error") {
        throw new Error(`Image file does not exist: ${filePath}`);
      }
      return [placeholder(entry.caption || id)];
    }

    const data = fs.readFileSync(filePath);
    const sourceSize = entry.width && entry.height
      ? { width: entry.width, height: entry.height }
      : probeImageSize(data, filePath);
    const transformation = fitWithin(
      sourceSize.width,
      sourceSize.height,
      overrides.maxWidth || maxWidth,
      overrides.maxHeight || maxHeight,
      overrides.allowUpscale ?? allowUpscale
    );
    const alt = overrides.alt || entry.alt || entry.caption || id;
    const caption = overrides.caption ?? entry.caption;

    const paragraphs = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: caption ? 50 : 120 },
        children: [
          new ImageRun({
            type: entry.type || imageType(filePath),
            data,
            transformation,
            altText: { title: alt, description: alt, name: id },
          }),
        ],
      }),
    ];

    if (caption) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 140 },
          children: [
            new TextRun({ text: caption, italics: true, color: "666666", size: 18 }),
          ],
        })
      );
    }
    return paragraphs;
  }

  return { imageBlock, manifest };
}

module.exports = { createImageHelpers, fitWithin };
