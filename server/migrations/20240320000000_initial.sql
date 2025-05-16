DROP TABLE IF EXISTS lemmas;

CREATE TABLE lemmas (
    lemma TEXT PRIMARY KEY,
    description TEXT,
    translation TEXT
);

CREATE TABLE vocabulary (
    lemma TEXT PRIMARY KEY REFERENCES lemmas(lemma),
    status TEXT NOT NULL,
    first_seen_at TIMESTAMP,
    last_attempt_at TIMESTAMP,
    last_correct_at TIMESTAMP,
    attempt_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    context_seen_count INTEGER DEFAULT 0
);

CREATE INDEX idx_vocabulary_status ON vocabulary(status); 