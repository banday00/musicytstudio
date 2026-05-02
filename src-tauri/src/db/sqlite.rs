use rusqlite::{Connection, Result as SqlResult, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectRecord {
    pub name: String,
    pub data: String,
    pub created_at: String,
    pub updated_at: String,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> SqlResult<Self> {
        let db_dir = app_data_dir.join("music-content-tool");
        std::fs::create_dir_all(&db_dir).ok();
        let db_path = db_dir.join("projects.db");

        let conn = Connection::open(db_path)?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                data TEXT NOT NULL DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TRIGGER IF NOT EXISTS update_timestamp
            AFTER UPDATE ON projects
            FOR EACH ROW
            BEGIN
                UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
            END;"
        )?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn save_project(&self, name: &str, data: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (name, data) VALUES (?1, ?2)
             ON CONFLICT(name) DO UPDATE SET data = excluded.data",
            params![name, data],
        )?;
        Ok(())
    }

    pub fn load_project(&self, name: &str) -> SqlResult<Option<ProjectRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT name, data, created_at, updated_at FROM projects WHERE name = ?1"
        )?;

        let result = stmt.query_row(params![name], |row| {
            Ok(ProjectRecord {
                name: row.get(0)?,
                data: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        });

        match result {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn list_projects(&self) -> SqlResult<Vec<ProjectRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT name, data, created_at, updated_at FROM projects ORDER BY updated_at DESC"
        )?;

        let records = stmt.query_map([], |row| {
            Ok(ProjectRecord {
                name: row.get(0)?,
                data: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(records)
    }

    pub fn delete_project(&self, name: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE name = ?1", params![name])?;
        Ok(())
    }
}
