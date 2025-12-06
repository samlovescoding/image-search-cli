// Example: How to use metadata.json to filter and analyze downloaded images

import { readdir } from "node:fs/promises";
import { join } from "node:path";

interface ImageMetadata {
  filename: string;
  originalUrl: string;
  sourceUrl: string;
  title: string;
  snippet: string;
  mimeType: string;
  dimensions: {
    width: number;
    height: number;
  };
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
  fileSize?: number;
  downloadedAt: string;
  success: boolean;
}

interface Metadata {
  query: string;
  searchedAt: string;
  totalImages: number;
  successfulDownloads: number;
  failedDownloads: number;
  images: ImageMetadata[];
}

// Example 1: Filter images by minimum dimensions
async function filterByDimensions(metadataPath: string, minWidth: number, minHeight: number) {
  const file = Bun.file(metadataPath);
  const metadata: Metadata = await file.json();

  const largeImages = metadata.images.filter(
    (img) => img.dimensions.width >= minWidth && img.dimensions.height >= minHeight
  );

  console.log(`\nImages larger than ${minWidth}x${minHeight}:`);
  largeImages.forEach((img) => {
    console.log(`- ${img.filename}: ${img.dimensions.width}x${img.dimensions.height}`);
  });

  return largeImages;
}

// Example 2: Generate attribution list
async function generateAttributions(metadataPath: string) {
  const file = Bun.file(metadataPath);
  const metadata: Metadata = await file.json();

  console.log(`\nImage Attributions for query: "${metadata.query}"`);
  console.log("=".repeat(50));

  metadata.images.forEach((img, index) => {
    console.log(`\n${index + 1}. ${img.title}`);
    console.log(`   Source: ${img.sourceUrl}`);
    console.log(`   Image URL: ${img.originalUrl}`);
  });
}

// Example 3: Find failed downloads for retry
async function findFailedDownloads(metadataPath: string) {
  const file = Bun.file(metadataPath);
  const metadata: Metadata = await file.json();

  const failed = metadata.images.filter((img) => !img.success);

  if (failed.length === 0) {
    console.log("\nAll downloads succeeded!");
    return [];
  }

  console.log(`\nFailed downloads (${failed.length}):`);
  failed.forEach((img) => {
    console.log(`- ${img.filename}: ${img.originalUrl}`);
  });

  return failed;
}

// Example 4: Generate HTML gallery
async function generateHTMLGallery(metadataPath: string, outputPath: string) {
  const file = Bun.file(metadataPath);
  const metadata: Metadata = await file.json();

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Gallery: ${metadata.query}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .image-card { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
    .image-card img { width: 100%; height: 200px; object-fit: cover; }
    .image-info { padding: 15px; }
    .image-info h3 { margin: 0 0 10px 0; font-size: 14px; }
    .image-info p { margin: 5px 0; font-size: 12px; color: #666; }
    .image-info a { color: #0066cc; text-decoration: none; }
  </style>
</head>
<body>
  <h1>Gallery: ${metadata.query}</h1>
  <p style="text-align: center; color: #666;">
    ${metadata.successfulDownloads} images downloaded on ${new Date(metadata.searchedAt).toLocaleDateString()}
  </p>
  <div class="gallery">
    ${metadata.images
      .filter((img) => img.success)
      .map(
        (img) => `
      <div class="image-card">
        <img src="../${img.filename}" alt="${img.title}">
        <div class="image-info">
          <h3>${img.title}</h3>
          <p><strong>Dimensions:</strong> ${img.dimensions.width}x${img.dimensions.height}</p>
          <p><strong>Size:</strong> ${img.fileSize ? (img.fileSize / 1024).toFixed(1) + " KB" : "Unknown"}</p>
          <p><a href="${img.sourceUrl}" target="_blank">View Source</a></p>
        </div>
      </div>
    `
      )
      .join("\n")}
  </div>
</body>
</html>`;

  await Bun.write(outputPath, html);
  console.log(`\nHTML gallery generated: ${outputPath}`);
}

// Example 5: Statistics
async function printStatistics(metadataPath: string) {
  const file = Bun.file(metadataPath);
  const metadata: Metadata = await file.json();

  const totalSize = metadata.images
    .filter((img) => img.success && img.fileSize)
    .reduce((sum, img) => sum + (img.fileSize || 0), 0);

  const avgWidth =
    metadata.images.reduce((sum, img) => sum + img.dimensions.width, 0) / metadata.images.length;

  const avgHeight =
    metadata.images.reduce((sum, img) => sum + img.dimensions.height, 0) / metadata.images.length;

  console.log(`\nStatistics for: "${metadata.query}"`);
  console.log("=".repeat(50));
  console.log(`Total images: ${metadata.totalImages}`);
  console.log(`Successful: ${metadata.successfulDownloads}`);
  console.log(`Failed: ${metadata.failedDownloads}`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Average dimensions: ${avgWidth.toFixed(0)}x${avgHeight.toFixed(0)}`);

  const formats = metadata.images.reduce(
    (acc, img) => {
      acc[img.mimeType] = (acc[img.mimeType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log("\nFormats:");
  Object.entries(formats).forEach(([format, count]) => {
    console.log(`  ${format}: ${count}`);
  });
}

// Main CLI
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log("Usage:");
  console.log("  bun examples/filter-metadata.ts <command> <metadata.json path> [options]");
  console.log("\nCommands:");
  console.log("  filter <metadata.json> <width> <height>  - Filter images by minimum dimensions");
  console.log("  attributions <metadata.json>             - Generate attribution list");
  console.log("  failed <metadata.json>                   - List failed downloads");
  console.log("  gallery <metadata.json> <output.html>    - Generate HTML gallery");
  console.log("  stats <metadata.json>                    - Print statistics");
  console.log("\nExample:");
  console.log("  bun examples/filter-metadata.ts stats searches/2025-12-06_1234567890-stars/metadata.json");
  process.exit(0);
}

const metadataPath = args[1];

if (!metadataPath) {
  console.error("Error: metadata.json path required");
  process.exit(1);
}

switch (command) {
  case "filter":
    await filterByDimensions(metadataPath, parseInt(args[2] || "800"), parseInt(args[3] || "600"));
    break;
  case "attributions":
    await generateAttributions(metadataPath);
    break;
  case "failed":
    await findFailedDownloads(metadataPath);
    break;
  case "gallery":
    await generateHTMLGallery(metadataPath, args[2] || "gallery.html");
    break;
  case "stats":
    await printStatistics(metadataPath);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
