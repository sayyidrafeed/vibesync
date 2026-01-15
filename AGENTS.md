# VibeSync: Implementation Plan

## Phase 1: The Pulse (CLI & Watcher)
**Description**: Scaffold the monorepo and build the core CLI tool. This tool will initialize the project and start watching for file system events. It establishes the "nervous system" of the app.
**User Story**: As a developer, I want to run `vibe watch` in my terminal so that the system starts tracking my changes immediately.
**Definition of Done (DoD)**:
- [ ] Monorepo setup (Turborepo/npm workspaces) with `apps/web` and `packages/cli`.
- [ ] CLI command `vibe init` creates a `.vibesync` config folder.
- [ ] CLI command `vibe watch` successfully logs file creation, modification, and deletion events to the console using `chokidar`.
**Validation**:
1. Run `vibe init` in a fresh folder -> check `.vibesync` exists.
2. Run `vibe watch`.
3. Create `test.js` -> Console logs "File Created: test.js".

---

## Phase 2: The Brain (AI Integration)
**Description**: Connect the "Pulse" to a local database and an LLM. This phase transforms raw file events into structured "Intent" data.
**User Story**: As a developer, I want VibeSync to understand *context* so that it knows I'm "fixing a bug" rather than just "changing lines 10-15".
**Definition of Done (DoD)**:
- [ ] SQLite/LevelDB set up to store event history.
- [ ] Integration with OpenAI/Anthropic API.
- [ ] Logic to bundle recent file changes (debounced) and send diffs to LLM.
- [ ] LLM successfully returns a summary of the change (e.g., "Added user authentication middleware").
**Validation**:
1. Run `vibe watch`.
2. Edit a file to add a function.
3. Check `.vibesync/db.sqlite` to see a new record with the correct summary of the change.

---

## Phase 3: The Record (Auto-Documentation)
**Description**: The core value proposition. Use the extracted intents to maintain a living `docs/spec.md` and `task.md`.
**User Story**: As a developer, I want my project documentation to stay up-to-date automatically so I don't have to context-switch to write specs.
**Definition of Done (DoD)**:
- [x] Module created to parsing/updating Markdown files.
- [x] Logic: If Intent = "New Feature", append to `spec.md`.
- [x] Logic: If Intent = "Completed Task", mark `[x]` in `task.md`.
**Validation**:
1. Create a "Todo item" in `task.md`.
2. Write code to complete that item.
3. VibeSync automatically marks the task as `[x]` in `task.md`.

---

## Phase 4: The Mirror (Dashboard UI)
**Description**: A visual "Head-Up Display" for the project's mental model. Built with Next.js and the "Cyber-Physical" Design System.
**User Story**: As a developer, I want to see a real-time dashboard of my project's health and evolution.
**Definition of Done (DoD)**:
- [ ] Next.js app running on `localhost:3000`.
- [ ] Implements the Dark/Neon "Cyber-Physical" design system.
- [ ] Connects to the local SQLite DB to fetch live events.
- [ ] Displays a real-time activity stream of AI-analyzed changes.
**Validation**:
1. Open Dashboard.
2. Modify a file in the project.
3. See the Dashboard pulse and the new event appear in the stream instantly.
