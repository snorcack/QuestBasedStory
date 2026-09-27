"""ChromaDB lore store interface for World Bible embeddings and consistency checking."""
import os
from typing import Any
import chromadb
from chromadb.config import Settings


class LoreStore:
    """Manages vector embeddings of World Bible entities using ChromaDB."""

    def __init__(self, persist_dir: str | None = None, in_memory: bool = False):
        self.persist_dir = persist_dir or os.getenv("LORE_STORE_PATH", "chroma_db")
        self.in_memory = in_memory
        
        if self.in_memory:
            self.client = chromadb.EphemeralClient()
        else:
            os.makedirs(self.persist_dir, exist_ok=True)
            self.client = chromadb.PersistentClient(path=self.persist_dir)

    def get_or_create_collection(self, category: str):
        """Retrieve or create a collection for a given lore category (e.g. 'locations', 'rules')."""
        return self.client.get_or_create_collection(name=category)

    def add_entry(
        self,
        category: str,
        entry_id: str,
        text: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Add or update a lore document in the vector store."""
        collection = self.get_or_create_collection(category)
        collection.upsert(
            ids=[entry_id],
            documents=[text],
            metadatas=[metadata or {"id": entry_id}],
        )

    def query_similar(
        self,
        category: str,
        query_text: str,
        n_results: int = 5,
    ) -> list[dict[str, Any]]:
        """Find most similar lore entries in a category."""
        collection = self.get_or_create_collection(category)
        if collection.count() == 0:
            return []
        
        count = min(n_results, collection.count())
        results = collection.query(
            query_texts=[query_text],
            n_results=count,
        )
        
        output = []
        if results and results["documents"]:
            docs = results["documents"][0]
            ids = results["ids"][0]
            metadatas = results["metadatas"][0] if results["metadatas"] else [{}] * len(docs)
            for i, doc in enumerate(docs):
                output.append({
                    "id": ids[i],
                    "document": doc,
                    "metadata": metadatas[i],
                })
        return output

    def reset_store(self) -> None:
        """Reset the vector database collections."""
        for coll in self.client.list_collections():
            self.client.delete_collection(name=coll.name)
