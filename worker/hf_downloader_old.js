const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// S3 Client configuration
const s3 = new S3Client({
  region: "auto",
  endpoint: "https://s3.hi168.com",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "C9RGITP8OGS65986RZ50",
    secretAccessKey: process.env.S3_SECRET_KEY || "QMjdC0LNHgUNrZNJajD1oszq24fFlNYqElyfcCqh",
  },
});

const BUCKET_NAME = "hi168-25505-58814hj4";

// Log file path
const LOG_FILE = path.join(__dirname, "downloader.log");

// Log function - writes to both console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  console.log(message);

  // Append to log file
  try {
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (e) {
    console.error("Failed to write to log file:", e.message);
  }
}

// Cookie storage path
const COOKIE_FILE = path.join(__dirname, ".cookies.json");

// Save cookies to file
function saveCookies(cookies) {
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
  log(`✅ Cookies saved to ${COOKIE_FILE}`);
}

// Load cookies from file
function loadCookies() {
  if (fs.existsSync(COOKIE_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
    log(`📥 Loaded ${cookies.length} cookies from ${COOKIE_FILE}`);
    return cookies;
  }
  log("ℹ️ No existing cookies found");
  return [];
}

// Check if cookies are still valid
async function checkCookiesValid(page) {
  try {
    log("🔍 Checking if cookies are valid...");
    await page.goto("https://geminigen.ai/dashboard", { waitUntil: 'networkidle' });
    const currentUrl = page.url();
    const isValid = !currentUrl.includes("login");
    log(`${isValid ? "✅ Cookies are valid" : "❌ Cookies are invalid/expired"}`);
    log(`📍 Current URL: ${currentUrl}`);
    return isValid;
  } catch (e) {
    log(`❌ Cookie check failed: ${e.message}`);
    return false;
  }
}

// Login and save cookies
async function loginAndSaveCookies() {
  log("🔐 Starting login process...");
  log(`📧 Email: ${process.env.GEM_EMAIL ? "***@***" : "NOT SET"}`);
  log(`🔑 Password: ${process.env.GEM_PASS ? "***" : "NOT SET"}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    // Navigate to login page
    log("📍 Navigating to login page...");
    await page.goto("https://geminigen.ai/login", { waitUntil: 'domcontentloaded', timeout: 30000 });
    log("✅ Login page loaded");

    // Wait longer for SPA to fully render
    log("⏳ Waiting for dynamic content to load...");
    await page.waitForTimeout(5000);

    // Try to find login button and click it using JavaScript
    log("🔍 Looking for Login button...");

    // Use JavaScript to find and click the login button
    const loginButtonClicked = await page.evaluate(() => {
      // Find button with text "Login"
      const buttons = Array.from(document.querySelectorAll('button'));
      const loginButton = buttons.find(btn =>
        btn.textContent && btn.textContent.trim() === 'Login'
      );

      if (loginButton) {
        loginButton.click();
        return true;
      }
      return false;
    });

    if (loginButtonClicked) {
      log("✅ Login button clicked via JavaScript");
    } else {
      log("❌ Could not find or click login button");
      throw new Error("Login button not found");
    }

    // Wait for form to appear
    log("⏳ Waiting for login form to appear...");
    await page.waitForTimeout(3000);

    // Now look for input fields
    log("🔍 Looking for input fields...");
    await page.waitForSelector('input', { timeout: 10000 });
    log("✅ Input fields found");

    const inputs = await page.$$('input');
    log(`📊 Found ${inputs.length} input elements`);

    let emailField = null;
    let passwordField = null;

    // Identify email and password fields
    for (const input of inputs) {
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');

      log(`  Input: type="${type}", name="${name}", placeholder="${placeholder}", id="${id}"`);

      if (!emailField && (type === 'email' || name === 'username' || placeholder?.toLowerCase().includes('email'))) {
        emailField = input;
        log(`    ✅ Identified as email field`);
      }
      if (!passwordField && type === 'password') {
        passwordField = input;
        log(`    ✅ Identified as password field`);
      }
    }

    if (!emailField) {
      log("❌ Email input not found!");
      throw new Error("Email input field not found");
    }

    if (!passwordField) {
      log("❌ Password input not found!");
      throw new Error("Password input field not found");
    }

    log("✅ Found email and password fields");

    // Check for Cloudflare Turnstile (CAPTCHA)
    const hasTurnstile = await page.$('[name="cf-turnstile-response"]');
    if (hasTurnstile) {
      log("⚠️ Detected Cloudflare Turnstile (CAPTCHA) on login form");
      log("⚠️ This login cannot be automated - requires human interaction");
      throw new Error("CAPTCHA detected - automation not possible");
    }

    // Fill login form
    log("✍️ Filling email field...");
    await emailField.fill(process.env.GEM_EMAIL);
    log("✍️ Email filled");

    log("✍️ Filling password field...");
    await passwordField.fill(process.env.GEM_PASS);
    log("✍️ Password filled");

    // Find and click submit button using JavaScript
    log("🔍 Looking for submit button...");

    const submitClicked = await page.evaluate(() => {
      // Look for submit button
      const submitButton = document.querySelector('button[type="submit"]') ||
                         document.querySelector('input[type="submit"]') ||
                         Array.from(document.querySelectorAll('button')).find(btn =>
                           btn.textContent && (btn.textContent.includes('Login') ||
                           btn.textContent.includes('Sign In') ||
                           btn.textContent.includes('登录') ||
                           btn.textContent.includes('Continue'))
                         );

      if (submitButton) {
        submitButton.click();
        return true;
      }
      return false;
    });

    if (submitClicked) {
      log("✅ Submit button clicked via JavaScript");
    } else {
      log("❌ Submit button not found!");
      throw new Error("Submit button not found");
    }

    // Wait for redirect or error
    log("⏳ Waiting for redirect to dashboard or error...");
    await page.waitForTimeout(5000);

    // Check current state
    const currentUrl = page.url();
    const pageContent = await page.content();

    log(`📍 Current URL after submit: ${currentUrl}`);

    // Check for error messages
    if (currentUrl.includes('login')) {
      log("❌ Still on login page - login likely failed");

      // Try to find error message
      const errorSelectors = [
        '.error',
        '.alert',
        '[class*="error"]',
        '[class*="alert"]',
        '[role="alert"]'
      ];

      let errorFound = false;
      for (const selector of errorSelectors) {
        const errorElement = await page.$(selector);
        if (errorElement) {
          const errorText = await errorElement.textContent();
          if (errorText && errorText.trim()) {
            log(`❌ Error message found: ${errorText.trim()}`);
            errorFound = true;
          }
        }
      }

      if (!errorFound) {
        // Search page content for error patterns
        const lowerContent = pageContent.toLowerCase();
        if (lowerContent.includes('invalid') || lowerContent.includes('incorrect') ||
            lowerContent.includes('wrong') || lowerContent.includes('failed')) {
          log("❌ Login failed - check email and password");
        }
      }

      throw new Error("Login failed - check credentials");
    } else if (currentUrl.includes('dashboard')) {
      log("✅ Login successful, redirected to dashboard");
    } else {
      log(`⚠️ Redirected to unexpected URL: ${currentUrl}`);
      // Still proceed if we're not on login page
    }

    // Final check - wait a bit more for full page load
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    log(`📍 Final URL: ${finalUrl}`);

    if (!finalUrl.includes('dashboard')) {
      log("❌ Not on dashboard page - login may have failed");
      throw new Error("Login failed - not redirected to dashboard");
    }

    // Save cookies
    const cookies = await context.cookies();
    log(`✅ Saving ${cookies.length} cookies`);
    saveCookies(cookies);

    return cookies;
  } catch (error) {
    log(`❌ Login failed: ${error.message}`);
    log(`❌ Error stack: ${error.stack}`);
    throw error;
  } finally {
    await browser.close();
    log("🔚 Browser closed");
  }
}

// Main function to get cookies
async function getCookies() {
  log("🍪 Getting cookies...");

  // Try loading existing cookies first
  const existingCookies = loadCookies();
  if (existingCookies.length > 0) {
    log("🔄 Checking if existing cookies are valid...");
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    await context.addCookies(existingCookies);

    const isValid = await checkCookiesValid(page);

    await browser.close();

    if (isValid) {
      log("✅ Existing cookies are valid, reusing them");
      return existingCookies;
    } else {
      log("⚠️ Existing cookies expired, need to re-login");
    }
  }

  // Login and get fresh cookies
  log("🔄 Logging in to get fresh cookies...");
  return await loginAndSaveCookies();
}

// Upload image to S3
async function uploadToS3(buffer, filename) {
  log(`📤 Uploading ${filename} to S3...`);
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: "image/jpeg",
  });

  await s3.send(command);
  const url = `https://${BUCKET_NAME}.s3.hi168.com/${filename}`;
  log(`✅ Uploaded to S3: ${url}`);
  return url;
}

// Download images from dashboard using cookies
async function downloadImages(cookies) {
  log("🖼️ Starting image download...");
  log(`🍪 Using ${cookies.length} cookies`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // Go to images page
    log("📍 Navigating to images page...");
    await page.goto("https://geminigen.ai/dashboard/images", { waitUntil: 'domcontentloaded', timeout: 30000 });
    log("✅ Images page loaded");

    // Wait for dynamic content
    log("⏳ Waiting for images to load...");
    await page.waitForTimeout(5000);

    // Extract image URLs
    log("🔍 Extracting image URLs...");
    const images = await page.$$eval("img", imgs =>
      imgs.map(i => i.src).filter(src => src && src.includes("cloudinary"))
    );

    log(`📸 Found ${images.length} images`);

    if (images.length === 0) {
      log("⚠️ No images found on page");
      return [];
    }

    log(`📝 Image URLs to download:`);
    images.forEach((url, i) => {
      log(`  ${i + 1}. ${url}`);
    });

    const uploadedImages = [];

    for (let i = 0; i < images.length; i++) {
      const src = images[i];
      try {
        log(`⏳ Downloading image ${i + 1}/${images.length}...`);
        const response = await axios.get(src, { responseType: "arraybuffer", timeout: 30000 });
        const buffer = Buffer.from(response.data);
        const filename = `geminigen/${Date.now()}_${i}.jpg`;

        // Upload to S3
        const s3Url = await uploadToS3(buffer, filename);

        uploadedImages.push({
          originalUrl: src,
          s3Url,
          filename,
          size: buffer.length
        });

        log(`✅ Uploaded [${i + 1}/${images.length}]: ${filename}`);

      } catch (error) {
        log(`❌ Failed to download/upload image ${i + 1}: ${error.message}`);
      }
    }

    log(`\n🎉 Uploaded ${uploadedImages.length} images to S3 successfully!`);
    return uploadedImages;

  } finally {
    await browser.close();
    log("🔚 Browser closed");
  }
}

// Main execution
(async () => {
  try {
    log("=".repeat(60));
    log("=== GeminiGen HuggingFace Downloader (S3 Version) ===");
    log("=".repeat(60));
    log(`📦 S3 Bucket: ${BUCKET_NAME}`);
    log(`🌐 S3 Endpoint: https://s3.hi168.com`);
    log(`📝 Log file: ${LOG_FILE}`);
    log("");

    // Get valid cookies
    const cookies = await getCookies();

    // Download and upload images
    const images = await downloadImages(cookies);

    log("\n📋 Summary:");
    log(`- Cookies: ${cookies.length}`);
    log(`- Images uploaded: ${images.length}`);
    log(`- Storage: S3 (hi168)`);

    if (images.length > 0) {
      log("\n📂 Downloaded Images:");
      images.forEach((img, i) => {
        log(`  ${i + 1}. ${img.filename}`);
        log(`     Original: ${img.originalUrl}`);
        log(`     S3: ${img.s3Url}`);
      });
    }

    log("\n✅ Process completed successfully!");

  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`);
    log(`❌ Stack: ${error.stack}`);
    process.exit(1);
  }
})();
