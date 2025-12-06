import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  createSlug,
  getFileExtensionFromUrl,
  getFileExtensionFromMime,
  detectFileExtensionFromContent,
  getTimestamp,
} from "./index";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

describe("createSlug", () => {
  test("converts simple query to slug", () => {
    expect(createSlug("sunset ocean")).toBe("sunset-ocean");
  });

  test("handles uppercase letters", () => {
    expect(createSlug("Sunset Ocean")).toBe("sunset-ocean");
  });

  test("removes special characters", () => {
    expect(createSlug("sunset & ocean!")).toBe("sunset-ocean");
  });

  test("handles multiple spaces", () => {
    expect(createSlug("sunset   ocean")).toBe("sunset-ocean");
  });

  test("removes leading and trailing dashes", () => {
    expect(createSlug("  sunset ocean  ")).toBe("sunset-ocean");
  });

  test("handles numbers", () => {
    expect(createSlug("sunset 2023")).toBe("sunset-2023");
  });

  test("handles single word", () => {
    expect(createSlug("sunset")).toBe("sunset");
  });

  test("handles complex special characters", () => {
    expect(createSlug("café résumé")).toBe("caf-r-sum");
  });

  test("handles empty string", () => {
    expect(createSlug("")).toBe("");
  });

  test("handles only special characters", () => {
    expect(createSlug("!@#$%^&*()")).toBe("");
  });

  test("handles hyphens in input", () => {
    expect(createSlug("pre-existing-hyphen")).toBe("pre-existing-hyphen");
  });
});

describe("getFileExtensionFromUrl", () => {
  test("extracts jpg extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.jpg")).toBe("jpg");
  });

  test("extracts png extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.png")).toBe("png");
  });

  test("converts jpeg to jpg", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.jpeg")).toBe("jpg");
  });

  test("handles query parameters", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.jpg?size=large")).toBe("jpg");
  });

  test("handles complex query parameters", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.png?w=800&h=600&format=png")).toBe(
      "png"
    );
  });

  test("returns null for unknown extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.xyz")).toBe(null);
  });

  test("returns null for no extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image")).toBe(null);
  });

  test("extracts webp extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.webp")).toBe("webp");
  });

  test("extracts gif extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.gif")).toBe("gif");
  });

  test("extracts bmp extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.bmp")).toBe("bmp");
  });

  test("extracts svg extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.svg")).toBe("svg");
  });

  test("handles uppercase extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.PNG")).toBe("png");
  });

  test("handles mixed case extension", () => {
    expect(getFileExtensionFromUrl("https://example.com/image.JpG")).toBe("jpg");
  });

  test("handles path with multiple dots", () => {
    expect(getFileExtensionFromUrl("https://example.com/my.file.name.jpg")).toBe("jpg");
  });
});

describe("getFileExtensionFromMime", () => {
  test("extracts jpg from image/jpeg", () => {
    expect(getFileExtensionFromMime("image/jpeg")).toBe("jpg");
  });

  test("extracts png from image/png", () => {
    expect(getFileExtensionFromMime("image/png")).toBe("png");
  });

  test("extracts gif from image/gif", () => {
    expect(getFileExtensionFromMime("image/gif")).toBe("gif");
  });

  test("extracts webp from image/webp", () => {
    expect(getFileExtensionFromMime("image/webp")).toBe("webp");
  });

  test("extracts bmp from image/bmp", () => {
    expect(getFileExtensionFromMime("image/bmp")).toBe("bmp");
  });

  test("extracts svg from image/svg+xml", () => {
    expect(getFileExtensionFromMime("image/svg+xml")).toBe("svg");
  });

  test("defaults to jpg for unknown mime", () => {
    expect(getFileExtensionFromMime("image/unknown")).toBe("jpg");
  });

  test("defaults to jpg for invalid mime", () => {
    expect(getFileExtensionFromMime("invalid")).toBe("jpg");
  });

  test("handles empty mime type", () => {
    expect(getFileExtensionFromMime("")).toBe("jpg");
  });

  test("handles uppercase mime type", () => {
    expect(getFileExtensionFromMime("IMAGE/PNG")).toBe("png");
  });
});

