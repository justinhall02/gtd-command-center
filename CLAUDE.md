# GTD Command Center — Project Rules

## Verification Protocol (MANDATORY)

**Every change** to this project must pass a 3-agent verification loop before reporting completion to the user. No exceptions. Do NOT tell the user a change is done until the manager agent confirms all three checks passed.

### The Loop

```
Code Change
    ↓
┌─────────────────────────────────────────────────┐
│  3 agents run IN PARALLEL:                       │
│                                                   │
│  1. VISUAL VERIFIER (Puppeteer screenshot)       │
│     - Takes before/after screenshots              │
│     - Confirms the UI renders correctly           │
│     - For backend-only changes: confirms app      │
│       still loads and API health check passes     │
│     - Returns: screenshot + pass/fail + details   │
│                                                   │
│  2. CODE REVIEWER                                 │
│     - Reads the actual files that were changed    │
│     - Confirms the code matches what was intended │
│     - Checks for regressions, syntax errors,      │
│       missing imports, broken references          │
│     - Returns: pass/fail + specific issues found  │
│                                                   │
│  3. QA AGENT                                      │
│     - Hits the API endpoints affected by change   │
│     - Tests the actual functionality (curl, etc.) │
│     - Confirms the feature works end-to-end       │
│     - Returns: pass/fail + test results           │
└─────────────────────────────────────────────────┘
    ↓
MANAGER AGENT receives all 3 reports
    ↓
Manager does NOT rubber-stamp — it:
  - Reviews each agent's evidence
  - Cross-checks: does the screenshot match what code reviewer says?
  - Cross-checks: does QA result confirm what visual shows?
  - If ANY agent failed or evidence is weak → REJECT
    ↓
┌──────────────┐     ┌──────────────┐
│  ALL PASS    │     │  ANY FAIL    │
│  → Tell user │     │  → Fix it    │
│    "Done"    │     │  → Re-run    │
│              │     │    the loop  │
└──────────────┘     └──────────────┘
```

### Agent Specifications

#### 1. Visual Verifier
- **Tool**: Puppeteer (globally installed, use `NODE_PATH=$(npm root -g) node`)
- **Method**: Launch headless Chrome, navigate to `http://localhost:5173`, take screenshot
- **For UI changes**: Navigate to the affected page/mode, screenshot at 1280x900
- **For backend changes**: Confirm app loads (screenshot home), hit `/api/health`
- **Output**: Screenshot path + pass/fail + description of what was verified

#### 2. Code Reviewer
- **Method**: Read the changed files, diff against intent
- **Checks**:
  - Code actually exists in the file (not just committed but overwritten)
  - No syntax errors or missing imports
  - Changes match what was requested
  - No regressions to surrounding code
- **Output**: File paths checked + pass/fail + specific findings

#### 3. QA Agent
- **Method**: curl/fetch against running server endpoints
- **Checks**:
  - `/api/health` returns 200
  - Affected endpoints return expected data
  - For UI changes: Puppeteer can interact with the element (click, type, etc.)
- **Output**: Endpoints tested + pass/fail + response summaries

#### 4. Manager Agent
- **Receives**: All 3 reports
- **Does NOT**: Just accept "pass" at face value — EVER
- **INDEPENDENTLY VERIFIES** each agent's work:
  - Reads the screenshot ITSELF to confirm visual correctness (don't trust "PASS" — look at the image)
  - Reads the actual changed files ITSELF to confirm the code reviewer checked the right things
  - Runs its own curl/health check to confirm the QA agent's results are real
  - Cross-references all three for consistency
  - Checks that agents tested the EXACT thing the user reported as broken (not a convenient stand-in)

##### On REJECT — Manager's Responsibilities:
1. **Identify root cause**: Why did it fail? Was the fix wrong, or did the agents test the wrong thing?
2. **Write specific fix instructions**: Tell the developer exactly what to change, not just "it failed"
3. **Document the lesson learned**: Write a guardrail to the project's lessons-learned section below so this exact failure pattern never happens again
4. **Delegate the fix**: Send the developer back with the fix instructions + the guardrail
5. **Re-verify after fix**: Run the full 3-agent loop again — no shortcuts, no "just check the one that failed"

##### On APPROVE:
1. **Confirm to user**: "Verified complete" with summary of what each agent confirmed
2. **Check for guardrails**: If this fix revealed a pattern (e.g., emails use <style> blocks not just inline styles), add it to the lessons learned below

- **Verdict**: APPROVED (tell user with evidence) or REJECTED (fix instructions + lesson learned + re-run)

### Implementation

Run all 3 verification agents **in parallel** using the Agent tool. Then run the manager agent with all 3 results.

```
# Parallel verification
Agent 1: subagent_type="general-purpose" → Visual verification
Agent 2: subagent_type="pr-review-toolkit:code-reviewer" → Code review
Agent 3: subagent_type="general-purpose" → QA testing

# Sequential manager review
Agent 4: subagent_type="manager-subagent" → Reviews all 3, makes final call
```

### Critical Rule: Test the ACTUAL broken thing
When the user reports a specific bug (e.g., "this HubSpot email is unreadable"), the visual verifier MUST screenshot THAT SPECIFIC item. Navigate to it, skip to it, find it by sender — do whatever it takes. Testing a different email that happens to work is NOT verification. The manager MUST reject if agents tested a stand-in instead of the real thing.

### Retry Policy
- Max 3 retry loops before escalating to user with full failure report
- Each retry must address the specific failure identified by the manager
- Manager must confirm the fix addresses the ORIGINAL failure, not just passes on different data
- On each retry, manager reviews previous failure notes to ensure the same mistake isn't repeated

---

## Lessons Learned (Manager writes here)

These are guardrails discovered through failed verifications. Agents MUST check these before reporting PASS.

### LL-001: Email HTML uses three styling methods
**Date**: 2026-03-19
**Bug**: Dark text on dark background in expanded emails
**Root cause**: Fix only stripped inline `style="..."` attributes. Email HTML also uses:
1. `<style>` blocks with class-based CSS (e.g., `.bg-surface-default { background-color: #FFFFFF }`)
2. Legacy `bgcolor="..."` HTML attributes
3. Legacy `color="..."` HTML attributes
**Guardrail**: `sanitizeEmailHtml()` must strip ALL of: `<style>` blocks, `style=""` attrs, `bgcolor=""` attrs, `color=""` attrs. If any new email styling method is found, add it here and to the function.

### LL-002: Verify against the user's exact broken data
**Date**: 2026-03-19
**Bug**: Visual verifier passed using a Fireflies email while the user's broken email was from HubSpot
**Root cause**: Agents picked the first/easiest email to test instead of the one the user reported
**Guardrail**: When user reports a specific broken item, agents MUST test THAT item. Manager MUST reject if a different item was tested.

## Dev Environment

- **Frontend**: `http://localhost:5173` (Vite dev server)
- **Backend**: `http://localhost:3456` (Express API)
- **Start**: `npm run dev` (runs both via concurrently)
- **Puppeteer**: `NODE_PATH=$(npm root -g) node <script>` (global install)
- **DB**: SQLite at `data/gtd.db`

## After Server Restart

When code changes require a server restart:
1. Kill both servers: `fuser -k 3456/tcp; fuser -k 5173/tcp`
2. Wait 2 seconds
3. `npm run dev > /tmp/gtd-dev.log 2>&1 &`
4. Wait 12 seconds for both servers
5. Verify: `curl -s http://localhost:3456/api/health`
6. THEN run the verification loop
