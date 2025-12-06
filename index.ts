// Image Search Utility
// This is a utility that allows you to search for images using the Google Image Search API.
// This is a command line tool that allows you to search for images using the Google Image Search API.
// We will download the images to local directory. We will create a timestamp and slug from the search query for the directory name.
// We must download the highest resolution of the image that is available
//
// Tech Stack: Bun, Google Image Search API, Local File System

import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export const DOWNLOAD_DIRECTORY = "./searches";
export const DEFAULT_MAX_RESULTS = 100;
export const DEFAULT_PARALLEL_DOWNLOADS = 5;
const DOWNLOAD_TIMEOUT_MS = 30000; // 30 second timeout for image downloads

interface ImageResult {
  link: string;
  mime: string;
  image: {
    contextLink: string;
    height: number;
    width: number;
    thumbnailLink?: string;
    thumbnailHeight?: number;
    thumbnailWidth?: number;
    byteSize?: number;
  };
  title?: string;
  snippet?: string;
  displayLink?: string;
}

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

interface SearchResponse {
  items?: ImageResult[];
  error?: {
    code: number;
    message: string;
  };
}

export function createSlug(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

export function getFileExtensionFromUrl(url: string): string | null {
  const urlExt = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (urlExt && ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(urlExt)) {
    return urlExt === "jpeg" ? "jpg" : urlExt;
  }
  return null;
}

export function getFileExtensionFromMime(mimeType: string): string {
  const ext = mimeType.split("/")[1]?.toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (ext === "svg+xml") return "svg";
  if (ext && ["jpg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) {
    return ext;
  }
  return "jpg";
}

export function detectFileExtensionFromContent(buffer: ArrayBuffer): string {
  const arr = new Uint8Array(buffer).slice(0, 12);

  // PNG: 89 50 4E 47
  if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
    return "jpg";
  }

  // GIF: 47 49 46
  if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) {
    return "gif";
  }

  // WebP: RIFF ... WEBP
  if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
      arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) {
    return "webp";
  }

  // BMP: 42 4D
  if (arr[0] === 0x42 && arr[1] === 0x4D) {
    return "bmp";
  }

  return "jpg";
}

async function searchImages(
  query: string,
  apiKey: string,
  searchEngineId: string,
  startIndex: number = 1
): Promise<ImageResult[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", searchEngineId);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "10");
  url.searchParams.set("start", startIndex.toString());

  const response = await fetch(url.toString());
  const data: SearchResponse = await response.json();

  if (data.error) {
    console.error(`\nAPI Error Code: ${data.error.code}`);
    console.error(`API Error Message: ${data.error.message}`);

    if (data.error.message.includes("blocked")) {
      console.error("\nTroubleshooting:");
      console.error("1. Make sure Custom Search API is enabled in Google Cloud Console");
      console.error("   Visit: https://console.cloud.google.com/apis/library/customsearch.googleapis.com");
      console.error("2. Verify your API key has permission to use Custom Search API");
      console.error("3. Check if you have billing enabled (required for API usage)");
    } else if (data.error.code === 400 && data.error.message.includes("invalid argument")) {
      console.error("\nNote: This likely means you've reached the API's pagination limit.");
      console.error("The API has a limit on how far you can paginate through results.");
    }

    throw new Error(`API Error: ${data.error.message}`);
  }

  return data.items || [];
}

