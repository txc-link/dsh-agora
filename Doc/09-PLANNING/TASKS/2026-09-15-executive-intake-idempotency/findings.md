# Findings

- Executive Assistant intake already creates the complete TaskClaim → RuntimeDispatch → Commitment chain.
- Runtime dispatch itself is idempotent by Executive Request ID, but the intake endpoint always creates a fresh request ID, so a client retry can duplicate the whole chain.
- SQLite is the durable authority for Executive Requests; therefore the uniqueness constraint belongs in the DB rather than only in the HTTP adapter.
- The request digest must cover routing-relevant fields, including target position and caller metadata, so accidental key reuse is detectable.
- After the dependency security refresh moved Vitest to 4.1.11, the full scenario-matrix text test takes about 45 seconds on isolated Linux. Its inherited 30-second budget was the sole failure in a 1,709-test run, so both full-matrix variants now use a 60-second integration-test budget.
