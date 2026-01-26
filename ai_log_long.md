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
- `console_app.py`: CLI for building index (`--index`) and searching (`--search`).

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

**User:** Refactor `console_app.py` and `parser.py` to use a dynamic `data_path` variable for the JSON source.

**AI:**
- Modified `console_app.py`.
- Updated `src/crawler/parser.py` to accept `data_path` as a parameter for more flexible localized testing.

**User:** Refactor `console_app.py` to remove database dependencies and use `sample.json` for retrieving product details in the search loop.

**AI:**
- Removed `psycopg2` and `python-dotenv` from `console_app.py`.
- Updated `search_loop` to load `data/sample.json` into a dictionary for fast ID-to-name lookup.
- Cleaned up database connection/cleanup logic.

**Task:** Efficient Data Aggregation & Streaming

**User:** Refactor `parser.py` to aggregate multiple `products.jsonl` files into `total_products.jsonl` and update the generator to read line-by-line.

**AI:**
- Updated `get_product_generator` to stream data from `total_products.jsonl` to minimize RAM usage.

**User:** Relocate `final_index.bin` and `lexicon.dat` into the `src/indexer` directory.

**AI:**
- Updated `src/indexer/merging.py` and `src/indexer/reader.py` to use `src/indexer/` as the default path for index files.
- Refactored `console_app.py` to match the new file locations in `src/indexer/`.
- Updated `.gitignore` to ignore the relocated binary files within `src/indexer/`.

**User:** Fix the issue where `console_app.py` and `parser.py` encountered unusual line terminators (LS/PS) or JSONL formatting errors during search.

**AI:**
- Updated `aggregate_shop_data` in `src/crawler/parser.py` to strip unusual line terminators (`\u2028`, `\u2029`) and ensure standard `\n` line endings.
- Identified that `console_app.py` needs refactoring to read `total_products.jsonl` line-by-line for product detail lookup instead of using `json.load()`.

## Date: 2026-01-20

**Task:** Project Organization & Data Integrity

**User:** Request to move the `output_blocks` folder into `src/indexer`.

**AI:**
- Updated `src/indexer/spimi.py` and `src/indexer/merging.py` to use `src/indexer/output_blocks` as the default directory for intermediate blocks.
- Refactored `console_app.py` to update all references to the `output_blocks` directory and metadata path.
- Renamed the main entry point from `test_console.py` to `console_app.py` for clarity.

**User:** Reported unusual line terminators (LS/PS) in `total_products.jsonl`.

**AI:**
- Improved the `aggregate_shop_data` function in `src/crawler/parser.py` to robustly remove `\u2028` and `\u2029` characters from the entire line.
- Created a utility script `src/scripts/clean_jsonl.py` to repair the existing `total_products.jsonl` file, fixing 2 problematic lines.
- Verified the fix by running the indexing pipeline successfully.

## Date: 2026-01-26

**Task:** Refactor Data Logic to Simulate DB Processing

**User:** 
- Refactor `src/crawler/parser.py`:
    - Remove `aggregate_shop_data`.
    - Update `get_product_generator` to read from DB.
    - Use `pyvi` content for tokenization/normalization.
    - Map `external_id` -> `doc_id` and `name_normalized` -> `name_normalized`.
- Update `console_app.py` to match the new logic.

**AI:**
- Refactored `src/crawler/parser.py`:
    - Processed `name_normalized` from the source using `ViTokenizer` from `pyvi`.
    - Removed aggregation logic.
- Updated `console_app.py` to remove calls to `aggregate_shop_data`.