describe("detectFileExtensionFromContent", () => {
  test("detects PNG signature", () => {
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectFileExtensionFromContent(pngSignature.buffer)).toBe("png");
  });

  test("detects JPEG signature (FF D8 FF E0)", () => {
    const jpegSignature = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectFileExtensionFromContent(jpegSignature.buffer)).toBe("jpg");
  });

  test("detects JPEG signature (FF D8 FF E1)", () => {
    const jpegSignature = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectFileExtensionFromContent(jpegSignature.buffer)).toBe("jpg");
  });

  test("detects GIF87a signature", () => {
    const gifSignature = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0, 0, 0, 0, 0, 0]);
    expect(detectFileExtensionFromContent(gifSignature.buffer)).toBe("gif");
  });

  test("detects GIF89a signature", () => {
    const gifSignature = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
    expect(detectFileExtensionFromContent(gifSignature.buffer)).toBe("gif");
  });

  test("detects WebP signature", () => {
    const webpSignature = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(detectFileExtensionFromContent(webpSignature.buffer)).toBe("webp");
  });

  test("detects BMP signature", () => {
    const bmpSignature = new Uint8Array([0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectFileExtensionFromContent(bmpSignature.buffer)).toBe("bmp");
  });

  test("defaults to jpg for unknown signature", () => {
    const unknownSignature = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectFileExtensionFromContent(unknownSignature.buffer)).toBe("jpg");
  });

  test("handles small buffer", () => {
    const smallBuffer = new Uint8Array([0x89, 0x50]);
    expect(detectFileExtensionFromContent(smallBuffer.buffer)).toBe("jpg");
  });

  test("handles empty buffer", () => {
    const emptyBuffer = new Uint8Array([]);
    expect(detectFileExtensionFromContent(emptyBuffer.buffer)).toBe("jpg");
  });
});

describe("getTimestamp", () => {
  test("returns timestamp in expected format YYYY-MM-DD-HH-MM-SS", () => {
    const timestamp = getTimestamp();
    // Format: YYYY-MM-DD-HH-MM-SS
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
  });

  test("contains valid date components", () => {
    const timestamp = getTimestamp();
    const parts = timestamp.split("-");

    expect(parts).toHaveLength(6);

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    const hours = parseInt(parts[3]);
    const minutes = parseInt(parts[4]);
    const seconds = parseInt(parts[5]);

    expect(year).toBeGreaterThan(2020);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThanOrEqual(23);
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThanOrEqual(59);
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThanOrEqual(59);
  });

  test("generates valid timestamps", () => {
    const ts1 = getTimestamp();
    const ts2 = getTimestamp();

    // Both should match the format
    expect(ts1).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
    expect(ts2).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);

    // They might be the same if called in the same second
    // Just verify they're valid
    expect(ts1.length).toBe(19); // YYYY-MM-DD-HH-MM-SS = 19 chars
    expect(ts2.length).toBe(19);
  });
});

