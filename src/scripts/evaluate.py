import math, requests, statistics
from typing import List, Dict
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

# --- CONFIG ---
API_BASE_URL = "http://localhost:8000/api"
console = Console()

# QUERY DATASET WITH PHRASE-BASED TARGETS
QUERIES = [
    {
        "query": "iphone 16 pro max quốc tế promax ip16prm", 
        "bm25_phrases": ["iphone 16", "pro max", "quốc tế", "promax", "ip16prm", "256gb"],
        "vector_phrases": ["iphone 16""điện thoại apple","điện thoại thông minh","iphone giá rẻ", "smartphone ios", "apple flagship", "ip 16"]
    },
    {
        "query": "laptop lenovo thinkpad x1 carbon gen 11", 
        "bm25_phrases": ["laptop lenovo", "thinkpad x1", "x1 carbon", "gen 11", "máy tính xách tay"],
        "vector_phrases": ["laptop lenovo thinkpad","ultrabook cao cấp", "laptop doanh nhân", "lenovo business","máy tính lenovo","máy tính xách tay","laptop văn phòng"]
    },
    {
        "query": "tủ lạnh aqua inverter 469 lít aqr m560xa", 
        "bm25_phrases": ["tủ lạnh", "aqua", "inverter", "469 lít", "aqr-m560xa", "4 cánh"],
        "vector_phrases": ["tủ lạnh aqua","thiết bị nhà bếp", "tủ lạnh dung tích lớn", "tủ lạnh aqua side by side","tủ lạnh aqua","tủ lạnh inverter","đồ gia dụng"]
    },
    {
        "query": "samsung galaxy z flip5 5g 256gb cũ", 
        "bm25_phrases": ["samsung galaxy", "z flip5", "5g", "256gb", "máy cũ", "likenew 99%"],
        "vector_phrases": ["samsung galaxy","điện thoại gập", "smartphone samsung cũ", "màn hình gập","điện thoại samsung","điện thoại thông minh","điện thoại cũ"]
    },
    {
        "query": "máy giặt toshiba 10 kg aw m1100pv", 
        "bm25_phrases": ["máy giặt", "toshiba", "10 kg", "aw-m1100pv", "lồng đứng"],
        "vector_phrases": ["máy giặt toshiba","thiết bị giặt giũ", "washing machine", "đồ gia dụng toshiba","máy giặt cửa trên","máy giặt giá rẻ","máy giặt cũ"]
    },
    {
        "query": "flycam dji mini 2 trắng 4k", 
        "bm25_phrases": ["flycam dji", "mini 2", "4k", "drone", "combo", "trắng"],
        "vector_phrases": ["flycam dji","máy bay quay phim", "camera bay dji", "thiết bị bay mini","flycam dji","flycam giá rẻ","flycam 4k","flycam cũ","drone","flycam chính hãng","flycam giá rẻ","thiết bị bay","flycam mini"]
    },
    {
        "query": "apple macbook air m1 fullbox", 
        "bm25_phrases": ["apple macbook", "air m1", "fullbox", "8gb", "256gb"],
        "vector_phrases": ["macbook air","laptop đồ họa nhẹ", "macbook series", "máy tính xách tay apple","máy tính apple","laptop apple","macbook giá rẻ","macbook cũ","laptop văn phòng","ios","apple chính hãng"]
    },
    {
        "query": "xiaomi redmi note 13 pro 4g 128gb", 
        "bm25_phrases": ["xiaomi redmi", "note 13 pro", "4g", "128gb", "chính hãng"],
        "vector_phrases": ["xiaomi redmi","điện thoại tầm trung", "smartphone giá rẻ", "redmi note series","xiaomi chính hãng","điện thoại xiaomi","điện thoại giá rẻ","điện thoại cũ","điện thoại 4g","điện thoại 128gb","điện thoại android","điện thoại xiaomi chính hãng","điện thoại redmi","điện thoại redmi note","điện thoại xiaomi redmi"]
    },
    {
        "query": "máy cạo râu philips s3122", 
        "bm25_phrases": ["máy cạo râu", "philips", "s3122", "cầm tay", "khô và ướt"],
        "vector_phrases": ["máy cạo râu","philips","electric shaver", "vệ sinh cá nhân", "phụ kiện nam giới","máy cạo râu philips","máy cạo râu giá rẻ","máy cạo râu cũ","máy cạo râu chính hãng","máy cạo râu philips chính hãng","máy cạo râu philips s3122","máy cạo râu philips s3122 chính hãng","máy cạo râu philips chính hãng"]
    },
    {
        "query": "đồng hồ casio edifice eqs 920 solar", 
        "bm25_phrases": ["đồng hồ", "casio edifice", "eqs-920", "chạy solar", "dây thép"],
        "vector_phrases": ["đồng hồ casio","đồng hồ nam", "casio năng lượng mặt trời", "watch edifice","đồng hồ casio","đồng hồ nam","đồng hồ giá rẻ","đồng hồ cũ","đồng hồ casio chính hãng","đồng hồ casio edifice","đồng hồ casio edifice eqs 920", "đồng hồ casio chính hãng","đồng hồ kim","đồng hồ thể thao","đồng hồ casio chính hãng"]
    }
]

