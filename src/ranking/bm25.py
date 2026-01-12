import numpy as np

class BM25Ranker:
    def __init__(self, doc_lengths, avgdl, N, k1=1.5, b=0.75):
        """
        doc_lengths: dict or array of document lengths. {doc_id: length} or array indexed by int(doc_id)
        avgdl: float, average document length
        N: int, total number of documents
        """
        self.doc_lengths = doc_lengths 
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
        
        # Convert doc_lengths to numpy array for efficient lookups
        candidate_lens = np.array([self.doc_lengths.get(d, 0) for d in doc_ids])

        for term in query_terms:
            if term not in candidate_postings:
                continue
                
            postings = candidate_postings[term] # {doc_id: tf}
            
            # Document frequency
            df = len(postings) 
            # IDF calculation
            idf = np.log((self.N - df + 0.5) / (df + 0.5) + 1)
            
            # Extract TFs for the candidate docs (aligned with doc_ids)
            term_docs = list(postings.keys())
            term_tfs = np.array(list(postings.values()))
            
            indices = [doc_to_idx[d] for d in term_docs]
            
            curr_lens = candidate_lens[indices]
            
            # BM25 formula component
            numerator = term_tfs * (self.k1 + 1)
            denominator = term_tfs + self.k1 * (1 - self.b + self.b * (curr_lens / self.avgdl))
            
            term_scores = idf * (numerator / denominator)
            
            # Accumulate scores
            scores[indices] += term_scores

        # Get top K and sort by descending
        top_indices = np.argsort(scores)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            results.append((doc_ids[idx], scores[idx]))
            
        return results
