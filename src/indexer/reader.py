import pickle
import os

class IndexReader:
    def __init__(self, index_file="src/indexer/final_index.bin", lexicon_file="src/indexer/lexicon.dat"):
        self.index_path = index_file
        self.lexicon_path = lexicon_file
        self.lexicon = {}
        self.file_handle = None
        self.load_lexicon()
        self.open_file()

    def load_lexicon(self):
        """Loads the lexicon (term -> offset, length) into RAM."""
        if not os.path.exists(self.lexicon_path):
            print(f"Lexicon file {self.lexicon_path} not found.")
            return
        
        with open(self.lexicon_path, 'rb') as f:
            self.lexicon = pickle.load(f)
            
    def open_file(self):
        """Opens the binary index file in read-binary mode."""
        if os.path.exists(self.index_path):
            self.file_handle = open(self.index_path, 'rb')
        else:
            print(f"Index file {self.index_path} not found.")
            
    def close(self):
        if self.file_handle:
            self.file_handle.close()

    def get_postings(self, term):
        """
        Retrieves postings for a term using seek() and read().
        Returns {doc_id: tf} or empty dict if not found.
        """
        if term not in self.lexicon:
            return {}
        
        meta = self.lexicon[term]
        offset = meta['offset']
        length = meta['length']
        
        if self.file_handle:
            self.file_handle.seek(offset)
            data_bytes = self.file_handle.read(length)
            return pickle.loads(data_bytes)
        
        return {}

    def __del__(self):
        self.close()
