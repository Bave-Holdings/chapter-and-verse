import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type Agent, type Chat, type CitationSource } from "../../lib/api";
import { KnowledgeWorkspace } from "./workspace";

const mocks = vi.hoisted(() => {
  const replace = vi.fn();
  const push = vi.fn();
  return {
    router: { replace, push },
    replace,
    push,
    me: vi.fn(),
    logout: vi.fn(),
    agents: vi.fn(),
    listChats: vi.fn(),
    createChat: vi.fn(),
    getChat: vi.fn(),
    renameChat: vi.fn(),
    removeChat: vi.fn(),
    feedback: vi.fn(),
    stream: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={String(href)} {...props}>{children}</a> }));
vi.mock("next/image", () => ({
  default: ({ alt, priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    void priority;
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    return <img alt={alt ?? ""} {...props} />;
  },
}));
vi.mock("../../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/api")>();
  return {
    ...original,
    authApi: { ...original.authApi, me: mocks.me, logout: mocks.logout },
    agentsApi: { list: mocks.agents },
    chatsApi: {
      list: mocks.listChats,
      create: mocks.createChat,
      get: mocks.getChat,
      rename: mocks.renameChat,
      remove: mocks.removeChat,
    },
    feedbackApi: { send: mocks.feedback },
    streamQuestion: mocks.stream,
  };
});

