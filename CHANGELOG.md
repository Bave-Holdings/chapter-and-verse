# Changelog

## September 24, 2026

### Authentication Entry and Preview

- Made `/` open Login, moved account creation to `/signup`, and updated the sign-up link and page metadata.
- Added a fresh cookie-session check to the authentication pages so signed-in visitors continue to `/home` without seeing the forms.
- Replaced the session-check message with a subtle form skeleton, reserving the form's layout to avoid logo jumps and respecting reduced-motion preferences.
- Rebuilt the supplied preview design as native HTML/CSS with SVG icons, matching its sidebar, toolbar, conversation, source badges, and composer across Login, Sign Up, and Forgot Password.
- Enlarged the preview to use the available panel space while keeping its toolbar, message bubble, send control, and footer fully visible, and added subtle hover effects with reduced-motion support.
- Added coverage for entry routing, existing and expired sessions, interrupted session checks, and the dedicated sign-up route.

### Persistent Workspace Navigation

- Moved `/home`, `/home/chat`, `/category`, `/category/[slug]`, and `/profile` into a shared workspace route-group layout so the authenticated shell remains mounted during navigation.
- Replaced manual browser-history updates with Next.js links and router navigation, keeping the address bar, selected category, profile screen, and rendered route synchronized.
- Preserved the loaded workspace, sidebar, and navigation state across category changes, account navigation, browser back/forward actions, and mobile drawer links without reloading the document or refetching shared agent data.
- Added route guards and canonical redirects for the `/category` alias, unknown categories, invalid conversations, and protected history after logout.

### Conversation Persistence and History

- Added encoded `?chat=` URLs for active conversations and restored the selected conversation after a hard refresh or browser back/forward navigation.
- Kept same-category and cross-category history selection synchronized with the active agent, and made New Question clear the conversation URL and return to the correct quick-question state.
- Added an accessible global chat-history search with recent conversations, title filtering, loading/error/empty states, keyboard navigation, outside-click and Escape dismissal, and focus restoration.
- Added JSON conversation export and retained the active streamed answer while replacing the URL for newly created chats.
- Replaced native chat-deletion confirmation with an accessible, responsive confirmation dialog.

### Citations, Answers, and Links

- Added a responsive citation details panel with document metadata, cited passages, source tabs, keyboard tab navigation, copy-citation feedback, and Open at page actions.
- Added support for source type, document version, and exact cited-passage metadata, including distinct firm-overlay presentation.
- Standardized citation labels across structured and Markdown answers and limited displayed sources to those referenced by the answer.
- Routed safe same-origin page links inside answers through the App Router while keeping external links and downloadable API documents as normal browser links.
- Refined structured-answer spacing, document checklist controls, source footers, and citation interactions to match the rendering specification.

### Authentication, Profile, and Responsive UI

- Added functional Remember me handling through the login form, API client, and same-origin login proxy while preserving session-only cookies when it is not selected.
- Moved Forgot password into the login form, refined the responsive authentication layouts, and replaced the reconstructed desktop preview with an optimized product-preview asset.
- Updated the profile screen to show backend account data and generated initials, added explicit unavailable/error states, and added a responsive collapsible password section.
- Refined the disabled forgot-password form so the intended workflow is visible while clearly explaining that the backend reset endpoint is unavailable.
- Fixed narrow and short viewport overflow, header crowding, sidebar behavior, and desktop/mobile layout consistency.

### Testing and Documentation

- Added Playwright configuration and mocked-API browser tests for document-preserving navigation, route synchronization, chat refresh persistence, back/forward behavior, internal answer links, authentication/logout, invalid-route guards, mobile drawers, and desktop/mobile history search.
- Expanded Vitest coverage for workspace routing, chat restoration, history search, citation labeling and panels, structured answers, Markdown links, authentication, and responsive interactions.
- Added a dedicated local authenticated QA account for exercising protected endpoints and verified the reported navigation and refresh regressions in Chrome through Playwright.
- Documented the shared workspace layout and browser-test workflow in the README, added `npm run test:e2e`, and ignored generated Playwright reports and test results.

## September 23, 2026

### Frontend Review Fixes