async function listPastSearches() {
  if (!existsSync(DOWNLOAD_DIRECTORY)) {
    console.log("No past searches found.");
    console.log("\nUsage: bun index.ts [--count N] [--parallel N] <search query>");
    return;
  }

  const dirs = await readdir(DOWNLOAD_DIRECTORY, { withFileTypes: true });
  const searches: Array<{
    folder: string;
    query: string;
    searchedAt: string;
    totalImages: number;
    successfulDownloads: number;
  }> = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;

    const metadataPath = join(DOWNLOAD_DIRECTORY, dir.name, "metadata.json");
    if (!existsSync(metadataPath)) continue;

    try {
      const file = Bun.file(metadataPath);
      const metadata = await file.json();

      searches.push({
        folder: dir.name,
        query: metadata.query || "Unknown",
        searchedAt: metadata.searchedAt || new Date().toISOString(),
        totalImages: metadata.totalImages || 0,
        successfulDownloads: metadata.successfulDownloads || 0,
      });
    } catch (error) {
      // Skip directories with invalid metadata
      continue;
    }
  }

  if (searches.length === 0) {
    console.log("No past searches found.");
    console.log("\nUsage: bun index.ts [--count N] [--parallel N] <search query>");
    return;
  }

  // Sort by searchedAt descending (latest first)
  searches.sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime());

  console.log("\nPast Searches (latest first):");
  console.log("=".repeat(80));

  searches.forEach((search, index) => {
    const date = new Date(search.searchedAt);
    const formattedDate = date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    console.log(
      `\n${index + 1}. "${search.query}" - ${search.successfulDownloads}/${search.totalImages} images`
    );
    console.log(`   Date: ${formattedDate}`);
    console.log(`   Folder: ${search.folder}`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("\nTo start a new search:");
  console.log("  bun index.ts [--count N] [--parallel N] <search query>");
  console.log("\nExample:");
  console.log("  bun index.ts --count 20 \"sunset ocean\"");
}

async function downloadImage(
  url: string,
  basePath: string,
  urlExtension: string | null,
  mimeType: string
): Promise<{ success: boolean; finalPath: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      clearTimeout(timeoutId);
      return { success: false, finalPath: basePath };
    }

    const arrayBuffer = await response.arrayBuffer();
    clearTimeout(timeoutId);

    // Determine extension: URL > Content > MIME > default
    let extension = urlExtension;
    if (!extension) {
      extension = detectFileExtensionFromContent(arrayBuffer);
      if (extension === "jpg" && mimeType) {
        // If content detection defaulted to jpg, try mime type
        const mimeExt = getFileExtensionFromMime(mimeType);
        if (mimeExt !== "jpg") {
          extension = mimeExt;
        }
      }
    }

    const finalPath = `${basePath}.${extension}`;
    await Bun.write(finalPath, arrayBuffer);
    return { success: true, finalPath };
  } catch (error) {
    clearTimeout(timeoutId);

    // Check if this was a timeout
    if (error instanceof Error && error.name === "AbortError") {
      // Timeout occurred - silently fail but could log if needed
      return { success: false, finalPath: basePath };
    }

    return { success: false, finalPath: basePath };
  }
}