class PhraseEvaluator:
    def _calculate_score(self, method: str, name: str, q_item: dict) -> float:
        if name == "N/A_NOT_FOUND" or not name: return 0.0
        name_l = name.lower()
        
        # 1. BM25 Score (Exact phrase matching)
        # Calculate score based on exact presence of phrases in product name
        bm_score = sum(1 for p in q_item["bm25_phrases"] if p.lower() in name_l) / len(q_item["bm25_phrases"])
        
        # 2. Vector Score (Semantic/Category matching)
        vec_score = 1.0 if any(p.lower() in name_l for p in q_item["vector_phrases"]) else 0.0
        
        # 3. Hybrid: Average calculation
        if method == "bm25": return bm_score
        if method == "vector": return vec_score
        return (bm_score + vec_score) / 2.0

    def get_metrics(self, scores: List[float]) -> Dict[str, float]:
        scores = scores[:10]
        if not scores: return {"p10": 0.0, "mrr": 0.0, "ndcg": 0.0}
        
        rel_bin = [1 if s >= 0.5 else 0 for s in scores]
        p10 = sum(rel_bin) / 10.0
        mrr = next((1/(i+1) for i, b in enumerate(rel_bin) if b == 1), 0.0)
        
        dcg = sum((2**s - 1) / math.log2(i + 2) for i, s in enumerate(scores))
        idcg = sum((2**s - 1) / math.log2(i + 2) for i, s in enumerate(sorted(scores, reverse=True)))
        
        return {"p10": p10, "mrr": mrr, "ndcg": dcg / idcg if idcg > 0 else 0.0}

    def run(self):
        methods = ["bm25", "vector", "hybrid"]
        results = {m: {"p10": [], "mrr": [], "ndcg": []} for m in methods}
        
        console.print("\n[bold cyan]🚀 Evaluating using Phrase-based Matching mechanism...[/]")

        with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), BarColumn(), console=console) as progress:
            task = progress.add_task("[yellow]Executing...", total=len(QUERIES) * len(methods))

            for q_item in QUERIES:
                for method in methods:
                    try:
                        res = requests.get(f"{API_BASE_URL}/search", params={"query": q_item["query"], "method": method, "limit": 10}, timeout=10)
                        names = [p.get("name") for p in res.json().get("data", [])] if res.status_code == 200 else []
                        while len(names) < 10: names.append("N/A_NOT_FOUND")
                        
                        scores = [self._calculate_score(method, n, q_item) for n in names]
                        m = self.get_metrics(scores)
                        
                        for key in ["p10", "mrr", "ndcg"]: results[method][key].append(m[key])
                    except:
                        for key in ["p10", "mrr", "ndcg"]: results[method][key].append(0.0)
                    progress.advance(task)

        table = Table(title="📊 PHRASE-BASED SEARCH QUALITY REPORT", header_style="bold magenta")
        table.add_column("Algorithm", style="cyan")
        table.add_column("Avg P@10", justify="center", style="green")
        table.add_column("Avg MRR", justify="center", style="magenta")
        table.add_column("Avg NDCG@10", justify="center", style="yellow")
        
        for m in methods:
            table.add_row(m.upper(), f"{statistics.mean(results[m]['p10']):.3f}", f"{statistics.mean(results[m]['mrr']):.3f}", f"{statistics.mean(results[m]['ndcg']):.3f}")
        console.print(table)

if __name__ == "__main__":
    PhraseEvaluator().run()