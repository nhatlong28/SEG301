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