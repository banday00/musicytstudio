use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenderTrack {
    pub id: String,
    pub title: String,
    pub path: String,
    pub duration: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenderSettings {
    pub resolution: String,       // "720p" | "1080p" | "4k"
    pub encoder: String,          // "h264_nvenc" | "h264_qsv" | "libx264"
    pub output_folder: String,
    pub output_filename: String,
    pub background_image: Option<String>,
    pub overlay_video: Option<String>,
    pub eq_bands: HashMap<String, f64>,
    pub fast_mode: bool,
    pub visualizer: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenderProgress {
    pub job_id: String,
    pub progress: f64,          // 0.0 to 100.0
    pub status: String,         // "rendering" | "done" | "error" | "cancelled"
    pub eta_seconds: f64,
    pub current_time_ms: f64,
    pub total_duration_ms: f64,
    pub message: String,
}

pub struct RenderState {
    pub active_processes: Mutex<HashMap<String, u32>>,  // job_id -> PID
}

impl RenderState {
    pub fn new() -> Self {
        RenderState {
            active_processes: Mutex::new(HashMap::new()),
        }
    }
}

fn get_resolution(res: &str) -> (u32, u32) {
    match res {
        "720p" => (1280, 720),
        "1080p" => (1920, 1080),
        "4k" | "4K" => (3840, 2160),
        _ => (1920, 1080),
    }
}

fn build_eq_filter(eq_bands: &HashMap<String, f64>) -> String {
    let band_freqs = vec![
        ("60", 60.0), ("170", 170.0), ("310", 310.0), ("600", 600.0),
        ("1000", 1000.0), ("3000", 3000.0), ("6000", 6000.0), ("14000", 14000.0),
    ];

    let filters: Vec<String> = band_freqs
        .iter()
        .filter_map(|(key, freq)| {
            let db = eq_bands.get(*key).copied().unwrap_or(0.0);
            if db.abs() > 0.01 {
                Some(format!("equalizer=f={}:width_type=o:width=2:g={}", freq, db))
            } else {
                None
            }
        })
        .collect();

    if filters.is_empty() {
        "anull".to_string()
    } else {
        filters.join(",")
    }
}

// Removed build_flare_filter

#[tauri::command]
pub async fn start_render(
    app: AppHandle,
    job_id: String,
    tracks: Vec<RenderTrack>,
    settings: RenderSettings,
) -> Result<String, String> {
    let render_state = app.state::<RenderState>();

    // Calculate total duration
    let total_duration_ms: f64 = tracks.iter().map(|t| t.duration * 1000.0).sum();

    // Create concat list file
    let temp_dir = std::env::temp_dir().join("music-content-tool");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let concat_file = temp_dir.join(format!("concat_{}.txt", &job_id));

    let mut concat_content = String::new();
    for track in &tracks {
        // Convert Windows backslashes to forward slashes for FFmpeg concat safe paths
        let formatted_path = track.path.replace("\\", "/").replace("'", "'\\''");
        concat_content.push_str(&format!("file '{}'\n", formatted_path));
    }
    std::fs::write(&concat_file, &concat_content).map_err(|e| e.to_string())?;

    // Build FFmpeg command
    let (width, height) = get_resolution(&settings.resolution);
    let eq_filter = build_eq_filter(&settings.eq_bands);
    
    // Note: Visualizer handles fast_mode override, Overlay video is separate

    let output_path = std::path::Path::new(&settings.output_folder)
        .join(&settings.output_filename);

    let mut args: Vec<String> = vec![
        "-y".to_string(),
        "-f".to_string(), "concat".to_string(),
        "-safe".to_string(), "0".to_string(),
        "-i".to_string(), concat_file.to_string_lossy().to_string(),
    ];

    // Add background image if available
    let has_bg = settings.background_image.as_ref().map_or(false, |p| std::path::Path::new(p).exists());
    if has_bg {
        if let Some(ref bg_image) = settings.background_image {
            args.extend_from_slice(&[
                "-loop".to_string(), "1".to_string(),
                "-i".to_string(), bg_image.clone(),
            ]);
        }
    } else {
        // No background image — generate a black background
        args.extend_from_slice(&[
            "-f".to_string(), "lavfi".to_string(),
            "-i".to_string(), format!("color=c=black:s={}x{}:r=1", width, height),
        ]);
    }

    // Add overlay video if available
    let mut has_overlay = false;
    if let Some(ref ovl_video) = settings.overlay_video {
        if std::path::Path::new(ovl_video).exists() {
            args.extend_from_slice(&[
                "-stream_loop".to_string(), "-1".to_string(),
                "-i".to_string(), ovl_video.clone(),
            ]);
            has_overlay = true;
        }
    }

    // Build filter complex
    let has_viz = settings.visualizer != "none" && !settings.fast_mode; // visualizer disabled in fast mode

    let audio_filter = if has_viz {
        format!("[0:a]{},aformat=fltp[a_eq];[a_eq]asplit=2[aout][a_viz]", eq_filter)
    } else {
        format!("[0:a]{},aformat=fltp[aout]", eq_filter)
    };

    let viz_filter = if has_viz {
        match settings.visualizer.as_str() {
            "waveform" => format!("[a_viz]showwaves=s=800x150:colors=white:mode=cline[viz]"),
            "eq_bars" => format!("[a_viz]showfreqs=s=800x200:mode=bar:colors=white|white:ascale=log:fscale=log[viz]"),
            _ => String::new(),
        }
    } else {
        String::new()
    };

    let mut video_filter = format!("[1:v]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2,setsar=1", width, height, width, height);

    if has_overlay {
        video_filter.push_str("[bg_scaled];");
        video_filter.push_str(&format!("[2:v]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2,setsar=1[ovl_scaled];", width, height, width, height));
        video_filter.push_str("[bg_scaled]format=gbrp[bg_rgb];[ovl_scaled]format=gbrp[ovl_rgb];[bg_rgb][ovl_rgb]blend=all_mode='screen':all_opacity=1,format=yuv420p");
    }

    if has_viz {
        video_filter.push_str("[bg_ready];");
        video_filter.push_str(&viz_filter);
        video_filter.push_str(&format!(";[bg_ready][viz]overlay=(W-w)/2:H-h-100[vout]"));
    } else {
        video_filter.push_str("[vout]");
    }

    let filter_complex = format!("{};{}", audio_filter, video_filter);

    args.extend_from_slice(&[
        "-filter_complex".to_string(), filter_complex,
        "-map".to_string(), "[vout]".to_string(),
        "-map".to_string(), "[aout]".to_string(),
    ]);

    // Encoder settings
    args.extend_from_slice(&[
        "-c:v".to_string(), settings.encoder.clone(),
    ]);

    // Ultra-Fast Mode: drop framerate to 2 FPS
    if settings.fast_mode && !has_viz {
        args.extend_from_slice(&["-r".to_string(), "2".to_string()]);
    }

    // Add encoder-specific presets
    match settings.encoder.as_str() {
        "h264_nvenc" => {
            args.extend_from_slice(&["-preset".to_string(), "p4".to_string()]);
        }
        "h264_qsv" => {
            args.extend_from_slice(&["-preset".to_string(), "medium".to_string()]);
        }
        _ => {
            args.extend_from_slice(&["-preset".to_string(), "medium".to_string()]);
        }
    }

    args.extend_from_slice(&[
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "192k".to_string(),
        "-shortest".to_string(),
        "-progress".to_string(), "pipe:1".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    // Spawn FFmpeg process
    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start FFmpeg: {}", e))?;

    let pid = child.id();

    // Store PID for cancellation
    {
        let mut processes = render_state.active_processes.lock().unwrap();
        processes.insert(job_id.clone(), pid);
    }

    // Read progress from stdout in a separate thread
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let job_id_clone = job_id.clone();
    let app_clone = app.clone();

    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        #[allow(unused_assignments)]
        let mut current_time_ms: f64 = 0.0;
        let start_time = std::time::Instant::now();

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };

            if line.starts_with("out_time_ms=") {
                if let Ok(time_us) = line.trim_start_matches("out_time_ms=").parse::<f64>() {
                    current_time_ms = time_us / 1000.0; // microseconds to milliseconds
                    let progress = if total_duration_ms > 0.0 {
                        (current_time_ms / total_duration_ms * 100.0).min(100.0)
                    } else {
                        0.0
                    };

                    let elapsed = start_time.elapsed().as_secs_f64();
                    let eta = if progress > 0.0 {
                        (elapsed / progress * 100.0) - elapsed
                    } else {
                        0.0
                    };

                    let _ = app_clone.emit("render-progress", RenderProgress {
                        job_id: job_id_clone.clone(),
                        progress,
                        status: "rendering".to_string(),
                        eta_seconds: eta.max(0.0),
                        current_time_ms,
                        total_duration_ms,
                        message: format!("Rendering... {:.1}%", progress),
                    });
                }
            }
        }
    });

    // Wait for process completion in another thread
    let job_id_done = job_id.clone();
    let app_done = app.clone();
    let stderr_stream = child.stderr.take();

    std::thread::spawn(move || {
        let mut stderr_msg = String::new();
        if let Some(mut stream) = stderr_stream {
            use std::io::Read;
            let _ = stream.read_to_string(&mut stderr_msg);
        }
        
        let exit_status = child.wait();

        // Remove from active processes
        {
            let rs = app_done.state::<RenderState>();
            let mut processes = rs.active_processes.lock().unwrap();
            processes.remove(&job_id_done);
        }

        // Cleanup concat file
        let _ = std::fs::remove_file(&concat_file);

        match exit_status {
            Ok(status) if status.success() => {
                let _ = app_done.emit("render-progress", RenderProgress {
                    job_id: job_id_done,
                    progress: 100.0,
                    status: "done".to_string(),
                    eta_seconds: 0.0,
                    current_time_ms: total_duration_ms,
                    total_duration_ms,
                    message: "Render completed successfully!".to_string(),
                });
            }
            Ok(status) => {
                let code = status.code().unwrap_or(-1);
                // Code 1 could mean cancelled
                let (status_str, msg) = if code == 1 {
                    ("cancelled".to_string(), "Render was cancelled.".to_string())
                } else {
                    ("error".to_string(), format!("FFmpeg exited with code {}", code))
                };
                let mut error_context = msg;
                if code != 1 && !stderr_msg.is_empty() {
                    // Extract last few lines of stderr for context
                    let lines: Vec<&str> = stderr_msg.lines().collect();
                    let last_lines = lines.iter().rev().take(5).rev().copied().collect::<Vec<&str>>().join(" | ");
                    error_context = format!("{} - {}", error_context, last_lines);
                }
                
                let _ = app_done.emit("render-progress", RenderProgress {
                    job_id: job_id_done,
                    progress: 0.0,
                    status: status_str,
                    eta_seconds: 0.0,
                    current_time_ms: 0.0,
                    total_duration_ms,
                    message: error_context,
                });
            }
            Err(e) => {
                let _ = app_done.emit("render-progress", RenderProgress {
                    job_id: job_id_done,
                    progress: 0.0,
                    status: "error".to_string(),
                    eta_seconds: 0.0,
                    current_time_ms: 0.0,
                    total_duration_ms,
                    message: format!("FFmpeg error: {}", e),
                });
            }
        }
    });

    Ok(job_id)
}

