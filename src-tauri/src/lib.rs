use std::collections::HashMap;
use std::fs;
use std::io::{Cursor, Write as IoWrite};
use std::path::PathBuf;

use spellbook_core::*;
use serde_json::Value;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const REPO: &str = "evyatarmitz/spell-book";

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_library_dir() -> Option<String> {
    read_library_dir().map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn set_library_dir(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.exists() { return Err(format!("Path does not exist: {}", path)); }
    write_library_dir(&p)?;
    Ok(path)
}

#[tauri::command]
fn get_entries() -> Result<Vec<Entry>, String> {
    read_catalog(&require_library_dir()?)
}

#[tauri::command]
fn get_entry(id: String) -> Result<EntryWithSource, String> {
    let lib = require_library_dir()?;
    let entry = read_catalog(&lib)?
        .into_iter()
        .find(|e| e.id == id)
        .ok_or_else(|| format!("Entry not found: {}", id))?;
    let source_content = read_source(&lib, &entry);
    Ok(EntryWithSource { entry, source_content })
}

#[tauri::command]
fn create_entry(data: EntryInput) -> Result<EntryWithSource, String> {
    if data.name.is_empty() || data.language.is_empty() {
        return Err("name and language are required".into());
    }
    validate_id(&data.id)?;

    let lib = require_library_dir()?;
    ensure_dirs(&lib)?;
    let mut entries = read_catalog(&lib)?;

    if entries.iter().any(|e| e.id == data.id) {
        return Err(format!("Entry \"{}\" already exists", data.id));
    }

    let source_rel = format!("sources/{}.{}", data.id, get_ext(&data.language));
    fs::write(lib.join(&source_rel), &data.source_content).map_err(|e| e.to_string())?;

    let now = now_iso();
    let entry = Entry {
        id: data.id, name: data.name, r#type: data.r#type,
        language: data.language, tags: data.tags, origin: data.origin,
        touched: data.touched,
        status: if data.status.is_empty() { "experimental".into() } else { data.status },
        contract: data.contract, inputs: data.inputs, outputs: data.outputs,
        scars: data.scars, notes: data.notes, source: source_rel,
        created_at: now.clone(), updated_at: now,
    };

    let source_content = data.source_content;
    entries.push(entry.clone());
    write_catalog(&lib, &entries)?;
    Ok(EntryWithSource { entry, source_content })
}

#[tauri::command]
fn update_entry(id: String, data: Value) -> Result<EntryWithSource, String> {
    let lib = require_library_dir()?;
    let mut entries = read_catalog(&lib)?;
    let idx = entries.iter().position(|e| e.id == id)
        .ok_or_else(|| format!("Entry not found: {}", id))?;
    let existing = entries[idx].clone();

    let source_content = if let Some(sc) = data["sourceContent"].as_str() {
        fs::write(lib.join(&existing.source), sc).map_err(|e| e.to_string())?;
        sc.to_string()
    } else {
        read_source(&lib, &existing)
    };

    fn s(val: &Value, fb: &str) -> String { val.as_str().unwrap_or(fb).to_string() }
    fn v(val: &Value, fb: &[String]) -> Vec<String> {
        val.as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_else(|| fb.to_vec())
    }

    entries[idx] = Entry {
        id: existing.id,
        name: s(&data["name"], &existing.name),
        r#type: data["type"].as_str().map(String::from).or(existing.r#type),
        language: s(&data["language"], &existing.language),
        status: s(&data["status"], &existing.status),
        origin: s(&data["origin"], &existing.origin),
        touched: v(&data["touched"], &existing.touched),
        tags: v(&data["tags"], &existing.tags),
        contract: s(&data["contract"], &existing.contract),
        inputs: s(&data["inputs"], &existing.inputs),
        outputs: s(&data["outputs"], &existing.outputs),
        scars: s(&data["scars"], &existing.scars),
        notes: s(&data["notes"], &existing.notes),
        source: existing.source,
        created_at: existing.created_at,
        updated_at: now_iso(),
    };

    write_catalog(&lib, &entries)?;
    Ok(EntryWithSource { entry: entries[idx].clone(), source_content })
}

#[tauri::command]
fn delete_entry(id: String) -> Result<(), String> {
    let lib = require_library_dir()?;
    let mut entries = read_catalog(&lib)?;
    let idx = entries.iter().position(|e| e.id == id)
        .ok_or_else(|| format!("Entry not found: {}", id))?;
    let src = lib.join(&entries[idx].source);
    if src.exists() { fs::remove_file(&src).map_err(|e| e.to_string())?; }
    entries.remove(idx);
    write_catalog(&lib, &entries)
}

#[tauri::command]
async fn export_entries(ids: Vec<String>, app: tauri::AppHandle) -> Result<String, String> {
    let lib = require_library_dir()?;
    let entries = read_catalog(&lib)?;
    let selected: Vec<_> = entries.iter().filter(|e| ids.contains(&e.id)).collect();
    if selected.is_empty() { return Err("No matching entries".into()); }

    let mut by_lang: HashMap<String, Vec<(&Entry, String)>> = HashMap::new();
    for e in &selected {
        by_lang.entry(e.language.to_lowercase()).or_default().push((e, read_source(&lib, e)));
    }

    let mut buf = Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut buf);
        let opts = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        fn comment(lang: &str) -> &'static str {
            match lang { "python"|"lua"|"gdscript"|"ruby"|"shell"|"r"|"powershell" => "#", _ => "//" }
        }

        for (lang, lang_entries) in &by_lang {
            let c = comment(lang);
            let mut content = String::new();
            for (e, src) in lang_entries {
                content += &format!("{} {}\n{} Name:     {}\n{} Origin:   {}\n{} Status:   {}\n{} Contract: {}\n",
                    c, "=".repeat(72), c, e.name, c, e.origin, c, e.status, c, e.contract);
                if !e.inputs.is_empty()  { content += &format!("{} Inputs:   {}\n", c, e.inputs); }
                if !e.outputs.is_empty() { content += &format!("{} Outputs:  {}\n", c, e.outputs); }
                if !e.scars.is_empty()   { content += &format!("{} Scars:    {}\n", c, e.scars); }
                content += &format!("{} {}\n\n{}\n\n\n", c, "=".repeat(72), src.trim());
            }
            zip.start_file(format!("{}.{}", lang, get_ext(lang)), opts).map_err(|e| e.to_string())?;
            zip.write_all(content.trim_end().as_bytes()).map_err(|e| e.to_string())?;
            zip.write_all(b"\n").map_err(|e| e.to_string())?;
        }

        let mut readme = format!("# Spell Book Export\n\nGenerated: {}\n\n## Entries\n\n", now_iso());
        for e in &selected { readme += &format!("- **{}** ({}) — {}\n", e.name, e.language, e.contract); }
        zip.start_file("README.md", opts).map_err(|e| e.to_string())?;
        zip.write_all(readme.as_bytes()).map_err(|e| e.to_string())?;
        zip.finish().map_err(|e| e.to_string())?;
    }

    let save_path = tauri_plugin_dialog::DialogExt::dialog(&app)
        .file()
        .add_filter("ZIP archive", &["zip"])
        .set_file_name("spellbook-export.zip")
        .blocking_save_file();

    match save_path {
        Some(fp) => {
            let pb = fp.into_path().map_err(|e| e.to_string())?;
            fs::write(&pb, buf.into_inner()).map_err(|e| e.to_string())?;
            Ok(pb.to_string_lossy().into_owned())
        }
        None => Err("Export cancelled".into()),
    }
}

// ── Updater ───────────────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    current: String,
    latest: String,
    up_to_date: bool,
    release_url: String,
}

#[tauri::command]
fn check_for_updates() -> Result<UpdateInfo, String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", REPO);
    let resp: Value = ureq::get(&url)
        .set("User-Agent", "spell-book-app")
        .call()
        .map_err(|e| format!("Network error: {}", e))?
        .into_json()
        .map_err(|e| format!("Parse error: {}", e))?;

    let tag = resp["tag_name"].as_str().ok_or("No tag_name in response")?;
    let latest = tag.trim_start_matches('v').to_string();
    let release_url = resp["html_url"].as_str().unwrap_or("").to_string();

    Ok(UpdateInfo {
        up_to_date: latest == APP_VERSION,
        current: APP_VERSION.to_string(),
        latest,
        release_url,
    })
}

#[tauri::command]
fn open_url(url: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    app.shell().open(&url, None).map_err(|e| e.to_string())
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_library_dir, set_library_dir,
            get_entries, get_entry, create_entry, update_entry, delete_entry,
            export_entries, check_for_updates, open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
