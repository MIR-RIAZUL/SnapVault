use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SnapVaultError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Lock error: {0}")]
    Lock(String),

    #[error("General error: {0}")]
    General(String),
}

impl Serialize for SnapVaultError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, SnapVaultError>;
