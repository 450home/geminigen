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

// Log function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  console.log(message);

  try {
    fs.appendFileSync("/app/worker/downloader.log", logMessage);
  } catch (e) {
    // Ignore
  }
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

// Download images using cookies
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
    log("=== GeminiGen HuggingFace Downloader ===");
    log("=".repeat(60));
    log(`📦 S3 Bucket: ${BUCKET_NAME}`);
    log(`🌐 S3 Endpoint: https://s3.hi168.com`);
    log();

    // Check for cookies in environment
    const cookiesJson = process.env.GEMINIGEN_COOKIES;
    if (cookiesJson) {
      log("🍪 Found cookies in environment variable");
      try {
        const cookies = JSON.parse(cookiesJson);
        const images = await downloadImages(cookies);

        log("\n📋 Summary:");
        log(`- Cookies: ${cookies.length}`);
        log(`- Images uploaded: ${images.length}`);
        log(`- Storage: S3 (hi168)`);

        return images;
      } catch (e) {
        log(`❌ Failed to parse cookies: ${e.message}`);
      }
    }

    // No cookies in environment - need login
    log("❌ No cookies found in GEMINIGEN_COOKIES environment variable");
    log();
    log("⚠️  GeminiGen 使用 Cloudflare Turnstile CAPTCHA 保护登录");
    log("⚠️  自动化登录已被阻止");
    log();
    log("📋 手动登录步骤：");
    log("   1. 在浏览器中访问: https://geminigen.ai/login");
    log("   2. 手动完成 Turnstile 验证");
    log("   3. 登录成功后，打开浏览器开发者工具 (F12)");
    log("   4. 在 Application 标签中找到 Cookies");
    log("   5. 复制所有 cookies");
    log("   6. 在 Space 的 Secrets 中添加 GEMINIGEN_COOKIES");
    log("   7. Cookie 格式示例：");
    log('      [{"name":"session","value":"xxx","domain":".geminigen.ai","path":"/"}]');
    log();
    log("🔗 HuggingFace Space Secrets:");
    log("   https://huggingface.co/spaces/tndai/geminigen-hf/settings");
    log();
    log("💡 提示：添加环境变量后，点击 Restart 重启 Space");

    throw new Error("No cookies provided. Manual login required.");

  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`);
    log(`❌ Stack: ${error.stack}`);
    process.exit(1);
  }
})();
