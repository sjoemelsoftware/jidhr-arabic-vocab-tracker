mod lemmatizer;

use anyhow::Result;
use axum::{
    extract::State,
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
}

#[derive(Debug, Serialize)]
struct WordLemmaStatus {
    word: String,
    lemma: String,
    status: Option<String>,
    attempt_count: Option<i64>,
    correct_count: Option<i64>,
    streak: Option<i64>,
}

#[derive(Debug, Serialize)]
struct VocabularyEntry {
    lemma: String,
    status: String,
    first_seen_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateVocabularyRequest {
    #[serde(deserialize_with = "validate_status")]
    status: String,
    lemmas: Vec<String>,
}

fn validate_status<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s: String = serde::Deserialize::deserialize(deserializer)?;
    match s.as_str() {
        "new" | "learning" | "known" | "ignored" => Ok(s),
        _ => Err(serde::de::Error::custom(
            "Invalid status. Must be one of: new, learning, known, ignored",
        )),
    }
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

    // Get port from environment variable or use default
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8000);

    // Set database URL for sqlx macros
    let database_url = "sqlite:vocabulary.db";
    std::env::set_var("DATABASE_URL", database_url);

    // Initialize database
    let db = SqlitePool::connect(database_url).await?;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to run migrations: {}", e))?;

    // Initialize lemmatizer with the JAR file path from environment or default
    let jar_path = std::env::var("FARASA_JAR_PATH")
        .unwrap_or_else(|_| "dist/FarasaSegmenterJar.jar".to_string());

    let jar_path = std::path::Path::new(&jar_path)
        .canonicalize()
        .map_err(|e| anyhow::anyhow!("Failed to find JAR file at {}: {}", jar_path, e))?
        .to_string_lossy()
        .into_owned();

    tracing::info!("Using Farasa JAR at: {}", jar_path);
    let lemmatizer = Arc::new(lemmatizer::Lemmatizer::new(jar_path));

    let state = Arc::new(AppState { db, lemmatizer });

    // Build our application with routes
    let app = Router::new()
        .route("/lemmatize", post(lemmatize))
        .route("/check", post(check))
        .route("/vocabulary", get(get_all_vocabulary))
        .route("/vocabulary/:status", get(get_vocabulary_by_status))
        .route("/vocabulary", put(update_vocabulary))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Run it with configured port
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await?;
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
        .into_iter()
        .map(|(word, lemma)| WordLemma { word, lemma })
        .collect::<Vec<_>>();

    let response = LemmatizeResponse {
        lemmatized_text: result.lemmatized_text,
        words,
    };

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
    for (word, lemma) in result.word_lemma_map {
        let vocab = sqlx::query!(
            r#"
            SELECT v.status
            FROM vocabulary v
            WHERE v.lemma = ?
            "#,
            lemma
        )
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        words.push(WordLemmaStatus {
            word,
            lemma,
            status: vocab.map(|v| v.status).or(Some("new".to_string())),
            attempt_count: None,
            correct_count: None,
            streak: None,
        });
    }

    let response = CheckResponse {
        lemmatized_text: result.lemmatized_text,
        words,
    };

    Ok(Json(response))
}

async fn get_all_vocabulary(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let rows = sqlx::query!(
        r#"
        SELECT v.lemma, v.status, v.first_seen_at
        FROM vocabulary v
        JOIN lemmas l ON l.lemma = v.lemma
        "#
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let vocabulary: Vec<VocabularyEntry> = rows
        .into_iter()
        .map(|row| VocabularyEntry {
            lemma: row.lemma.unwrap(),
            status: row.status,
            first_seen_at: row.first_seen_at.map(|dt| dt.to_string()),
        })
        .collect();

    Ok(Json(vocabulary))
}

async fn get_vocabulary_by_status(
    State(state): State<Arc<AppState>>,
    status: axum::extract::Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Validate status
    if !["new", "learning", "known", "ignored"].contains(&status.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "Invalid status".to_string()));
    }

    let rows = sqlx::query!(
        r#"
        SELECT v.lemma,
               v.status, v.first_seen_at
        FROM vocabulary v
        WHERE v.status = ?
        "#,
        status.0
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let vocabulary: Vec<VocabularyEntry> = rows
        .into_iter()
        .map(|row| VocabularyEntry {
            lemma: row.lemma.unwrap(),
            status: row.status,
            first_seen_at: row.first_seen_at.map(|dt| dt.to_string()),
        })
        .collect();

    Ok(Json(vocabulary))
}

async fn update_vocabulary(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateVocabularyRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    for lemma in &payload.lemmas {
        // First ensure the lemma exists in the lemmas table
        sqlx::query!(
            r#"
            INSERT OR IGNORE INTO lemmas (lemma)
            VALUES (?)
            "#,
            lemma
        )
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        // Then update or insert the vocabulary entry
        sqlx::query!(
            r#"
            INSERT INTO vocabulary (lemma, status, first_seen_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(lemma) DO UPDATE SET
                status = ?,
                first_seen_at = COALESCE(first_seen_at, CURRENT_TIMESTAMP)
            "#,
            lemma,
            payload.status,
            payload.status
        )
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(StatusCode::OK)
}
