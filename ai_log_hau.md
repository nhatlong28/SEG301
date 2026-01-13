# AI INTERACTION LOG
**Project**: SEG301 E-Commerce Price Spider

---
## Task: Understanding Project Requirements
**Date**: 2026-01-10

**User**: Read and understand the SEG301 - Search Engines & Information Retrieval project specification. The project requires building a Vertical Search Engine from scratch with at least 1,000,000 documents.

**AI**:
- Reviewed the complete project specification for SEG301
- Understood the two-phase approach:
  - Phase 1 (Hardcore): Self-implement Crawler, SPIMI Indexer, BM25 Ranker
  - Phase 2 (Modern): Integrate AI with Vector Search and LLM
- Identified three main milestones:
  - M1 (Week 4, 20%): Data Acquisition - Crawl & Clean 1M documents
  - M2 (Week 7, 20%): Core Search Engine - SPIMI + BM25 + Console App
  - M3 (Week 10, 20%): Final Product - Vector Search + Web UI + Hybrid Search
- Noted zero tolerance policies: GitHub commit history and AI logging requirements

---

## Task: Understanding Topic Selection

**User**: Our team selected Topic 2: E-Commerce Price Spider. Need to understand the specific requirements and challenges.

**AI**:
- Analyzed Topic 2: E-Commerce Price Spider (Price Comparison)
- Data Sources: Shopee, Tiki, Lazada, CellphoneS, Dienmayxanh
- Document Definition: Each product detail page counts as one document
- Key Technical Challenge: Entity Resolution
  - System must recognize that "iPhone 13 128GB" on Shopee and "Apple iPhone 13 128GB VN/A" on Tiki are the same product
  - This enables accurate cross-platform price comparison
- Target: 1,000,000 product pages across multiple e-commerce platforms

---

## Task: Understanding Project Context
**Date**: 2026-01-11

**User**: Need to understand the existing project structure and how components connect together.

**AI**:
- Analyzed the repository structure following SEG301 specifications:
  - `src/crawler/` - Data collection scripts with async/multi-thread support
  - `src/indexer/` - SPIMI algorithm implementation
  - `src/ranking/` - BM25 and Vector Search implementations
  - `src/ui/` - Web interface (Backend FastAPI + Frontend React/Vite)
- Reviewed existing data pipeline from crawling to search
- Understood the hybrid search approach combining BM25 (keyword) and Vector Search (semantic)
- Verified project follows the required GitHub structure with proper .gitignore and data_sample

---

## Task: Building Web Framework
**Date**: 2026-01-12

**User**: Create a modern web UI for the E-Commerce Price Spider search engine. Need professional design similar to Google Shopping and Trivago.

**AI**:
- Set up React + TypeScript + Vite frontend framework
- Created FastAPI backend with search API endpoints
- Implemented core pages:
  - HomePage with search interface
  - ResultsPage with product grid/grouped views
  - DashboardPage with statistics
- Configured API client for frontend-backend communication
- Set up environment configuration for development

---

## Task: Fixing Bugs and Basic UI Design

**User**: Fix various issues with the web application including platform display showing "unknown" and other UI bugs.

**AI**:
- Fixed platform name display issue across Search and Dashboard interfaces
- Implemented logic to derive platform names from product URLs
- Fixed API response mapping in `src/api.ts`
- Corrected data aggregation logic in `DashboardPage.tsx`
- Resolved TypeScript errors and import issues

---

## Task: Recreating Frontend with Modern Design
**Date**: 2026-01-13

**User**: Recreate all frontend components with modern professional design including animations, glassmorphism, gradients, and hover effects.

**AI**:
- Recreated all frontend files with premium modern design:
  - `index.css` - Glassmorphism styles, gradient utilities, keyframe animations (shimmer, float, fade)
  - `SearchBar.tsx` - Gradient glow effect, search method selector with icons
  - `ProductCard.tsx` - Hover effects, price comparison display, best price highlight
  - `FilterSidebar.tsx` - Platform checkboxes, price range filters, smooth animations
  - `Loading.tsx` - Modern skeleton loading with shimmer effect
  - `HomePage.tsx` - Hero section with animated orbs, stats, features, CTA buttons
  - `ResultsPage.tsx` - Grid/Grouped views, filters, pagination, responsive layout
- Design Features Implemented:
  - Glassmorphism: Cards with backdrop-blur and transparency
  - Gradients: Buttons, badges, backgrounds
  - Animations: fadeIn, slideUp, float, shimmer
  - Platform Badges: Unique colors for each e-commerce platform
  - Best Price Glow: Visual highlight for best prices
- Servers running:
  - Backend: http://localhost:8000
  - Frontend: http://localhost:5173

---
