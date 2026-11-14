.PHONY: test evaluate build vectors fixtures crosscheck
# Unit, hero, module and cross-language tests.
test:
	cargo test --release --locked
	node test-vectors/crosscheck.mjs verify

# Reproduces the 100-case comparison and writes per-case results for the UI.
evaluate:
	mkdir -p evaluation
	EVAL_OUT=$(CURDIR)/evaluation/results.json cargo test --release --locked -p bandsheet-audit --test adversarial -- --nocapture

build:
	./build.sh

# Regenerate the TypeScript-made vector (then `make test` checks Rust against it).
vectors:
	node test-vectors/crosscheck.mjs write

# Regenerate the DKIM payslip fixtures (fixtures/dkim). Keys live in keys/dkim/ and are kept if present.
fixtures:
	node scripts/dkim-fixtures.mjs

# Independent check of the fixtures with dkimpy: DKIMPY_PYTHON=<python with dkimpy installed> make crosscheck
crosscheck:
	$${DKIMPY_PYTHON:-python3} -I scripts/dkim-crosscheck.py
