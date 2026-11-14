.PHONY: test evaluate build vectors
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
