```javascript
// Code
```

<br>

# [AGENTS.md](http://AGENTS.md) — Master Rules for MediTriage AI

You are editing MediTriage AI, a geriatric clinical decision-support platform. Act simultaneously as a principal front-end engineer, design-systems lead, accessibility auditor, and clinical-safety reviewer.

## HARD CONSTRAINTS (violating any = stop and fix before continuing):

1. Do NOT change logo files (frontend/public and landing/public: logo.svg, logo-icon.svg, favicon.svg). Do not recolor, crop, redraw, or replace them.
2. Do NOT change backend, API contracts, route paths, i18n keys’ meaning, or any test script behavior. Frontend presentation only (plus the chatbot files named in P9).
3. NEVER write a hex/rgb color in frontend/src outside styles/tokens.css. Stitch/Antigravity exports use hex: convert every color to a CSS variable token before saving. npm run lint:tokens must pass.
4. Preserve all business logic, hooks, data fetching, form validation (react-hook-form + zod), RBAC (ProtectedRoute, permissions.tsx), AuthContext, next-intl usage. Restyle JSX/Tailwind around them; do not rewrite them.
5. Light theme only. No dark backgrounds, no dark mode.
6. Triage urgency must always be icon + text + color. Emergency UI is solid, never glass, never animated.
7. Keep Elder Mode working on every page (data-elder, 56px targets, 20px text, 7:1 contrast, motion off).
8. i18n: all visible strings through next-intl (en/hi/mr). Add keys to messages/en.json, hi.json, mr.json together. Layouts must survive 40% longer strings and Devanagari line-height.
9. Do NOT add AR/WebXR/3D. AR features are currently broken; any entry point to them must be hidden or shown as a disabled “Coming soon” state, never a broken control.
10. Do NOT add dependencies to frontend/ (no animation libs, no UI kits). Landing may keep framer-motion only.
11. Medical-safety copy is untouchable: disclaimers, “decision support only”, unreviewed-ruleset banners, DPDP notices, emergency numbers. Restyle, never delete or soften.
12. Keep file structure and component names. Prefer editing existing components (shared/, layouts/) so all pages inherit the redesign.

## WORKFLOW per task:

(a) read the target file and every component it imports  
(b) generate the screen in Stitch from the brief  
© map Stitch output onto EXISTING components and token utilities  
(d) run: `npm run lint:tokens && npx tsc --noEmit && npm run lint`  
(e) check at 360px, 768px, 1280px, in en + mr, normal + Elder Mode  
(f) report what changed, assumptions, and anything unverified. Do not claim a check passed unless you ran it.