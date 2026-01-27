import sys
import pickle
import os
import json
from collections import defaultdict

class SPIMIIndexer:
    def __init__(self, block_size_limit_mb=200, output_dir="src/indexer/output_blocks"):
        self.block_size_limit = block_size_limit_mb * 1024 * 1024
        self.output_dir = output_dir
        self.dictionary = defaultdict(dict) # {term: {doc_id: tf}}
        self.block_count = 0
        self.doc_lengths = {}
        self.total_length = 0
        self.doc_count = 0
        
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def run_indexing(self, doc_generator):
        """
        Consumes (doc_id, tokens) from generator and builds index.
        """
        for doc_id, tokens in doc_generator:
            doc_len = len(tokens)
            self.doc_lengths[doc_id] = doc_len
            self.total_length += doc_len
            self.doc_count += 1
            
            for term in tokens:
                if doc_id not in self.dictionary[term]:
                    self.dictionary[term][doc_id] = 0
                self.dictionary[term][doc_id] += 1
            
            # Check memory usage
            if sys.getsizeof(self.dictionary) >= self.block_size_limit:
                self.write_block()
        
        # Write remaining data
        if self.dictionary:
            self.write_block()
            
        # Save Metadata
        self.save_metadata()

    def save_metadata(self):
        avgdl = self.total_length / self.doc_count if self.doc_count > 0 else 0
        metadata = {
            'N': self.doc_count,
            'avgdl': avgdl,
            'total_length': self.total_length,
            'doc_lengths': self.doc_lengths
        }
        meta_path = os.path.join(self.output_dir, "metadata.pkl")
        with open(meta_path, 'wb') as f:
            pickle.dump(metadata, f)
        print(f"Metadata saved to {meta_path} (N={self.doc_count}, avgdl={avgdl:.2f})")

    def write_block(self):
        """
        Sorts terms and writes current dictionary to a binary block file.
        """
        self.block_count += 1
        block_filename = os.path.join(self.output_dir, f"block_{self.block_count}.bin")
        print(f"Writing block {block_filename}...")
        
        # Sort terms
        sorted_terms = sorted(self.dictionary.keys())
        
        block_data = []
        for term in sorted_terms:
            block_data.append((term, self.dictionary[term]))
            
        with open(block_filename, 'wb') as f:
            pickle.dump(block_data, f)
            
        # Reset dictionary and force garbage collection suggested implicitly by 'memory management'
        self.dictionary = defaultdict(dict)
        print(f"Finished writing block {self.block_count}.")
