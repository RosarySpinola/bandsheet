use near_workspaces::{types::{NearToken, SecretKey}, Account, Contract};
use serde_json::{json, Value};

const OUT: &str = "../out";

fn ct(tag: &str) -> Value {
    json!({"epk": tag, "nonce": "bm9uY2U=", "ct": "Y3Q="})
}

fn release_output(status: &str, mean: u64) -> String {
    json!({
        "release_id": 1, "status": status,
        "cells": [{"key": {"grade": "Senior"}, "n": 4, "mean_eur": mean}],
        "suppressed": [{"key": {"grade": "Chief"}, "reason": "differencing", "witness": "Release #2 row Senior - Release #1 row Senior isolates 1 member"}],
        "history": {"v": 1}, "input_hash": "aa", "output_hash": "bb"
    })
    .to_string()
}

struct Env {
    unit: Contract,
    mock: Contract,
    owner: Account,
    dao: Account,
    outsider: Account,
    worker: near_workspaces::Worker<near_workspaces::network::Sandbox>,
}

async fn setup() -> anyhow::Result<Env> {
    let worker = near_workspaces::sandbox().await?;
    let owner = worker.dev_create_account().await?;
    let dao = worker.dev_create_account().await?;
    let outsider = worker.dev_create_account().await?;
    let unit = worker.dev_deploy(&std::fs::read(format!("{OUT}/bandsheet.wasm"))?).await?;
    let mock = worker.dev_deploy(&std::fs::read(format!("{OUT}/mock_outlayer.wasm"))?).await?;
    mock.call("new").transact().await?.into_result()?;
    unit.call("new")
        .args_json(json!({"owner": owner.id(), "dao": dao.id(), "k": 3, "enclave_pubkey": "ZW5jbGF2ZQ==", "wasm_sha256": "ab".repeat(32), "policy_hash": "cd".repeat(32)}))
        .transact().await?.into_result()?;
    owner
        .call(unit.id(), "set_outlayer")
        .args_json(json!({"account": mock.id(), "source": r#"{"Project":{"project_id":"o/p","version_key":null}}"#, "secrets_ref": "", "run_deposit": "20000000000000000000000"}))
        .transact().await?.into_result()?;
    Ok(Env { unit, mock, owner, dao, outsider, worker })
}

fn member_account(env: &Env, sk: &SecretKey) -> Account {
    Account::from_secret_key(env.unit.id().clone(), sk.clone(), &env.worker)
}

#[tokio::test]
async fn members_submit_with_their_own_keys_and_outsiders_are_refused() -> anyhow::Result<()> {
    let env = setup().await?;
    let (sk1, sk2) = (SecretKey::from_random(near_workspaces::types::KeyType::ED25519), SecretKey::from_random(near_workspaces::types::KeyType::ED25519));
    env.owner.call(env.unit.id(), "add_members").args_json(json!({"public_keys": [sk1.public_key(), sk2.public_key()]})).transact().await?.into_result()?;

    // the member key is a function-call key on the union account, method submit only
    let key = env.unit.as_account().view_access_key(&sk1.public_key()).await?;
    let perm = format!("{:?}", key.permission);
    assert!(perm.contains("FunctionCall") && perm.contains("submit"), "unexpected permission {perm}");

    let m1 = member_account(&env, &sk1);
    m1.call(env.unit.id(), "submit").args_json(json!({"ciphertext": ct("a")})).transact().await?.into_result()?;
    member_account(&env, &sk2).call(env.unit.id(), "submit").args_json(json!({"ciphertext": ct("b")})).transact().await?.into_result()?;
    assert_eq!(env.unit.view("entry_count").await?.json::<u64>()?, 2);

    // resubmission replaces
    m1.call(env.unit.id(), "submit").args_json(json!({"ciphertext": ct("a2")})).transact().await?.into_result()?;
    assert_eq!(env.unit.view("entry_count").await?.json::<u64>()?, 2);
    let all: Vec<String> = env.unit.view("get_entries").args_json(json!({})).await?.json()?;
    assert!(all.iter().any(|e| e.contains("a2")) && !all.iter().any(|e| e.contains("\"a\"")));

    // an outside account is refused with a clear message
    let r = env.outsider.call(env.unit.id(), "submit").args_json(json!({"ciphertext": ct("fake")})).transact().await?;
    assert!(format!("{:?}", r.failures()).contains("outside the union"), "{:?}", r.failures());
    // a member key cannot call anything but submit (the protocol refuses it)
    let r = m1.call(env.unit.id(), "add_members").args_json(json!({"public_keys": []})).transact().await;
    assert!(r.is_err() || r.unwrap().is_failure());
    assert_eq!(env.unit.view("entry_count").await?.json::<u64>()?, 2);

    // revoke: the key stops working and the entry is dropped
    env.owner.call(env.unit.id(), "revoke_member").args_json(json!({"public_key": sk1.public_key()})).transact().await?.into_result()?;
    assert_eq!(env.unit.view("entry_count").await?.json::<u64>()?, 1);
    let r = m1.call(env.unit.id(), "submit").args_json(json!({"ciphertext": ct("again")})).transact().await;
    assert!(r.is_err() || r.unwrap().is_failure(), "a revoked key must not submit");
    Ok(())
}

#[tokio::test]
async fn dao_releases_are_logged_and_never_rewritten() -> anyhow::Result<()> {
    let env = setup().await?;
    let sks: Vec<SecretKey> = (0..3).map(|_| SecretKey::from_random(near_workspaces::types::KeyType::ED25519)).collect();
    let pks: Vec<_> = sks.iter().map(|s| s.public_key()).collect();
    env.owner.call(env.unit.id(), "add_members").args_json(json!({"public_keys": pks})).transact().await?.into_result()?;
    for (i, sk) in sks.iter().enumerate() {
        member_account(&env, sk).call(env.unit.id(), "submit").args_json(json!({"ciphertext": ct(&format!("m{i}"))})).transact().await?.into_result()?;
    }
    env.unit.as_account().transfer_near(env.unit.id(), NearToken::from_near(0)).await.ok();

    env.mock.call("push_response").args_json(json!({"response": release_output("released", 51000)})).transact().await?.into_result()?;
    env.mock.call("push_response").args_json(json!({"response": release_output("refused", 52000)})).transact().await?.into_result()?;
    let q = json!({"query": r#"{"group_by":["grade"]}"#});

    // not the DAO: refused
    let r = env.outsider.call(env.unit.id(), "request_release").args_json(q.clone()).max_gas().transact().await?;
    assert!(format!("{:?}", r.failures()).contains("only the union's DAO"), "{:?}", r.failures());
    let r = env.owner.call(env.unit.id(), "request_release").args_json(q.clone()).max_gas().transact().await?;
    assert!(r.is_failure(), "owner without the override must be refused");

    let r = env.dao.call(env.unit.id(), "request_release").args_json(q.clone()).gas(near_workspaces::types::Gas::from_tgas(200)).transact().await?;
    assert!(r.is_success(), "{:?}", r.failures());
    for _ in 0..4 { env.worker.fast_forward(2).await?; }
    assert_eq!(env.unit.view("release_count").await?.json::<u64>()?, 1);
    let first: Value = env.unit.view("get_release").args_json(json!({"id": 1})).await?.json()?;
    assert_eq!(first["status"], "released");
    assert_eq!(first["cells"][0]["mean_eur"], 51000);
    // the input the enclave saw carries policy, query, the three entries and (first release) no history
    let seen: Value = serde_json::from_str(&env.mock.view("get_last_input").await?.json::<String>()?)?;
    assert_eq!(seen["policy"]["k"], 3);
    assert_eq!(seen["entries"].as_array().unwrap().len(), 3);
    assert!(seen["history"].is_null());

    let r = env.dao.call(env.unit.id(), "request_release").args_json(q).gas(near_workspaces::types::Gas::from_tgas(200)).transact().await?;
    assert!(r.is_success(), "{:?}", r.failures());
    for _ in 0..4 { env.worker.fast_forward(2).await?; }
    let all: Vec<Value> = env.unit.view("get_releases").args_json(json!({})).await?.json()?;
    assert_eq!(all.len(), 2);
    assert_eq!(all[1]["status"], "refused");
    assert_eq!(all[1]["suppressed"][0]["reason"], "differencing");
    assert_eq!(all[0], first, "release 1 must be byte-for-byte unchanged");
    // release 2 was given release 1's history
    let seen: Value = serde_json::from_str(&env.mock.view("get_last_input").await?.json::<String>()?)?;
    assert_eq!(seen["history"]["v"], 1);
    Ok(())
}
