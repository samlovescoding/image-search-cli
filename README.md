# Image Search Utility

A command-line tool to search and download images using Google Custom Search API.

## Features

- Search for images using Google Custom Search API
- Download high-resolution images (API naturally limits pagination at ~100-200)
- **Multiple queries support** - Run multiple searches in one command with automatic summary
- **Natural API limit handling** - No artificial caps, gracefully handles API pagination limits
- **Past search history** - Run without arguments to see all previous searches sorted by date
- **Quick folder access** - `image-search open` opens the downloads folder in your file explorer
- **Parallel downloads** - Configurable workers (1-20, default 5) with `--parallel` flag for faster performance
- **Download timeout protection** - 30-second timeout per image to prevent stuck downloads
- **Smart file extension detection** using URL, file content analysis, and MIME types
- **Metadata tracking** - Each download folder includes `metadata.json` with image URLs, dimensions, titles, and more
- **Clean folder naming** - `YYYY-MM-DD-HH-MM-SS-search-query` format for easy sorting
- **GNU Parallel support** - Batch process queries from files for true parallel execution
- Configurable result count with `--count` flag
- Progress tracking and error handling
- Preserves original image formats (JPG, PNG, GIF, WebP, BMP, SVG)
- **Comprehensive test suite** for safe updates and refactoring

## Installation

You can use this tool in three ways:

### Option 1: Standalone Executable (Recommended)

Download the pre-built binary for your platform (no Bun or Node.js required):

```bash
# Download and make executable (macOS/Linux)
chmod +x image-search
./image-search config set GOOGLE_API_KEY=your_key
./image-search "search query"
```

### Option 2: npm Package (Global Install)

```bash
# Install globally with Bun
bun add -g image-search

# Or run directly with bunx (no install)
bunx image-search "search query"
```

### Option 3: From Source

```bash
# Clone and install dependencies
git clone <repository-url>
cd image-search
bun install

# Run directly
bun cli.ts "search query"
```

## Setup

### 1. Get Google Custom Search API Credentials

1. **Create a Google Custom Search Engine:**
   - Go to [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all)
   - Click "Add" to create a new search engine
   - Enter a name and select "Search the entire web"
   - Create the search engine and copy the **Search Engine ID (cx)**

