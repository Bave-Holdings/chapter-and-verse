import { expect, test, type Page } from "@playwright/test";
import { adminUser, guidelineDocument, ingestionAgents, rangeJob } from "../tests/fixtures/ingestion";

async function fixture(page: Page, role = "admin") {
  let document = { ...guidelineDocument };
  const older = { ...guidelineDocument, id: "33333333-3333-4333-8333-333333333333", name: "previous.pdf", status: "active", version: "v2025" };
  let job = { ...rangeJob, updated_at: new Date().toISOString() };
  let uploaded = false;
  let polls = 0;
  let finish = false;
  const uploads: { body: string; contentType: string; cookie: string }[] = [];
  const protectedPaths: string[] = [];
  await page.context().addCookies([{ name: "session", value: "controlled-test-session", domain: "localhost", path: "/", httpOnly: true }]);
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (path.endsWith("/auth/me")) return json({ ...adminUser, role }, role === "signed-out" ? 401 : 200);
    if (path.endsWith("/agents")) return json(ingestionAgents.map((agent) => ({ ...agent, document_count: document.status === "active" ? 1 : 0, has_documents: document.status === "active" })));
    if (path.endsWith("/chats")) return json([]);
    protectedPaths.push(path);
    if (path.endsWith("/ingest/range")) {
      const body = request.postDataBuffer()!.toString("utf8");
      uploads.push({ body, contentType: request.headers()["content-type"], cookie: request.headers().cookie ?? "" });
      uploaded = true;
      document = { ...document, agent_key: body.includes("fha_handbook") ? "fha_handbook" : "mortgage_guidelines" };
      return json({ job_id: job.id, document_id: document.id, document_name: document.name, from_page: 1, to_page: 10, status: "pending" });
    }
    if (path.endsWith("/documents")) return json(uploaded ? [document, older] : [older]);
    if (path.endsWith("/ingest/jobs")) return json(uploaded ? [job] : []);
    if (path.endsWith(`/jobs/${job.id}`)) {
      polls += 1;
      job = { ...job, status: finish ? "done" : "sectioning", pages: 10, section_pages: finish ? 10 : 4, chunks: finish ? 20 : 0, sections: finish ? 3 : 0 };
      if (finish) document = { ...document, status: "ready", page_count: 10 };
      return json(job);
    }
    if (path.endsWith("/ingests")) return json([job]);
    if (path.endsWith("/status")) {
      expect(request.postDataJSON()).toEqual({ status: "active" });
      document = { ...document, status: "active" };
      if (older.agent_key === document.agent_key) older.status = "inactive";
      return json(document);
    }
    if (path.endsWith(`/documents/${document.id}`)) return json(document);
    return json({ detail: "Missing fixture" }, 404);
  });
  return { uploads, protectedPaths, finish: () => { finish = true; }, polls: () => polls };
}

for (const corpus of ["mortgage_guidelines", "fha_handbook"]) {
  test(`admin uploads ${corpus}, resumes after reload, reviews and activates`, async ({ page }) => {
    const backend = await fixture(page);
    await page.goto("/home");
    await page.getByRole("link", { name: "Ingestion admin", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Guideline ingestion" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Write a message" })).toHaveCount(0);
    const corpusSelect = page.getByRole("combobox", { name: "Corpus", exact: true });
    await expect(corpusSelect.locator("option")).toHaveCount(3);
    await expect(corpusSelect).not.toContainText("Combined");
    await corpusSelect.selectOption(corpus);
    await page.getByLabel("Complete source PDF").setInputFiles({ name: "guide.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nControlled upload fixture\n%%EOF") });
    await page.getByLabel("Last physical page").fill("100");
    await page.getByRole("button", { name: "Upload and start ingestion" }).click();
    await expect(page.getByText(/Accepted physical pages 1–10/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`document=${guidelineDocument.id}&job=${rangeJob.id}`));
    await expect(page.getByRole("region", { name: "Job monitor" })).toContainText("Section detection: 4 / 10");
    expect(backend.uploads).toHaveLength(1);
    expect(backend.uploads[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(backend.uploads[0].body).toContain(`name="agent_key"\r\n\r\n${corpus}`);
    expect(backend.uploads[0].cookie).toContain("session=controlled-test-session");
    await page.reload();
    await expect(page.getByRole("region", { name: "Job monitor" })).toContainText("Section detection");
    backend.finish();
    await expect(page.getByText("10 / 10 required pages covered")).toBeVisible({ timeout: 12000 });
    const review = page.getByRole("region", { name: "Document review" });
    await expect(review).toContainText("Document: ready");
    await expect(review.getByRole("link", { name: /Open source PDF/ })).toHaveAttribute("href", `/api/v1/documents/${guidelineDocument.id}/file#page=1`);
    await expect(review).toContainText("including documents with different filenames");
    await review.getByRole("checkbox", { name: /I reviewed/ }).check();
    await review.getByRole("button", { name: "Activate for Q&A" }).click();
    await expect(review).toContainText("Document: active");
    await expect(page.getByRole("region", { name: "Documents", exact: true })).toContainText("Q&A available");
    if (corpus === "mortgage_guidelines") await expect(page.getByRole("row").filter({ hasText: "previous.pdf" })).toContainText("inactive");
    const pollCount = backend.polls();
    await page.getByRole("link", { name: "All Libraries", exact: true }).click();
    await expect(page.getByRole("heading", { name: "What do you need to check today?" })).toBeVisible();
    expect(backend.polls()).toBe(pollCount);
  });
}

for (const role of ["user", "signed-out"]) {
  test(`${role} cannot load ingestion data`, async ({ page }) => {
    const backend = await fixture(page, role);
    await page.goto("/admin/ingest");
    if (role === "user") {
      await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Ingestion admin", exact: true })).toHaveCount(0);
    } else await expect(page).toHaveURL(/\/login$/);
    expect(backend.protectedPaths).toEqual([]);
  });
}
