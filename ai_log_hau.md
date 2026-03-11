# AI INTERACTION LOG
**Project**: SEG301 E-Commerce Price Spider (Vertical Search Engine)

---

## Date: 2026-01-10

### Task: Understanding Project Requirements
**User:** Read and understand the SEG301 project specification. The goal is to build a Vertical Search Engine from scratch with at least 1,000,000 documents.

**AI:**
- Reviewed the complete project specification for SEG301.
- Analyzed the two-phase approach:
  - Phase 1 (Hardcore): Self-implement Crawler, SPIMI Indexer, BM25 Ranker.
  - Phase 2 (Modern): Integrate AI with Vector Search and LLM.
- Identified milestones: M1 (Data Acquisition), M2 (Core Engine), M3 (Final Product).
- Noted strict policies regarding GitHub history and AI logging.

### Task: Understanding Topic Selection (Topic 2)
**User:** Selected "Topic 2: E-Commerce Price Spider". Needed clarification on requirements and challenges specific to this topic.

**AI:**
- Analyzed the domain: Price Comparison across Shopee, Tiki, Lazada, CellphoneS, Dienmayxanh.
- Defined "Document": Each product detail page equals one document.
- Identified Key Challenge: **Entity Resolution** (Recognizing "iPhone 13" on Shopee and "Apple iPhone 13" on Tiki as the same product for price comparison).
- Set Target: 1,000,000 product pages.

---

## Date: 2026-01-11

### Task: Understanding Project Context & Structure
**User:** Required an analysis of the existing project structure and component connectivity.

**AI:**
- Analyzed the Monorepo structure:
  - `src/crawler/`: Async/multi-thread data collection.
  - `src/indexer/`: SPIMI algorithm implementation.
  - `src/ranking/`: BM25 and Vector Search.
  - `src/ui/`: FastAPI Backend + React/Vite Frontend.
- Verified the hybrid search approach (BM25 + Vector).
- Confirmed compliance with GitHub structure and `.gitignore` rules.

---

## Date: 2026-01-12

### Task: Building Web Framework (MVP)
**User:** Requested a modern web UI for the search engine, aiming for a professional look similar to Google Shopping or Trivago.

**AI:**
- Initialized React + TypeScript + Vite frontend.
- Created FastAPI backend with search endpoints.
- Implemented core pages: Home, Results, Dashboard.
- Configured API client and environment variables.

### Task: Bug Fixing & Basic UI Stabilization
**User:** Reported issues with "unknown" platform names and various UI bugs.

**AI:**
- Fixed platform name display logic across the application.
- Implemented URL-based platform detection.
- Corrected API response mapping in `src/api.ts`.
- Resolved TypeScript errors and import issues.

---

## Date: 2026-01-13

### Task: Recreating Frontend with Modern Design (Glassmorphism)
**User:** Requested a complete UI overhaul with modern design elements: animations, glassmorphism, gradients, and hover effects.

**AI:**
- **Recreated all frontend components:**
  - `index.css`: Added glassmorphism, gradients, and keyframe animations.
  - `SearchBar.tsx`: Added glow effects and method selectors.
  - `ProductCard.tsx`: Enhanced hover effects and "Best Price" highlighting.
  - `FilterSidebar.tsx` & `ResultsPage.tsx`: Improved layout and interactions.
- **Implemented Design System:**
  - Glassmorphism (Backdrop blur).
  - Platform-specific color badges.
  - Responsive Grid/List views.

---

## Date: 2026-01-16

### Task: Monorepo Structure Verification & Configuration Validation
**User:** Provided the SEG301 project context (Core/Backend/Frontend). Requested the AI to memorize the directory structure and validate system configuration files.

**AI:**
- Verified the standard directory structure.
- Confirmed strict separation of concerns (Python for Core/Backend, TypeScript for Frontend).
- Validated `tsconfig.json` and `vite.config.ts`.
- Action: Executed `npm install` to verify the dev environment.

### Task: Platform Data Handling & Normalization
**User:** Identified inconsistent or null `platform` fields in the database causing "Unknown" UI status. Requested a fallback mechanism via URL parsing.

**AI:**
- **Backend (`main.py`):** Implemented `detect_platform_from_url` (Regex) and `normalize_product_data`.
- **Frontend (`api.ts`):** Added client-side fallback detection.
- **UI (`DashboardPage.tsx`):** Updated color palettes and display name mapping (e.g., "dienmayxanh" → "Điện Máy Xanh").

### Task: Supabase Query Limit Workaround (Large Dataset Aggregation)
**User:** The Dashboard only displayed 1,000 records due to Supabase API limits. Requested a solution to visualize the full dataset (200k+ items).

**AI:**
- Identified client-side query limitations.
- **Solution:** Transitioned to Server-Side RPC (Stored Procedure).
- **Execution:**
  1. Created `supabase_rpc.sql` for direct DB aggregation.
  2. Refactored `get_stats()` in `main.py` to invoke the RPC.
  3. Guided execution of the SQL script in Supabase Editor.

