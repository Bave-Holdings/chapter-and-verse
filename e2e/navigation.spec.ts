import { expect, test, type Page } from "@playwright/test";

const timestamp = "2026-09-24T08:00:00Z";
const common = { live: true, has_documents: true, document_count: 1, pages_ingested: 1, total_pages: 1, empty_title: "", empty_sub: "", placeholder: "Ask a question", kb_label: "Guide" };
const agents = [
  { ...common, key: "mortgage_guidelines", slug: "mortgage", name: "Fannie Mae Selling Guide", chips: ["Fannie question"] },
  { ...common, key: "fha_handbook", slug: "fha", name: "FHA Handbook 4000.1", chips: ["FHA question"] },
  { ...common, key: "compliance", slug: "compliance", name: "Compliance", chips: ["Compliance question"] },
];
const chats = [
  { id: "fannie /?&", agent_key: "mortgage_guidelines", title: "Saved Fannie chat" },
  { id: "fannie-two", agent_key: "mortgage_guidelines", title: "Second Fannie chat" },
  { id: "fha-one", agent_key: "fha_handbook", title: "Saved FHA chat" },
].map((chat) => ({ ...chat, user_id: "user", created_at: timestamp, updated_at: timestamp }));

async function mockApi(page: Page, initiallyAuthenticated = true) {
  const requests: string[] = [];
  let authenticated = initiallyAuthenticated;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    requests.push(path);
    if (path === "/api/v1/auth/logout") authenticated = false;
    if (path === "/api/v1/auth/login" || path === "/api/v1/auth/signup") authenticated = true;
    if (path === "/api/v1/auth/me" && !authenticated) {
      await route.fulfill({ status: 401, json: { detail: "Unauthorized" } });
      return;
    }
    if (path.startsWith("/api/v1/auth/")) {
      await route.fulfill({ json: { id: "user", full_name: "Test User", email: "test@example.test", role: "user", created_at: timestamp } });
    } else if (path === "/api/v1/agents") {
      await route.fulfill({ json: agents });
    } else if (path === "/api/v1/chats" && request.method() === "POST") {
      await route.fulfill({ json: { ...chats[0], id: "created-chat", agent_key: request.postDataJSON().agent_key } });
    } else if (path === "/api/v1/chats") {
      await route.fulfill({ json: chats.filter((chat) => chat.agent_key === url.searchParams.get("agent_key")) });
    } else if (path.startsWith("/api/v1/chats/")) {
      const chat = chats.find((item) => item.id === decodeURIComponent(path.slice("/api/v1/chats/".length)));
      await route.fulfill(chat ? { json: { ...chat, messages: [{ id: `message-${chat.id}`, chat_id: chat.id, role: "user", content: `Question from ${chat.title}`, sources: [], created_at: timestamp }] } } : { status: 404, json: { detail: "Chat not found" } });
    } else if (path === "/api/v1/ask/stream") {
      await route.fulfill({ contentType: "text/event-stream", body: `event: done\ndata: ${JSON.stringify({ status: "answered", answer: `Completed answer. [Open FHA](/category/fha). [Profile](${url.origin}/profile). [Reference](https://example.com/guide). [PDF](/api/v1/documents/guide/file#page=12).`, sources: [] })}\n\n` });
    } else {
      throw new Error(`Unexpected API request: ${request.method()} ${path}`);
    }
  });
  return requests;
}

// Check both document identity and network requests: a router mock cannot detect
// a browser reload or the workspace remount that originally caused the flash.
async function trackDocument(page: Page) {
  const document = await page.evaluateHandle(() => window.document);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) requests.push(request.url());
  });
  return async () => {
    expect(requests).toEqual([]);
    expect(await document.evaluate((original) => original === window.document)).toBe(true);
  };
}

