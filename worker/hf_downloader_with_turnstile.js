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

// Log function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  console.log(message);

  try {
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (e) {
    console.error("Failed to write to log file:", e.message);
  }
}

// Human-like mouse movement with Bezier curve and jitter
async function humanMouseMove(page, startX, startY, endX, endY) {
  const steps = Math.floor(Math.random() * 30) + 30; // 30-60 steps

  for (let i = 0; i < steps; i++) {
    const t = i / steps;

    // Bezier curve interpolation
    let x = startX + (endX - startX) * t;
    let y = startY + (endY - startY) * t;

    // Add sine wave jitter (simulates hand tremor)
    x += (Math.random() * 4 - 2) * Math.sin(t * Math.PI);
    y += (Math.random() * 4 - 2) * Math.sin(t * Math.PI);

    await page.mouse.move(x, y);

    // Variable speed: faster in middle, slower at ends
    let sleepTime = Math.random() * 0.009 + 0.001;
    if (t > 0.2 && t < 0.8) {
      sleepTime /= 2;
    }

    await new Promise(resolve => setTimeout(resolve, sleepTime * 1000));
  }

  // Ensure final position
  await page.mouse.move(endX, endY);
}

// Apply stealth mode to hide automation features
async function applyStealth(page) {
  await page.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter(parameter);
    };

    // Hide automation indicators
    Object.defineProperty(navigator, 'automation', { get: () => false });
    Object.defineProperty(navigator, 'permissions', {
      get: () => ({
        query: () => Promise.resolve({ state: 'granted' })
      })
    });
  `);
}

// Cookie storage
const COOKIE_FILE = path.join(__dirname, ".cookies.json");

function saveCookies(cookies) {
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
  log(`✅ Cookies saved to ${COOKIE_FILE}`);
}

function loadCookies() {
  if (fs.existsSync(COOKIE_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
    log(`📥 Loaded ${cookies.length} cookies from ${COOKIE_FILE}`);
    return cookies;
  }
  log("ℹ️ No existing cookies found");
  return [];
}

// Check cookies validity
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

// Login with human-like behavior and Turnstile handling
async function loginAndSaveCookies() {
  log("🔐 Starting login process with human-like behavior...");
  log(`📧 Email: ${process.env.GEM_EMAIL ? "***@***" : "NOT SET"}`);
  log(`🔑 Password: ${process.env.GEM_PASS ? "***" : "NOT SET"}`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  const page = await context.newPage();
  await applyStealth(page);

  try {
    // Navigate to login page
    log("📍 Navigating to login page...");
    await page.goto("https://geminigen.ai/login", { waitUntil: 'domcontentloaded', timeout: 30000 });
    log("✅ Login page loaded");

    // Wait for SPA to render
    log("⏳ Waiting for dynamic content to load...");
    await page.waitForTimeout(5000);

    // Click Login button with human-like movement
    log("🔍 Looking for Login button...");

    const loginButtonClicked = await page.evaluate(() => {
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

    // Find and fill form with human-like typing
    log("🔍 Looking for input fields...");
    await page.waitForSelector('input', { timeout: 10000 });
    log("✅ Input fields found");

    const inputs = await page.$$('input');
    log(`📊 Found ${inputs.length} input elements`);

    let emailField = null;
    let passwordField = null;
    let submitButton = null;

    for (const input of inputs) {
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');

      log(`  Input: type="${type}", name="${name}", placeholder="${placeholder}"`);

      if (!emailField && (type === 'email' || name === 'username' || placeholder?.toLowerCase().includes('email'))) {
        emailField = input;
        log(`    ✅ Identified as email field`);
      }
      if (!passwordField && type === 'password') {
        passwordField = input;
        log(`    ✅ Identified as password field`);
      }
    }

    if (!emailField || !passwordField) {
      log("❌ Email or password input not found!");
      throw new Error("Email or password input field not found");
    }

    log("✅ Found email and password fields");

    // Fill email with human-like movement
    log("✍️ Filling email field with human-like typing...");
    const emailBox = await emailField.boundingBox();
    if (emailBox) {
      await humanMouseMove(page, 960, 540, emailBox.x + emailBox.width / 2, emailBox.y + emailBox.height / 2);
      await page.mouse.click(emailBox.x + emailBox.width / 2, emailBox.y + emailBox.height / 2);
    }

    // Type with random delays (simulating human typing)
    for (const char of process.env.GEM_EMAIL) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * 100) + 50 });
    }
    log("✍️ Email filled");

    await page.waitForTimeout(500 + Math.random() * 500);

    // Fill password
    log("✍️ Filling password field...");
    const passwordBox = await passwordField.boundingBox();
    if (passwordBox) {
      await humanMouseMove(page, emailBox.x, emailBox.y, passwordBox.x + passwordBox.width / 2, passwordBox.y + passwordBox.height / 2);
    }

    for (const char of process.env.GEM_PASS) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * 80) + 40 });
    }
    log("✍️ Password filled");

    await page.waitForTimeout(500 + Math.random() * 500);

    // Check for Cloudflare Turnstile
    const turnstileIframe = await page.$('iframe[src*="challenges.cloudflare.com"]');
    if (turnstileIframe) {
      log("⚠️ Detected Cloudflare Turnstile (CAPTCHA)");
      log("🔄 Attempting to solve with human-like behavior...");

      try {
        // Wait for Turnstile iframe to load
        await page.waitForTimeout(2000);

        // Get iframe coordinates
        const box = await turnstileIframe.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          log(`📍 Turnstile iframe found at (${box.x}, ${box.y})`);

          // Simulate human reaction time (1.5-3.0 seconds)
          const reactionTime = Math.random() * 1.5 + 1.5;
          log(`⏱️ Simulating human reaction time: ${reactionTime.toFixed(2)}s`);
          await page.waitForTimeout(reactionTime * 1000);

          // Calculate target coordinates (left checkbox + random offset)
          const targetX = box.x + 30 + (Math.random() * 10 - 5);
          const targetY = box.y + (box.height / 2) + (Math.random() * 10 - 5);
          log(`🎯 Target coordinates: (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`);

          // Human-like mouse movement to Turnstile checkbox
          await humanMouseMove(page, 960, 540, targetX, targetY);

          // Hover before clicking (0.3-0.8 seconds)
          const hoverTime = Math.random() * 0.5 + 0.3;
          log(`⏸️ Hover time: ${hoverTime.toFixed(2)}s`);
          await page.waitForTimeout(hoverTime * 1000);

          // Physical click (down -> wait -> up)
          log("🖱️ Executing physical click (Down -> Sleep -> Up)...");
          await page.mouse.down();
          await page.waitForTimeout(Math.random() * 0.07 + 0.08);
          await page.mouse.up();

          log("✅ Clicked Turnstile checkbox, waiting for verification...");
          await page.screenshot({ path: '/app/worker/turnstile_clicked.png' });

          // Wait for Turnstile to verify
          await page.waitForTimeout(5000);
        }
      } catch (e) {
        log(`⚠️ Turnstile solving failed: ${e.message}`);
        log("⚠️ Continuing anyway - may fail login");
      }
    }

    // Find and click submit button with human-like movement
    log("🔍 Looking for submit button...");

    const submitClicked = await page.evaluate(() => {
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

    const currentUrl = page.url();
    log(`📍 Current URL after submit: ${currentUrl}`);

    // Check for errors
    if (currentUrl.includes('login')) {
      log("❌ Still on login page - login likely failed");

      // Try to find error message
      const errorSelectors = ['.error', '.alert', '[class*="error"]', '[class*="alert"]', '[role="alert"]'];
      let errorFound = false;
      for (const selector of errorSelectors) {
        const errorElement = await page.$(selector);
        if (errorElement) {
          const errorText = await errorElement.textContent();
          if (errorText && errorText.trim()) {
            log(`❌ Error message: ${errorText.trim()}`);
            errorFound = true;
          }
        }
      }

      throw new Error("Login failed - check credentials or CAPTCHA");
    } else if (currentUrl.includes('dashboard')) {
      log("✅ Login successful, redirected to dashboard");
    } else {
      log(`⚠️ Redirected to unexpected URL: ${currentUrl}`);
    }

    // Final check
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

async function getCookies() {
  log("🍪 Getting cookies...");

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

  log("🔄 Logging in with human-like behavior...");
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
    log("📍 Navigating to images page...");
    await page.goto("https://geminigen.ai/dashboard/images", { waitUntil: 'domcontentloaded', timeout: 30000 });
    log("✅ Images page loaded");

    log("⏳ Waiting for images to load...");
    await page.waitForTimeout(5000);

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
    log("=== GeminiGen HuggingFace Downloader (Human-like + Turnstile Solver) ===");
    log("=".repeat(60));
    log(`📦 S3 Bucket: ${BUCKET_NAME}`);
    log(`🌐 S3 Endpoint: https://s3.hi168.com`);
    log(`📝 Log file: ${LOG_FILE}`);
    log("");

    const cookies = await getCookies();
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
