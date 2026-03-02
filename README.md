# SEG301 - Vertical Search Engine Project

## Group Information
- **Course**: SEG301 - Search Engines & Information Retrieval
- **Project**: Vertical Search Engine for E-commerce (Tiki, Lazada, Shopee, Chotot, etc.)
- **Goal**: 1,000,000 Documents (Status: **Achieved & Exceeded**)

## Data Statistics (Milestone 1)
As of the latest verification (2026-03-02), the system has successfully collected and processed **1,006,666** clean documents (193 records excluded post-cleaning due to missing `name_normalized`).

| Source Platform | Document Count | Status |
| :--- | :--- | :--- |
| **Tiki** | 389,306 | Normalized |
| **Chotot** | 387,818 | Normalized |
| **Lazada** | 177,256 | Normalized |
| **CellphoneS** | 42,249 | Normalized |
| **Điện Máy Xanh** | 6,145 | Normalized |
| **Thegioididong** | 3,892 | Normalized |
| **TOTAL** | **1,006,666** | **100% Target Met** |

## Architecture
This project uses a hybrid architecture designed for big data scalability:
- **Crawler (Milestone 1)**: 
    - **Engine**: TypeScript/Node.js with Puppeteer & Axios.
    - **Performance**: Multi-threaded concurrency with `p-queue` and Browser Pooling.
    - **Stealth**: Automated fingerprint rotation and hybrid execution to bypass bot detection (Lazada, Tiki).
- **Processing (Milestone 1)**: Python (`src/crawler/parser.py`) for Cleaning, Word Segmentation (PyVi), and Deduplication.
- **Persistence**: Hybrid storage using JSONL for raw data and **CockroachDB** for structured search metadata.
- **Indexing & Ranking (Milestone 2)**: Python (`src/indexer/spimi.py`, `src/ranking/bm25.py`). SPIMI implementation for memory-efficient indexing of 1M+ docs.
- **Web App (Milestone 3)**: Next.js frontend with FastAPI backend.

## Directory Structure
```
SEG301-Project/
├── ai_log_long.md           # AI Interaction Logs (Team members)
├── ai_log_chien.md
├── ai_log_hau.md
├── data_sample/             # Sample data (JSONL)
├── src/
│   ├── crawler/             # Multi-source scrapers
│   ├── indexer/             # SPIMI implementation
│   ├── ranking/             # BM25 & Vector Search logic
│   └── ui/                  # Web Interface
├── reports/                 # Milestone documentation
```

## Setup & Run
1. **Install Dependencies**:
   ```bash
   npm install
   pip install -r requirements.txt
   ```

2. **Run Crawler**:
   ```bash
   # Multi-source orchestration
   npx tsx src\scripts\crawl_exhaustive.ts
   ```



## Dataset
The full dataset (1M+ documents) is stored in the production CockroachDB cluster or can be viewed in the [Google Drive](https://drive.google.com/drive/folders/1RmbsW8ud0SJlAS5bPZMCjE29aVc6AOsC?usp=sharing).