async function selectScope(page: Page, name: string) {
  await page.getByRole("button", { name: "Agent scope", exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
}

test("categories, sidebar links, profile, and back/forward retain the document and workspace", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/category/mortgage");
  await expect(page.getByRole("button", { name: "Agent scope", exact: true })).toContainText("Fannie Mae");
  await expect(page.getByRole("button", { name: chats[0].title, exact: true })).toBeVisible();
  const checkDocument = await trackDocument(page);
  const sidebar = await page.getByRole("complementary", { name: "Main navigation" }).elementHandle();
  const agentLoads = requests.filter((path) => path.endsWith("/agents")).length;
  const historyLoads = requests.filter((path) => path === "/api/v1/chats").length;

  await selectScope(page, "FHA");
  await expect(page).toHaveURL(/\/category\/fha$/);
  await expect(page.getByRole("group", { name: "FHA Handbook 4000.1 quick questions" })).toBeVisible();
  await selectScope(page, "Fannie Mae");
  await expect(page).toHaveURL(/\/category\/mortgage$/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Agent scope", exact: true })).toContainText("FHA");
  await page.goForward();
  await expect(page.getByRole("button", { name: "Agent scope", exact: true })).toContainText("Fannie Mae");
  await page.getByRole("button", { name: "Compliance", exact: true }).click();
  await expect(page).toHaveURL(/\/category\/compliance$/);
  await expect(page.getByRole("button", { name: "Compliance", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Account settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account info" })).toBeVisible();
  await page.getByRole("link", { name: "All Libraries", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("link", { name: "All Libraries", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Mortgage", exact: true }).click();
  await expect(page).toHaveURL(/\/category\/mortgage$/);
  await checkDocument();
  expect(await sidebar!.evaluate((original) => original === document.querySelector('aside[aria-label="Main navigation"]'))).toBe(true);
  expect(requests.filter((path) => path.endsWith("/agents"))).toHaveLength(agentLoads);
  expect(requests.filter((path) => path === "/api/v1/chats")).toHaveLength(historyLoads);
});

test("chat query parameters, same-category history, cross-category history, and new questions", async ({ page }) => {
  await mockApi(page);
  const firstUrl = `/category/mortgage?chat=${encodeURIComponent(chats[0].id)}&view=saved`;
  await page.goto(firstUrl);
  await expect(page.getByRole("log")).toContainText(`Question from ${chats[0].title}`);
  const checkDocument = await trackDocument(page);
  await page.getByRole("button", { name: chats[1].title, exact: true }).click();
  await expect(page).toHaveURL(/chat=fannie-two$/);
  await expect(page.getByRole("log")).toContainText(`Question from ${chats[1].title}`);
  await page.goBack();
  await expect(page).toHaveURL(new URL(firstUrl, page.url()).href);
  await expect(page.getByRole("log")).toContainText(`Question from ${chats[0].title}`);
  await page.goForward();
  await expect(page.getByRole("log")).toContainText(`Question from ${chats[1].title}`);
  await page.getByRole("button", { name: chats[2].title, exact: true }).click();
  await expect(page).toHaveURL(/\/category\/fha\?chat=fha-one$/);
  await expect(page.getByRole("button", { name: chats[2].title, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "New Question", exact: true }).click();
  await expect(page).toHaveURL(/\/category\/fha$/);
  await expect(page.getByRole("group", { name: "FHA Handbook 4000.1 quick questions" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("log")).toContainText(`Question from ${chats[2].title}`);
  await checkDocument();
});

test("cards and chat creation keep the active answer when replacing the URL", async ({ page }) => {
  await mockApi(page);
  await page.goto("/category/fha");
  await expect(page.getByRole("button", { name: "Ask FHA Handbook 4000.1: FHA question" })).toBeVisible();
  const checkDocument = await trackDocument(page);
  await page.getByRole("button", { name: "Ask FHA Handbook 4000.1: FHA question" }).click();
  await expect(page).toHaveURL(/\/category\/fha\?chat=created-chat$/);
  await expect(page.getByRole("log")).toContainText("Completed answer");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export conversation" }).click();
  expect((await download).suggestedFilename()).toBe("chapter-and-verse-conversation.json");
  await page.getByRole("link", { name: "All Libraries", exact: true }).click();
  await page.getByRole("button", { name: "Ask Fannie Mae Selling Guide: Fannie question" }).click();
  await expect(page.getByRole("log")).toContainText("Completed answer");
  await expect(page.getByRole("link", { name: "Reference", exact: true })).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("link", { name: "PDF", exact: true })).toHaveAttribute("href", "/api/v1/documents/guide/file#page=12");
  await page.getByRole("link", { name: "Open FHA", exact: true }).click();
  await expect(page).toHaveURL(/\/category\/fha$/);
  await page.getByRole("button", { name: "Ask FHA Handbook 4000.1: FHA question" }).click();
  await expect(page.getByRole("log")).toContainText("Completed answer");
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await checkDocument();
});

test("mobile links close the drawer and retain the shared sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/home/chat");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  const checkDocument = await trackDocument(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog", { name: "Navigation", exact: true }).getByRole("link", { name: "Account settings" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("dialog", { name: "Navigation", exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog", { name: "Navigation", exact: true }).getByRole("link", { name: "All Libraries", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("dialog", { name: "Navigation", exact: true })).not.toBeVisible();
  await checkDocument();
});

test("auth links, form redirects, logout, and protected history use client navigation", async ({ page }) => {
  await mockApi(page, false);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  const checkDocument = await trackDocument(page);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByRole("link", { name: "Go back", exact: true }).click();
  await page.getByRole("link", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByRole("link", { name: "Log In", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email Address", { exact: true }).fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("button", { name: "Mortgage", exact: true }).click();
  await expect(page).toHaveURL(/\/category\/mortgage$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Log In", exact: true })).toBeVisible();
  await checkDocument();
});

for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
  test(`signed-in visitors go home from ${path}`, async ({ page }) => {
    await mockApi(page);
    await page.goto(path);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { name: "What do you need to check today?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log In", exact: true })).toHaveCount(0);
  });
}

test("the dedicated signup page creates an account and enters home", async ({ page }) => {
  await mockApi(page, false);
  await page.goto("/signup");
  await page.getByLabel("Full Name", { exact: true }).fill("Test User");
  await page.getByLabel("Email Address", { exact: true }).fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("category aliases and invalid category/chat guards preserve client routing", async ({ page }) => {
  await mockApi(page);
  await page.goto("/category?chat=missing");
  await expect(page).toHaveURL(/\/category\/mortgage$/);
  const checkDocument = await trackDocument(page);
  await page.getByRole("link", { name: "Chapter and Verse home", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await checkDocument();
  await page.goto("/category/unknown");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "What do you need to check today?" })).toBeVisible();
});

for (const width of [1512, 390]) {
  test(`history search opens, filters, dismisses, and navigates without reloading at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests = await mockApi(page);
    await page.goto("/home");
    const trigger = page.getByRole("button", { name: "Search chat history", exact: true });
    await expect(trigger).toBeVisible();
    const checkDocument = await trackDocument(page);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Search chat history", exact: true });
    const search = dialog.getByRole("searchbox", { name: "Search chats" });
    await expect(search).toBeFocused();
    await expect(dialog.getByRole("button", { name: chats[0].title, exact: true })).toBeVisible();
    const historyLoads = requests.filter((path) => path === "/api/v1/chats").length;
    await page.screenshot({ path: `.preview/history-search-${width}.png` });
    await search.fill("no matching title");
    await expect(dialog.getByRole("status")).toContainText("No chats match");
    await search.fill("  fha  ");
    await expect(dialog.getByRole("button", { name: chats[0].title, exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: chats[2].title, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(search).toHaveValue("");
    await dialog.getByRole("button", { name: "Close history search" }).click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(5, 5);
    await expect(dialog).not.toBeVisible();
    await trigger.click();
    await search.fill("fha");
    await page.keyboard.press("ArrowDown");
    await expect(dialog.getByRole("button", { name: chats[2].title, exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/category\/fha\?chat=fha-one$/);
    await expect(page.getByRole("log")).toContainText(`Question from ${chats[2].title}`);
    await expect(dialog).not.toBeVisible();
    expect(requests.filter((path) => path === "/api/v1/chats")).toHaveLength(historyLoads);
    await checkDocument();
  });
}