const user = { id: "user-1", full_name: "Syed Ahmed", email: "person@example.com", role: "user", created_at: "2026-01-01T00:00:00Z" };
const agents: Agent[] = [
  {
    key: "mortgage_guidelines", slug: "mortgage", name: "Mortgage guidelines", live: true,
    kb_label: "Selling Guide", empty_title: "Ask mortgage", empty_sub: "", placeholder: "Message…",
    chips: ["What is the rule?"], document_count: 1, pages_ingested: 10, total_pages: 10, has_documents: true,
  },
  {
    key: "fha_handbook", slug: "fha", name: "FHA handbook", live: true,
    kb_label: "FHA", empty_title: "Ask FHA", empty_sub: "", placeholder: "Ask FHA…",
    chips: ["What is the FHA rule?"], document_count: 1, pages_ingested: 5, total_pages: 5, has_documents: true,
  },
  {
    key: "compliance", slug: "compliance", name: "Compliance", live: false,
    kb_label: "", empty_title: "", empty_sub: "", placeholder: "", chips: [],
    document_count: 0, pages_ingested: 0, total_pages: 0, has_documents: false,
  },
];
const chat: Chat = {
  id: "chat-1", user_id: user.id, agent_key: agents[0].key, title: "Chat one",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const fhaChat: Chat = {
  ...chat,
  id: "chat-fha",
  agent_key: "fha_handbook",
  title: "FHA chat",
};

describe("KnowledgeWorkspace integration", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => { if (typeof mock === "function") mock.mockReset(); });
    mocks.me.mockResolvedValue(user);
    mocks.logout.mockResolvedValue({ status: "ok" });
    mocks.agents.mockResolvedValue(agents);
    mocks.listChats.mockResolvedValue([]);
    mocks.createChat.mockResolvedValue(chat);
    mocks.feedback.mockResolvedValue({ status: "ok", audit_id: "audit-1", feedback: "up" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("redirects an unauthenticated session to login", async () => {
    mocks.me.mockRejectedValue(new ApiError("Unauthorized", 401));
    render(<KnowledgeWorkspace />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
  });

  it("navigates directly to the profile from the initials button", async () => {
    render(<KnowledgeWorkspace />);

    const profileButton = await screen.findByRole("button", { name: "View profile" });
    expect(profileButton).toHaveTextContent("SA");
    fireEvent.click(profileButton);

    expect(mocks.push).toHaveBeenCalledWith("/profile");
    expect(screen.queryByText(/Signed in as/i)).not.toBeInTheDocument();
  });

  it("renders most-asked dashboard cards and submits them through the card's agent", async () => {
    mocks.createChat.mockResolvedValue(fhaChat);
    mocks.stream.mockImplementation(async (_question, _chatId, handlers) => {
      handlers.onEvent({ event: "done", data: { status: "answered", answer: "FHA answer", sources: [], audit_id: null, latency_ms: 400 } });
    });
    render(<KnowledgeWorkspace />);

    expect(await screen.findByRole("heading", { name: "What do you need to check today?" })).toBeInTheDocument();
    expect(screen.getAllByText("Knowledge Hub")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Good afternoon, Syed Ahmed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View profile" })).toHaveTextContent("SA");
    expect(screen.queryByRole("textbox", { name: "Write a message" })).not.toBeInTheDocument();
    const cards = screen.getByLabelText("Most asked questions");
    expect(within(cards).getByRole("button", { name: "Ask Fannie Mae Selling Guide: What is the rule?" })).toBeInTheDocument();

    fireEvent.click(within(cards).getByRole("button", { name: "Ask FHA Handbook 4000.1: What is the FHA rule?" }));

    await waitFor(() => expect(mocks.createChat).toHaveBeenCalledWith("fha_handbook"));
    expect(mocks.stream).toHaveBeenCalledWith("What is the FHA rule?", fhaChat.id, expect.any(Object), expect.any(AbortSignal));
    expect(await screen.findByRole("log")).toHaveTextContent("FHA answer");
    expect(screen.getAllByText("Mortgage / FHA Handbook 4000.1")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "FHA Handbook 4000.1" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Good afternoon, Syed" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Write a message" })).toBeInTheDocument();
  });

  it("opens the Mortgage category drawer and routes category choices", async () => {
    const keyboard = userEvent.setup();
    render(<KnowledgeWorkspace />);

    const navigation = await screen.findByRole("navigation", { name: "Knowledge agents" });
    const mortgage = within(navigation).getByRole("button", { name: "Mortgage" });
    expect(within(navigation).getAllByRole("button", { name: "Mortgage" })).toHaveLength(1);
    expect(mortgage).toHaveAttribute("aria-expanded", "false");
    expect(mortgage).toHaveAttribute("data-active", "true");
    expect(within(navigation).queryByRole("button", { name: "Fannie Mae Selling Guide" })).not.toBeInTheDocument();

    mortgage.focus();
    await keyboard.keyboard("{Enter}");
    expect(mortgage).toHaveAttribute("aria-expanded", "true");
    expect(mocks.push).not.toHaveBeenCalled();

    const categoryDrawer = screen.getByRole("complementary", { name: "Mortgage category drawer" });
    expect(within(categoryDrawer).getByRole("heading", { name: "Categories" })).toBeInTheDocument();
    expect(within(categoryDrawer).getByRole("heading", { name: "Chat history" })).toBeInTheDocument();
    const mortgageAgents = within(categoryDrawer).getByRole("group", { name: "Mortgage agents" });
    expect(within(mortgageAgents).getByRole("button", { name: "Fannie Mae Selling Guide" })).toHaveAttribute("aria-pressed", "true");
    expect(within(mortgageAgents).getByRole("button", { name: "FHA Handbook 4000.1" })).toBeEnabled();
    expect(within(categoryDrawer).queryByRole("button", { name: "Close category drawer" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Fannie Mae Selling Guide quick questions" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Write a message" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "What do you need to check today?" })).not.toBeInTheDocument();

    fireEvent.click(within(categoryDrawer).getByRole("button", { name: "New chat" }));
    expect(screen.getByRole("textbox", { name: "Write a message" })).toBeInTheDocument();

    await keyboard.keyboard("{Escape}");
    const persistentDrawer = screen.getByRole("complementary", { name: "Mortgage category drawer" });

    fireEvent.click(within(persistentDrawer).getByRole("button", { name: "Fannie Mae Selling Guide" }));
    expect(mocks.push).toHaveBeenCalledWith("/category/mortgage");
    fireEvent.click(within(persistentDrawer).getByRole("button", { name: "FHA Handbook 4000.1" }));
    expect(mocks.push).toHaveBeenCalledWith("/category/fha");
    expect(screen.getAllByRole("button", { name: /Compliance/ })[0]).toBeDisabled();
  });

  it("keeps Fannie and FHA chat histories isolated when switching agents", async () => {
    mocks.listChats.mockImplementation(async (agentKey: string) => agentKey === "fha_handbook" ? [fhaChat] : [chat]);
    mocks.getChat.mockResolvedValue({
      ...chat,
      messages: [{
        id: "message-1", chat_id: chat.id, role: "user", content: "Fannie question",
        sources: [], status: null, audit_id: null, created_at: "2026-01-01T00:00:00Z",
      }],
    });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);

    expect(await screen.findByRole("button", { name: "Chat one" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat one" })).toHaveAttribute("title", "Chat one");
    expect(mocks.listChats).toHaveBeenCalledWith("mortgage_guidelines", expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "Chat one" }));
    expect(await screen.findByRole("log")).toHaveTextContent("Fannie question");

    const navigation = screen.getByRole("navigation", { name: "Knowledge agents" });
    const categoryDrawer = screen.getByRole("complementary", { name: "Mortgage category drawer" });
    fireEvent.click(within(categoryDrawer).getByRole("button", { name: "FHA Handbook 4000.1" }));

    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chat one" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "FHA chat" })).toBeInTheDocument();
    expect(mocks.listChats).toHaveBeenCalledWith("fha_handbook", expect.any(AbortSignal));
    expect(within(categoryDrawer).getByRole("button", { name: "FHA Handbook 4000.1" })).toHaveAttribute("aria-pressed", "true");
    expect(within(navigation).getByRole("button", { name: "Mortgage" })).toHaveAttribute("data-active", "true");
    expect(screen.queryByRole("button", { name: "Chat one" })).not.toBeInTheDocument();
  });

  it("loads, renames, and deletes chats from the category rail", async () => {
    mocks.listChats.mockResolvedValue([chat]);
    mocks.getChat.mockResolvedValue({ ...chat, messages: [] });
    mocks.renameChat.mockResolvedValue({ ...chat, title: "Renamed" });
    mocks.removeChat.mockResolvedValue({ status: "ok", id: chat.id });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);

    fireEvent.click(await screen.findByRole("button", { name: "Chat one" }));
    await waitFor(() => expect(mocks.getChat).toHaveBeenCalledWith(chat.id, expect.any(AbortSignal)));

    fireEvent.click(screen.getByRole("button", { name: "Rename Chat one" }));
    fireEvent.change(screen.getByLabelText("Chat title"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Renamed" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Delete Renamed" }));
    await waitFor(() => expect(mocks.removeChat).toHaveBeenCalledWith(chat.id));
    expect(screen.queryByRole("button", { name: "Renamed" })).not.toBeInTheDocument();
  });

  it("keeps the category drawer open and restores quick questions for a new chat", async () => {
    mocks.listChats.mockResolvedValue([chat]);
    mocks.getChat.mockResolvedValue({
      ...chat,
      messages: [{
        id: "message-1", chat_id: chat.id, role: "user", content: "Existing question",
        sources: [], status: null, audit_id: null, created_at: "2026-01-01T00:00:00Z",
      }],
    });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);

    fireEvent.click(await screen.findByRole("button", { name: "Chat one" }));
    expect(await screen.findByRole("log")).toHaveTextContent("Existing question");
    expect(screen.getAllByText("Mortgage / Fannie Mae Selling Guide")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Fannie Mae Selling Guide" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));

    expect(screen.getByRole("complementary", { name: "Mortgage category drawer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mortgage" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Fannie Mae Selling Guide quick questions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Good afternoon, Syed Ahmed" })).toBeInTheDocument();
    expect(screen.queryAllByText("Mortgage / Fannie Mae Selling Guide")).toHaveLength(0);
  });

  it("shows quick questions for an empty existing chat", async () => {
    mocks.listChats.mockResolvedValue([chat]);
    mocks.getChat.mockResolvedValue({ ...chat, messages: [] });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);

    fireEvent.click(await screen.findByRole("button", { name: "Chat one" }));

    await waitFor(() => expect(mocks.getChat).toHaveBeenCalledWith(chat.id, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.queryByRole("log")).not.toBeInTheDocument());
    expect(screen.getByRole("group", { name: "Fannie Mae Selling Guide quick questions" })).toBeInTheDocument();
  });

  it("starts one chat directly from a subcategory quick question and preserves the category panel", async () => {
    mocks.stream.mockImplementation(async (_question, _chatId, handlers) => {
      handlers.onEvent({ event: "done", data: { status: "answered", answer: "Quick answer", sources: [], audit_id: null, latency_ms: 300 } });
    });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    const quickQuestion = await screen.findByRole("button", { name: "Ask Fannie Mae Selling Guide: What is the rule?" });

    fireEvent.click(quickQuestion);
    fireEvent.click(quickQuestion);

    await waitFor(() => expect(mocks.createChat).toHaveBeenCalledTimes(1));
    expect(mocks.createChat).toHaveBeenCalledWith("mortgage_guidelines");
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(mocks.stream).toHaveBeenCalledWith("What is the rule?", chat.id, expect.any(Object), expect.any(AbortSignal));
    const conversation = await screen.findByRole("log");
    expect(conversation).toHaveTextContent("What is the rule?");
    expect(conversation).toHaveTextContent("Quick answer");
    expect(screen.queryByRole("group", { name: "Fannie Mae Selling Guide quick questions" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Mortgage category drawer" })).toBeInTheDocument();
    const mainNavigation = screen.getByRole("complementary", { name: "Main navigation" });
    expect(within(mainNavigation).getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("title", "Expand sidebar");

    fireEvent.click(within(mainNavigation).getByRole("button", { name: "Expand sidebar" }));
    expect(within(mainNavigation).getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("title", "Collapse sidebar");
    expect(screen.getByRole("log")).toHaveTextContent("Quick answer");
  });

  it("manually collapses and expands the black menu without hiding the category panel", async () => {
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    const mainNavigation = await screen.findByRole("complementary", { name: "Main navigation" });

    fireEvent.click(within(mainNavigation).getByRole("button", { name: "Collapse sidebar" }));
    expect(within(mainNavigation).getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("title", "Expand sidebar");
    expect(screen.getByRole("complementary", { name: "Mortgage category drawer" })).toBeInTheDocument();

    fireEvent.click(within(mainNavigation).getByRole("button", { name: "Expand sidebar" }));
    expect(within(mainNavigation).getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("title", "Collapse sidebar");
    expect(screen.getByRole("complementary", { name: "Mortgage category drawer" })).toBeInTheDocument();
  });

  it("creates a chat, streams citations without duplicating done.answer, and submits feedback", async () => {
    const source: CitationSource = {
      index: 1, document_id: "doc", doc_name: "Guide.pdf", source_path: "Guide.pdf", page_number: 4,
      section_id: "A1", sub_section_id: null, citation_url: "/api/v1/documents/doc/file#page=4",
    };
    mocks.stream.mockImplementation(async (_question, _chatId, handlers) => {
      handlers.onEvent({ event: "status", data: { message: "Searching guidelines..." } });
      handlers.onEvent({ event: "sources", data: { sources: [source] } });
      handlers.onEvent({ event: "token", data: { text: "Answer [1]" } });
      handlers.onEvent({ event: "done", data: { status: "answered", answer: "Answer [1]", sources: [source], audit_id: "audit-1", latency_ms: 1200 } });
    });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    const input = await screen.findByRole("textbox", { name: "Write a message" });
    fireEvent.change(input, { target: { value: "Question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    const citation = await screen.findByRole("button", { name: "Show source 1" });
    expect(mocks.createChat).toHaveBeenCalledWith("mortgage_guidelines");
    expect(screen.getByRole("img", { name: "Chapter & Verse" })).toHaveAttribute("src", "/chapter-verse-mark.svg");
    expect(screen.getByRole("log")).toHaveTextContent("Answer 1");
    expect(screen.getByRole("log")).not.toHaveTextContent("Answer 1Answer 1");
    fireEvent.click(citation);
    expect(screen.getByRole("link", { name: /Guide\.pdf.*page 4/i })).toHaveAttribute("href", source.citation_url);
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    await waitFor(() => expect(mocks.feedback).toHaveBeenCalledWith("audit-1", "up"));
  });

  it.each([
    ["Fannie Mae Selling Guide", "mortgage", "mortgage_guidelines"],
    ["FHA Handbook 4000.1", "fha", "fha_handbook"],
  ])("creates %s chats with only the exact backend key", async (_label, slug, agentKey) => {
    const scopedChat = { ...chat, id: `chat-${agentKey}`, agent_key: agentKey };
    mocks.createChat.mockResolvedValue(scopedChat);
    mocks.stream.mockResolvedValue(undefined);
    render(<KnowledgeWorkspace categoryMode initialAgentSlug={slug} />);

    const input = await screen.findByRole("textbox", { name: "Write a message" });
    fireEvent.change(input, { target: { value: "Scoped question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(mocks.createChat).toHaveBeenCalledWith(agentKey));
    expect(mocks.stream).toHaveBeenCalledWith("Scoped question", scopedChat.id, expect.any(Object), expect.any(AbortSignal));
  });

  it("cancels an in-flight response and exposes a retry action", async () => {
    mocks.stream.mockImplementationOnce((_question, _chatId, _handlers, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })).mockImplementationOnce(async (_question, _chatId, handlers) => {
      handlers.onEvent({ event: "error", data: { status: "error", error: "Still unavailable" } });
    });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    const input = await screen.findByRole("textbox", { name: "Write a message" });
    fireEvent.change(input, { target: { value: "Question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("status", { name: "Generating answer" })).toBeInTheDocument();
    expect(screen.getByRole("log")).not.toHaveTextContent("Thinking");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel response" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
    expect((await screen.findAllByText("Still unavailable")).length).toBeGreaterThan(0);
  });

  it("keeps navigation usable through the mobile drawer", async () => {
    render(<KnowledgeWorkspace />);
    const open = await screen.findByRole("button", { name: "Open navigation" });
    fireEvent.click(open);
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toHaveAttribute("open");
    const mortgage = within(dialog).getByRole("button", { name: "Mortgage" });
    expect(mortgage).toHaveAttribute("aria-expanded", "false");
    expect(within(dialog).queryByRole("button", { name: "Fannie Mae Selling Guide" })).not.toBeInTheDocument();
    fireEvent.click(mortgage);
    const categoryDrawer = screen.getByRole("complementary", { name: "Mortgage category drawer" });
    expect(within(categoryDrawer).getByRole("button", { name: "Fannie Mae Selling Guide" })).toBeEnabled();
    fireEvent.click(within(categoryDrawer).getByRole("button", { name: "FHA Handbook 4000.1" }));
    expect(mocks.push).toHaveBeenCalledWith("/category/fha");
  });
});
