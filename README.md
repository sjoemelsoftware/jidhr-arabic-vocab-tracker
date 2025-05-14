# Arabic Vocabulary Tracker

A web application to track and manage Arabic vocabulary using a Rust backend with Axum. Integrates with a Java-based lemmatizer to process input text and store word-level information in a local SQLite database.

## Features

- HTTP API endpoint `/lemmatize` for Arabic text
- Java-based lemmatization using `farasaSeg.jar`
- Word-level lemmatization results
- Vocabulary tracking with known/unknown word status
- SQLite database storage

## Requirements

- Rust (1.70+ recommended)
- Java (for running `farasaSeg.jar`)
- `farasaSeg.jar` file available in `dist/` directory
- SQLite3

## API

### POST `/lemmatize`

**Request:**

```json
{
  "text": "أنا أحب البرمجة"
}
```

**Response:**

```json
[
  { "word": "أنا", "lemma": "أنا" },
  { "word": "أحب", "lemma": "حب" },
  { "word": "البرمجة", "lemma": "برمجة" }
]
```

## Vocabulary Tracking (Planned)

Frontend can allow users to mark words as known or unknown. This status will be sent to the backend and stored in a `words` table with frequency and metadata.

## Database Schema (Initial)

```sql
CREATE TABLE words (
  id INTEGER PRIMARY KEY,
  word TEXT NOT NULL,
  lemma TEXT,
  known BOOLEAN DEFAULT false,
  count INTEGER DEFAULT 0,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Running the Project

1. Ensure `farasaSeg.jar` is in `dist/`
2. Start the server:

```bash
cargo run
```

The server will listen on `localhost:8000`.

## License

MIT

## DB

```build
# 1. Create the database if it doesn't exist
touch vocabulary.db

# 2. Set the DATABASE_URL
export DATABASE_URL="sqlite:vocabulary.db"

# 3. Run the migrations manually using sqlx-cli
cargo install sqlx-cli
sqlx database create
sqlx migrate run

# 4. Prepare SQLx queries
cargo sqlx prepare

# 5. Rebuild the project
cargo clean
cargo build
```
