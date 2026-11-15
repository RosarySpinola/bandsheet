//! Sandbox: create -> join -> submit -> propose -> vote -> engine run (mock OutLayer) -> release, with real access
//! keys, real cross-contract calls and a real joint callback for the DKIM count run.
use near_workspaces::types::{Gas, KeyType, SecretKey};
use near_workspaces::{Account, Contract};
use serde_json::{json, Value};

const UNITS_WASM: &str = "../out/bandsheet_units.wasm";
const MOCK_WASM: &str = "../../bandsheet/out/mock_outlayer.wasm";
/// invite code = hex sha256("sandbox-link-secret"); the unit stores hex sha256(invite code).
const CODE: &str = "817e0e35f1e4a352a00b2eb0632bd700b76a180e2fa301d6a2ccecca203a2060";
const CODE_HASH: &str = "a34124e4238b812497b96d0a2e96636a13c7000337b5caa98b25fbb691ccea46";
const RSA: &str = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwYQbPBZJmFq1ZaRZ8n3t2hT5t7kQ0hM9bZcVY2xg1Y3nJ0dI4ZfJp7r8Kq4m2s7N2wQ1kq9Vb3rX5Y8nU4cR8e6hD1yT2pS0fG3jK5lM7nO9qR2tU4vW6xY8zA0bC2dE4fG6hI8jK0lM2nO4pQ6rS8tU0vW2xY4zA6bC8dE0fG2hI4jK6lM8nO0pQ2rS4tU6vW8xY0zA2bC4dE6fG8hI0jK2lM4nO6pQ8rS0tU2vW4xY6zA8bC0dE2fG4hI6jK8lM0nO2pQ4rS6tU8vW0xY2zA4bC6dE8fG0hI2jK4lM6nO8pQ0rS2tU4vW6xY8zA0bC2dE4fG6hI8jK0lM2nO4pQ6rS8tU0vW2xQIDAQAB";

struct Env {
    units: Contract,
    mock: Contract,
    registrar: Account,
    alice: Account,
    bob: Account,
    outsider: Account,
    worker: near_workspaces::Worker<near_workspaces::network::Sandbox>,
}

