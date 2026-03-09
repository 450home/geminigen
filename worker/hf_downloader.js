const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Cookie storage path
const COOKIE_FILE = path.join(__dirname, ".cookies.json");

// Save cookies to file
function saveCookies(cookies) {
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
  console.log("✅ Cookies saved to", COOKIE_FILE);
}

// Load cookies from file
function loadCookies() {
  if (fs.existsSync(COOKIE_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
    console.log("📥 Loaded", cookies.length, "cookies from", COOKIE_FILE);
    return cookies;
  }
  return [];
}

// Check if cookies are still valid
async function checkCookiesValid(page) {
  try {
    await page.goto("https://geminigen.ai/dashboard");
    // Check if we're redirected to login (invalid cookies)
    const currentUrl = page.url();
    return !currentUrl.includes("login");
  } catch (e) {
    return false;
  }
}

// Login and save cookies
async function loginAndSaveCookies() {
  console.log("🔐 Starting login process...");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto("https://geminigen.ai/login");
    console.log("📍 Loaded login page");

    // Fill login form
    await page.fill('input[type="email"]', process.env.GEM_EMAIL);
    await page.fill('input[type="password"]', process.env.GEM_PASS);
    console.log("✍️ Filled credentials");

    // Submit
    await page.click("button[type=submit]");

    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    console.log("✅ Login successful, redirected to dashboard");

    // Save cookies
    const cookies = await context.cookies();
    saveCookies(cookies);

    return cookies;
  } catch (error) {
    console.error("❌ Login failed:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Main function to get cookies
async function getCookies() {
  // Try loading existing cookies first
  const existingCookies = loadCookies();
  if (existingCookies.length > 0) {
    // Verify cookies are still valid
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await context.addCookies(existingCookies);

    const isValid = await checkCookiesValid(page);

    await browser.close();

    if (isValid) {
      console.log("✅ Existing cookies are valid");
      return existingCookies;
    } else {
      console.log("⚠️ Existing cookies expired, re-login required");
    }
  }

  // Login and get fresh cookies
  return await loginAndSaveCookies();
}

// Download images from dashboard using cookies
async function downloadImages(cookies) {
  console.log("🖼️ Starting image download...");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // Go to images page
    await page.goto("https://geminigen.ai/dashboard/images");
    console.log("📍 Loaded images page");

    // Wait for images to load
    await page.waitForTimeout(5000);

    // Extract image URLs
    const images = await page.$$eval("img", imgs =>
      imgs.map(i => i.src).filter(src => src && src.includes("cloudinary"))
    );

    console.log(`📸 Found ${images.length} images`);

    const downloadedImages = [];

    for (let i = 0; i < images.length; i++) {
      const src = images[i];
      try {
        const response = await axios.get(src, { responseType: "arraybuffer" });
        const filename = `geminigen_${Date.now()}_${i}.jpg`;
        const filepath = path.join(__dirname, "downloads", filename);

        // Create downloads directory if it doesn't exist
        if (!fs.existsSync(path.dirname(filepath))) {
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
        }

        // Save image to local filesystem
        fs.writeFileSync(filepath, response.data);

        downloadedImages.push({
          url: src,
          filename,
          path: filepath,
          size: Buffer.byteLength(response.data)
        });

        console.log(`✅ Downloaded [${i + 1}/${images.length}]: ${filename}`);

      } catch (error) {
        console.error(`❌ Failed to download image ${i + 1}:`, error.message);
      }
    }

    console.log(`\n🎉 Downloaded ${downloadedImages.length} images successfully!`);
    return downloadedImages;

  } finally {
    await browser.close();
  }
}

// Main execution
(async () => {
  try {
    console.log("=== GeminiGen HuggingFace Downloader ===\n");

    // Get valid cookies
    const cookies = await getCookies();

    // Download images
    const images = await downloadImages(cookies);

    console.log("\n📋 Summary:");
    console.log("- Cookies:", cookies.length);
    console.log("- Images downloaded:", images.length);
    console.log("- Storage location:", path.join(__dirname, "downloads"));

  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
})();
