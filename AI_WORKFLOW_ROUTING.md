# HYBRID AI AGENT WORKFLOW & MODEL ROUTING SPECIFICATION

## 1. PURPOSE

This project uses a hybrid AI workflow to reduce cloud LLM token consumption while maintaining correctness and system safety.

The AI Agent MUST choose the appropriate model based on task complexity and risk.

The Local LLM is a supporting worker.

The Cloud LLM is the primary reasoning model for architecture, security, database design, complex debugging, and high-risk changes.

---

## 2. LOCAL LLM INFRASTRUCTURE

### Local Runtime

- Runtime: Ollama
- Endpoint: `http://127.0.0.1:11434`
- Local model: `qwen2.5-coder:1.5b`
- Model storage: `D:\ollama_models`

### Host Constraints

The development machine has:

- 8 GB RAM
- Intel Core i3-6100U
- 2 cores / 4 threads
- Integrated Intel HD Graphics 520
- Approximately 1 GB RAM may remain available during local inference.

Therefore:

- Do NOT run multiple local inference requests concurrently.
- Do NOT intentionally keep long-running local generations active.
- Prefer short prompts and small context.
- Prefer retrieval/search before sending code to the Local LLM.
- If system responsiveness degrades, stop local inference and use the Cloud LLM.

---

# 3. MODEL ROUTING POLICY

## 3.1 LOCAL WORKER — Qwen 1.5B

Use the Local LLM for LOW-RISK and SMALL-SCOPE tasks.

Suitable tasks include:

- Summarizing a single small source file.
- Explaining a function.
- Finding a function, variable, class, import, or regex.
- Searching where a symbol is used.
- Reading and summarizing logs.
- Parsing stack traces.
- Identifying the likely location of a simple error.
- Explaining existing code.
- Checking simple syntax or obvious local bugs.
- Extracting relevant code sections before sending them to the Cloud LLM.
- Creating short notes or summaries.
- Performing repository pre-analysis.

The Local LLM MAY suggest small code changes when the change is clearly isolated and low-risk.

However, the Agent MUST NOT blindly accept a Local LLM code change.

Any Local LLM-generated code modification MUST pass:

1. Diff inspection.
2. Formatter/linter if applicable.
3. Relevant automated tests.
4. Build/typecheck if applicable.

If the change affects architecture, security, data integrity, authentication, authorization, transactions, or multiple modules, escalate to the Cloud LLM.

---

# 4. CLOUD LLM — PRIMARY ARCHITECT / REASONING MODEL

Use the Cloud LLM for HIGH-COMPLEXITY, HIGH-RISK, or CROSS-MODULE tasks.

Mandatory escalation areas include:

### Architecture

- Overall system architecture.
- Multi-tenant architecture.
- Tenant/store/branch isolation.
- Domain boundaries.
- Clean Architecture / DDD decisions.
- Large refactors.
- Major dependency changes.

### Database

- Database schema design.
- Tenant/store/branch relationships.
- PostgreSQL/Supabase architecture.
- Row Level Security.
- Database migrations.
- Index strategy.
- Constraints.
- Data integrity.
- Concurrency.
- Transactions.

### Security

- Authentication.
- Authorization.
- RBAC.
- Permission systems.
- JWT/session handling.
- Row Level Security.
- Tenant isolation.
- API security.
- Secret handling.
- Security-sensitive middleware.

### Business-critical logic

- Inventory deduction.
- Stock transfers.
- Purchasing.
- Sales transactions.
- Payment processing.
- Accounting calculations.
- Race-condition prevention.
- Overselling prevention.
- Synchronization between systems.
- Google Sheets ↔ database synchronization.

### Large changes

- Changes involving multiple modules.
- Changes involving multiple database tables.
- Changes that may affect existing production data.
- Changes that may break existing APIs.
- Changes affecting many users or tenants.

---

# 5. MODEL ESCALATION RULE

The Agent MUST NOT decide based only on token size.

Before assigning a task to the Local LLM, evaluate:

1. Scope
2. Risk
3. Number of affected files
4. Security impact
5. Database impact
6. Business-critical impact
7. Reversibility

If any of the following is true:

- Security-sensitive
- Database-sensitive
- Business-critical
- Cross-module
- Difficult to verify
- Potentially destructive
- Architectural

