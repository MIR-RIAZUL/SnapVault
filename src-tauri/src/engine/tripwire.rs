use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::DatabaseManager;
use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TripwireEvaluation {
    pub triggered: bool,
    pub total_files_previous: i64,
    pub files_deleted: i64,
    pub files_modified: i64,
    pub volatility_percentage: f64,
    pub previous_snapshot_id: Option<i64>,
    pub message: String,
}

/// Evaluates deletion & modification volatility against the latest COMMITTED snapshot.
/// If volatility exceeds >20% AND >= 25 files, locks previous snapshot and returns triggered status.
pub fn evaluate_tripwire_safety_brake(
    db: &DatabaseManager,
    job_id: i64,
    files_deleted: i64,
    files_modified: i64,
) -> Result<TripwireEvaluation> {
    // 1. Fetch previous COMMITTED snapshot for this job
    let prev = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, total_files FROM snapshots 
             WHERE job_id = ?1 AND status = 'COMMITTED' 
             ORDER BY started_at DESC LIMIT 1;",
        )?;
        let mut rows = stmt.query(params![job_id])?;
        if let Some(r) = rows.next()? {
            let id: i64 = r.get(0)?;
            let total: i64 = r.get(1)?;
            Ok(Some((id, total)))
        } else {
            Ok(None)
        }
    })?;

    let (prev_id, prev_total) = match prev {
        Some(p) => p,
        None => {
            // Initial snapshot: tripwire inactive
            return Ok(TripwireEvaluation {
                triggered: false,
                total_files_previous: 0,
                files_deleted,
                files_modified,
                volatility_percentage: 0.0,
                previous_snapshot_id: None,
                message: "Initial snapshot: tripwire inactive".to_string(),
            });
        }
    };

    if prev_total <= 0 {
        return Ok(TripwireEvaluation {
            triggered: false,
            total_files_previous: 0,
            files_deleted,
            files_modified,
            volatility_percentage: 0.0,
            previous_snapshot_id: Some(prev_id),
            message: "Previous snapshot had zero files".to_string(),
        });
    }

    let changed_count = files_deleted + files_modified;
    let volatility_percentage = (changed_count as f64 / prev_total as f64) * 100.0;

    // Default safety threshold: >20% changed AND at least 25 files
    let triggered = volatility_percentage > 20.0 && changed_count >= 25;

    if triggered {
        // Lock previous clean snapshot as immutable read-only
        db.with_conn_mut(|conn| {
            conn.execute(
                "UPDATE snapshots SET is_locked_readonly = 1 WHERE id = ?1;",
                params![prev_id],
            )?;
            Ok(())
        })?;

        let message = format!(
            "TRIPWIRE ACTIVATED: {:.1}% volatility ({} changed/deleted out of {} files). Previous snapshot #{} has been locked to prevent ransomware data loss.",
            volatility_percentage, changed_count, prev_total, prev_id
        );

        Ok(TripwireEvaluation {
            triggered: true,
            total_files_previous: prev_total,
            files_deleted,
            files_modified,
            volatility_percentage,
            previous_snapshot_id: Some(prev_id),
            message,
        })
    } else {
        Ok(TripwireEvaluation {
            triggered: false,
            total_files_previous: prev_total,
            files_deleted,
            files_modified,
            volatility_percentage,
            previous_snapshot_id: Some(prev_id),
            message: format!("{:.1}% volatility is within safety bounds", volatility_percentage),
        })
    }
}

/// Unlocks a locked snapshot upon user confirmation
pub fn unlock_snapshot(db: &DatabaseManager, snapshot_id: i64) -> Result<()> {
    db.with_conn_mut(|conn| {
        conn.execute(
            "UPDATE snapshots SET is_locked_readonly = 0 WHERE id = ?1;",
            params![snapshot_id],
        )?;
        Ok(())
    })?;
    Ok(())
}
