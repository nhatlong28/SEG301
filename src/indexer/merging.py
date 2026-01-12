import pickle
import os
import heapq
from contextlib import ExitStack

def merge_blocks(block_dir="output_blocks", output_file="final_index.bin", lexicon_file="lexicon.dat"):
    """
    Performs K-Way Merge on block files.
    """
    block_files = sorted([os.path.join(block_dir, f) for f in os.listdir(block_dir) if f.endswith('.bin')])
    if not block_files:
        print("No blocks to merge.")
        return

    # Use ExitStack to manage multiple open files
    with ExitStack() as stack:
        files = [stack.enter_context(open(fn, 'rb')) for fn in block_files]
        
        print("Loading blocks for merging...")
        iterators = []
        for f in files:
            # Check if file is empty
            try:
                data = pickle.load(f) # Loads the entire list :| 
                # Ideally we want an iterator over this list.
                iterators.append(iter(data)) 
            except EOFError:
                continue

        # Priority Queue for K-Way Merge: (term, doc_id_of_block, posting, iterator_index)
        # We need to merge postings for the SAME term.
        # heap element: (term, postings, iterator_id)
        
        heap = []
        for i, it in enumerate(iterators):
            try:
                term, postings = next(it)
                heapq.heappush(heap, (term, i, postings))
            except StopIteration:
                pass
        
        lexicon = {}
        offset = 0
        
        # Open final index for writing
        with open(output_file, 'wb') as out_f:
            current_term = None
            current_postings = {}
            
            while heap:
                term, idx, postings = heapq.heappop(heap)
                
                if current_term is None:
                    current_term = term
                    current_postings = postings
                elif term == current_term:
                    # Merge postings (doc_ids should be unique across calls if blocks are partitioned by docs, 
                    # but SPIMI partitions by TIME/Memory. A term can appear in multiple blocks.
                    # We merge the dictionaries.
                    current_postings.update(postings)
                else:
                    # New term saw, write the old term
                    # Serialize postings
                    data_bytes = pickle.dumps(current_postings)
                    length = len(data_bytes)
                    
                    # Update lexicon
                    lexicon[current_term] = {'offset': offset, 'length': length}
                    
                    # Write to file
                    out_f.write(data_bytes)
                    offset += length
                    
                    # Start new term
                    current_term = term
                    current_postings = postings
                
                # Push next from same iterator
                try:
                    next_term, next_postings = next(iterators[idx])
                    heapq.heappush(heap, (next_term, idx, next_postings))
                except StopIteration:
                    pass
            
            # Write global last term
            if current_term is not None:
                data_bytes = pickle.dumps(current_postings)
                length = len(data_bytes)
                lexicon[current_term] = {'offset': offset, 'length': length}
                out_f.write(data_bytes)
    
    # Save lexicon
    with open(lexicon_file, 'wb') as f:
        pickle.dump(lexicon, f)
    
    print(f"Merged complete. Index saved to {output_file}, Lexicon to {lexicon_file}")
