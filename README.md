# SEG301 - Vertical Search Engine Project

## Group Information
- **Course**: SEG301 - Search Engines & Information Retrieval
- **Project**: Vertical Search Engine for E-commerce (Tiki, Lazada, Shopee, etc.)
- **Goal**: 1,000,000 Documents

## Architecture
This project uses a hybrid architecture for maximum performance:
- **Crawler (Milestone 1)**: TypeScript/Node.js (Puppeteer & Axios) for high-performance async crawling. Wrapped in Python for specification compliance.
- **Processing (Milestone 1)**: Python (`src/crawler/parser.py`) for Cleaning, Word Segmentation (PyVi), and Deduplication.
- **Indexing & Ranking (Milestone 2)**: Python (`src/indexer/spimi.py`, `src/ranking/bm25.py`).
- **Web App (Milestone 3)**: Python (Streamlit/Flask) or Next.js.

## Directory Structure
```
SEG301-Project/
├── ai_log.md                # AI Interaction Log (IMPORTANT)
├── data/                    # Crawled data (JSONL)
├── src/
│   ├── crawler/
│   │   ├── spider.py        # Entry point (Wraps TS crawler)
│   │   ├── parser.py        # Data cleaning & Segmentation
│   │   └── ... (TS implementation files)
│   ├── indexer/             # SPIMI implementation
│   ├── ranking/             # BM25 implementation
│   └── ui/                  # Web Interface
```

## Setup & Run
1. **Install Dependencies**:
   ```bash
   npm install
   pip install -r requirements.txt
   ```

2. **Run Crawler (Milestone 1)**:
   ```bash
   python src/crawler/spider.py
   # OR directly:
   # npx tsx src/scripts/crawl_to_json.ts
   ```

3. **Clean Data**:
   ```bash
   python src/crawler/parser.py
   ```
   Output: `data/cleaned_products.jsonl`

## Data Sample
Sample data is available in `data_sample/`. Full dataset is stored locally/cloud.

