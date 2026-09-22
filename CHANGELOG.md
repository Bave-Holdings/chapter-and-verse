# Changelog

## September 21, 2026

### Backend Integration

- Added same-origin rewrites for the backend API and a server-only `API_BASE_URL` setting.
- Added a dedicated streaming proxy route for `/api/v1/ask/stream` that preserves cookies while removing invalid hop-by-hop headers.
- Connected signup, login, session restoration, and logout to the HTTP-only cookie session API.
- Replaced hardcoded categories, chats, messages, user identity, and suggestions with backend data.
- Added chat creation, loading, renaming, deletion, answer streaming, cancellation/retry, citations, and feedback.
- Added safe GitHub-flavored Markdown rendering with tables and interactive numeric citations.
- Disabled non-live/document-less agents and clearly marked unsupported profile, password, avatar, notification, upload, and reset-password features.
- Added 16 tests covering API errors, split SSE frames, auth, agents, chat CRUD, streaming, cancellation, citations, feedback, Markdown safety, and mobile navigation.
- Verified ESLint, the production build, the full test suite, and a zero-vulnerability npm audit.

## September 20, 2026

### Category and Profile Screens

- Recreated the desktop and mobile designs in `Category.svg` and `profile.svg` at `/category` and `/profile`.
- Connected the knowledge navigation to individual Mortgage, Investment, Compliance, and HR category routes.
- Added the category policy list, policy selection, and mobile navigation between the list and chat.
- Added the profile overview, local name and photo editing, and responsive account and password forms.
- Added password confirmation validation, an accessible confirmation dialog, and the mobile bottom-sheet layout.
- Connected My Profile in the header menu and retained the shared mobile navigation drawer.
- Profile edits and password confirmation remain UI previews; no account credentials are changed or stored.
- Verified the production build, ESLint, desktop/mobile interactions, and responsive layouts from 320px to 1512px.

### Home and Chat Screens

- Recreated the desktop and mobile screens in `intellence.ai/Home.svg` at `/home` and `/home/chat`.
- Added the knowledge sidebar, greeting, profile controls, six image upload cards, most-asked questions, and message composer.
- Added the mobile navigation drawer with keyboard dismissal and the expandable most-asked panel in the chat view.
- Added local image previews with file validation, category selection, question selection, and message submission within the UI preview.
- Matched the reference chat bubbles, avatars, colors, spacing, and responsive layouts using React components and scoped CSS.
- Chat messages, uploads, and notification counts are preview data; no backend service is connected.

## September 18, 2026

### Sign Up Page

- Recreated the Sign Up page from the supplied desktop and mobile SVG designs.
- Added responsive layouts for desktop, laptop, tablet, mobile, and small-screen devices.
- Matched the reference typography, colors, spacing, form controls, button styling, and background effects.
- Added accessible email and password fields, labels, keyboard focus states, hover states, and a remember-me control.
- Added navigation from Sign Up to the Login page.

### Desktop Product Preview

- Rebuilt the desktop product preview with native React, HTML, CSS, and inline SVG elements instead of displaying it as a single image.
- Added the dark navy background, dotted wave decorations, navigation sidebar, knowledge workspace, upload cards, and message composer.
- Corrected preview sizing and clipping so the interface intentionally extends to the right edge without cutting important content.
- Set Mortgage as the active navigation item.
- Added hover feedback to the inactive Investment, Compliance, and HR navigation items.

### Animation and Interaction Effects

- Added entrance animations to authentication content and the desktop preview.
- Added floating motion to the desktop product preview.
- Added animated dotted background waves and a workspace sheen effect.
- Added staggered upload-card entrance animations and subtle card hover movement.
- Added a teal pulse to the active Mortgage icon.
- Added animated hover indicators and icon movement to inactive navigation items.
- Added a blinking composer caret and subtle upload-icon motion.
- Added reduced-motion support for users who disable animations at the operating-system level.

### Login Page

- Created the responsive Login page based on the supplied reference image.
- Reused the shared authentication layout and animated desktop product preview.
- Added email and password fields, remember-me control, Log In button, and Sign Up navigation.
- Refined the Forget Password link position, width, color, alignment, hover state, and focus state to match the design.

### Authentication Layout Refinements

- Removed rounded outer backgrounds from the Sign Up and Login page layouts.
- Removed unwanted page-edge gaps and rounded corners on desktop.
- Prevented horizontal overflow on smaller screens.
- Added compact layout adjustments for short mobile displays.
- Consolidated shared authentication and product-preview styling in the existing CSS module.

### CSS Build Fix

- Fixed the Turbopack CSS-module purity error caused by global selectors in `page.module.css`.
- Moved document-level resets for `html`, `body`, form elements, and box sizing into `globals.css`.
- Preserved square page edges and full-viewport sizing after the CSS fix.

### Forgot Password Page

- Created the responsive `/forgot-password` page from the supplied desktop and mobile SVG designs.
- Added the exact heading, explanatory text, email field, Check E-mail button, and Go back navigation.
- Linked the Go back action to the Login page.
- Added dedicated desktop and mobile spacing while reusing the shared authentication layout.
- Added accessible form semantics, keyboard focus styling, hover feedback, and entrance animation.

### Vector Logo Upgrade

- Replaced the previously generated raster logo with the supplied high-resolution SVG artwork.
- Added light-background, dark-background, and standalone-mark SVG variants under `public/`.
- Used the light vector logo across Sign Up, Login, and Forgot Password pages.
- Used the standalone vector mark in the desktop preview and as the application icon.
- Cropped excess SVG frame space and removed baked-in background rectangles so the logos blend cleanly with the interface.
- Removed the obsolete raster logo asset.

### Validation

- Verified the Sign Up, Login, and Forgot Password routes load successfully.
- Verified all new SVG assets are served successfully.
- Ran ESLint successfully after the implementation and refinements.
