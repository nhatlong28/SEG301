
import json
import os
import glob
from pyvi import ViTokenizer
import pandas as pd
from tqdm import tqdm
import re

DATA_DIR = "../../data"
OUTPUT_FILE = "../../data/cleaned_products.jsonl"

def clean_text(text):
    if not text:
        return ""
    # Remove HTML tags (simple regex)
    text = re.sub(r'<[^>]+>', '', text)
    # Remove scripts
    text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL)
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def segment_text(text):
    if not text:
        return ""
    try:
        return ViTokenizer.tokenize(text)
    except:
        return text

def process_file(filepath):
    products = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                if not line.strip(): continue
                product = json.loads(line)
                
                # Cleaning
                product['name_clean'] = clean_text(product.get('name', ''))
                product['description_clean'] = clean_text(product.get('description', ''))
                
                # Segmentation
                product['name_segmented'] = segment_text(product['name_clean'])
                product['description_segmented'] = segment_text(product['description_clean'])
                
                products.append(product)
            except json.JSONDecodeError:
                continue
    return products

def main():
    print("Starting cleaning process...")
    files = glob.glob(os.path.join(DATA_DIR, "*_products.jsonl"))
    print(f"Found {len(files)} files: {files}")
    
    all_products = []
    seen_ids = set()
    
    for f in files:
        print(f"Processing {f}...")
        file_products = process_file(f)
        for p in file_products:
            # Deduplication by source_id + external_id
            # Or hash_name? 
            # external_id is best if reliable.
            # Assuming external_id is unique per source.
            # Note: We don't have source name in record easily unless we parse filename or use logic.
            # But the record has 'source_id' (which was 0 placeholder).
            # Let's rely on 'external_url' or 'external_id'.
            # Combining simple strategy: external_url is strongest unique key.
            uid = p.get('external_url') or p.get('external_id')
            if uid and uid not in seen_ids:
                seen_ids.add(uid)
                all_products.append(p)
                
    print(f"Total unique products: {len(all_products)}")
    
    # Save to JSONL
    print(f"Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        for p in tqdm(all_products):
            f.write(json.dumps(p, ensure_ascii=False) + '\n')
            
    print("Done!")

if __name__ == "__main__":
    main()
