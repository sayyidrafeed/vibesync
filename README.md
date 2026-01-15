# VibeSync

VibeSync is a developer tool that bridges the gap between fast "vibe coding" and professional engineering standards. It captures your development intent in real-time and visualizes it.

## 🚀 Getting Started

### 1. Installation
Install dependencies for the entire monorepo:
```bash
npm install
npm run build
```

### 2. Configuration
Initialize the project settings and set up your API key:
```bash
# Run the init command from the CLI package
node packages/cli/dist/index.js init

# Then edit .vibesync/.env to add your OpenAI API Key
nano .vibesync/.env
```

---

## 🖥️ Usage

### Running the CLI (The Pulse)
The `vibe` command is not installed globally by default. You have two options:

**Option A: Run Directly (Recommended for Dev)**
Run this in a separate terminal to watch for file changes:
```bash
# Run using node directly
node packages/cli/dist/index.js watch
```

**Option B: Link Globally**
If you want to use the `vibe` command directly:
```bash
cd packages/cli
npm link
cd ../..
vibe watch
```

### Running the Dashboard (The Mirror)
To see your coding activity visualization:
```bash
npm run dev --workspace=@vibesync/web
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ❓ Troubleshooting

### "vibe: command not found..."
This means the CLI package isn't linked globally.
*   **Fix 1**: Use the full path: `node packages/cli/dist/index.js watch`
*   **Fix 2**: Run `npm link` inside `packages/cli` folder.

### "Dashboard is empty"
The dashboard currently uses mock data if it can't find the real database. Ensure you ran `vibe init` and that `vibe watch` is running to generate real events.

---

## 📂 Project Structure
- `apps/web`: Next.js Dashboard (The Mirror)
- `packages/cli`: File Watcher & AI Logic (The Pulse)
- `.vibesync`: Local configuration and database (created after init)
