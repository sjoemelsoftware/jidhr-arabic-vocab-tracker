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
- Java 7 or 8 (required for Farasa)
- SQLite3

## Setup

### 1. Farasa Setup

1. Download the Farasa Lemmatization module from [Farasa's website](https://farasa.qcri.org/lemmatization/)
2. Place `FarasaSegmenterJar.jar` in the `dist/` directory

   - Alternatively, set `FARASA_JAR_PATH` environment variable to your jar location

3. Test Farasa installation:

```bash
# Interactive mode
java -jar dist/FarasaSegmenterJar.jar

# Lemmatization mode
java -jar dist/FarasaSegmenterJar.jar --lemma 1
```

### 2. Database Setup

```bash
# Create the database if it doesn't exist
touch vocabulary.db

# Set the DATABASE_URL
export DATABASE_URL="sqlite:vocabulary.db"

# Install and run migrations using sqlx-cli
cargo install sqlx-cli
sqlx database create
sqlx migrate run

# Prepare SQLx queries
cargo sqlx prepare
```

## Development

For local development (default port 8000):

```bash
cargo run
```

For production build:

```bash
cargo build --release
cross build --target x86_64-unknown-linux-musl --release
```

Running the release build with custom settings:

```bash
PORT=5000 FARASA_JAR_PATH=/path/to/FarasaSegmenterJar.jar ./target/release/lemmatization
```
