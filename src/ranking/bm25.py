import numpy as np

class BM25Ranker:
    def __init__(self, doc_lengths, avgdl, N, k1=1.5, b=0.75):
        """
        doc_lengths: dict or array of document lengths. {doc_id: length} or array indexed by int(doc_id)
        avgdl: float, average document length
        N: int, total number of documents
        """
        self.doc_lengths = doc_lengths 
        # Convert doc_lengths to dictionary if it's not, or assume it's accessible by doc_id
        # The prompt says "mảng NumPy doc_lengths", implying index access or we map doc_id to index.
        # But doc_ids are strings from parsing "str(row[0])". 
        # To use numpy array efficiently, we need int doc_ids.
        # Let's handle doc_id mapping in the main app, or handle dict here.
        # The prompt says "mảng NumPy doc_lengths". Efficient way: mapping doc_id(str) -> index(int).
        # We assume for this class that we can look up length.
        
        self.avgdl = avgdl
        self.N = N
        self.k1 = k1
        self.b = b

    def rank(self, query_terms, candidate_postings, top_k=10):
        """
        query_terms: list of terms in query (only for IDF calculation if needed, 
                     but postings already filtered by query terms?)
                     Actually usually we iterate over query terms.
        candidate_postings: {term: {doc_id: tf}} for terms in query.
        
        Returns: list of (doc_id, score) sorted by score.
        """
        
        # Identify all unique candidate docs
        all_candidate_docs = set()
        for term in candidate_postings:
             all_candidate_docs.update(candidate_postings[term].keys())
        
        if not all_candidate_docs:
            return []

        # Create a mapping from doc_id to index for vectorization
        doc_ids = list(all_candidate_docs)
        doc_to_idx = {d: i for i, d in enumerate(doc_ids)}
        num_candidates = len(doc_ids)
        
        # Initialize scores
        scores = np.zeros(num_candidates)
        
        # Pre-fetch lengths for these candidates to a numpy array
        # Assuming self.doc_lengths is a dict {doc_id: length} for simplicity 
        # as doc_id is str. If it was dense array, we'd need int conversion.
        # Prompt said "mảng NumPy doc_lengths", maybe it meant global array.
        # We will try to cast doc_id to int if possible, or just use list comprehension.
        
        # Let's try to handle both dict or array if doc_id is int-able.
        # For safety/generality with str doc_ids:
        candidate_lens = np.array([self.doc_lengths.get(d, 0) for d in doc_ids])

        for term in query_terms:
            if term not in candidate_postings:
                continue
                
            postings = candidate_postings[term] # {doc_id: tf}
            
            # Document frequency
            df = len(postings) # Global DF should ideally come from index stats, but approx with local if needed?
            # Actually, IndexReader should probably provide DF. 
            # But the prompt says "candidate_postings". We can use len(postings) if it's the FULL list.
            # Assuming postings contains all docs containing the term.
            
            # IDF calculation
            idf = np.log((self.N - df + 0.5) / (df + 0.5) + 1)
            
            # Extract TFs for the candidate docs (aligned with doc_ids)
            # This part can be sparse. 
            # Vectorized approach:
            # We only care about docs that have this term.
            
            term_docs = list(postings.keys())
            term_tfs = np.array(list(postings.values()))
            
            # Map term_docs to the indices in our scores array
            indices = [doc_to_idx[d] for d in term_docs]
            
            # Get lengths for just these docs
            # (Optimization: use global candidate_lens and slice? No, indices are random.)
            # better:
            curr_lens = candidate_lens[indices]
            
            # BM25 formula component
            # score = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc_len / avgdl))))
            
            numerator = term_tfs * (self.k1 + 1)
            denominator = term_tfs + self.k1 * (1 - self.b + self.b * (curr_lens / self.avgdl))
            
            term_scores = idf * (numerator / denominator)
            
            # Accumulate scores
            scores[indices] += term_scores

        # Get top K
        # np.argsort returns indices of sorted.
        # we want descending.
        top_indices = np.argsort(scores)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            results.append((doc_ids[idx], scores[idx]))
            
        return results
