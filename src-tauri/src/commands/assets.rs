use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackItem {
    pub id: String,
    pub title: String,
    pub path: String,
    pub duration: f64,
    pub format: String,
}

#[tauri::command]
pub async fn scan_music_folder(folder_path: String) -> Result<Vec<TrackItem>, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Invalid directory: {}", folder_path));
    }

    let mut tracks: Vec<TrackItem> = Vec::new();
    let supported_extensions = ["mp3", "wav", "flac", "ogg", "m4a", "aac", "wma"];

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();

        if !file_path.is_file() {
            continue;
        }

        let extension = file_path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !supported_extensions.contains(&extension.as_str()) {
            continue;
        }

        let file_name = file_path
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let track = TrackItem {
            id: uuid::Uuid::new_v4().to_string(),
            title: file_name,
            path: file_path.to_string_lossy().to_string(),
            duration: estimate_duration_from_file(&file_path, &extension),
            format: extension.to_uppercase(),
        };

        tracks.push(track);
    }

    tracks.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(tracks)
}

/// Estimate duration from file size and format.
/// This is a rough estimate — accurate duration requires FFprobe or audio header parsing.
/// For MP3: ~128kbps average, so duration ≈ filesize_bytes / (128000/8)
/// For WAV: header contains sample rate and bits
/// For FLAC: similar estimation
fn estimate_duration_from_file(path: &Path, extension: &str) -> f64 {
    let metadata = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return 0.0,
    };
    let file_size = metadata.len() as f64;

    match extension {
        "mp3" => file_size / 16000.0,       // ~128kbps
        "wav" => file_size / 176400.0,       // 44.1kHz, 16bit, stereo
        "flac" => file_size / 88200.0,       // ~half of WAV due to compression
        "ogg" => file_size / 20000.0,        // ~160kbps
        "m4a" | "aac" => file_size / 16000.0,// ~128kbps
        "wma" => file_size / 16000.0,        // ~128kbps
        _ => 0.0,
    }
}

#[tauri::command]
pub async fn get_audio_duration(file_path: String) -> Result<f64, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    Ok(estimate_duration_from_file(path, &extension))
}

#[tauri::command]
pub async fn import_audio_files(file_paths: Vec<String>) -> Result<Vec<TrackItem>, String> {
    let mut tracks: Vec<TrackItem> = Vec::new();

    for file_path in file_paths {
        let path = Path::new(&file_path);
        if !path.exists() || !path.is_file() {
            continue;
        }

        let extension = path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        let file_name = path
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let track = TrackItem {
            id: uuid::Uuid::new_v4().to_string(),
            title: file_name,
            path: file_path.clone(),
            duration: estimate_duration_from_file(path, &extension),
            format: extension.to_uppercase(),
        };

        tracks.push(track);
    }

    Ok(tracks)
}

#[tauri::command]
pub async fn read_image_base64(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read image: {}", e))?;
    use base64::{Engine as _, engine::general_purpose};
    let b64 = general_purpose::STANDARD.encode(&bytes);
    
    let ext = std::path::Path::new(&path).extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    };
    
    Ok(format!("data:{};base64,{}", mime, b64))
}
