//! DKIM verification for the Bandsheet enclave. See `verify` and `payslip`.

pub mod canon;
pub mod message;
pub mod payslip;
pub mod sig;
pub mod verify;

pub use payslip::{nullifier, Payslip};
pub use verify::{verify, Failure, Issuer, Verified};
