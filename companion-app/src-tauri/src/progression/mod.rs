pub mod store;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProgressionSave {
    pub updated_at_ms: i64,
    #[serde(default)]
    pub checked: HashMap<String, bool>,
    #[serde(default)]
    pub internet_auto: bool,
    #[serde(default)]
    pub notes: String,
}

const CONNECTIVITY_URL: &str = "https://www.lelanation.fr";

fn http_status_ok(status: reqwest::StatusCode) -> bool {
    status.is_success() || status.as_u16() == 204 || status.as_u16() == 304
}

fn tcp_can_reach(host: &str, port: u16) -> bool {
    use std::net::ToSocketAddrs;
    use std::time::Duration;

    let addrs: Vec<_> = match (host, port).to_socket_addrs() {
        Ok(addrs) => addrs.collect(),
        Err(_) => return false,
    };
    for addr in addrs {
        if std::net::TcpStream::connect_timeout(&addr, Duration::from_secs(4)).is_ok() {
            return true;
        }
    }
    false
}

pub fn check_internet() -> bool {
    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("LelanationCompanion/1.0")
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
    {
        Ok(c) => c,
        Err(_) => return tcp_fallback(),
    };

    for url in [
        CONNECTIVITY_URL,
        "https://clients3.google.com/generate_204",
        "https://www.cloudflare.com/cdn-cgi/trace",
    ] {
        if let Ok(resp) = client.get(url).send() {
            if http_status_ok(resp.status()) {
                return true;
            }
        }
    }

    tcp_fallback()
}

fn tcp_fallback() -> bool {
    for host in ["1.1.1.1", "8.8.8.8", "www.lelanation.fr"] {
        if tcp_can_reach(host, 443) {
            return true;
        }
    }
    false
}

pub fn apply_internet_result(data: &mut ProgressionSave, online: bool) {
    data.internet_auto = true;
    data.checked.insert("base_stable_internet".into(), online);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_internet_reaches_public_host() {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .user_agent("LelanationCompanion/1.0")
            .build()
            .expect("client");
        for url in [
            CONNECTIVITY_URL,
            "https://clients3.google.com/generate_204",
        ] {
            let resp = client.get(url).send();
            eprintln!("{url}: {resp:?}");
        }
        assert!(
            check_internet(),
            "expected check_internet() to succeed against public HTTPS endpoints"
        );
    }
}
