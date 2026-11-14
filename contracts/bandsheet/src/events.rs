//! NEP-297 style log lines so an indexer or the UI can follow the union without reading state.
use near_sdk::env;

pub fn emit(event: &str, data: &str) {
    env::log_str(&format!("EVENT_JSON:{{\"standard\":\"bandsheet\",\"version\":\"1.0.0\",\"event\":\"{event}\",\"data\":{data}}}"));
}
