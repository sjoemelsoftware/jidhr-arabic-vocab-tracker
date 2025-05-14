

-- Create lemmas table
CREATE TABLE IF NOT EXISTS lemmas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lemma_part TEXT NOT NULL UNIQUE,
    is_known BOOLEAN NOT NULL DEFAULT 0,
    count INTEGER NOT NULL DEFAULT 0,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on the lemma_part column for faster lookups
CREATE INDEX IF NOT EXISTS idx_lemmas_part ON lemmas(lemma_part); 