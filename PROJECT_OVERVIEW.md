# 📋 TỔNG QUAN DỰ ÁN SEG301 — VERTICAL SEARCH ENGINE
**Course:** SEG301 – Search Engines & Information Retrieval  
**Dự án:** Xây dựng Máy tìm kiếm chuyên biệt (Vertical Search Engine) cho **E-commerce Việt Nam**  
**Nhóm:** 3 sinh viên  
**Thời lượng:** 10 tuần (Project-Based Learning)  

---

## 📑 MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)  
2. [Kiến trúc tổng thể](#2-kiến-trúc-tổng-thể)  
3. [Cấu trúc thư mục dự án](#3-cấu-trúc-thư-mục-dự-án)  
4. [MILESTONE 1 — Data Acquisition (Thu thập dữ liệu)](#4-milestone-1--data-acquisition)  
5. [MILESTONE 2 — Core Search Engine (Lõi tìm kiếm)](#5-milestone-2--core-search-engine)  
6. [MILESTONE 3 — Final Product (Sản phẩm hoàn chỉnh)](#6-milestone-3--final-product)  
7. [Hướng dẫn chạy dự án](#7-hướng-dẫn-chạy-dự-án)  
8. [Đánh giá đối chiếu với Đặc tả Đồ án](#8-đánh-giá-đối-chiếu-với-đặc-tả-đồ-án)  

---

## 1. TỔNG QUAN HỆ THỐNG

### 🎯 Mục tiêu
Xây dựng một **Vertical Search Engine** chuyên biệt cho **sản phẩm thương mại điện tử Việt Nam** từ con số 0, bao gồm:

1. **Giai đoạn Hardcore:** Tự lập trình Crawler, Indexer (SPIMI), Ranker (BM25) — không dùng thư viện tìm kiếm có sẵn.
2. **Giai đoạn Modern:** Tích hợp AI với Vector Search (Qdrant + Sentence-Transformers) và Hybrid Search.
3. **Sản phẩm Web:** Giao diện web đẹp, đầy đủ tính năng tìm kiếm, lọc, phân trang, chi tiết sản phẩm.

### 📊 Quy mô dữ liệu

| Nguồn dữ liệu | Số lượng documents | Trạng thái |
|:---|---:|:---|
| **Tiki** | 389,306 | ✅ Normalized |
| **Chotot** | 387,818 | ✅ Normalized |
| **Lazada** | 177,256 | ✅ Normalized |
| **CellphoneS** | 42,249 | ✅ Normalized |
| **Điện Máy Xanh** | 6,145 | ✅ Normalized |
| **Thegioididong** | 3,892 | ✅ Normalized |
| **TỔNG CỘNG** | **1,006,666** | **🎯 Vượt mục tiêu 1 triệu** |

### 🛠️ Tech Stack

| Layer | Công nghệ |
|:---|:---|
| **Crawler** | TypeScript, Node.js, Puppeteer, Axios, p-queue |
| **NLP / Preprocessing** | Python, PyVi (ViTokenizer) |
| **Indexing (SPIMI)** | Python (pickle, heapq, defaultdict) |
| **Ranking (BM25)** | Python, NumPy (vectorized) |
| **Vector Search** | Qdrant (Docker), intfloat/multilingual-e5-base (SentenceTransformers) |
| **Database** | CockroachDB (PostgreSQL-compatible, distributed) |
| **Backend API** | Python, FastAPI, Uvicorn |
| **Frontend** | React (Vite + TypeScript), TailwindCSS |
| **Containerization** | Docker Compose (Qdrant) |

---

## 2. KIẾN TRÚC TỔNG THỂ

### 🏗️ Sơ đồ kiến trúc End-to-End

```mermaid
graph TD
    subgraph "MILESTONE 1: DATA ACQUISITION"
        A1["🌐 Tiki API Spoofing"] --> D
        A2["🌐 Lazada Hybrid Puppeteer"] --> D
        A3["🌐 CellphoneS GraphQL"] --> D
        A4["🌐 DMX/TGDD DOM Parser"] --> D
        A5["🌐 Chotot Gateway API"] --> D
        D["Orchestrator + BrowserPool"]
        D --> E["BaseCrawler ETL<br/>(Validation, Normalization, Dedup)"]
        E --> F["CockroachDB<br/>(1,006,666 documents)"]
        E --> G["JSONL Local Files"]
    end

    subgraph "MILESTONE 2: CORE SEARCH ENGINE"
        F --> P["parser.py<br/>(Server-Side Cursor Generator)"]
        P --> Q["spimi.py<br/>(SPIMI Indexer — 50MB blocks)"]
        Q --> R["merging.py<br/>(K-Way Merge — heapq)"]
        R --> S["final_index.bin (254MB)<br/>+ lexicon.dat (7MB)<br/>+ metadata.pkl"]
        S --> T["console_app.py<br/>(CLI: --index / --search)"]
    end

    subgraph "MILESTONE 3: FINAL PRODUCT"
        F --> V["index_vectors.py<br/>(Batch embed + Qdrant upsert)"]
        V --> W["Qdrant Vector DB<br/>(Docker, port 6333)"]
        
        S --> X["app.py — FastAPI Server"]
        W --> X
        F --> X
        
        X --> Y["api.py — RESTful Router<br>/api/search (BM25/Vector/Hybrid)<br>/api/products, /api/stats"]
        Y --> Z["React Frontend (Vite)<br/>Search, Filter, Details, Dashboard"]
    end
```

### 🔄 Luồng xử lý chi tiết (Data Flow)

```
[User nhập query trên Web UI]
        │
        ▼
[React Frontend] ──── GET /api/search?query=...&method=hybrid ────►
        │
        ▼
[FastAPI Backend — api.py]
        │
        ├──► [BM25 Pipeline]
        │       1. ViTokenizer.tokenize(query) → tách từ tiếng Việt
        │       2. IndexReader.get_postings(token) → seek() vào final_index.bin
        │       3. BM25Ranker.rank() → tính TF/IDF/Length Norm (NumPy)
        │       4. Trả về top-K doc_ids + BM25 scores
        │
        ├──► [Vector Pipeline]
        │       1. SentenceTransformer.encode("query: " + query) → embedding 768-dim
        │       2. Qdrant.query_points() → cosine similarity search
        │       3. Trả về top-K doc_ids + vector scores
        │
        └──► [Hybrid Merge]
                1. Min-Max normalize cả 2 bộ scores về [0,1]
                2. Final = α × VectorScore + (1-α) × BM25Score
                3. Sort descending → top-K results
                4. Enrich từ CockroachDB (name, price, image, platform...)
                5. Trả JSON về Frontend
```

---

## 3. CẤU TRÚC THƯ MỤC DỰ ÁN

```
SEG301-Project/
│
├── 📄 app.py                          # Entry point FastAPI — init BM25 + Vector + DB Pool
├── 📄 console_app.py                  # CLI: --index (build SPIMI) / --search (interactive BM25)
├── 📄 docker-compose.yml              # Qdrant Vector DB container
├── 📄 requirements.txt                # Python dependencies
├── 📄 package.json                    # Node.js dependencies (crawlers)
├── 📄 .env                            # DATABASE_URL, API keys
│
├── 📂 src/
│   ├── 📂 crawler/                    # ═══════ MILESTONE 1 ═══════
│   │   ├── 📄 base.ts                 # BaseCrawler abstract class (546 lines)
│   │   │                               # — Axios instance, p-queue concurrency
│   │   │                               # — fetchWithRetry(), rotateUserAgent()
│   │   │                               # — saveProducts() bulk upsert to CockroachDB
│   │   │                               # — normalizeName(), generateHash() for dedup
│   │   ├── 📄 orchestrator.ts         # CrawlerOrchestrator — manages all crawlers
│   │   │                               # — startCrawler(), stopCrawler()
│   │   │                               # — runMassCrawl() — run all 5 platforms parallel
│   │   ├── 📄 browserPool.ts          # Puppeteer browser pool (5-10 instances)
│   │   │                               # — Stealth mode, memory recycling
│   │   ├── 📄 tiki.ts                 # Tiki: API v2 spoofing
│   │   ├── 📄 lazada.ts               # Lazada: Hybrid mobile emulation + cookie decode
│   │   ├── 📄 cellphones.ts           # CellphoneS: GraphQL tunneling via Puppeteer
│   │   ├── 📄 dienmayxanh.ts          # DMX + TGDD: DOM parser + scroll automation
│   │   ├── 📄 thegioididong.ts        # TGDD: Server-side rendered DOM parsing
│   │   ├── 📄 parser.py               # Python data generator — server-side cursor
│   │   │                               # — yield (doc_id, ViTokenizer.tokenize(name)) 
│   │   └── ... (support files)
│   │
│   ├── 📂 indexer/                    # ═══════ MILESTONE 2 ═══════
│   │   ├── 📄 spimi.py                # SPIMI Indexer (84 lines)
│   │   │                               # — SPIMIIndexer class
│   │   │                               # — run_indexing(): consume generator, build dict
│   │   │                               # — write_block(): sort terms → binary .bin
│   │   │                               # — save_metadata(): N, avgdl, doc_lengths → .pkl
│   │   ├── 📄 merging.py              # K-Way Merge (85 lines)
│   │   │                               # — merge_blocks(): heapq min-heap merge
│   │   │                               # — Output: final_index.bin + lexicon.dat
│   │   ├── 📄 reader.py               # IndexReader (54 lines)
│   │   │                               # — load_lexicon(): {term: {offset, length}}
│   │   │                               # — get_postings(term): seek() + read() → {doc_id: tf}
│   │   ├── 📁 output_blocks/          # Generated SPIMI blocks + metadata.pkl
│   │   ├── 📦 final_index.bin         # ← 254MB merged inverted index
│   │   └── 📦 lexicon.dat             # ← 7MB term directory
│   │
│   ├── 📂 ranking/                    # ═══════ MILESTONE 2 + 3 ═══════
│   │   ├── 📄 bm25.py                 # BM25Ranker (81 lines)
│   │   │                               # — rank(): vectorized TF-IDF scoring (NumPy)
│   │   │                               # — Manual IDF: log((N-df+0.5)/(df+0.5)+1)
│   │   │                               # — Parameters: k1=1.5, b=0.75
│   │   └── 📄 vector.py               # VectorRanker (127 lines)
│   │                                    # — Qdrant client (localhost:6333)
│   │                                    # — SentenceTransformer: intfloat/multilingual-e5-base
│   │                                    # — index_documents(): batch embed + upsert
│   │                                    # — search(): cosine similarity search
│   │
│   ├── 📂 router/                     # ═══════ MILESTONE 3 ═══════
│   │   └── 📄 api.py                  # FastAPI Router (643 lines)
│   │                                    # — POST /api/search/bm25
│   │                                    # — POST /api/search/vector
│   │                                    # — POST /api/search/hybrid (α weighted merge)
│   │                                    # — GET  /api/search (unified UI endpoint)
│   │                                    # — GET  /api/products, /api/products/:id
│   │                                    # — GET  /api/stats (dashboard data)
│   │                                    # — Platform detection & normalization
│   │                                    # — DB connection pooling (ThreadedConnectionPool)
│   │
│   ├── 📂 ui/frontend/               # ═══════ MILESTONE 3 ═══════
│   │   └── 📂 src/
│   │       ├── 📄 App.tsx              # React Router setup
│   │       ├── 📄 api.ts              # API client (fetch wrapper)
│   │       ├── 📄 types.ts            # TypeScript interfaces
│   │       ├── 📂 pages/
│   │       │   ├── HomePage.tsx        # Landing page + stats
│   │       │   ├── SearchPage.tsx      # Search form + method selector
│   │       │   ├── ResultsPage.tsx     # Search results grid
│   │       │   ├── ProductDetailsPage  # Full product detail view
│   │       │   └── DashboardPage.tsx   # Data analytics dashboard
│   │       └── 📂 components/
│   │           ├── SearchBar.tsx       # Search input component
│   │           ├── ProductCard.tsx     # Product card (grid/list/comparison)
│   │           ├── FilterSidebar.tsx   # Platform, price filters
│   │           ├── PlatformBadge.tsx   # Platform logo/badge
│   │           ├── Header.tsx          # Navigation header
│   │           └── Loading.tsx         # Loading spinner
│   │
│   └── 📂 scripts/                    # Utility & Migration Scripts
│       ├── 📄 index_vectors.py         # Vector indexing script (Qdrant)
│       ├── 📄 crawl_exhaustive.ts      # Mass crawl orchestrator script
│       ├── 📄 import_all_smart.ts      # Smart JSONL → DB importer
│       └── ... (migration, dedup scripts)
│
├── 📂 reports/                        # Báo cáo Milestone
│   ├── REPORT_MILESTONE_1.md
│   └── REPORT_MILESTONE_2.md
│
├── 📂 data_sample/                    # Sample JSONL data (fallback)
├── 📂 logs/                           # API & crawl logs
│
├── 📄 ai_log_hau.md                   # AI Log — Hậu
├── 📄 ai_log_chien.md                 # AI Log — Chiến
└── 📄 ai_log_long.md                  # AI Log — Long
```

---

## 4. MILESTONE 1 — DATA ACQUISITION

### 🎯 Mục tiêu
Thu thập, làm sạch và lưu trữ **tối thiểu 1.000.000 documents** sản phẩm từ các sàn TMĐT Việt Nam.

### 📁 Các file liên quan chính
| File | Vai trò |
|:---|:---|
| `src/crawler/base.ts` | Abstract class cho tất cả crawler — xử lý retry, rate-limit, dedup, bulk upsert |
| `src/crawler/orchestrator.ts` | Điều phối chạy song song tất cả crawler |
| `src/crawler/browserPool.ts` | Quản lý pool Puppeteer instances (5-10 browser) |
| `src/crawler/tiki.ts` | Crawler Tiki — API v2 spoofing |
| `src/crawler/lazada.ts` | Crawler Lazada — Hybrid mobile emulation |
| `src/crawler/cellphones.ts` | Crawler CellphoneS — GraphQL injection |
| `src/crawler/dienmayxanh.ts` | Crawler Điện Máy Xanh — DOM parsing |
| `src/crawler/thegioididong.ts` | Crawler Thế Giới Di Động — SSR DOM parsing |
| `src/crawler/parser.py` | Python generator — tokenize dữ liệu cho Indexer |
| `src/scripts/crawl_exhaustive.ts` | Script chạy mass crawl |

### 🔧 Chi tiết kỹ thuật

#### 4.1. Cơ chế Crawler đa nguồn (Multi-source)

Mỗi sàn TMĐT có cơ chế crawl riêng biệt, được thiết kế đặc thù cho từng nền tảng:

| Sàn | Kỹ thuật | Chi tiết |
|:---|:---|:---|
| **Tiki** | API Spoofing | Gọi trực tiếp `api/v2/products`, lấy full specs + lịch sử giá |
| **Chotot** | Gateway API | Bypass UI → `gateway.chotot.com` (backend trực tiếp) |
| **CellphoneS** | GraphQL Tunneling | Puppeteer inject GraphQL queries nội bộ |
| **Lazada** | Hybrid Mobile Emulation | Giả lập iPhone/Safari + decode cookie → bypass Sliding Captcha |
| **DMX/TGDD** | DOM Parser + Scroll | Parse HTML server-side rendered + auto-scroll |

#### 4.2. Concurrency & Rate Limiting (`BaseCrawler`)
```typescript
// p-queue configuration — "Turbo Mode"
this.queue = new PQueue({
    concurrency: 10,    // 10 requests song song
    interval: 200,      // Mỗi 200ms
    intervalCap: 10,    // Tối đa 10 requests/interval
});
```

- **UA Rotation:** Tự động đổi User-Agent mỗi 10 requests từ pool 9 trình duyệt.
- **Exponential Backoff:** Retry với delay tăng dần `2^n * 2000ms + random jitter`.
- **Stealth Mode:** `--disable-blink-features=AutomationControlled` để xóa dấu vết Puppeteer.

#### 4.3. Anti-Bot Handling
- **Browser Fingerprint Rotation:** Thay đổi `Sec-Ch-Ua`, `Sec-Ch-Ua-Platform` theo UA.
- **Random Delay:** 500–1500ms giữa mỗi request (human-like behavior).
- **Browser Pool Recycling:** Tự động restart browser sau 10 pages (tránh memory leak).

#### 4.4. Data Cleaning & ETL
Mỗi sản phẩm được xử lý qua pipeline:

```
Raw Data → Schema Validation → Name Normalization (lowercase, remove special chars)
         → Hash-based Dedup (generateHash()) → Bulk Upsert to CockroachDB
         → Python NLP: ViTokenizer.tokenize() → Final Clean Dataset
```

- **Dedup:** Hash code từ tên sản phẩm chuẩn hóa → `ON CONFLICT (source_id, external_id)`.
- **Storage:** JSONL cho raw data (backup) + CockroachDB cho structured data.
- **Vietnamese Tokenization:** `PyVi` tách từ ghép ("tai nghe" → "tai_nghe").

#### 4.5. Resume Mechanism (Zero-Loss)
- Mỗi category/keyword đánh dấu `last_crawled_at` sau khi crawl thành công.
- Khi restart, Orchestrator chỉ crawl lại những target chưa crawl trong 24h.

#### ✅ Kết quả đạt được
- **1,006,666 documents** sạch (đã exceed mục tiêu 1 triệu).
- **Average length:** 10.96 tokens/product name.
- **Total tokens:** 11,033,059.
- Dữ liệu từ **6 nguồn** khác nhau.

---

## 5. MILESTONE 2 — CORE SEARCH ENGINE

### 🎯 Mục tiêu
Tự code tay thuật toán **SPIMI Indexing** và **BM25 Ranking** — không dùng thư viện IR có sẵn.

### 📁 Các file liên quan chính
| File | Vai trò |
|:---|:---|
| `src/crawler/parser.py` | Generator stream data từ DB (server-side cursor) |
| `src/indexer/spimi.py` | SPIMI Indexer — chia block 50MB, ghi binary |
| `src/indexer/merging.py` | K-Way Merge — heapq merge → final_index.bin |
| `src/indexer/reader.py` | IndexReader — lexicon O(1) lookup + seek() |
| `src/ranking/bm25.py` | BM25 Ranker — manual TF/IDF + NumPy vectorization |
| `console_app.py` | CLI app: `--index` (build) / `--search` (query) |

### 🔧 Chi tiết kỹ thuật

#### 5.1. Data Ingestion — Server-Side Streaming (`parser.py`)

Để tránh load toàn bộ 1 triệu docs vào RAM:

```python
# Sử dụng server-side named cursor — stream từng batch 1000 rows
with conn.cursor(name='product_cursor') as cursor:
    cursor.execute("SELECT id, name_normalized FROM raw_products")
    while True:
        rows = cursor.fetchmany(size=1000)  # 1000 rows/batch
        if not rows: break
        for row in rows:
            tokenized = ViTokenizer.tokenize(row[1]).split()
            yield str(row[0]), tokenized   # Generator pattern
```

**Lưu ý:** `yield` trả về `(doc_id, [tokens])` one-by-one → SPIMI Indexer tiêu thụ lazy, **không tốn thêm RAM**.

#### 5.2. SPIMI Indexer (`spimi.py`) — Single-Pass In-Memory Indexing

**Nguyên lý hoạt động:**
1. Đọc từng document từ generator.
2. Tích lũy posting `{term: {doc_id: tf}}` trong dictionary ở RAM.
3. Khi RAM vượt ngưỡng **50MB** → **flush to disk** (write_block).
4. Lặp lại cho đến hết 1 triệu docs.
5. Lưu metadata (N, avgdl, doc_lengths) vào `metadata.pkl`.

```
┌─────────────────────────────────────────────────┐
│                  SPIMI FLOW                      │
│                                                  │
│  doc_generator ──► dictionary{term: {doc: tf}}   │
│       │                    │                     │
│       │           RAM > 50MB?                    │
│       │          /         \                     │
│       │        YES          NO                   │
│       │         │            │                   │
│       │    write_block()    continue              │
│       │    ├── sort terms                        │
│       │    ├── pickle → block_N.bin              │
│       │    └── clear dictionary (free RAM)       │
│       │                                          │
│       └──► End: write final block + metadata.pkl │
└─────────────────────────────────────────────────┘
```

**Tại sao không bị tràn RAM?**
- Block limit 50MB → flush xuống đĩa.
- Generator stream → không pre-load dataset.
- `self.dictionary = defaultdict(dict)` → clear sau mỗi block.

#### 5.3. K-Way Merge (`merging.py`)

Sau khi SPIMI tạo N block files (đã sorted theo term), K-Way Merge gom lại thành **1 file index duy nhất**:

```
┌──────────────────────────────────────────────────┐
│                K-WAY MERGE                        │
│                                                   │
│  block_1.bin  ──┐                                 │
│  block_2.bin  ──┼──► heapq Min-Heap               │
│  block_3.bin  ──┤    (pop term nhỏ nhất)           │
│  ...          ──┘         │                        │
│                     ┌─────┴─────┐                  │
│                     │ same term?│                  │
│                     └─────┬─────┘                  │
│                    YES    │    NO                   │
│                     │     │     │                   │
│              merge postings   write previous term  │
│                                   │                │
│                          ┌────────┴────────┐       │
│                          │ final_index.bin │       │
│                          │ (254MB binary)  │       │
│                          └────────┬────────┘       │
│                          ┌────────┴────────┐       │
│                          │  lexicon.dat    │       │
│                          │ {term: {offset, │       │
│                          │   length}}      │       │
│                          └─────────────────┘       │
└──────────────────────────────────────────────────┘
```

**Output:**
| File | Size | Nội dung |
|:---|---:|:---|
| `final_index.bin` | 254 MB | Binary serialized postings, sorted by term |
| `lexicon.dat` | 7 MB | Dictionary `{term: {offset, length}}` — O(1) lookup |
| `metadata.pkl` | - | N=1,006,666, avgdl=10.96, doc_lengths dict |

#### 5.4. Index Reader (`reader.py`) — Disk-based Retrieval

Khi search, **chỉ lexicon (7MB) được load vào RAM**. Postings được đọc on-demand:

```python
def get_postings(self, term):
    meta = self.lexicon[term]           # O(1) dict lookup
    self.file_handle.seek(meta['offset'])   # Jump to exact position in 254MB file
    data_bytes = self.file_handle.read(meta['length'])   # Read only needed bytes
    return pickle.loads(data_bytes)      # {doc_id: tf}
```

**Hiệu quả:** Không cần load toàn bộ 254MB index → chỉ đọc vài KB per term.

#### 5.5. BM25 Ranker (`bm25.py`) — Manual Implementation

**Công thức BM25 (Okapi):**

```
Score(d, q) = Σ IDF(t) × [tf(t,d) × (k1+1)] / [tf(t,d) + k1 × (1 - b + b × |d|/avgdl)]
```

**Các thành phần tự tính (KHÔNG dùng thư viện rank có sẵn):**

| Thành phần | Cách tính | Vị trí code |
|:---|:---|:---|
| **TF** (Term Frequency) | `dictionary[term][doc_id] += 1` | `spimi.py` line 33 |
| **DF** (Document Frequency) | `len(postings)` — số docs chứa term | `bm25.py` line 52 |
| **IDF** (Inverse DF) | `log((N - df + 0.5) / (df + 0.5) + 1)` | `bm25.py` line 54 |
| **avgdl** | `total_length / doc_count` | `spimi.py` line 51 |
| **Document Length** | `len(tokens)` per doc | `spimi.py` line 25-26 |
| **k1, b** | `k1=1.5, b=0.75` (standard defaults) | `bm25.py` line 4 |

**Tối ưu:** Sử dụng **NumPy vectorization** — thay vì loop Python từng document, tất cả tính toán TF/IDF được vectorize:

```python
numerator = term_tfs * (self.k1 + 1)                    # numpy array operation
denominator = term_tfs + self.k1 * (1 - self.b + self.b * (curr_lens / self.avgdl))
scores[indices] += idf * (numerator / denominator)       # Batch accumulate
```

#### 5.6. Console Application (`console_app.py`)

Hai chế độ hoạt động:

| Mode | Command | Quy trình |
|:---|:---|:---|
| **Build Index** | `python console_app.py --index` | parser → SPIMI → Merge → Output files |
| **Search** | `python console_app.py --search` | Input query → Tokenize → Lookup → BM25 → Display top 10 |

**Kết quả search mẫu:**
```
Enter query: tai nghe bluetooth samsung
Found 10 results in 0.0312s

Top 10 Results:
1. [ID: 7823901] Tai nghe Bluetooth Samsung Galaxy Buds2 - Price: 2490000 (Score: 14.2813)
2. [ID: 4519022] Tai nghe không dây Samsung AKG Y500 - Price: 1890000 (Score: 12.7654)
...
```

#### ✅ Hiệu năng đạt được
| Metric | Giá trị |
|:---|:---|
| **Indexing time** | 342.15 giây (cho 1M+ docs) |
| **Index size** | 254MB (final_index.bin) + 7MB (lexicon.dat) |
| **Average query time** | ~30–80ms (bao gồm DB enrichment) |
| **Lexicon load** | < 1 giây (7MB, load 1 lần khi startup) |

---

## 6. MILESTONE 3 — FINAL PRODUCT

### 🎯 Mục tiêu
Tích hợp AI (Vector Search), xây dựng Web Interface, và đánh giá so sánh.

### 📁 Các file liên quan chính
| File | Vai trò |
|:---|:---|
| `src/ranking/vector.py` | VectorRanker — Qdrant + multilingual-e5-base |
| `src/scripts/index_vectors.py` | Script index toàn bộ docs vào Qdrant |
| `docker-compose.yml` | Qdrant container configuration |
| `app.py` | FastAPI entry point — init BM25 + Vector + DB Pool |
| `src/router/api.py` | API endpoints (BM25, Vector, Hybrid, Products, Stats) |
| `src/ui/frontend/` | React frontend (Vite + TypeScript + TailwindCSS) |

### 🔧 Chi tiết kỹ thuật

#### 6.1. Vector Search — Semantic Search (`vector.py`)

**Model:** `intfloat/multilingual-e5-base` — 768-dimension embeddings, hỗ trợ tiếng Việt.

**Database:** Qdrant (chạy Docker, port 6333) — cosine similarity search.

```python
# Indexing: Thêm prefix "passage:" theo convention của E5 model
texts = [f"passage: {doc['name']}" for doc in batch]
embeddings = model.encode(texts, normalize_embeddings=True)
qdrant.upsert(points=[PointStruct(id=doc['id'], vector=emb, payload={"name": doc['name']})])

# Searching: Thêm prefix "query:" 
query_embedding = model.encode([f"query: {query}"], normalize_embeddings=True)
results = qdrant.query_points(query=query_embedding, limit=top_k)
```

**Ưu điểm Vector Search:**
- Tìm được kết quả **ngữ nghĩa** (semantic): "máy tính chơi game" → trả về "laptop gaming".
- Không phụ thuộc vào từ khóa chính xác (keyword match).

#### 6.2. Hybrid Search — Kết hợp BM25 + Vector (`api.py`)

Hybrid Search kết hợp điểm mạnh của cả hai phương pháp:

```python
# 1. Lấy kết quả từ cả 2 engine (mở rộng pool ×2 để có nhiều candidates)
vec_results = vector_ranker.search(query, top_k=limit * 2)
bm25_results = bm25_ranker.rank(tokens, postings, top_k=limit * 2)

# 2. Normalize scores về [0, 1] (Min-Max)
vec_norm = {id: (score - min) / (max - min) for id, score in vec_scores}
bm25_norm = {id: (score - min) / (max - min) for id, score in bm25_scores}

# 3. Weighted fusion (Alpha điều chỉnh được từ UI)
final_score = α × vector_score + (1 - α) × bm25_score  # α mặc định = 0.5
```

#### 6.3. FastAPI Backend (`app.py` + `api.py`)

**Khởi tạo (Lifespan):**

```
Startup:
  1. Load BM25: final_index.bin + lexicon.dat + metadata.pkl
  2. Load Vector: SentenceTransformer model + connect Qdrant
  3. Init DB Pool: ThreadedConnectionPool (20 connections) → CockroachDB

Shutdown:
  1. Close all DB connections
```

**API Endpoints:**

| Endpoint | Method | Mô tả |
|:---|:---|:---|
| `/api/search/bm25` | POST | Tìm kiếm chỉ dùng BM25 |
| `/api/search/vector` | POST | Tìm kiếm chỉ dùng Vector |
| `/api/search/hybrid` | POST | Tìm kiếm Hybrid (BM25 + Vector) |
| `/api/search` | GET | **Unified endpoint** cho UI — tự chọn method |
| `/api/products` | GET | Danh sách sản phẩm (landing page) |
| `/api/products/:id` | GET | Chi tiết sản phẩm |
| `/api/stats` | GET | Thống kê (total products, platforms, brands) |

**Tính năng đặc biệt:**
- **Filter:** Platform, min_price, max_price — áp dụng ở cả SQL level.
- **Fallback:** Nếu DB fail → fallback sang JSONL local sample.
- **Platform Detection:** Tự nhận diện platform từ URL nếu thiếu metadata.

#### 6.4. React Frontend

**Tech:** Vite + React + TypeScript + TailwindCSS

| Page | File | Mô tả |
|:---|:---|:---|
| **Home** | `HomePage.tsx` | Landing page — stats, featured products |
| **Search** | `SearchPage.tsx` | Form tìm kiếm — chọn method (BM25/Vector/Hybrid), alpha slider |
| **Results** | `ResultsPage.tsx` | Hiển thị kết quả — grid/list/comparison views |
| **Detail** | `ProductDetailsPage.tsx` | Chi tiết sản phẩm — ảnh, giá, specs, rating |
| **Dashboard** | `DashboardPage.tsx` | Bảng thống kê dữ liệu, biểu đồ platform distribution |

| Component | Vai trò |
|:---|:---|
| `SearchBar.tsx` | Input search + submit |
| `ProductCard.tsx` | Card sản phẩm (hỗ trợ 3 views) |
| `FilterSidebar.tsx` | Filter platform + khoảng giá |
| `PlatformBadge.tsx` | Badge logo sàn TMĐT |
| `Header.tsx` | Navigation bar |
| `Loading.tsx` | Loading spinner |

#### 6.5. Vector Indexing Script (`index_vectors.py`)

Script index toàn bộ dữ liệu vào Qdrant:

```python
# 1. Kết nối CockroachDB với server-side cursor
# 2. Kiểm tra IDs đã index → skip duplicates
# 3. Batch encode (1000 docs/batch) bằng SentenceTransformer
# 4. Upsert vào Qdrant
# Hỗ trợ resume: nếu dừng giữa chừng, chạy lại sẽ skip đã index
```

---

## 7. HƯỚNG DẪN CHẠY DỰ ÁN

### Yêu cầu hệ thống
- **Python** 3.10+
- **Node.js** 18+
- **Docker** (cho Qdrant)
- **CockroachDB** (cloud hoặc local)

### Bước 1: Cài đặt dependencies
```bash
pip install -r requirements.txt      # Python: FastAPI, PyVi, psycopg2, numpy, qdrant-client, sentence-transformers
npm install                          # Node.js: Crawlers
cd src/ui/frontend && npm install    # Frontend: React + Vite
```

### Bước 2: Cấu hình .env
```
DATABASE_URL=postgresql://user:pass@host:26257/dbname?sslmode=require
```

### Bước 3: Khởi động Qdrant (Docker)
```bash
docker-compose up -d
```

### Bước 4: Build SPIMI Index (Milestone 2)
```bash
python console_app.py --index
# Output: final_index.bin (254MB), lexicon.dat (7MB), metadata.pkl
```

### Bước 5: Index Vectors vào Qdrant (Milestone 3)
```bash
python src/scripts/index_vectors.py
```

### Bước 6: Chạy Backend
```bash
python app.py
# → FastAPI server tại http://localhost:8000
```

### Bước 7: Chạy Frontend
```bash
cd src/ui/frontend
npm run dev
# → React app tại http://localhost:5173
```

---

## 8. ĐÁNH GIÁ ĐỐI CHIẾU VỚI ĐẶC TẢ ĐỒ ÁN

### 📋 MILESTONE 1: DATA ACQUISITION (20%)

| Tiêu chí | Điểm tối đa | Trạng thái | Chi tiết |
|:---|:---:|:---:|:---|
| **(4đ) Khối lượng & Chất lượng** | 4 | ✅ **ĐẠT** | 1,006,666 docs (vượt 1M). Dữ liệu sạch, đã tách từ PyVi, không lỗi font. |
| **(3đ) Kỹ thuật Crawl** | 3 | ✅ **ĐẠT** | Multi-source TypeScript crawlers. `p-queue` concurrency=10. BrowserPool với memory recycling. Resume mechanism (last_crawled_at). |
| **(2đ) GitHub & Log** | 2 | ✅ **ĐẠT** | 3 file AI log (`ai_log_hau.md`, `ai_log_chien.md`, `ai_log_long.md`). Commit history trên GitHub. |
| **(1đ) Insight** | 1 | ✅ **ĐẠT** | Có thống kê: avgdl=10.96 tokens, total=11,033,059 tokens. Bảng phân bố theo nguồn. |
| **TỔNG** | **10** | ✅ | **Đầy đủ** |

### 📋 MILESTONE 2: CORE SEARCH ENGINE (20%)

| Tiêu chí | Điểm tối đa | Trạng thái | Chi tiết |
|:---|:---:|:---:|:---|
| **(4đ) Thuật toán SPIMI** | 4 | ✅ **ĐẠT** | SPIMI đúng logic: block 50MB, sort terms, flush to disk, clear RAM. K-Way Merge bằng heapq. Chạy 1M+ docs không tràn RAM (server-side cursor + generator). |
| **(3đ) Thuật toán BM25** | 3 | ✅ **ĐẠT** | Tự tính TF, IDF, avgdl. Không gọi hàm rank() thư viện. NumPy vectorization cho performance. IDF formula: `log((N-df+0.5)/(df+0.5)+1)`. |
| **(2đ) Hiệu năng** | 2 | ✅ **ĐẠT** | Tốc độ search ~30-80ms (< 1 giây). Lexicon load < 1s. seek()-based retrieval. |
| **(1đ) Demo** | 1 | ✅ **ĐẠT** | Console app hoạt động (console_app.py --search). Có output mẫu top 10 results. |
| **TỔNG** | **10** | ✅ | **Đầy đủ** |

### 📋 MILESTONE 3: FINAL PRODUCT (20%)

| Tiêu chí | Điểm tối đa | Trạng thái | Chi tiết |
|:---|:---:|:---:|:---|
| **(3đ) Tính năng AI** | 3 | ✅ **ĐẠT** | Vector Search tích hợp thành công (Qdrant + multilingual-e5-base). Tìm được query ngữ nghĩa ("máy tính chơi game" → "laptop gaming"). |
| **(3đ) Sản phẩm Web** | 3 | ✅ **ĐẠT** | Giao diện React đầy đủ: Search (3 methods + alpha slider), Filter (platform, price), Pagination, Product Detail, Dashboard. |
| **(2đ) Đánh giá** | 2 | ⚠️ **CẦN BỔ SUNG** | Chưa thấy file evaluation rõ ràng. Cần bảng so sánh Precision@10 giữa BM25, Vector, Hybrid với bộ 20 queries test. |
| **(2đ) Trình bày** | 2 | ⏳ **Chưa thực hiện** | Cần chuẩn bị slide + demo live. |
| **TỔNG** | **10** | ⚠️ | **Gần đầy đủ — cần bổ sung Evaluation** |

### 📋 QUY ĐỊNH BẮT BUỘC

| Quy định | Trạng thái | Chi tiết |
|:---|:---:|:---|
| **GitHub History** | ✅ | Có commit history (cần kiểm tra thêm tính đều đặn) |
| **AI Logging** | ✅ | 3 file: `ai_log_hau.md` (5KB), `ai_log_chien.md` (15KB), `ai_log_long.md` (8KB) |

---

### ⚠️ NHỮNG PHẦN CẦN BỔ SUNG

> [!WARNING]
> **Evaluation (2 điểm Milestone 3):** Đây là phần quan trọng chưa hoàn thành. Cần:
> 1. Tạo bộ **20 queries test** (tiếng Việt, đa chủ đề).
> 2. Chạy cả 3 method (BM25, Vector, Hybrid) cho mỗi query.
> 3. Tính **Precision@10** cho từng method.
> 4. Tạo bảng so sánh + phân tích **tại sao** AI tốt hơn/tệ hơn trong từng trường hợp.
> 5. Viết vào `reports/REPORT_MILESTONE_3.md`.

> [!NOTE]
> **Slide trình bày** cũng cần được chuẩn bị cho demo cuối kỳ (2 điểm).

---

*Document generated: 2026-03-11 | SEG301 — Vertical Search Engine Project*
