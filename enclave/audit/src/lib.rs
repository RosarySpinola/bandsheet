//! Bandsheet release audit. Pure: no I/O, no clock, no randomness.
//!
//! Model: every member's pay (in one version of their entry) is an unknown. Every released cell is
//! a sum query over a set of those unknowns (mean x public n). A release is refused cell by cell
//! when, after adding it, the row space of everything released so far contains a nonzero vector
//! with fewer than k nonzero entries (k = 1 entry is exactly "one member's pay is solvable").
//! The decision depends on membership only, never on pay values.

pub mod baseline;
pub mod echelon;
pub mod engine;
pub mod history;
pub mod release;
pub mod types;
pub mod witness;

pub use baseline::naive_release;
pub use release::{release, groups, mean_eur};
pub use types::*;
