import os
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from qdrant_client.models import PointStruct
from sentence_transformers import SentenceTransformer
import torch

class VectorRanker:
    def __init__(self, collection_name: str = "product_embeddings", model_name: str = "intfloat/multilingual-e5-base"):
        """
        Initialize VectorRanker with Qdrant and SentenceTransformer.
        """
        print(f"Initializing VectorRanker with model: {model_name}")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = SentenceTransformer(model_name, device=device)
        
        # Initialize Qdrant client
        # Connect to Docker container usually at localhost:6333
        self.client = QdrantClient(host="localhost", port=6333)
        # self.client = QdrantClient(path="./qdrant_storage")
        self.collection_name = collection_name
        
        # Ensure collection exists
        print(f"Checking collection {collection_name}...")
        if not self.client.collection_exists(collection_name):
            print(f"Creating collection {collection_name}...")
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=768, distance=Distance.COSINE),
            )
        print(f"Vector Database ready at localhost:6333, Collection: {collection_name}")

    def delete_collection(self):
        """
        Delete the current collection from Qdrant.
        """
        print(f"Deleting collection {self.collection_name}...")
        self.client.delete_collection(collection_name=self.collection_name)
        print(f"Collection {self.collection_name} deleted.")

    def index_documents(self, documents: List[Dict[str, Any]], batch_size: int = 64):
        """
        Embed and index a list of documents.
        documents: List of dicts with 'id', 'text', and optional 'metadata'.
        """
        total_docs = len(documents)
        print(f"Indexing {total_docs} documents into Qdrant...")
        
        for i in range(0, total_docs, batch_size):
            batch = documents[i:i + batch_size]
            
            # Prepare texts with E5 prefix
            names = [f"passage: {doc['name']}" for doc in batch]
            
            # Generate embeddings
            embeddings = self.model.encode(names, normalize_embeddings=True).tolist()
            
            # Create PointStructs
            points = []
            for j, doc in enumerate(batch):
                points.append(PointStruct(
                    id=doc['id'],
                    vector=embeddings[j],
                    payload={"name": doc['name']}
                ))
            
            # Upsert
            if points:
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=points
                )
            print(f"Indexed {min(i + batch_size, total_docs)}/{total_docs} documents.")

    def search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Search for documents similar to the query.
        """
        # Embed query with prefix
        query_text = f"query: {query}"
        query_embedding = self.model.encode([query_text], normalize_embeddings=True)[0].tolist()
        
        # Search Qdrant
        results = self.client.query_points(
            collection_name=self.collection_name,
            query=query_embedding,
            limit=top_k
        ).points
        
        # Format results
        formatted_results = []
        for hit in results:
            formatted_results.append({
                "id": hit.id,
                "name": hit.payload["name"],
                "score": hit.score
            })
                
        return formatted_results
