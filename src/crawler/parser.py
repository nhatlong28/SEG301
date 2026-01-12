import json
import os
from pathlib import Path

def get_all_shops_generator(root_data_path="data"):
    """
    Generator to aggregate data from all shop subdirectories.
    Scans through data/shop_name/products.jsonl
    """
    root_path = Path(root_data_path)
    
    # Iterate through all subdirectories in the 'data' folder
    for shop_dir in root_path.iterdir():
        if shop_dir.is_dir():
            jsonl_path = shop_dir / "products.jsonl"
            
            # Check if the products.jsonl file exists in this specific shop folder
            if jsonl_path.exists():
                print(f"--- Reading data from shop: {shop_dir.name} ---")
                
                with open(jsonl_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            product = json.loads(line)
                            
                            # Extract required fields for SPIMI/BM25 processing
                            doc_id = str(product.get("external_id"))
                            name_normalized = product.get("name_normalized", "")
                            
                            if name_normalized:
                                # Split the normalized name into tokens to feed SPIMI directly
                                tokens = name_normalized.split()
                                yield doc_id, tokens
                        except json.JSONDecodeError:
                            continue