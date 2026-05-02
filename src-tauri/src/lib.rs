mod commands;
mod db;

use db::sqlite::Database;
use commands::render::RenderState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize database
            let handle = app.handle();
            let app_data_dir = handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let database = Database::new(app_data_dir)
                .expect("Failed to initialize database");

            handle.manage(database);
            handle.manage(RenderState::new());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Project commands
            commands::project::save_project,
            commands::project::load_project,
            commands::project::list_projects,
            commands::project::delete_project,
            // Asset commands
            commands::assets::scan_music_folder,
            commands::assets::get_audio_duration,
            commands::assets::import_audio_files,
            commands::assets::read_image_base64,
            // Render commands
            commands::render::start_render,
            commands::render::cancel_render,
            commands::render::check_gpu_available,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
