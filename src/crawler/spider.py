
import subprocess
import os
import sys

def run_crawler():
    """
    Launches the High-Performance TypeScript Crawler.
    We leverage Node.js for superior Async/Await concurrency handling 
    requried for crawling 1M+ documents efficiently.
    """
    print("[Spider] Launching optimized TypeScript crawler...")
    
    # Ensure dependencies are installed
    if not os.path.exists("node_modules"):
        print("[Spider] Installing Node.js dependencies...")
        subprocess.run(["npm", "install"], shell=True, check=True)
        
    # Run the crawler script
    try:
        # call src/scripts/crawl_to_json.ts
        cmd = "npx tsx src/scripts/crawl_to_json.ts"
        print(f"[Spider] Executing: {cmd}")
        subprocess.run(cmd, shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"[Spider] Crawler failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_crawler()
