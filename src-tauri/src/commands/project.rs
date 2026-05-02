use crate::db::sqlite::Database;
use tauri::State;

#[tauri::command]
pub async fn save_project(
    db: State<'_, Database>,
    name: String,
    data: serde_json::Value,
) -> Result<(), String> {
    let data_str = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    db.save_project(&name, &data_str).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_project(
    db: State<'_, Database>,
    name: String,
) -> Result<serde_json::Value, String> {
    let record = db
        .load_project(&name)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", name))?;

    let data: serde_json::Value =
        serde_json::from_str(&record.data).map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn list_projects(
    db: State<'_, Database>,
) -> Result<Vec<serde_json::Value>, String> {
    let records = db.list_projects().map_err(|e| e.to_string())?;
    let projects: Vec<serde_json::Value> = records
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "name": r.name,
                "createdAt": r.created_at,
                "updatedAt": r.updated_at,
            })
        })
        .collect();
    Ok(projects)
}

#[tauri::command]
pub async fn delete_project(
    db: State<'_, Database>,
    name: String,
) -> Result<(), String> {
    db.delete_project(&name).map_err(|e| e.to_string())
}
