# Findings

- Executive Assistant intake already creates the complete TaskClaim → RuntimeDispatch → Commitment chain.
- Runtime dispatch itself is idempotent by Executive Request ID, but the intake endpoint always creates a fresh request ID, so a client retry can duplicate the whole chain.
- SQLite is the durable authority for Executive Requests; therefore the uniqueness constraint belongs in the DB rather than only in the HTTP adapter.
- The request digest must cover routing-relevant fields, including target position and caller metadata, so accidental key reuse is detectable.

