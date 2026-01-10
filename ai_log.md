# AI INTERACTION LOG

## Date: 2026-01-07
**Task:** Crawler Infrastructure & Data Deduplication

**User:** Setup Supabase client and fix connection errors for the crawler. Implement deduplication logic for gathered product data.

**AI:** Fixed Supabase initialization type errors. Implemented `MLEntityMatcher` (`src/lib/entity-resolution/mlMatcher.ts`) using weighted features like name similarity, price proximity, and brand matching. Optimized `BrowserPool` to use `/tmp` for logs to fix Vercel deployment issues. Added a sensitivity slider for the deduplication UI.

## Date: 2026-01-08
**Task:** Semantic Search & Embedding Integration

**User:** Check BGE-M3 usage for semantic search. Improve product embedding generation.

**AI:** Verified and configured `src/lib/search/embeddingService.ts` to utilize the BGE-M3 model for multilingual product embeddings, enhancing the semantic search capabilities of the engine.

## Date: 2026-01-10
**Task:** Milestone 1 Alignment (SEG301 Project)

**User:** SEG301 - SEARCH ENGINES & INFORMATION RETRIEVAL ... [Specifications provided] ... nhóm t làm cào sàn tmddt m xem nhóm t giờ cần gì nữa. Đưa toàn bộ vô ai log luôn của riêng project Caodulieu thôi.

**AI:** Analyzed SEG301 requirements. Created the mandatory `ai_log.md` and `task.md`. Identified the need for:
1. Reorganizing folder structure to `src/crawler`, `src/indexer`, etc.
2. Reaching 1,000,000 docs target.
3. Implementing Vietnamese Word Segmentation (Tách từ).
4. Generating Data Insights report for Milestone 1.
Ensured the AI Log is strictly filtered for the `Caodulieu` project.

**Task:** Search Engine Core Implementation (SPIMI & BM25)

**User:** Request to code the core Search Engine modules:
1. Module Indexer (SPIMI) - 1M records, RAM constraint, K-Way Merge.
2. Module Ranking (BM25) - Vectorized NumPy implementation.
3. Retrieval Mechanism (Seek & Offset) - efficient binary reading.
4. System Integration - connection pipeline.

**AI:** Implemented the full pipeline:
- `src/crawler/parser.py`: Generator for Supabase data.
- `src/indexer/spimi.py`: SPIMI algorithm with 100MB block limit and metadata saving.
- `src/indexer/merging.py`: K-Way Merge logic for binary blocks.
- `src/indexer/reader.py`: Optimized `IndexReader` using `seek()` and `read()`.
- `src/ranking/bm25.py`: High-performance vectorized BM25 using NumPy.
- `main.py`: CLI for building index (`--index`) and searching (`--search`).

**User:** Created `requirements.txt` and installed dependencies after a `ModuleNotFoundError`.

**AI:**
- Created `requirements.txt` with: `python-dotenv`, `psycopg2-binary`, `numpy`.
- Executed `pip install -r requirements.txt` to resolve missing dependencies.
