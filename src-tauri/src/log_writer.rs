use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc;

use crate::protocol::types::ConsoleMessage;

/// Writes console messages to timestamped log files in the given directory.
pub async fn log_file_writer(mut log_rx: mpsc::Receiver<ConsoleMessage>, log_dir: PathBuf) {
    if let Err(e) = fs::create_dir_all(&log_dir).await {
        tracing::error!("Failed to create log directory: {e}");
        return;
    }

    // Create a log file with timestamp in name
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let filename = format!("ds-{secs}.log");
    let path = log_dir.join(&filename);

    let file = match fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .await
    {
        Ok(f) => f,
        Err(e) => {
            tracing::error!("Failed to open log file {}: {e}", path.display());
            return;
        }
    };

    tracing::info!("Logging console messages to {}", path.display());
    let mut writer = tokio::io::BufWriter::new(file);

    while let Some(msg) = log_rx.recv().await {
        let level = if msg.is_error { "ERROR" } else { "INFO" };
        let line = format!("[{:.3}] [{level}] {}\n", msg.timestamp, msg.message);
        if let Err(e) = writer.write_all(line.as_bytes()).await {
            tracing::warn!("Failed to write log: {e}");
            break;
        }
        let _ = writer.flush().await;
    }
}