→ ESCALATE TO CLOUD LLM.

When uncertain:

→ ESCALATE TO CLOUD LLM.

---

# 6. CONTEXT RETRIEVAL PIPELINE

NEVER dump the entire repository into an LLM context unnecessarily.

Use this pipeline:

```text
Repository
    ↓
Repository Search / Index
    ↓
AST / Symbol Search / ripgrep / semantic search
    ↓
Identify relevant files
    ↓
Retrieve only required code
    ↓
Local LLM for lightweight pre-analysis
    ↓
Cloud LLM for complex reasoning when required
    ↓
Implementation
    ↓
Automated Tests
    ↓
Build / Typecheck / Lint
    ↓
Inspect Logs
    ↓
Fix
    ↓
Retest
```

The Agent MUST prefer targeted retrieval over sending the entire repository.

---

# 7. LOCAL LLM RESOURCE LIMITS

Because the host has only 8 GB RAM:

### Local generation

Prefer:

- Short responses.
- Small code snippets.
- Small context windows.
- One request at a time.

Target:

- `num_predict <= 200` for normal Local LLM tasks.

Do not use the Local LLM for long code generation unless explicitly requested and verified.

If Ollama becomes slow, times out, causes excessive memory pressure, or noticeably degrades IDE responsiveness:

1. Stop the Local LLM request.
2. Do not retry repeatedly.
3. Escalate the task to the Cloud LLM.

---

# 8. VERIFICATION POLICY

No AI-generated code is considered complete merely because the model produced code.

After every code modification:

1. Inspect the diff.
2. Run the smallest relevant test.
3. Run typecheck/lint when applicable.
4. Run build when applicable.
5. Inspect errors and logs.
6. Fix failures.
7. Retest.

For high-risk changes, the Cloud LLM should review the implementation before considering the task complete.

The Agent MUST NOT claim "completed", "fixed", or "working" without verification evidence.

---

# 9. PROJECT MEMORY

The Agent MUST treat these files as project instructions when they exist:

- `AI_PROJECT_RULES.md`
- `AI_WORKFLOW_ROUTING.md`
- `ARCHITECTURE.md`
- `DATABASE.md`
- `TESTING.md`

The repository itself is the source of truth for implementation details.

If documentation conflicts with actual code, the Agent MUST investigate the discrepancy instead of silently assuming either source is correct.

---

# 10. MULTI-TENANT SAFETY

The following areas are ALWAYS considered HIGH-RISK:

- Tenant isolation.
- Store isolation.
- Branch isolation.
- User permissions.
- Role permissions.
- Database Row Level Security.
- API authorization.
- Cross-tenant queries.
- Cross-store data access.
- Cross-branch data access.

These tasks MUST be reasoned about and reviewed using the Cloud LLM.

The Agent MUST include negative security tests where appropriate, such as:

```text
Tenant A cannot access Tenant B data.
Store A cannot access Store B data.
Branch A cannot access Branch B restricted data.
Unauthorized users cannot modify protected resources.
```

---

# 11. COST OPTIMIZATION

The objective is NOT to use the Local LLM as much as possible.

The objective is:

> Use the cheapest model that can safely perform the task.

Preferred strategy:

```text
Simple / Low-risk
        ↓
Local LLM
        ↓
If uncertain
        ↓
Cloud LLM

Complex / High-risk
        ↓
Cloud LLM directly
```

Do not waste Cloud LLM tokens by repeatedly sending the same repository context.

Use repository indexing, symbol search, summaries, and project memory to reduce context size.

---

# 12. FINAL AGENT RULE

The AI Agent is responsible for coordinating:

```text
Human
  ↓
AI Agent
  ├── Local LLM — lightweight worker
  ├── Cloud LLM — architect/reasoner
  ├── Repository
  ├── Terminal
  ├── Tests
  ├── Git
  └── Documentation
```

The Agent MUST:

- Think before editing.
- Retrieve only relevant context.
- Select the appropriate model.
- Escalate when uncertain.
- Verify every important change.
- Never trust Local LLM output blindly.
- Never allow Local LLM limitations to compromise architecture or security.
- Never claim success without test evidence.

The goal is a reliable hybrid engineering workflow, not simply maximum Local LLM usage.