# Admin guideline ingestion

Open `/admin/ingest` or choose **Ingestion admin** in the workspace sidebar with an admin session. Upload the complete source PDF to Fannie Mae or FHA, then use document ranges to continue without uploading the file again. The combined agent is not an upload destination.

Physical page numbers begin at 1. The first range permanently sets the required content start. Coverage uses the union of completed ranges, not the highest chunk page. Replacements require explicit intent and must completely cover every completed range they overlap. Only one active job is allowed per document.

The URL stores `document` and `job` identifiers. Reloading validates them against the backend and resumes monitoring. A failed progress request does not fail the job. Leaving the page does not cancel ingestion. Failed ranges can be submitted as new jobs after reviewing refreshed coverage. After an uncertain POST, check history before a deliberate resubmission; never blindly repeat an upload.

Review the authenticated source PDF and coverage before choosing **Activate for Q&A**. Activation is enforced by the backend quality gate and deactivates other versions in the same corpus. Later successful ingestion requires another activation. The browser has no job reset API: ask a backend operator to inspect logs and recover jobs stranded by backend restarts.

## Runtime and upload limits

- `API_BASE_URL` is the server-only backend origin. Restart Next.js after changing it.
- `API_PROXY_TIMEOUT_MS` controls the Next.js external rewrite timeout, defaulting to 300000 ms. This covers source transfer and job preparation; it does not wait for background parsing or embeddings.
- Set body size limits and timeouts on the actual hosting platform and upstream reverse proxy for representative PDFs. The Next.js timeout does not override a hosting platform's limits.
- `experimental.proxyClientMaxBodySize` in `next.config.ts` sets the request buffer to 100 MB, including multipart fields. The installed Next.js version also uses this buffer for external rewrites without a `proxy.ts` file; the default 10 MB limit truncates larger uploads. Increase this setting for larger source PDFs and restart Next.js. Server Actions body limits do not control this multipart workflow.
- A 413, disconnected upload, or timeout must be reconciled with document/job history before another POST.

## Verification

Run `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e -- e2e/ingestion.spec.ts e2e/navigation.spec.ts`. If Playwright's bundled browser is absent, install it or set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome.

The browser tests use controlled API fixtures. They verify both destinations, real browser multipart boundaries and cookies, URL restoration, activation, access checks, and existing navigation. Unit tests cover coverage union, replacement boundaries, request payloads, structured quality errors, polling cleanup and backoff, and uncertain POST recovery. Fixtures do not exercise the real Next.js rewrite or backend parsing, storage, and embeddings.

For a separate real integration check:

1. Start a configured test backend and Next.js with the intended deployment proxy limits. Use an admin session and an approved guideline PDF; avoid activating test content in a production corpus.
2. Upload the complete PDF through `/admin/ingest` with a unique version label and a small first range. Inspect the POST's accepted range, document ID, and job ID.
3. Reload while processing and confirm real job states, terminal counters, metadata, and the authenticated PDF preview. Append the remaining range using `document_id`, including a representative large-source upload in the deployment size check.
4. Verify gaps disappear only after successful ingestion. Attempt a partial overlap, then a deliberate complete-range replacement. Review the parsed content and backend quality result before activating.
5. Confirm same-corpus status changes and that a Q&A response cites the new version. Confirm later successful ingestion removes its active status until reviewed and activated again.

The initial implementation environment had `API_BASE_URL=http://127.0.0.1:8000`, but its health endpoint was unreachable. A real upload and deployment capacity check remain required; passing fixture tests is not evidence of either.