2. **Get an API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the [Custom Search API](https://console.cloud.google.com/apis/library/customsearch.googleapis.com)
   - Go to [Credentials](https://console.cloud.google.com/apis/credentials) and click "Create Credentials" → "API Key"
   - Copy the **API Key** (optionally restrict it to Custom Search API for security)

### 2. Configure API Credentials

The CLI supports multiple ways to provide credentials (in priority order):

#### Option A: Global Config File (Recommended for CLI)

Set credentials once, use anywhere:

```bash
image-search config set GOOGLE_API_KEY=your_api_key_here
image-search config set GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here

# View current config
image-search config list

# Get config file location
image-search config path
```

Config is stored in `~/.config/image-search/config.json`

#### Option B: Environment Variables (.env file)

Create a `.env` file in your project directory:

```bash
cp .env.example .env
```

Edit `.env`:

```env
GOOGLE_API_KEY=your_actual_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_actual_search_engine_id_here
```

Good for project-specific credentials or when running from source.

#### Option C: CLI Flags

Pass credentials directly (not recommended for security):

```bash
image-search --api-key YOUR_KEY --search-engine-id YOUR_ID "search query"
```

**Priority:** CLI flags → .env file → Global config → Error

## Usage

> **Note:** Replace `image-search` with `bun cli.ts` if running from source, or `./image-search` if using the standalone executable.

### Config Management

```bash
# Set API credentials
image-search config set GOOGLE_API_KEY=your_key
image-search config set GOOGLE_SEARCH_ENGINE_ID=your_id

# View current configuration (keys are masked)
image-search config list

# Get specific config value
image-search config get GOOGLE_API_KEY

# Show config file location
image-search config path
```

### List Past Searches

Run without arguments to see all previous searches:

```bash
image-search
```

This displays all past searches in descending order (latest first) with:
- Search query
- Number of successful downloads
- Date and time
- Folder name

Example output:
```
Past Searches (latest first):
================================================================================

1. "nebula" - 5/5 images
   Date: Dec 6, 2025 at 11:11 AM
   Folder: 2025-12-06_1764999665021-nebula

2. "galaxies" - 3/3 images
   Date: Dec 6, 2025 at 11:10 AM
   Folder: 2025-12-06_1764999652102-galaxies

3. "stars" - 5/5 images
   Date: Dec 6, 2025 at 11:05 AM
   Folder: 2025-12-06_1764999341834-stars

================================================================================
```

### Open Downloads Folder

Open the searches folder in your system's file explorer:

```bash
image-search open
```

This will open the `./searches` directory in:
- Finder (macOS)
- Explorer (Windows)
- Default file manager (Linux)

This is helpful when you want to quickly access your downloaded images without navigating manually. If no searches have been performed yet, you'll get an error with instructions to run a search first.

### Search for Images

**Single Query:**
```bash
image-search [--count N] [--parallel N] "your search query"
```

**Multiple Queries:**
```bash
image-search [--count N] [--parallel N] "query1" "query2" "query3"
```

Run multiple searches in one command! Each query is treated as a separate search with its own folder. The tool will:
- Execute each search sequentially
- Show progress for each search
- Display a summary at the end with totals across all searches

### Options

- `--count N` - Number of images to download (default 100)
  - **No artificial limits** - Request as many as you want
  - The API will naturally stop when it reaches its pagination limit (~100-200 images)
  - Error handling will catch and report the API limit gracefully
- `--parallel N` - Number of parallel downloads (max 20, default 5)

### Examples

```bash
# Download default 100 images with 5 parallel workers
image-search "sunset ocean"

# Open the downloads folder to view images
image-search open

# Download only 20 images
image-search --count 20 "mountain landscape"

# Download 50 images with 10 parallel workers for faster downloads
image-search --count 50 --parallel 10 "cute puppies"

# Use 1 worker for sequential downloads
image-search --parallel 1 "nature"

# Request any amount - API will naturally limit when reached
image-search --count 200 "space"
# Downloads will continue until API returns pagination limit error

# Search multiple topics in one command
image-search --count 10 "sunset" "mountains" "ocean"
# Runs 3 separate searches, 10 images each, shows summary at the end

# Use CLI flags for credentials (not recommended)
image-search --api-key YOUR_KEY --search-engine-id YOUR_ID "cats"
```

## Batch Processing with GNU Parallel

For processing large lists of search queries from a file, use GNU Parallel for even greater efficiency:

### Create a file with search terms

```bash
# queries.txt
sunset
mountains
ocean
forest
desert
galaxy
nebula
```

### Run searches in parallel (4 at a time)

```bash
cat queries.txt | parallel -j4 image-search --count 20 {}
```

### With custom flags

```bash
cat queries.txt | parallel -j4 image-search --count 50 --parallel 10 {}
```

### Progress tracking

```bash
cat queries.txt | parallel --progress -j4 image-search --count 20 {}
```

### GNU Parallel Benefits

- **True parallelism**: Run multiple searches simultaneously (vs sequential in multi-query mode)
- **Progress tracking**: See how many searches are complete
- **Resume capability**: Can resume if interrupted
- **Logging**: Built-in job logging
- **Resource control**: Limit concurrent jobs with `-j` flag

**Install GNU Parallel:**
```bash
# macOS
brew install parallel

# Ubuntu/Debian
sudo apt-get install parallel

# Other systems
# See: https://www.gnu.org/software/parallel/
```

### Multiple Queries Output

When running multiple queries, you'll see progress for each search and a final summary:

```
================================================================================
Search 1 of 3: "moon"
================================================================================
[... download progress ...]

================================================================================
Search 2 of 3: "mars"
================================================================================
[... download progress ...]

================================================================================
SUMMARY - All Searches
================================================================================

1. "moon"
   Success: 10 | Failed: 0
   Location: searches/2025-12-06_1234567890-moon

2. "mars"
   Success: 10 | Failed: 0
   Location: searches/2025-12-06_1234567891-mars

================================================================================
Total: 20 successful, 0 failed across 2 searches
================================================================================
```

## Output

Images are downloaded to:
```
./searches/YYYY-MM-DD-HH-MM-SS-search-query-in-kebab-case/
  ├── 001.jpg
  ├── 002.png
  ├── 003.webp
  ├── metadata.json
  └── ...
```

### Folder Naming Format

`YYYY-MM-DD-HH-MM-SS-search-query-in-kebab-case`

Examples:
- `2025-12-06-11-36-38-black-holes`
- `2025-12-06-14-22-15-sunset-ocean`
- `2025-12-06-09-45-30-mountain-landscape`

The timestamp includes the full date and time (year, month, day, hour, minute, second) for precise sorting and identification.

### Metadata File

Each download folder contains a `metadata.json` file with comprehensive information about the search and downloaded images:

```json
{
  "query": "stars",
  "searchedAt": "2025-12-06T05:35:43.634Z",
  "totalImages": 5,
  "successfulDownloads": 5,
  "failedDownloads": 0,
  "images": [
    {
      "filename": "001.jpg",
      "originalUrl": "https://example.com/image.jpg",
      "sourceUrl": "https://example.com/page",
      "title": "Image Title",
      "snippet": "Image Description",
      "mimeType": "image/jpeg",
      "dimensions": {
        "width": 1600,
        "height": 1600
      },
      "thumbnail": {
        "url": "https://example.com/thumb.jpg",
        "width": 150,
        "height": 150
      },
      "fileSize": 766108,
      "downloadedAt": "2025-12-06T05:35:42.723Z",
      "success": true
    }
  ]
}
```

This metadata is useful for:
- Tracking image sources and attributions
- Filtering images by dimensions or file size
- Identifying failed downloads for retry
- Building image galleries or databases

### Using Metadata

The project includes example utilities for working with metadata in `examples/filter-metadata.ts`:

```bash
# Show statistics about downloaded images
bun examples/filter-metadata.ts stats searches/2025-12-06_1234567890-stars/metadata.json

# Filter images by minimum dimensions (e.g., 800x600)
bun examples/filter-metadata.ts filter searches/.../metadata.json 800 600

# Generate HTML gallery from downloaded images
bun examples/filter-metadata.ts gallery searches/.../metadata.json output.html

# List image attributions (sources)
bun examples/filter-metadata.ts attributions searches/.../metadata.json

# Find failed downloads for retry
bun examples/filter-metadata.ts failed searches/.../metadata.json
```

## Troubleshooting

### "Requests to this API are blocked" Error

If you see this error, it means the Custom Search API is not properly enabled:

1. **Enable the API:**
   - Visit [Custom Search API](https://console.cloud.google.com/apis/library/customsearch.googleapis.com)
   - Make sure you're in the correct project
   - Click "Enable" button

2. **Enable Billing (Required):**
   - Go to [Billing](https://console.cloud.google.com/billing)
   - Link a billing account to your project
   - Note: The API has a free tier (100 queries/day), but billing must be enabled

3. **Verify API Key Permissions:**
   - Go to [Credentials](https://console.cloud.google.com/apis/credentials)
   - Click on your API key
   - Under "API restrictions", ensure Custom Search API is allowed

### "API key not valid" Error

- Double-check your API key in the `.env` file
- Make sure there are no extra spaces or quotes
- Verify the API key hasn't been deleted or restricted

### "Invalid Value for cx" Error

- Verify your Search Engine ID is correct
- Make sure you created a Programmable Search Engine at https://programmablesearchengine.google.com/

## Limitations

- **API quota**: Google Custom Search API allows 100 queries per day on the free tier
- **Results per query**: ~100-200 images maximum per search (API pagination limit)
  - The API returns 10 results per request
  - Pagination has a natural limit (varies, typically around start index 100-200)
  - **No artificial limits in our code** - request any amount and let API naturally stop
  - Error handling gracefully catches pagination limit errors
  - This is a Google API limitation that cannot be bypassed
- Some images may fail to download due to access restrictions or broken links
- **Billing must be enabled** in Google Cloud Console to use the API (even for free tier)

## Testing

The project includes a comprehensive test suite with **67+ tests** to ensure reliability across updates.

Run tests:

```bash
bun test
```

### Test Coverage

**Core Utility Functions** (exported and tested directly):
- `createSlug()` - 11 tests covering edge cases (special chars, empty strings, unicode)
- `getFileExtensionFromUrl()` - 13 tests for URL parsing and query parameters
- `getFileExtensionFromMime()` - 10 tests for MIME type handling
- `detectFileExtensionFromContent()` - 10 tests for magic byte detection (PNG, JPEG, GIF, WebP, BMP)
- `getTimestamp()` - 4 tests for timestamp format validation

**Argument Parsing** - 10 tests:
- Flag parsing (`--count`, `--parallel`)
- Multi-word queries
- Edge cases (invalid values, missing arguments)
- Order independence

**API Limit Validation** - 4 tests:
- Maximum result capping
- Under/at/over limit scenarios

**Integration Tests** - 2 tests:
- Directory name generation
- Metadata structure validation

### Test Structure

Tests import actual functions from `index.ts` (no code duplication), ensuring tests match implementation:

```typescript
import {
  createSlug,
  getFileExtensionFromUrl,
  detectFileExtensionFromContent,
} from "./index";
```

All tests pass with proper cleanup (beforeEach/afterEach hooks for temp files).

## Building Standalone Executables

For developers who want to build their own executables:

```bash
# Build for current platform
bun run build

# Build for specific platforms
bun run build:linux     # Linux x64
bun run build:macos     # macOS x64
bun run build:windows   # Windows x64

# Build for all platforms
bun run build:all
```

Executables are created in the project root:
- `image-search` (current platform)
- `image-search-linux` (Linux)
- `image-search-macos` (macOS)
- `image-search-windows.exe` (Windows)

The executables are self-contained and include the Bun runtime (~58MB).

## Publishing to npm

To publish as an npm package:

1. Update `package.json`:
   - Remove `"private": true`
   - Add `"author"` and other metadata

2. Publish:
   ```bash
   bun publish
   ```

3. Users can install globally:
   ```bash
   bun add -g image-search
   # or
   npm install -g image-search
   ```

## Tech Stack

- Bun runtime
- Google Custom Search JSON API
- TypeScript
- Bun Test (built-in testing framework)

---

This project was created using `bun init` in bun v1.3.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
