import json
import os
from pathlib import Path

def aggregate_shop_data(root_data_path="data", output_filename="total_products.jsonl"):
    """
    Scans all subdirectories in root_data_path for products.jsonl files
    and aggregates them into a single total_products.jsonl file.
    """
    root_path = Path(root_data_path)
    output_path = root_path / output_filename
    
    with open(output_path, 'w', encoding='utf-8') as outfile:
        # Iterate through all subdirectories in the 'data' folder
        for shop_dir in root_path.iterdir():
            if shop_dir.is_dir():
                jsonl_path = shop_dir / "products.jsonl"
                
                if jsonl_path.exists():
                    print(f"--- Processing shop: {shop_dir.name} ---")
                    with open(jsonl_path, 'r', encoding='utf-8') as infile:
                        for line in infile:
                            # Strip unusual line terminators and write with standard \n
                            clean_line = line.strip('\u2028\u2029\r\n')
                            if clean_line:
                                outfile.write(clean_line + '\n')
    
    print(f"Aggregation complete. Output saved to: {output_path}")
    return str(output_path)

def get_product_generator(data_path="data/total_products.jsonl"):
    """
    Efficiently yields product data line-by-line from the aggregated file.
    """
    if not os.path.exists(data_path):
        return

    with open(data_path, 'r', encoding='utf-8') as f:
        for line in f:
            # Chỉ nạp đúng 1 dòng này vào RAM
            try:
                product = json.loads(line) 
                
                doc_id = str(product.get("external_id"))
                name_normalized = product.get("name_normalized", "")
                
                if name_normalized:
                    tokens = name_normalized.split()
                    yield doc_id, tokens
            except json.JSONDecodeError:
                continue
