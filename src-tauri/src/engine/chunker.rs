use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use fastcdc::FastCDC;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::engine::path_helper::to_extended_length_path;
use crate::error::{Result, SnapVaultError};

pub const MIN_CHUNK_SIZE: usize = 4096;      // 4 KB
pub const AVG_CHUNK_SIZE: usize = 16384;     // 16 KB
pub const MAX_CHUNK_SIZE: usize = 65536;     // 64 KB

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedChunk {
    pub hash: String,
    pub size: usize,
    pub is_new: bool,
    pub offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChunkingResult {
    pub file_hash: String,
    pub file_size: u64,
    pub chunks: Vec<ProcessedChunk>,
    pub total_chunks: usize,
    pub new_chunks: usize,
    pub new_bytes: u64,
    pub dedup_saved_bytes: u64,
}

/// Generates the 2-level directory fan-out path for a content-addressed chunk
pub fn get_chunk_relative_path(hash: &str) -> PathBuf {
    if hash.len() < 4 {
        return PathBuf::from("misc").join(format!("{}.chunk", hash));
    }
    let p1 = &hash[0..2];
    let p2 = &hash[2..4];
    PathBuf::from(p1).join(p2).join(format!("{}.chunk", hash))
}

/// Resolves the absolute chunk storage path within a destination store root
pub fn get_chunk_absolute_path(store_root: &Path, hash: &str) -> PathBuf {
    store_root.join(".snapvault").join("chunks").join(get_chunk_relative_path(hash))
}

/// Writes chunk data atomically using .tmp -> sync_all -> rename pattern
pub fn write_chunk_atomically(target_path: &Path, data: &[u8]) -> Result<bool> {
    let extended_target = to_extended_length_path(target_path);

    // If chunk already exists with identical size, it is deduplicated
    if extended_target.exists() {
        if let Ok(meta) = fs::metadata(&extended_target) {
            if meta.len() as usize == data.len() {
                return Ok(false); // Not new, deduplicated
            }
        }
    }

    let parent = extended_target.parent().ok_or_else(|| {
        SnapVaultError::General("Chunk target path missing parent directory".to_string())
    })?;
    fs::create_dir_all(parent)?;

    let temp_name = format!("{}.tmp.{}", target_path.file_name().unwrap().to_string_lossy(), Uuid::new_v4());
    let temp_path = parent.join(temp_name);

    {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)?;

        file.write_all(data)?;
        file.sync_all()?;
    }

    fs::rename(&temp_path, &extended_target)?;
    Ok(true) // Newly written
}

/// Chunks an in-memory byte buffer and stores chunks in destination root
pub fn chunk_and_store_bytes(
    data: &[u8],
    dest_store_root: &Path,
) -> Result<FileChunkingResult> {
    let file_hash = blake3::hash(data).to_hex().to_string();
    let file_size = data.len() as u64;

    let mut chunks = Vec::new();
    let mut new_chunks_count = 0;
    let mut new_bytes_count = 0u64;
    let mut dedup_saved_bytes = 0u64;

    if data.is_empty() {
        // Zero-byte file: single empty chunk
        let chunk_hash = blake3::hash(&[]).to_hex().to_string();
        let target_path = get_chunk_absolute_path(dest_store_root, &chunk_hash);
        let is_new = write_chunk_atomically(&target_path, &[])?;
        if is_new {
            new_chunks_count += 1;
        }
        chunks.push(ProcessedChunk {
            hash: chunk_hash,
            size: 0,
            is_new,
            offset: 0,
        });
    } else {
        let cdc = FastCDC::new(data, MIN_CHUNK_SIZE, AVG_CHUNK_SIZE, MAX_CHUNK_SIZE);
        for chunk in cdc {
            let chunk_data = &data[chunk.offset..chunk.offset + chunk.length];
            let chunk_hash = blake3::hash(chunk_data).to_hex().to_string();
            let target_path = get_chunk_absolute_path(dest_store_root, &chunk_hash);

            let is_new = write_chunk_atomically(&target_path, chunk_data)?;
            if is_new {
                new_chunks_count += 1;
                new_bytes_count += chunk.length as u64;
            } else {
                dedup_saved_bytes += chunk.length as u64;
            }

            chunks.push(ProcessedChunk {
                hash: chunk_hash,
                size: chunk.length,
                is_new,
                offset: chunk.offset,
            });
        }
    }

    Ok(FileChunkingResult {
        file_hash,
        file_size,
        total_chunks: chunks.len(),
        chunks,
        new_chunks: new_chunks_count,
        new_bytes: new_bytes_count,
        dedup_saved_bytes,
    })
}

/// Streams a file from disk, chunks it with FastCDC, and writes new chunks to destination.
/// If opening the file fails due to Windows sharing violation / file-lock, retries once after 500ms.
pub fn chunk_and_store_file(
    source_file_path: &Path,
    dest_store_root: &Path,
) -> Result<FileChunkingResult> {
    let extended_source = to_extended_length_path(source_file_path);

    let mut file = match File::open(&extended_source) {
        Ok(f) => f,
        Err(err) => {
            let is_locked = err.kind() == std::io::ErrorKind::PermissionDenied
                || err.raw_os_error() == Some(32)  // ERROR_SHARING_VIOLATION
                || err.raw_os_error() == Some(33); // ERROR_LOCK_VIOLATION

            if is_locked {
                // Retry once after 500ms
                std::thread::sleep(std::time::Duration::from_millis(500));
                File::open(&extended_source)?
            } else {
                return Err(SnapVaultError::Io(err));
            }
        }
    };

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;

    chunk_and_store_bytes(&buffer, dest_store_root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_fanout_relative_path() {
        let hash = "a3f9b2c810de00112233445566778899aabbccddeeff00112233445566778899";
        let path = get_chunk_relative_path(hash);
        assert_eq!(path, PathBuf::from("a3").join("f9").join(format!("{}.chunk", hash)));
    }

    #[test]
    fn test_chunk_deduplication_and_atomic_write() {
        let dir = tempdir().expect("tempdir failed");
        let data = vec![42u8; 100000]; // 100 KB uniform data

        // First pass
        let res1 = chunk_and_store_bytes(&data, dir.path()).expect("first chunking failed");
        assert!(res1.new_chunks > 0);
        assert!(res1.new_bytes > 0);
        assert_eq!(res1.dedup_saved_bytes, 0);

        // Second pass with identical data
        let res2 = chunk_and_store_bytes(&data, dir.path()).expect("second chunking failed");
        assert_eq!(res2.new_chunks, 0, "All chunks must be deduplicated in 2nd pass");
        assert_eq!(res2.new_bytes, 0);
        assert_eq!(res2.dedup_saved_bytes, data.len() as u64);
        assert_eq!(res1.file_hash, res2.file_hash);
    }
}
