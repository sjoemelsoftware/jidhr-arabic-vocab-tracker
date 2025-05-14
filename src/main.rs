mod lemmatizer;

use anyhow::Result;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Debug, Deserialize)]
struct LemmatizeRequest {
    text: String,
}

#[derive(Debug, Deserialize)]
struct UpdateKnownRequest {
    text: String,
    unknown_words: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct VocabQuery {
    after: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateLemmaPartsRequest {
    parts: Vec<LemmaPartUpdate>,
}

#[derive(Debug, Deserialize)]
struct LemmaPartUpdate {
    part: String,
    is_known: bool,
}

#[derive(Debug, Serialize)]
struct LemmatizeResponse {
    lemmatized_text: String,
    words: Vec<WordLemma>,
}

#[derive(Debug, Serialize)]
struct CheckResponse {
    lemmatized_text: String,
    words: Vec<WordLemmaStatus>,
}

#[derive(Debug, Serialize)]
struct WordLemma {
    word: String,
    lemma: String,
    lemma_parts: Vec<String>,
}

#[derive(Debug, Serialize)]
struct WordLemmaStatus {
    word: String,
    lemma: String,
    lemma_parts: Vec<LemmaPartStatus>,
    is_known: bool,
}

#[derive(Debug, Serialize)]
struct LemmaPartStatus {
    part: String,
    is_known: bool,
    count: i64,
}

#[derive(Debug, Serialize)]
struct VocabEntry {
    lemma_part: String,
    is_known: bool,
    count: i64,
    last_seen: Option<String>,
}

struct AppState {
    db: SqlitePool,
    lemmatizer: Arc<lemmatizer::Lemmatizer>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Set database URL for sqlx macros
    std::env::set_var("DATABASE_URL", "sqlite:vocabulary.db");

    // Initialize database
    let db = SqlitePool::connect("sqlite:vocabulary.db").await?;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to run migrations: {}", e))?;

    // Initialize lemmatizer with the JAR file path
    let jar_path = std::path::Path::new("dist/farasaSeg.jar")
        .canonicalize()?
        .to_string_lossy()
        .into_owned();
    let lemmatizer = Arc::new(lemmatizer::Lemmatizer::new(jar_path));

    let state = Arc::new(AppState { db, lemmatizer });

    // Build our application with routes
    let app = Router::new()
        .route("/lemmatize", post(lemmatize))
        .route("/check", post(check))
        .route("/update-known", put(update_known))
        .route("/update-parts", put(update_lemma_parts))
        .route("/vocab", get(get_vocab))
        .route("/vocab/known", get(get_known_vocab))
        .route("/vocab/unknown", get(get_unknown_vocab))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Run it
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8000").await?;
    tracing::info!("listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn lemmatize(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LemmatizeRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Lemmatize the text
    let result = state
        .lemmatizer
        .lemmatize(&payload.text)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Convert to response format
    let words = result
        .word_lemma_map
        .iter()
        .map(|(word, lemma, lemma_parts)| WordLemma {
            word: word.clone(),
            lemma: lemma.clone(),
            lemma_parts: lemma_parts.clone(),
        })
        .collect::<Vec<_>>();

    let response = LemmatizeResponse {
        lemmatized_text: result.lemmatized_text,
        words,
    };

    // Store lemma parts in database
    for (_, _, lemma_parts) in result.word_lemma_map {
        for part in lemma_parts {
            sqlx::query!(
                r#"
                INSERT INTO lemmas (lemma_part, count)
                VALUES (?, 1)
                ON CONFLICT(lemma_part) DO UPDATE SET
                    count = count + 1,
                    last_seen = CURRENT_TIMESTAMP
                "#,
                part
            )
            .execute(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    Ok(Json(response))
}

async fn check(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LemmatizeRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Lemmatize the text
    let result = state
        .lemmatizer
        .lemmatize(&payload.text)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Convert to response format with status
    let mut words = Vec::new();
    for (word, lemma, lemma_parts) in result.word_lemma_map {
        let mut part_statuses = Vec::new();
        let mut all_parts_known = true;
        for part in lemma_parts {
            let status = sqlx::query!(
                r#"
                SELECT is_known, count FROM lemmas WHERE lemma_part = ?
                "#,
                part
            )
            .fetch_optional(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let (is_known, count) = status
                .map(|s| (s.is_known != false, s.count))
                .unwrap_or((false, 0));

            if !is_known {
                all_parts_known = false;
            }

            part_statuses.push(LemmaPartStatus {
                part,
                is_known,
                count,
            });
        }

        words.push(WordLemmaStatus {
            word,
            lemma,
            lemma_parts: part_statuses,
            is_known: all_parts_known,
        });
    }

    let response = CheckResponse {
        lemmatized_text: result.lemmatized_text,
        words,
    };

    Ok(Json(response))
}

async fn update_known(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateKnownRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Lemmatize the text
    let result = state
        .lemmatizer
        .lemmatize(&payload.text)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create a set of unknown words for quick lookup
    let unknown_words: std::collections::HashSet<_> = payload.unknown_words.into_iter().collect();

    // Update lemma parts in database
    for (word, _, lemma_parts) in result.word_lemma_map {
        let is_unknown = unknown_words.contains(&word);
        let is_known = !is_unknown;
        for part in lemma_parts {
            sqlx::query!(
                r#"
                INSERT INTO lemmas (lemma_part, is_known, count)
                VALUES (?, ?, 1)
                ON CONFLICT(lemma_part) DO UPDATE SET
                    is_known = ?,
                    count = count + 1,
                    last_seen = CURRENT_TIMESTAMP
                "#,
                part,
                is_known,
                is_known
            )
            .execute(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    Ok(StatusCode::OK)
}

async fn update_lemma_parts(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateLemmaPartsRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Update lemma parts in database
    for part_update in payload.parts {
        sqlx::query!(
            r#"
            INSERT INTO lemmas (lemma_part, is_known, count)
            VALUES (?, ?, 1)
            ON CONFLICT(lemma_part) DO UPDATE SET
                is_known = ?,
                count = count + 1,
                last_seen = CURRENT_TIMESTAMP
            "#,
            part_update.part,
            part_update.is_known,
            part_update.is_known
        )
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(StatusCode::OK)
}

async fn get_vocab(
    State(state): State<Arc<AppState>>,
    Query(query): Query<VocabQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let entries = sqlx::query!(
        r#"
        SELECT lemma_part, is_known, count, last_seen
        FROM lemmas
        WHERE (? IS NULL OR last_seen > ?)
        ORDER BY last_seen DESC
        "#,
        query.after,
        query.after
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let vocab: Vec<VocabEntry> = entries
        .into_iter()
        .map(|row| VocabEntry {
            lemma_part: row.lemma_part,
            is_known: row.is_known,
            count: row.count,
            last_seen: row.last_seen.map(|dt| dt.to_string()),
        })
        .collect();

    Ok(Json(vocab))
}

async fn get_known_vocab(
    State(state): State<Arc<AppState>>,
    Query(query): Query<VocabQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let entries = sqlx::query!(
        r#"
        SELECT lemma_part, is_known, count, last_seen
        FROM lemmas
        WHERE is_known = 1 AND (? IS NULL OR last_seen > ?)
        ORDER BY last_seen DESC
        "#,
        query.after,
        query.after
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let vocab: Vec<VocabEntry> = entries
        .into_iter()
        .map(|row| VocabEntry {
            lemma_part: row.lemma_part,
            is_known: row.is_known != false,
            count: row.count,
            last_seen: row.last_seen.map(|dt| dt.to_string()),
        })
        .collect();

    Ok(Json(vocab))
}

async fn get_unknown_vocab(
    State(state): State<Arc<AppState>>,
    Query(query): Query<VocabQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let entries = sqlx::query!(
        r#"
        SELECT lemma_part, is_known, count, last_seen
        FROM lemmas
        WHERE is_known = 0 AND (? IS NULL OR last_seen > ?)
        ORDER BY last_seen DESC
        "#,
        query.after,
        query.after
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let vocab: Vec<VocabEntry> = entries
        .into_iter()
        .map(|row| VocabEntry {
            lemma_part: row.lemma_part,
            is_known: row.is_known != false,
            count: row.count,
            last_seen: row.last_seen.map(|dt| dt.to_string()),
        })
        .collect();

    Ok(Json(vocab))
}