export async function performSearch(
  query: string,
  apiKey: string,
  searchEngineId: string,
  maxResults: number,
  parallelDownloads: number
) {
  console.log(`Searching for: "${query}"`);
  console.log(`Target: ${maxResults} images\n`);

  const slug = createSlug(query);
  const timestamp = getTimestamp();
  const outputDir = join(DOWNLOAD_DIRECTORY, `${timestamp}-${slug}`);

  if (!existsSync(DOWNLOAD_DIRECTORY)) {
    await mkdir(DOWNLOAD_DIRECTORY, { recursive: true });
  }

  await mkdir(outputDir, { recursive: true });
  console.log(`Created directory: ${outputDir}`);

  let allImages: ImageResult[] = [];
  const numRequests = Math.ceil(maxResults / 10);

  console.log(`Fetching up to ${maxResults} results...`);

  for (let i = 0; i < numRequests; i++) {
    const startIndex = i * 10 + 1;
    try {
      const images = await searchImages(query, apiKey, searchEngineId, startIndex);
      if (images.length === 0) {
        console.log(`No more results found after ${allImages.length} images`);
        break;
      }
      allImages = allImages.concat(images);
      console.log(`Fetched ${allImages.length} results...`);

      if (allImages.length >= maxResults) {
        allImages = allImages.slice(0, maxResults);
        break;
      }
    } catch (error) {
      // Check if this is a pagination limit error
      if (error instanceof Error && error.message.includes("invalid argument")) {
        console.log(`\n⚠️  Reached API pagination limit. Retrieved ${allImages.length} images.`);
        break;
      }
      console.error(`\nError fetching results at index ${startIndex}:`, error);
      if (allImages.length === 0) {
        // If we haven't gotten any images yet, this is a fatal error
        throw error;
      }
      // Otherwise, continue with what we have
      console.log(`Continuing with ${allImages.length} images retrieved so far...`);
      break;
    }
  }

  console.log(`\nFound ${allImages.length} images. Starting downloads...`);
  console.log(`Parallel workers: ${parallelDownloads}\n`);

  let successCount = 0;
  let failCount = 0;
  const metadata: ImageMetadata[] = [];

  // Download in parallel batches
  for (let i = 0; i < allImages.length; i += parallelDownloads) {
    const batch = allImages.slice(i, i + parallelDownloads);
    const downloadPromises = batch.map(async (image, batchIndex) => {
      const imageIndex = i + batchIndex;
      const imageNumber = String(imageIndex + 1).padStart(3, "0");
      const urlExtension = getFileExtensionFromUrl(image.link);
      const basePath = join(outputDir, imageNumber);

      const result = await downloadImage(image.link, basePath, urlExtension, image.mime);

      const filename = result.finalPath.split("/").pop() || `${imageNumber}.jpg`;
      process.stdout.write(
        `\rDownloading ${imageIndex + 1}/${allImages.length}: ${filename}${" ".repeat(20)}`
      );

      // Create metadata entry
      const imageMetadata: ImageMetadata = {
        filename,
        originalUrl: image.link,
        sourceUrl: image.image.contextLink,
        title: image.title || "Untitled",
        snippet: image.snippet || "",
        mimeType: image.mime,
        dimensions: {
          width: image.image.width,
          height: image.image.height,
        },
        downloadedAt: new Date().toISOString(),
        success: result.success,
      };

      if (image.image.thumbnailLink) {
        imageMetadata.thumbnail = {
          url: image.image.thumbnailLink,
          width: image.image.thumbnailWidth || 0,
          height: image.image.thumbnailHeight || 0,
        };
      }

      if (image.image.byteSize) {
        imageMetadata.fileSize = image.image.byteSize;
      }

      return { success: result.success, metadata: imageMetadata };
    });

    const results = await Promise.all(downloadPromises);
    successCount += results.filter((r) => r.success).length;
    failCount += results.filter((r) => !r.success).length;
    metadata.push(...results.map((r) => r.metadata));
  }

  // Save metadata.json
  const metadataPath = join(outputDir, "metadata.json");
  const metadataContent = {
    query,
    searchedAt: new Date().toISOString(),
    totalImages: allImages.length,
    successfulDownloads: successCount,
    failedDownloads: failCount,
    images: metadata,
  };

  await Bun.write(metadataPath, JSON.stringify(metadataContent, null, 2));

  console.log(`\n\nDownload complete!`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Location: ${outputDir}`);
  console.log(`Metadata: ${metadataPath}`);

  return { successCount, failCount, outputDir };
}

export async function main(apiKey?: string, searchEngineId?: string) {
  const args = process.argv.slice(2);

  // Parse arguments
  let maxResults = DEFAULT_MAX_RESULTS;
  let parallelDownloads = DEFAULT_PARALLEL_DOWNLOADS;
  const queries: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count" && i + 1 < args.length) {
      maxResults = parseInt(args[i + 1], 10);
      if (isNaN(maxResults) || maxResults < 1) {
        console.error("Error: --count must be a positive number");
        process.exit(1);
      }
      i++; // Skip next arg
    } else if (args[i] === "--parallel" && i + 1 < args.length) {
      parallelDownloads = parseInt(args[i + 1], 10);
      if (isNaN(parallelDownloads) || parallelDownloads < 1) {
        console.error("Error: --parallel must be a positive number");
        process.exit(1);
      }
      parallelDownloads = Math.min(parallelDownloads, 20); // Reasonable max
      i++; // Skip next arg
    } else if (!args[i].startsWith("--")) {
      // Treat each non-flag argument as a separate query
      queries.push(args[i]);
    }
  }

  if (queries.length === 0) {
    await listPastSearches();
    return;
  }

  // Validate API credentials
  if (!apiKey || !searchEngineId) {
    console.error("Error: Missing required API credentials");
    console.error("Please provide GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID");
    process.exit(1);
  }

  // Run searches for each query
  const totalQueries = queries.length;
  const results: Array<{ query: string; success: number; failed: number; location: string }> = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    if (totalQueries > 1) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`Search ${i + 1} of ${totalQueries}: "${query}"`);
      console.log("=".repeat(80) + "\n");
    }

    try {
      const result = await performSearch(query, apiKey, searchEngineId, maxResults, parallelDownloads);
      results.push({
        query,
        success: result.successCount,
        failed: result.failCount,
        location: result.outputDir,
      });
    } catch (error) {
      console.error(`\nError running search for "${query}":`, error);
      results.push({
        query,
        success: 0,
        failed: 0,
        location: "N/A",
      });
    }
  }

  // Print summary if multiple queries
  if (totalQueries > 1) {
    console.log(`\n\n${"=".repeat(80)}`);
    console.log("SUMMARY - All Searches");
    console.log("=".repeat(80));

    let totalSuccess = 0;
    let totalFailed = 0;

    results.forEach((result, index) => {
      console.log(`\n${index + 1}. "${result.query}"`);
      console.log(`   Success: ${result.success} | Failed: ${result.failed}`);
      console.log(`   Location: ${result.location}`);

      totalSuccess += result.success;
      totalFailed += result.failed;
    });

    console.log(`\n${"=".repeat(80)}`);
    console.log(`Total: ${totalSuccess} successful, ${totalFailed} failed across ${totalQueries} searches`);
    console.log("=".repeat(80));
  }
}
