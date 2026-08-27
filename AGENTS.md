<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Homelab Index project rules

## Approved design contract

- The current dashboard implementation is the approved visual source of truth. Preserve its layout, density, spacing, chart treatment, and restrained Cloudflare-style character unless the user explicitly approves a redesign.
- Keep the page hierarchy: tiny header, Core systems, LAN workloads, Quick links, tiny footer. The primary target is a one-screen 3840x2160 dashboard on a 32-inch display, with responsive behavior for smaller screens.
- Do not add explanatory, promotional, onboarding, or helper copy inside dashboard blocks. Labels, names, addresses, states, metrics, units, and terse errors are allowed.
- Preserve the approved signature: Proxmox and Unraid are paired as the primary telemetry surface, joined by the compact network-flow marker.

## Required UI system

- Use `@cloudflare/kumo` components, primitives, chart utilities, styles, and semantic behavior whenever the library provides the required element. Do not recreate a Kumo component locally without documenting why Kumo cannot cover it.
- Build charts with Kumo chart utilities and ECharts. Keep legends, interaction, accessibility, and colors aligned with Kumo.
- Use Phosphor icons through Kumo's expected icon dependency. Placeholder service icons remain intentionally generic until the user selects real icons.
- Use the project CSS variables for design colors. Do not introduce arbitrary replacement colors:
  - canvas `#f4f5f6`
  - surface `#ffffff`
  - ink `#1a1a1d`
  - muted `#686a70`
  - quiet `#92959b`
  - hairline `#dfe1e5`
  - orange `#f48120`
  - blue `#0f61d8`
  - green `#16864b`
  - purple `#7259c9`
- Prefer hairline borders, compact radii, quiet shadows, tabular data, and restrained motion. Avoid decorative gradients, glass-heavy effects, oversized headings, pill-heavy layouts, and decorative copy; Kumo chart fills are allowed when they match the approved dashboard.

## Architecture and quality

- Use Next.js 16 App Router. Prefer Server Components for reads and small client islands only for charts, polling, or browser-only behavior.
- Keep Proxmox and Unraid credentials server-only. Never expose tokens, passwords, or private API endpoints through `NEXT_PUBLIC_*` variables or serialized props.
- Keep provider integrations behind typed adapters and normalize them into shared dashboard models. The UI must not depend directly on provider response shapes.
- Use provider-backed runtime data only. Missing or unreachable providers must surface as unavailable or degraded; never substitute fabricated telemetry.
- Preserve clean module boundaries under `src/components`, `src/features`, and `src/lib`; avoid monolithic page components.
- Run Prettier, ESLint, type checking, unit/integration tests, production build, and Playwright smoke coverage for material changes. Verify the real 3840x2160 browser render for visual changes.
- Docker deployment must use Next.js standalone output, a non-root runtime user, a health check, and `.env`-based configuration.