### Task: Search Page UI/UX Refinement (Pixel Perfect)
**User:** Requested detailed UI refinements for the Search Page (spacing, alignment, and styling).

**AI:**
- **Modified `SearchPage.tsx`:**
  - Added `pt-4` to adjust filter sidebar spacing.
  - Optimized Search Bar padding (`py-2`) and removed excess width (`px-4`) to align with the Product Grid.
  - Added `rounded-xl` for consistent styling.

---

## Date: 2026-03-04

### Task: Database Connectivity Resolution (CockroachDB)
**User:** Encountered a fatal SSL certificate verification error during database initialization, blocking the indexing pipeline.

**AI:**
- Identified the root cause as a missing local root certificate for the cloud database.
- **Resolution:** Modified the `DATABASE_URL` in `.env` to use `sslmode=require`. This maintains encryption while leveraging system-level certificates, bypassing the local file requirement.
- Verified the fix with a standalone `test_db.py` script, confirming successful connection and query execution.

### Task: Vietnamese Search Relevance Optimization
**User:** Reported a critical recall issue where searching for "điện thoại xiaomi" returned only 3 results despite thousands of relevant records existing in the database.

**AI:**
- Diagnosed the issue as inconsistent tokenization of Vietnamese compound words by `pyvi.ViTokenizer`.
- **Resolution:** Engineered a new robust tokenization utility in `src/utils/tokenizer.py` that decomposes compound tokens into constituent parts (e.g., `điện_thoại_xiaomi` → `['điện_thoại', 'xiaomi', ...]`).
- Integrated the new tokenizer into both `console_app.py` and `src/router/api.py`.
- **Result:** Successfully increased search results from 3 to over 45,000 candidates for the same query.

### Task: Search Algorithm Engineering (BM25 & IDF Analysis)
**User:** Requested clarification and validation of the IDF (Inverse Document Frequency) calculations used in the hybrid search engine's BM25 implementation.

**AI:**
- Provided a technical deep-dive into the IDF scoring logic within the Okapi BM25 variation used by the project.
- Verified that the ranking scores correctly reflect term rarity and document importance across the multi-million record dataset.

---

## Date: 2026-03-05

### Task: Backend Architecture Consolidation
**User:** Requested the elimination of the redundant `src/ui/backend` directory and consolidation of logic into the core FastAPI services.

**AI:**
- **Refactoring:** Migrated platform detection and data normalization logic into `src/router/api.py`.
- **Cleanup:** Deleted the `src/ui/backend` directory completely to establish `app.py` and `api.py` as the unified source of truth.
- Configured recursive search fallbacks and health check endpoints to ensure API reliability.

---

## Date: 2026-03-10

### Task: Product Details UI/UX & Backend Stability
**User:** Requested high-end UI refinements for the Product Details page and a fix for potential database connection failures.

**AI:**
- **UI Refinement:** Transitioned to professional typography and label copy (e.g., "Thêm vào túi" instead of informal variants). Scaled down layouts in Description and Specification sections for a more premium, compact aesthetic.
- **Backend Fix:** Restored SSL fallback logic in `psycopg2` connection handling within `app.py` to ensure high availability across different environments.
- Verified consistency of platform branding and responsive layout.

---

## Date: 2026-03-11

### Task: Architectural Analysis — Backend Removal Feasibility
**User:** Proposed removing the entire Python backend layer and having the React frontend call the three search APIs (BM25, Vector, Hybrid) directly from the client side.

**AI:**
- Conducted a full architectural review of the system: `app.py`, `src/router/api.py`, and `src/ui/frontend/`.
- **Conclusion: NOT FEASIBLE** — identified three critical blockers:
  1. **Security Risk:** Eliminating the backend would force the frontend to connect directly to the database (CockroachDB/Supabase), exposing `DATABASE_URL` and credentials in client-side code.
  2. **Computational Complexity:** Core search algorithms (BM25 Ranking, Vector Search via Qdrant/ChromaDB) rely on Python-native libraries (`pyvi`, `chromadb`) and binary index files (`final_index.bin`) that cannot execute in a browser environment.
  3. **Performance Constraint:** Binary index files (`final_index.bin`, `lexicon.dat`) are tens of megabytes in size — downloading them to the browser for client-side search would be prohibitively slow.
- Documented the full analysis and alternative approaches in `implementation_plan.md`.

### Task: Backend Simplification — Consolidation into `app.py` + `api.py`
**User:** Asked whether the backend could be simplified by using only the existing `app.py` and `src/router/api.py` as the sole backend, replacing any additional backend layers.

