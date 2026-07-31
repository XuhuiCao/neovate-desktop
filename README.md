<div align="center">
<img src="packages/desktop/build/icons/prod/icon.png" alt="Neovate Logo" width="60" />
<br />
<br />
<h1>Neovate Desktop</h1>

### Desktop

---

[![](https://github.com/neovateai/neovate-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/neovateai/neovate-desktop/actions/workflows/ci.yml)
[![](https://img.shields.io/github/license/neovateai/neovate-desktop)](https://github.com/neovateai/neovate-desktop/blob/master/LICENSE)
[![](https://img.shields.io/badge/platform-macOS-blue)](https://github.com/neovateai/neovate-desktop)

**Neovate Desktop** is a native desktop app for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), with other code agents coming soon — a feature-rich environment for AI-assisted development with built-in editor, terminal, git, and code review.

</div>

![](https://pic.sorrycc.com/proxy/1774535548107-815850794.png)

## Quick Start

Prerequisites: macOS, [Bun](https://bun.sh/) >= 1.3.9

```bash
git clone https://github.com/neovateai/neovate-desktop.git
cd neovate-desktop
bun install
bun dev
```

## Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](./CONTRIBUTING.md) file for guidelines on setting up the development environment, running tests, and submitting pull requests.

## Features

Beyond the core Claude Code chat experience, Neovate Desktop ships with:

- **Provider authorization (dual-mode)** — sign in with a Claude subscription (inherit, zero-config) or plug in a custom Anthropic-compatible endpoint (API key + baseURL). See `main/features/provider`.
- **Notifications** — native OS notifications + in-app toast, via `main/features/notification` and the main→renderer event bus (`main/core/event-bus`).
- **`neovate-file://` protocol** — load local resources (images, PDFs, …) directly in the renderer; plus a thin local fs service (`main/features/file`, `main/features/fs`).
- **Token usage (local-only)** — per-session and global token/cost/duration accounting, never reported externally (`main/features/token-usage`).
- **Git Worktree** — start isolated branch sessions from the sidebar (`main/features/worktree`).
- **Dev workflow** — switch `default` / `plan` / `dev` permission modes and prepend a draft prefix to every turn (`main/features/dev-workflow`).
- **neo-desktop MCP** — a built-in MCP server exposing local file/terminal/open capabilities to the agent (`main/plugins/neo-desktop-mcp`).
- **Agent contributions** — plugins contribute MCP servers / hooks; see [`docs/designs/agent-contributions.md`](./docs/designs/agent-contributions.md).
- **Attachments** — attach images, PDFs, and text files to chat messages.

## Credits

Neovate Desktop is built on the shoulders of these open source projects:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) / [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) — AI agent backbone
- [Vercel AI SDK](https://github.com/vercel/ai) — chat UI primitives (partial port of `AbstractChat` and stream processing)
- [VS Code](https://github.com/microsoft/vscode) — shell environment resolution and plugin lifecycle patterns
- [Electron](https://github.com/electron/electron) / [electron-vite](https://github.com/alex8088/electron-vite) — desktop app framework and build tooling
- [xterm.js](https://github.com/xtermjs/xterm.js) / [node-pty](https://github.com/microsoft/node-pty) — terminal emulator
- [Streamdown](https://github.com/nicepkg/streamdown) — streaming markdown rendering
- [Shiki](https://github.com/shikijs/shiki) — syntax highlighting
- [shadcn/ui](https://github.com/shadcn-ui/ui) — component primitives
- [CodePilot](https://github.com/op7418/CodePilot) — multi-provider architecture reference
- [cc-viewer](https://github.com/weiesky/cc-viewer) — network feature reference
- [wechatbot](https://github.com/corespeed-io/wechatbot) — WeChat adapter reference (iLink Bot protocol, error recovery patterns)
- [RTK](https://github.com/rtk-ai/rtk) — token-optimized CLI proxy
- [Bun](https://github.com/oven-sh/bun) — JavaScript runtime

## License

[MIT](./LICENSE)