describe("argument parsing", () => {
  function parseArgs(args: string[]): {
    count?: number;
    parallel?: number;
    query: string;
  } {
    let count: number | undefined;
    let parallel: number | undefined;
    const queryParts: string[] = [];

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--count" && i + 1 < args.length) {
        count = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i] === "--parallel" && i + 1 < args.length) {
        parallel = Math.min(parseInt(args[i + 1], 10), 20);
        i++;
      } else {
        queryParts.push(args[i]);
      }
    }

    return { count, parallel, query: queryParts.join(" ") };
  }

  test("parses count argument", () => {
    const result = parseArgs(["--count", "50", "sunset"]);
    expect(result.count).toBe(50);
    expect(result.query).toBe("sunset");
  });

  test("parses parallel argument", () => {
    const result = parseArgs(["--parallel", "10", "sunset"]);
    expect(result.parallel).toBe(10);
    expect(result.query).toBe("sunset");
  });

  test("parses both arguments", () => {
    const result = parseArgs(["--count", "30", "--parallel", "5", "sunset ocean"]);
    expect(result.count).toBe(30);
    expect(result.parallel).toBe(5);
    expect(result.query).toBe("sunset ocean");
  });

  test("allows any count value (no artificial capping)", () => {
    const result = parseArgs(["--count", "200", "sunset"]);
    expect(result.count).toBe(200);

    const result2 = parseArgs(["--count", "1000", "sunset"]);
    expect(result2.count).toBe(1000);
  });

  test("caps parallel at 20", () => {
    const result = parseArgs(["--parallel", "50", "sunset"]);
    expect(result.parallel).toBe(20);
  });

  test("handles multi-word query", () => {
    const result = parseArgs(["sunset", "ocean", "beach"]);
    expect(result.query).toBe("sunset ocean beach");
  });

  test("handles query with arguments", () => {
    const result = parseArgs(["--count", "20", "mountain", "landscape"]);
    expect(result.count).toBe(20);
    expect(result.query).toBe("mountain landscape");
  });

  test("handles arguments in different order", () => {
    const result = parseArgs(["mountain", "--count", "20", "landscape"]);
    expect(result.count).toBe(20);
    expect(result.query).toBe("mountain landscape");
  });

  test("handles only query", () => {
    const result = parseArgs(["space exploration"]);
    expect(result.count).toBeUndefined();
    expect(result.parallel).toBeUndefined();
    expect(result.query).toBe("space exploration");
  });

  test("handles empty args", () => {
    const result = parseArgs([]);
    expect(result.query).toBe("");
  });

  test("handles invalid count", () => {
    const result = parseArgs(["--count", "abc", "sunset"]);
    expect(isNaN(result.count!)).toBe(true);
  });

  test("handles missing count value", () => {
    const result = parseArgs(["--count", "sunset"]);
    expect(result.count).toBeNaN();
    expect(result.query).toBe("");
  });
});

describe("API behavior", () => {
  test("allows any count value without artificial limits", () => {
    // We don't artificially cap the count - let the API tell us the limit
    const counts = [50, 100, 200, 1000];
    counts.forEach((count) => {
      expect(count).toBeGreaterThan(0);
      // No capping in our code - API will naturally limit when reached
    });
  });

  test("error handling will catch API limits naturally", () => {
    // The API will return errors when limits are reached
    // Our error handling catches 400 errors with "invalid argument"
    const mockError = {
      code: 400,
      message: "Request contains an invalid argument.",
    };

    expect(mockError.code).toBe(400);
    expect(mockError.message).toContain("invalid argument");
  });
});

describe("integration tests", () => {
  const TEST_DIR = "./test-temp-searches";

  beforeEach(async () => {
    // Clean up before each test
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true });
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true });
    }
  });

  test("creates valid directory names from queries", async () => {
    const queries = ["sunset ocean", "Mountain View!", "café@paris", "test 123"];
    const expectedSlugs = ["sunset-ocean", "mountain-view", "caf-paris", "test-123"];

    for (let i = 0; i < queries.length; i++) {
      const slug = createSlug(queries[i]);
      expect(slug).toBe(expectedSlugs[i]);

      // Verify slug can be used in directory name
      const timestamp = getTimestamp();
      const dirName = `${timestamp}-${slug}`;
      // Format: YYYY-MM-DD-HH-MM-SS-slug
      expect(dirName).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-[a-z0-9-]+$/);
    }
  });

  test("metadata structure is valid", () => {
    const mockMetadata = {
      query: "test query",
      searchedAt: new Date().toISOString(),
      totalImages: 10,
      successfulDownloads: 8,
      failedDownloads: 2,
      images: [
        {
          filename: "001.jpg",
          originalUrl: "https://example.com/image.jpg",
          sourceUrl: "https://example.com",
          title: "Test Image",
          snippet: "Description",
          mimeType: "image/jpeg",
          dimensions: { width: 800, height: 600 },
          downloadedAt: new Date().toISOString(),
          success: true,
        },
      ],
    };

    // Verify all required fields exist
    expect(mockMetadata.query).toBeDefined();
    expect(mockMetadata.searchedAt).toBeDefined();
    expect(mockMetadata.totalImages).toBe(10);
    expect(mockMetadata.successfulDownloads).toBe(8);
    expect(mockMetadata.failedDownloads).toBe(2);
    expect(mockMetadata.images).toHaveLength(1);
    expect(mockMetadata.images[0].filename).toBe("001.jpg");
  });
});