async fn setup() -> anyhow::Result<Env> {
    let worker = near_workspaces::sandbox().await?;
    let registrar = worker.dev_create_account().await?;
    let alice = worker.dev_create_account().await?;
    let bob = worker.dev_create_account().await?;
    let outsider = worker.dev_create_account().await?;
    let units = worker.dev_deploy(&std::fs::read(UNITS_WASM)?).await?;
    let mock = worker.dev_deploy(&std::fs::read(MOCK_WASM)?).await?;
    mock.call("new").transact().await?.into_result()?;
    let outlayer = json!({"account": mock.id(), "source": r#"{"Project":{"project_id":"bandsheet-enclave.testnet/bandsheet-enclave","version_key":null}}"#,
        "secrets_ref": r#"{"profile":"default","account_id":"bandsheet-enclave.testnet"}"#, "run_deposit": "50000000000000000000000"});
    // init is private: another account cannot initialise the contract with its own registrar
    let r = outsider.call(units.id(), "new")
        .args_json(json!({"owner": outsider.id(), "k": 3, "enclave_pubkey": "x", "wasm_sha256": "69".repeat(32), "policy_hash": "53".repeat(32), "outlayer": outlayer.clone()}))
        .transact().await?;
    assert!(format!("{:?}", r.failures()).contains("private"), "{:?}", r.failures());
    units
        .call("new")
        .args_json(json!({"owner": registrar.id(), "k": 3, "enclave_pubkey": "Kn0bVgYSbpi5A3d/ldGgeVoUQr/zxTccybuYjC2JE0Y=", "wasm_sha256": "69".repeat(32), "policy_hash": "53".repeat(32), "outlayer": outlayer}))
        .transact()
        .await?
        .into_result()?;
    Ok(Env { units, mock, registrar, alice, bob, outsider, worker })
}

fn ct(tag: &str) -> Value {
    json!({"epk": tag, "nonce": "bm9uY2U=", "ct": "Y3Q="})
}

fn release_output(mean: u64) -> String {
    json!({"release_id": 1, "status": "partially_released", "cells": [{"key": {"grade": "Senior"}, "n": 5, "mean_eur": mean}],
        "suppressed": [{"key": {"grade": "Chief"}, "reason": "small_cell", "witness": "n=1 < k=3"}],
        "history": {"v": 1}, "input_hash": "aa", "output_hash": "bb", "entries_used": 6, "entries_rejected": {}})
    .to_string()
}

impl Env {
    fn posting(&self, sk: &SecretKey) -> Account {
        Account::from_secret_key(self.units.id().clone(), sk.clone(), &self.worker)
    }
    async fn join(&self, unit: u32, synthetic: bool) -> anyhow::Result<SecretKey> {
        let sk = SecretKey::from_random(KeyType::ED25519);
        let code = if synthetic { "" } else { CODE };
        self.registrar
            .call(self.units.id(), "unit_add_member")
            .args_json(json!({"unit_id": unit, "public_key": sk.public_key(), "invite_code": code, "synthetic": synthetic}))
            .transact()
            .await?
            .into_result()?;
        Ok(sk)
    }
    async fn view(&self, method: &str, args: Value) -> anyhow::Result<Value> {
        Ok(self.units.view(method).args_json(args).await?.json()?)
    }
}

#[tokio::test]
async fn create_join_submit_propose_vote_run_release() -> anyhow::Result<()> {
    let env = setup().await?;
    let unit: u32 = env.alice.call(env.units.id(), "create_unit").args_json(json!({"name": "Night desk", "invite_code_hash": CODE_HASH, "dkim_domains": []}))
        .transact().await?.into_result()?.json()?;
    assert_eq!(unit, 1);
    // a second unit, to prove isolation
    let other: u32 = env.bob.call(env.units.id(), "create_unit").args_json(json!({"name": "Other", "invite_code_hash": CODE_HASH, "dkim_domains": []}))
        .transact().await?.into_result()?.json()?;
    env.alice.call(env.units.id(), "unit_add_council").args_json(json!({"unit_id": unit, "account_id": env.bob.id()})).transact().await?.into_result()?;

    // only the registrar adds members; a wrong code is refused
    let sk = SecretKey::from_random(KeyType::ED25519);
    let r = env.alice.call(env.units.id(), "unit_add_member").args_json(json!({"unit_id": unit, "public_key": sk.public_key(), "invite_code": CODE, "synthetic": false})).transact().await?;
    assert!(format!("{:?}", r.failures()).contains("only the units registrar"));
    let r = env.registrar.call(env.units.id(), "unit_add_member").args_json(json!({"unit_id": unit, "public_key": sk.public_key(), "invite_code": CODE_HASH, "synthetic": false})).transact().await?;
    assert!(format!("{:?}", r.failures()).contains("invite code does not match"));

    // join: the posting key is a function-call key on the units account, method submit only
    let me = env.join(unit, false).await?;
    let key = env.units.as_account().view_access_key(&me.public_key()).await?;
    let perm = format!("{:?}", key.permission);
    assert!(perm.contains("FunctionCall") && perm.contains("submit"), "{perm}");
    env.posting(&me).call(env.units.id(), "submit").args_json(json!({"ciphertext": ct("mine")})).transact().await?.into_result()?;
    // a posting key cannot call anything else, and an outside wallet cannot submit
    let r = env.posting(&me).call(env.units.id(), "create_unit").args_json(json!({"name": "x", "invite_code_hash": CODE_HASH, "dkim_domains": []})).transact().await;
    assert!(r.is_err() || r.unwrap().is_failure());
    let r = env.outsider.call(env.units.id(), "submit").args_json(json!({"ciphertext": ct("fake")})).transact().await?;
    assert!(format!("{:?}", r.failures()).contains("outside the units contract"));

    // a member of the other unit submits there; it must not reach unit 1
    let theirs = env.join(other, false).await?;
    env.posting(&theirs).call(env.units.id(), "submit").args_json(json!({"ciphertext": ct("other-unit")})).transact().await?.into_result()?;

    // synthetic colleagues: flagged, single-use keys
    for i in 0..5 {
        let s = env.join(unit, true).await?;
        env.posting(&s).call(env.units.id(), "submit").args_json(json!({"ciphertext": ct(&format!("syn{i}"))})).transact().await?.into_result()?;
        if i == 0 {
            env.worker.fast_forward(2).await?;
            assert!(env.units.as_account().view_access_key(&s.public_key()).await.is_err(), "a synthetic key deletes itself after its submit");
        }
    }
    let u = env.view("get_unit", json!({"unit_id": unit})).await?;
    assert_eq!((u["members"].as_u64(), u["synthetic_members"].as_u64(), u["entries"].as_u64(), u["threshold"].as_u64()), (Some(6), Some(5), Some(6), Some(2)));

    // propose (1 of 2 seats: open), then vote (2 of 2: runs)
    env.mock.call("push_response").args_json(json!({"response": release_output(61_000)})).transact().await?.into_result()?;
    let r = env.outsider.call(env.units.id(), "unit_propose_release").args_json(json!({"unit_id": unit, "query": r#"{"group_by":["grade"]}"#})).max_gas().transact().await?;
    assert!(format!("{:?}", r.failures()).contains("not on unit 1's council"));
    let pid: u64 = env.alice.call(env.units.id(), "unit_propose_release").args_json(json!({"unit_id": unit, "query": r#"{"group_by":["grade"]}"#}))
        .gas(Gas::from_tgas(300)).transact().await?.into_result()?.json()?;
    assert_eq!(pid, 1);
    let r = env.alice.call(env.units.id(), "unit_vote").args_json(json!({"unit_id": unit, "proposal_id": pid, "approve": true})).gas(Gas::from_tgas(300)).transact().await?;
    assert!(format!("{:?}", r.failures()).contains("already voted"));
    let status: String = env.bob.call(env.units.id(), "unit_vote").args_json(json!({"unit_id": unit, "proposal_id": pid, "approve": true}))
        .gas(Gas::from_tgas(300)).transact().await?.into_result()?.json()?;
    assert_eq!(status, "running");
    for _ in 0..4 {
        env.worker.fast_forward(2).await?;
    }
    let releases = env.view("get_unit_releases", json!({"unit_id": unit})).await?;
    let rel = &releases[0];
    assert_eq!(rel["status"], "partially_released");
    assert_eq!(rel["cells"][0]["mean_eur"], 61_000);
    assert_eq!(rel["counts"], json!({"entries": 6, "synthetic": 5, "dkim_verified": 0, "self_attested": 1, "rejected": 0}));
    // the engine saw unit 1's six entries only
    let seen: Value = serde_json::from_str(&env.mock.view("get_last_input").await?.json::<String>()?)?;
    let entries = seen["entries"].to_string();
    assert_eq!(seen["entries"].as_array().unwrap().len(), 6);
    assert!(entries.contains("mine") && !entries.contains("other-unit"));
    assert_eq!(seen["policy"]["require_dkim"], false);
    let props = env.view("get_unit_proposals", json!({"unit_id": unit})).await?;
    assert_eq!(props[0]["status"], "executed");
    // voting after execution is refused
    let r = env.bob.call(env.units.id(), "unit_vote").args_json(json!({"unit_id": unit, "proposal_id": pid, "approve": false})).gas(Gas::from_tgas(300)).transact().await?;
    assert!(format!("{:?}", r.failures()).contains("voting is closed"));
    assert!(env.view("get_unit_releases", json!({"unit_id": other})).await?.as_array().unwrap().is_empty());
    Ok(())
}

#[tokio::test]
async fn a_dkim_unit_sends_a_count_run_and_records_the_verified_count() -> anyhow::Result<()> {
    let env = setup().await?;
    let unit: u32 = env.alice.call(env.units.id(), "create_unit")
        .args_json(json!({"name": "Harbour", "invite_code_hash": CODE_HASH, "dkim_domains": ["harbourcourier.example"]}))
        .transact().await?.into_result()?.json()?;
    let r = env.alice.call(env.units.id(), "unit_add_issuer")
        .args_json(json!({"unit_id": unit, "domain": "harbourcourier.example", "selector": "payroll2026", "public_key_pem_or_fingerprint": RSA, "source": "supplied"})).transact().await?;
    assert!(format!("{:?}", r.failures()).contains("only the units registrar"));
    env.registrar.call(env.units.id(), "unit_add_issuer")
        .args_json(json!({"unit_id": unit, "domain": "harbourcourier.example", "selector": "payroll2026", "public_key_pem_or_fingerprint": RSA, "source": "supplied"}))
        .transact().await?.into_result()?;
    for i in 0..3 {
        let sk = env.join(unit, false).await?;
        env.posting(&sk).call(env.units.id(), "submit").args_json(json!({"ciphertext": ct(&format!("r{i}"))})).transact().await?.into_result()?;
    }
    // the mock pops one response per call: the release, then the count run
    env.mock.call("push_response").args_json(json!({"response": release_output(52_000)})).transact().await?.into_result()?;
    env.mock.call("push_response").args_json(json!({"response": json!({"status": "refused", "cells": [], "suppressed": [], "entries_verified": 2,
        "rejections": [{"reason": "no_email", "count": 1}]}).to_string()})).transact().await?.into_result()?;
    let pid: u64 = env.alice.call(env.units.id(), "unit_propose_release").args_json(json!({"unit_id": unit, "query": r#"{"group_by":["grade"]}"#}))
        .gas(Gas::from_tgas(300)).transact().await?.into_result()?.json()?;
    for _ in 0..4 {
        env.worker.fast_forward(2).await?;
    }
    assert_eq!(env.mock.view("get_calls").await?.json::<u32>()?, 2);
    let seen: Value = serde_json::from_str(&env.mock.view("get_last_input").await?.json::<String>()?)?;
    assert_eq!(seen["policy"]["require_dkim"], true, "the second call is the count run");
    assert_eq!(seen["query"]["filter"]["grade"], "(dkim count only)");
    let rel = &env.view("get_unit_releases", json!({"unit_id": unit})).await?[0];
    assert_eq!(rel["proposal_id"], pid);
    assert_eq!(rel["status"], "partially_released");
    assert_eq!(rel["counts"]["dkim_verified"], 2);
    assert_eq!(rel["counts"]["self_attested"], 1);
    assert_eq!(rel["dkim_rejections"][0]["reason"], "no_email");
    Ok(())
}
