"""
HuggingFace Space for GeminiGen Image Downloader
"""
import subprocess
import os
import sys

# Install Playwright browsers on startup
def install_browsers():
    """Install required Playwright browsers"""
    print("🔧 Installing Playwright browsers...")
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    print("✅ Playwright browsers installed successfully")

if __name__ == "__main__":
    # Install browsers first
    install_browsers()

    # Run the downloader
    print("\n🚀 Starting GeminiGen Downloader...")
    os.system("node worker/hf_downloader.js")
