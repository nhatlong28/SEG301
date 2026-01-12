# AI INTERACTION LOG

## Date: 2026-01-12

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
- `test_console.py`: CLI for building index (`--index`) and searching (`--search`).

**User:** Created `requirements.txt` and installed dependencies after a `ModuleNotFoundError`.

**AI:**
- Created `requirements.txt` with: `python-dotenv`, `psycopg2-binary`, `numpy`.
- Executed `pip install -r requirements.txt` to resolve missing dependencies.

**Task:** Local Data Testing & DataSource Migration

**User:** Switch data source from database to `data/sample.json` (10 items). Refactor parser to read from JSON. No thinking comments in code.

**AI:** 
- Created `data/sample.json` with 10 sample product records.
- Refactored `src/crawler/parser.py` to yield data from the JSON file instead of Supabase.
- Provided a clear implementation without internal thinking comments in code.

**User:** Refactor `test_console.py` and `parser.py` to use a dynamic `data_path` variable for the JSON source.

**AI:**
- Modified `test_console.py`.
- Updated `src/crawler/parser.py` to accept `data_path` as a parameter for more flexible localized testing.

**User:** Refactor `test_console.py` to remove database dependencies and use `sample.json` for retrieving product details in the search loop.

**AI:**
- Removed `psycopg2` and `python-dotenv` from `test_console.py`.
- Updated `search_loop` to load `data/sample.json` into a dictionary for fast ID-to-name lookup.
- Cleaned up database connection/cleanup logic.


