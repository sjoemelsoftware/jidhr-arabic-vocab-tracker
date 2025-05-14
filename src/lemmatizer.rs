use anyhow::{Context, Result};
use std::io::{BufRead, BufReader, Write};
use std::process::{ChildStderr, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};
use tokio::sync::OnceCell;
use tracing::info;

pub struct Lemmatizer {
    child: Arc<OnceCell<Mutex<ChildProcess>>>,
    jar_path: String,
}

struct ChildProcess {
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    stderr: BufReader<ChildStderr>,
}

#[derive(Debug)]
pub struct LemmatizeResult {
    pub lemmatized_text: String,
    pub word_lemma_map: Vec<(String, String, Vec<String>)>,
}

impl Lemmatizer {
    pub fn new(jar_path: String) -> Self {
        info!("lemmatizer: initializing with jar at {}", jar_path);
        Self {
            child: Arc::new(OnceCell::new()),
            jar_path,
        }
    }

    pub async fn ensure_initialized(&self) -> Result<()> {
        self.child
            .get_or_try_init(|| async {
                info!("lemmatizer: starting Java process");

                // Start Java process with all output visible
                let mut child = Command::new("java")
                    .arg("-jar")
                    .arg(&self.jar_path)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped()) // Show stderr in console
                    .spawn()
                    .context("Failed to start Java process")?;

                let stdin = child.stdin.take().context("Failed to open stdin")?;
                let stdout = child.stdout.take().context("Failed to open stdout")?;
                let stderr = child.stderr.take().context("Failed to open stderr")?;

                let mut stdout_reader = BufReader::new(stdout);
                let mut stderr_reader = BufReader::new(stderr);

                // Wait for "System ready!"
                let mut line = String::new();
                loop {
                    line.clear();
                    let bytes_read = stderr_reader
                        .read_line(&mut line)
                        .context("Failed to read from Java process")?;

                    if bytes_read == 0 {
                        return Err(anyhow::anyhow!("Java process exited unexpectedly"));
                    }

                    info!("lemmatizer: {}", line.trim());
                    if line.contains("System ready!") {
                        break;
                    }
                }

                Ok::<Mutex<ChildProcess>, anyhow::Error>(Mutex::new(ChildProcess {
                    stdin,
                    stdout: stdout_reader,
                    stderr: stderr_reader,
                }))
            })
            .await?;
        Ok(())
    }

    pub async fn lemmatize(&self, text: &str) -> Result<LemmatizeResult> {
        self.ensure_initialized().await?;

        let child = self.child.get().unwrap();
        let mut child = child.lock().unwrap();

        // Filter out punctuation before lemmatizing
        let filtered_text: String = text
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect();

        info!("lemmatizer: input: {}", filtered_text);

        // Send input to Java process
        writeln!(child.stdin, "{}", filtered_text)?;
        child.stdin.flush()?;

        // Read response
        let mut response = String::new();
        let mut line = String::new();

        loop {
            line.clear();
            if child.stdout.read_line(&mut line)? == 0 {
                return Err(anyhow::anyhow!("Java process exited unexpectedly"));
            }

            let trimmed = line.trim();
            info!("lemmatizer: {}", trimmed);

            if !trimmed.is_empty() && !trimmed.contains("System ready!") {
                response = trimmed.to_string();
                break;
            }
        }

        // Create word-lemma mapping
        let words: Vec<&str> = filtered_text.split_whitespace().collect();
        let lemmas: Vec<&str> = response.split_whitespace().collect();

        let word_lemma_map = if words.len() == lemmas.len() {
            words
                .iter()
                .zip(lemmas.iter())
                .map(|(&word, &lemma)| {
                    let lemma_parts: Vec<String> = lemma.split('+').map(String::from).collect();
                    (word.to_string(), lemma.to_string(), lemma_parts)
                })
                .collect()
        } else {
            info!("lemmatizer: mismatch between input words ({}) and lemmas ({}), returning empty map", words.len(), lemmas.len());
            Vec::new()
        };

        Ok(LemmatizeResult {
            lemmatized_text: response,
            word_lemma_map,
        })
    }
}
