import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export interface Chunk {
  id: number;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, string>;
}

export interface SearchResult {
  content: string;
  documentId: string;
  distance: number;
  metadata: Record<string, string>;
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

export class VectorStore {
  private db: Database.Database;
  private _dimensions: number;

  get dimensions(): number {
    return this._dimensions;
  }

  constructor(dbPath: string, dimensions?: number) {
    this.db = new Database(dbPath);
    this.db.defaultSafeIntegers(false);
    sqliteVec.load(this.db);
    this._dimensions = dimensions ?? 0;
    this.init();
  }

  private init(): void {
    this.db.exec(`
         CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
         )
      `);

    const existing = this.db
      .prepare("SELECT value FROM meta WHERE key = 'dimensions'")
      .get() as { value: string } | undefined;

    if (existing) {
      const stored = parseInt(existing.value);
      if (this._dimensions > 0 && stored !== this._dimensions) {
        throw new Error(
          `Embedding dimensions mismatch: store has ${stored}, provider has ${this._dimensions}. Different embedding model?`,
        );
      }
      this._dimensions = stored;
    } else if (this._dimensions > 0) {
      this.db
        .prepare("INSERT INTO meta (key, value) VALUES ('dimensions', ?)")
        .run(String(this._dimensions));
    } else {
      throw new Error(
        "Cannot create a new store without specifying dimensions",
      );
    }

    this.db.exec(`
         CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            file_hash TEXT NOT NULL DEFAULT '',
            ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
         )
      `);

    this.db.exec(`
         CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            metadata TEXT NOT NULL DEFAULT '{}'
         )
      `);

    this.db.exec(`
         CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
            embedding float[${this._dimensions}]
         )
      `);
  }

  addDocument(id: string, filename: string, fileHash = ""): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO documents (id, filename, file_hash) VALUES (?, ?, ?)",
      )
      .run(id, filename, fileHash);
  }

  addChunk(
    documentId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, string> = {},
  ): void {
    const result = this.db
      .prepare(
        "INSERT INTO chunks (document_id, content, metadata) VALUES (?, ?, ?)",
      )
      .run(documentId, content, JSON.stringify(metadata));

    const chunkId = Number(result.lastInsertRowid);
    const normalized = normalize(embedding);
    const vecBuf = Buffer.from(new Float32Array(normalized).buffer);
    this.db
      .prepare(
        `INSERT INTO chunks_vec (rowid, embedding) VALUES (${chunkId}, ?)`,
      )
      .run(vecBuf);
  }

  search(queryEmbedding: number[], limit = 5): SearchResult[] {
    const count = this.db
      .prepare("SELECT COUNT(*) as n FROM chunks_vec")
      .get() as { n: number };
    if (count.n === 0) return [];

    const normalized = normalize(queryEmbedding);
    const rows = this.db
      .prepare(
        `
            SELECT c.content, c.document_id, c.metadata, v.distance
            FROM chunks_vec v
            JOIN chunks c ON c.id = v.rowid
            WHERE embedding MATCH ? AND k = ?
            ORDER BY distance
         `,
      )
      .all(Buffer.from(new Float32Array(normalized).buffer), limit) as any[];

    return rows.map((r) => ({
      content: r.content,
      documentId: r.document_id,
      distance: r.distance,
      metadata: JSON.parse(r.metadata),
    }));
  }

  removeDocument(id: string): void {
    const chunks = this.db
      .prepare("SELECT id FROM chunks WHERE document_id = ?")
      .all(id) as { id: number }[];

    for (const chunk of chunks) {
      this.db.prepare("DELETE FROM chunks_vec WHERE rowid = ?").run(chunk.id);
    }
    this.db.prepare("DELETE FROM chunks WHERE document_id = ?").run(id);
    this.db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  }

  listDocuments(): {
    id: string;
    filename: string;
    fileHash: string;
    ingestedAt: string;
  }[] {
    return this.db
      .prepare(
        "SELECT id, filename, file_hash as fileHash, ingested_at as ingestedAt FROM documents ORDER BY ingested_at DESC",
      )
      .all() as any[];
  }

  getChunksByFilename(filename: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT c.content FROM chunks c
         JOIN documents d ON c.document_id = d.id
         WHERE d.filename = ?
         ORDER BY c.id`,
      )
      .all(filename) as { content: string }[];
    return rows.map((r) => r.content);
  }

  close(): void {
    this.db.close();
  }
}
