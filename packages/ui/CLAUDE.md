# @neo/ui

Shared coss UI primitives (built on `@base-ui/react`). Source-only, Tailwind v4.

- Don't modify unless necessary — it's generated/vendored. To add or update, regenerate from the `@coss` registry: `bunx shadcn@latest add @coss/<name>` (unset `*_proxy` env vars first, or it fails).
- Internal imports use `#` subpath aliases: `#components/*`, `#lib/utils`, `#hooks/*`. Other packages import `@neo/ui/components/*` etc. (via `exports`).
- i18n-free: user-facing text is a prop with an English default; consumers translate.
- Declare every runtime dep here (bun isolated linker); pin shared deps to the app's versions.
- Theme lives in `src/styles/globals.css`; tokens track the `@coss` source — don't add CSS variables unless needed. No build step.