#[tauri::command]
pub async fn cancel_render(
    app: AppHandle,
    job_id: String,
) -> Result<(), String> {
    let render_state = app.state::<RenderState>();
    let pid = {
        let processes = render_state.active_processes.lock().unwrap();
        processes.get(&job_id).copied()
    };

    if let Some(pid) = pid {
        // On Windows, use taskkill
        #[cfg(target_os = "windows")]
        {
            Command::new("taskkill")
                .args(&["/PID", &pid.to_string(), "/F"])
                .spawn()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }

        #[cfg(not(target_os = "windows"))]
        {
            Command::new("kill")
                .args(&["-9", &pid.to_string()])
                .spawn()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }

        // Remove from tracking
        let mut processes = render_state.active_processes.lock().unwrap();
        processes.remove(&job_id);

        Ok(())
    } else {
        Err(format!("No active render process found for job {}", job_id))
    }
}

#[tauri::command]
pub async fn check_gpu_available() -> serde_json::Value {
    // Try NVIDIA
    let nvidia = Command::new("ffmpeg")
        .args(&["-hide_banner", "-encoders"])
        .output()
        .map(|output| {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let has_nvenc = stdout.contains("h264_nvenc");
            let has_qsv = stdout.contains("h264_qsv");
            (has_nvenc, has_qsv)
        })
        .unwrap_or((false, false));

    serde_json::json!({
        "nvenc": nvidia.0,
        "qsv": nvidia.1,
        "recommended": if nvidia.0 { "h264_nvenc" } else if nvidia.1 { "h264_qsv" } else { "libx264" }
    })
}