**AI:**
- Confirmed: **YES** — and in fact, the current system **already operates under this exact architecture**.
- The entire backend consists of just two files:
  - `app.py`: Application entry point — initializes FastAPI, loads BM25 indices, Vector Search engine, and the database connection pool during startup.
  - `src/router/api.py`: Houses all API route handlers (`/api/search`, `/api/products`, `/api/stats`, etc.).
- No additional backend infrastructure is required — these two files constitute the complete backend service.
- The frontend (`src/ui/frontend/`) communicates with `http://127.0.0.1:8000/api/*`, which is the FastAPI server launched by `app.py`.

### Task: Platform Badge Misidentification in Price Comparison View
**User:** Why do all product listings in the price comparison view display the same platform logo (Chợ Tốt) even though they supposedly originate from different e-commerce platforms? How can users differentiate pricing across platforms when the branding is identical?

**AI:**
- Identified a data mapping bug in `PlatformBadge.tsx`: the `shopee` key was incorrectly assigned the Chợ Tốt logo URL and display name.
- Fixed `PLATFORM_LOGOS` to point to the correct Shopee logo.
- Fixed `PLATFORM_NAMES` to display "Shopee" instead of "Chợ Tốt".

### Task: Understanding Product Grouping Logic for Same-Platform Listings
**User:** In the comparison view, multiple listings share the same platform badge — does this mean the system is comparing prices across different sellers within the same marketplace, rather than across different platforms?

**AI:**
- Confirmed: the grouping algorithm in `api.ts` groups products by the first 50 characters of `name_normalized`. Multiple sellers on the same platform (e.g., Shopee) listing similar products will be grouped together.
- Updated UI labels in `ProductCard.tsx`: changed "X sàn" to "X nơi bán", and comparison header to "So sánh X tùy chọn giá từ Y sàn" for clarity.
- User reverted these label changes manually (preferred original wording).

### Task: Confirming Cross-Seller Price Comparison Feature
**User:** Does the web application include a built-in price comparison feature that aggregates and compares product prices from multiple sellers within the same e-commerce platform?

**AI:**
- Confirmed: the system's `groupProducts()` function in `api.ts` automatically groups similar products (by normalized name) and ranks offers by price, highlighting the best deal.
- This enables cross-seller price comparison even within a single platform (e.g., multiple Shopee shops selling the same item at different prices).

### Task: UI Regression — CSS Flexbox Layout Bug on View Mode Toggle
**User:** When toggling the product gallery from Grid View back to Comparison (List) View, the first one or two product images intermittently overflow their containers, appearing disproportionately enlarged compared to the rest of the list. What is causing this layout inconsistency during state transitions?

**AI:**
- Identified two overlapping root causes for this UI regression:
  1. **React Reconciliation Issue:** React was overzealously preserving DOM nodes across the view toggle (`grid` to `space-y-3` in `SearchPage.tsx`), preventing clean structural unmounting.
  2. **Flexbox Image Caching Bug:** In `GroupedProductCard`, the flex container defaulted to `min-width: auto`. When rendering cached, high-resolution images, the browser's flexbox engine expanded the container to the image's intrinsic width before applying the `w-48` tailwind constraint.
- **Resolution:**
  - Added strict React `key` props (`key="grouped-view"` and `key="grid-view"`) in `SearchPage.tsx` to force independent component lifecycles (clean unmount/remount) across view modes.
  - Implemented hard layout constraints in `GroupedProductCard` using explicit min/max width classes (`md:min-w-[11rem] md:max-w-[11rem] lg:min-w-[12rem] lg:max-w-[12rem]`), preventing intrinsic image dimensions from overriding the flex layout system.

### Task: Systems Architecture — Purpose of Qdrant Snapshots & Project Context Correction
**User:** What is the technical purpose of taking a snapshot in Qdrant immediately after the indexing process is complete? *(Note: The AI initially answered this under the incorrect persona of "Project Loom", to which the user clarified: "This is a crawler and search data project, not Project Loom")*

**AI:**
- Acknowledged the correction: The current project is the **SEG301 E-Commerce Price Spider**, not Project Loom.
- Explained the four highly critical technical reasons for taking Qdrant Snapshots post-indexing:
  1. **Disaster Recovery (Backup):** Generating embeddings for millions of products using models like `intfloat/multilingual-e5-base` requires immense CPU/GPU computation time. A snapshot serves as a state backup. If the vector database container crashes or the volume is deleted, restoring a snapshot takes seconds, whereas re-indexing from scratch (`index_vectors.py`) takes hours.
  2. **Environment Migration:** A snapshot packages the entire vector index into a portable file, enabling seamless synchronization between Local environments and Cloud servers (Staging/Production) via simple push/pull operations.
  3. **Team Collaboration:** Developers can share the snapshot file to instantly replicate a fully-populated Vector DB instance locally, bypassing the expensive data indexing step entirely.
  4. **Versioning & Rollback:** If a new embedding strategy or chunking update degrades search accuracy, the snapshot serves as a secure checkpoint, allowing instantaneous rollback to the previous stable state.