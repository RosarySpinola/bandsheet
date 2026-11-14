#!/usr/bin/env python3
"""Independent check of the fixtures with dkimpy (third implementation), key supplied directly, no DNS.

  python3 -m venv /tmp/v && /tmp/v/bin/pip install dkimpy && /tmp/v/bin/python enclave/scripts/dkim-crosscheck.py
"""
import json, pathlib, sys
import dkim

root = pathlib.Path(__file__).resolve().parents[2] / "fixtures" / "dkim"
issuer = json.loads((root / "issuer.json").read_text())
manifest = json.loads((root / "manifest.json").read_text())


def verifier(domain, selector, spki):
    name = f"{selector}._domainkey.{domain}.".encode()
    txt = f"v=DKIM1; k=rsa; p={spki}".encode()
    return lambda n, timeout=5: txt if n.rstrip(b".") == name.rstrip(b".") else None


trusted = verifier(issuer["domain"], issuer["selector"], issuer["rsa_pubkey_spki_b64"])
other = verifier(issuer["other_issuer"]["domain"], issuer["other_issuer"]["selector"], issuer["other_issuer"]["rsa_pubkey_spki_b64"])


def check(rel, dns):
    raw = (root / rel).read_bytes()
    try:
        return bool(dkim.verify(raw, dnsfunc=dns))
    except Exception:
        return False


bad = 0
def expect(rel, dns, want, label):
    global bad
    got = check(rel, dns)
    if got != want:
        bad += 1
    print(("ok  " if got == want else "FAIL"), label, rel, "->", got)

for m in manifest["members"]:
    expect(m["eml"], trusted, True, "member")
for v in manifest["variants"]:
    expect(v["eml"], trusted, True, "variant")
for n in manifest["negatives"]:
    # dkimpy with the chapel's trusted key: only the re-issued duplicate is a genuine signature.
    expect(n["eml"], trusted, n["file"] == "duplicate.eml", "negative(trusted key)")
expect("emails/untrusted.eml", other, True, "untrusted (own key)")
print("FAILURES:", bad)
sys.exit(1 if bad else 0)
