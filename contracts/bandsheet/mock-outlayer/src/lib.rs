//! Stand-in for outlayer.testnet (testnet and sandbox only). `request_execution` returns the response
//! staged with `set_response` (or computed by `set_echo`), records the last input, and refunds the
//! unused deposit like the real one. Never part of a production path.
use near_sdk::serde_json::{self, Value};
use near_sdk::{env, near, NearToken, PanicOnDefault, Promise};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MockOutlayer {
    responses: Vec<String>,
    last_input: String,
    calls: u32,
}

#[near]
impl MockOutlayer {
    #[init]
    pub fn new() -> Self {
        Self { responses: Vec::new(), last_input: String::new(), calls: 0 }
    }

    /// Queue a response; each call to `request_execution` pops the oldest (the last one is reused).
    pub fn push_response(&mut self, response: String) {
        self.responses.push(response);
    }

    pub fn clear_responses(&mut self) {
        self.responses.clear();
    }

    #[payable]
    pub fn request_execution(
        &mut self,
        source: Value,
        input_data: Option<String>,
        resource_limits: Option<Value>,
        secrets_ref: Option<Value>,
        response_format: Option<Value>,
        payer_account_id: Option<near_sdk::AccountId>,
        params: Option<Value>,
    ) -> Option<Value> {
        let _ = (source, resource_limits, secrets_ref, response_format, params);
        self.last_input = input_data.unwrap_or_default();
        self.calls += 1;
        let dep = env::attached_deposit().as_yoctonear();
        let used = 1_000_000_000_000_000_000_000u128;
        if dep > used {
            let to = payer_account_id.unwrap_or_else(env::predecessor_account_id);
            Promise::new(to).transfer(NearToken::from_yoctonear(dep - used)).detach();
        }
        if self.responses.is_empty() {
            return None;
        }
        let r = if self.responses.len() > 1 { self.responses.remove(0) } else { self.responses[0].clone() };
        serde_json::from_str(&r).ok()
    }

    pub fn get_last_input(&self) -> String {
        self.last_input.clone()
    }

    pub fn get_calls(&self) -> u32 {
        self.calls
    }
}
