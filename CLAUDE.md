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
- **Does NOT**: Just accept "pass" at face value
- **Does**:
  - Reads the screenshot to confirm visual correctness
  - Reads the code reviewer's file citations to confirm they checked the right files
  - Reads QA test results to confirm they tested the right endpoints
  - Cross-references all three for consistency
- **Verdict**: APPROVED (tell user) or REJECTED (fix and re-run loop)

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

### Retry Policy
- Max 3 retry loops before escalating to user with full failure report
- Each retry must address the specific failure from the previous loop
- Manager must confirm the fix addresses the original failure, not just passes

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