- Reviewed the UI issues documented in `Intellence AI.md` and corrected the reported authentication, workspace, navigation, profile, and responsive-layout problems.
- Refined the login and sign-up layouts for desktop, tablet, landscape, mobile, and short-screen viewports, including fixes for horizontal overflow and misplaced authentication content.
- Corrected the mobile sign-up copy and moved Forgot password into the login form beside Remember me.
- Prevented the main navigation sidebar from collapsing automatically when opening a saved conversation or submitting a question, while retaining the manual collapse control.
- Replaced the browser-native delete prompt with an accessible confirmation dialog and responsive mobile bottom sheet.

### Authentication and Session Handling

- Connected Remember me to the login request and added a same-origin login proxy that preserves the backend's persistent cookie only when requested.
- Kept unchecked logins session-only by removing cookie expiration and maximum-age attributes from the proxied response.
- Added unit coverage for both persistent and session-only login behavior.
- Created a dedicated local dummy user for authenticated UI and protected-endpoint testing.

### Category and Conversation Routing

- Removed the forced category workspace remount and changed category selection to client-side navigation so switching between Fannie Mae and FHA does not reload the document or repeat authentication requests.
- Synchronized category state with browser navigation and kept each agent's chat history isolated.
- Replaced the profile initials button with a proper `/profile` link, fixing the case where profile content appeared while the address bar still showed `/category/mortgage`.
- Added the active chat ID to the category URL and restored that conversation after a hard refresh instead of starting a new chat.
- Updated selected, newly created, deleted, and New chat states so the conversation URL remains synchronized with the visible workspace.

### Validation

- Added regression coverage for category navigation, preserved sidebar state, the delete dialog, profile navigation, and restoring an active chat from the URL.
- Verified authenticated `/home`, category, profile, agent, and chat flows with the local QA account through Playwright in Chrome.
- Tested authentication and workspace layouts across desktop, tablet, landscape, and mobile viewport sizes, including widths down to 320 pixels.
- Completed the full 40-test Vitest suite, ESLint, TypeScript checking, and the optimized Next.js production build successfully.

## September 22, 2026

### Knowledge Navigation and Chat Experience

- Reworked Mortgage into a non-answering parent category with separate Fannie Mae Selling Guide and FHA Handbook 4000.1 agents.
- Preserved the exact `mortgage_guidelines` and `fha_handbook` backend keys, routes, chat creation payloads, and isolated chat histories.
- Added a persistent category panel with subcategory selection above agent-specific chat history, including responsive mobile behavior.
- Added subcategory quick-question cards that create and submit a new chat without duplicating conversations.
- Updated new and empty chats to show quick questions and the message composer while existing chats immediately display their messages.
- Hid the message composer on the global home screen and restored it whenever a category context is active.
- Added automatic black-sidebar collapse when a conversation begins, plus persistent manual collapse and expand controls with an icon-only collapsed rail.
- Replaced the generic empty-category introduction and knowledge-agent card with the selected subcategory's quick questions.
- Updated chat history titles to a single-line ellipsis treatment and removed decorative leading dots.
- Replaced the assistant photo with the Chapter & Verse mark, limited source cards to citations referenced in the answer, and kept streamed answers positioned at the start of the active response.
- Replaced the thinking label with a compact animated status indicator.

### Header and Account Refinements

- Added a time-aware greeting using the signed-in user's full name for home and empty-chat states.
- Added dynamic Mortgage/subcategory breadcrumbs and titles for active and previously saved conversations.
- Replaced the header profile photo with generated name initials and made the initials control navigate directly to `/profile`.
- Kept the category and chat-history panel visible when the main navigation sidebar is collapsed.

### Sign-up Validation

- Added Full Name and Confirm Password fields to sign-up while keeping sign-in limited to Email and Password.
- Added required-field, email-format, eight-character password, and password-confirmation validation with field-level errors.
- Disabled submission while a sign-up request is in progress and ensured only `full_name`, `email`, and `password` are sent to the API.

### Validation

- Expanded integration coverage for Mortgage grouping, agent isolation, quick-question chat creation, empty/new-chat states, sidebar controls, dynamic headers, profile navigation, and responsive navigation.
- Verified the workspace tests, ESLint, and TypeScript checks after the refinements.

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
