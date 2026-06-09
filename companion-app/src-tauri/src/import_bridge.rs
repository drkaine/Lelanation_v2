//! Local HTTP bridge for companion ↔ prod iframe communication.
//!
//! - `POST /import` — build JSON from iframe (fetch or relay)
//! - `GET /embed?url=…` — relay shell: prod iframe → postMessage → POST /import

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const IMPORT_BRIDGE_PORT: u16 = 17321;

static STARTED: AtomicBool = AtomicBool::new(false);

pub fn start(app: AppHandle) {
    if STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    thread::spawn(move || run_server(app));
}

fn run_server(app: AppHandle) {
    let addr = format!("127.0.0.1:{IMPORT_BRIDGE_PORT}");
    let listener = loop {
        match TcpListener::bind(&addr) {
            Ok(l) => break l,
            Err(e) => {
                let _ = &e;
                thread::sleep(Duration::from_secs(2));
            }
        }
    };
    for stream in listener.incoming().flatten() {
        let app = app.clone();
        thread::spawn(move || {
            if let Err(e) = handle_client(stream, app) {
                let _ = &e;
            }
        });
    }
}

fn handle_client(mut stream: TcpStream, app: AppHandle) -> Result<(), String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(8)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(8)))
        .map_err(|e| e.to_string())?;

    let mut buf = vec![0u8; 256 * 1024];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    if n == 0 {
        return Ok(());
    }
    let req = String::from_utf8_lossy(&buf[..n]);
    let request_line = req.lines().next().unwrap_or("");
    let method = request_line.split_whitespace().next().unwrap_or("");
    let path_with_query = request_line.split_whitespace().nth(1).unwrap_or("/");
    let path = path_with_query.split('?').next().unwrap_or("/");

    let mut content_length = 0usize;
    for line in req.lines().skip(1) {
        if line.is_empty() {
            break;
        }
        let lower = line.to_ascii_lowercase();
        if lower.starts_with("content-length:") {
            content_length = line[15..].trim().parse().unwrap_or(0);
        }
    }

    if method == "OPTIONS" {
        write_response(&mut stream, 204, "text/plain", "")?;
        return Ok(());
    }

    if method == "GET" && path == "/embed" {
        let target = query_param(path_with_query, "url").unwrap_or_default();
        if !is_allowed_embed_target(&target) {
            write_response(&mut stream, 400, "text/plain", "invalid embed url")?;
            return Ok(());
        }
        let html = embed_shell_html(&target);
        write_response(&mut stream, 200, "text/html; charset=utf-8", &html)?;
        return Ok(());
    }

    if method == "POST" && path == "/import" {
        return handle_import_post(&mut stream, &req, n, content_length, app);
    }

    write_response(&mut stream, 404, "application/json", r#"{"error":"not found"}"#)?;
    Ok(())
}

fn handle_import_post(
    stream: &mut TcpStream,
    req: &str,
    n: usize,
    content_length: usize,
    app: AppHandle,
) -> Result<(), String> {
    let body_start = req.find("\r\n\r\n").map(|i| i + 4).unwrap_or(0);
    let mut body = req[body_start..].to_string();
    if content_length > body.len() && body_start + content_length <= n {
        body = req[body_start..body_start + content_length].to_string();
    }

    if body.trim().is_empty() {
        write_response(stream, 400, "application/json", r#"{"error":"empty body"}"#)?;
        return Ok(());
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("invalid json: {e}"))?;
    let build = parsed
        .get("build")
        .cloned()
        .unwrap_or_else(|| parsed.clone());

    app.emit(
        "companion-import-build",
        serde_json::json!({ "build": build, "via": "http-bridge" }),
    )
    .map_err(|e| e.to_string())?;

    write_response(stream, 200, "application/json", r#"{"ok":true}"#)?;
    Ok(())
}

fn is_allowed_embed_target(url: &str) -> bool {
    let url = url.trim();
    if url.is_empty() {
        return false;
    }
    let lower = url.to_ascii_lowercase();
    if !lower.starts_with("https://") && !lower.starts_with("http://") {
        return false;
    }
    lower.contains("lelanation.fr")
        || lower.starts_with("http://localhost")
        || lower.starts_with("http://127.0.0.1")
}

fn embed_shell_html(target_url: &str) -> String {
    let safe_src = html_attr_escape(target_url);
    let port = IMPORT_BRIDGE_PORT;
    format!(
        r#"<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lelanation embed relay</title>
  <style>html,body,#site{{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0a1428}}</style>
  <script>
    (function () {{
      var BRIDGE = "http://127.0.0.1:{port}/import";
      function forwardBuild(build) {{
        if (!build) return;
        fetch(BRIDGE, {{
          method: "POST",
          mode: "cors",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{ build: build }}),
        }}).catch(function (err) {{
          console.warn("[lelanation-embed-relay]", err);
        }});
      }}
      function relayImport(data) {{
        var build = data && data.payload && data.payload.build ? data.payload.build : null;
        if (!build) return;
        forwardBuild(build);
      }}
      window.addEventListener(
        "message",
        function (ev) {{
          var data = ev.data;
          if (!data) return;
          if (data.type === "lelanation:companion-import-build" || data.type === "lelanation:companion-proxy-import") {{
            relayImport(data);
          }}
        }},
        true
      );
    }})();
  </script>
</head>
<body>
  <iframe id="site" src="{safe_src}" title="Lelanation" loading="eager"></iframe>
</body>
</html>"#
    )
}

fn html_attr_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn query_param(path_with_query: &str, key: &str) -> Option<String> {
    let query = path_with_query.split_once('?')?.1;
    let prefix = format!("{key}=");
    for part in query.split('&') {
        if let Some(raw) = part.strip_prefix(&prefix) {
            return Some(percent_decode(raw));
        }
    }
    None
}

fn percent_decode(input: &str) -> String {
    let mut out = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""),
                16,
            ) {
                out.push(byte);
                i += 3;
                continue;
            }
        } else if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn write_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &str,
) -> Result<(), String> {
    let status_text = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "Error",
    };
    let response = format!(
        "HTTP/1.1 {status} {status_text}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type\r\n\
         Content-Type: {content_type}\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n{body}",
        body.len()
    );
    stream
        .write_all(response.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_lelanation_embed() {
        assert!(is_allowed_embed_target(
            "https://www.lelanation.fr/builds?app=on"
        ));
        assert!(!is_allowed_embed_target("https://evil.example/phish"));
    }

    #[test]
    fn decodes_query_url() {
        let path = "/embed?url=https%3A%2F%2Fwww.lelanation.fr%2Fbuilds";
        assert_eq!(
            query_param(path, "url").as_deref(),
            Some("https://www.lelanation.fr/builds")
        );
    }
}
