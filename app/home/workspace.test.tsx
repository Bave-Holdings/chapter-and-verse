import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type Agent, type AnswerPresentation, type Chat, type CitationSource } from "../../lib/api";
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
    updateUiState: vi.fn(),
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
      updateMessageUiState: mocks.updateUiState,
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
    window.history.replaceState(null, "", "/home");
    mocks.me.mockResolvedValue(user);
    mocks.logout.mockResolvedValue({ status: "ok" });
    mocks.agents.mockResolvedValue(agents);
    mocks.listChats.mockResolvedValue([]);
    mocks.createChat.mockResolvedValue(chat);
    mocks.feedback.mockResolvedValue({ status: "ok", audit_id: "audit-1", feedback: "up" });
    mocks.updateUiState.mockResolvedValue({ message_id: "message-structured", ui_state: { completed_step_ids: [], checked_document_ids: [] } });
  });

  it("redirects an unauthenticated session to login", async () => {
    mocks.me.mockRejectedValue(new ApiError("Unauthorized", 401));
    render(<KnowledgeWorkspace />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
  });

  it("navigates directly to the profile from the initials button", async () => {
    render(<KnowledgeWorkspace />);

    const profileButton = await screen.findByRole("link", { name: "View profile" });
    expect(profileButton).toHaveTextContent("SA");
    expect(profileButton).toHaveAttribute("href", "/profile");
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
    expect(screen.getByRole("link", { name: "View profile" })).toHaveTextContent("SA");
    expect(screen.getByRole("textbox", { name: "Write a message" })).toHaveAttribute("placeholder", "Hey, quick question…");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
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

  it("selects Fannie Mae and FHA from the header without a category panel", async () => {
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    const scope = await screen.findByRole("button", { name: "Agent scope" });
    expect(scope).toHaveTextContent("Fannie Mae");
    fireEvent.click(scope);
    const options = screen.getByRole("listbox", { name: "Agent scope options" });
    expect(within(options).getByRole("option", { name: "Fannie Mae" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(options).getByRole("option", { name: "FHA" }));
    expect(scope).toHaveTextContent("FHA");
    expect(mocks.push).toHaveBeenCalledWith("/category/fha", { scroll: false });
    expect(screen.getByRole("group", { name: "FHA Handbook 4000.1 quick questions" })).toBeInTheDocument();
    fireEvent.click(scope);
    fireEvent.click(screen.getByRole("option", { name: "Fannie Mae" }));
    expect(mocks.push).toHaveBeenCalledWith("/category/mortgage", { scroll: false });
    expect(screen.queryByRole("complementary", { name: /category drawer/i })).not.toBeInTheDocument();
    expect(mocks.me).toHaveBeenCalledTimes(1);
  });

  it("keeps all scope histories visible and selects a chat's owning agent", async () => {
    const complianceChat = { ...chat, id: "compliance-chat", agent_key: "compliance", title: "Compliance history" };
    const olderChats = Array.from({ length: 5 }, (_, index) => ({ ...chat, id: "older-" + index, title: "Older chat " + index, updated_at: "2025-01-01T00:00:00Z" }));
    const newestFha = { ...fhaChat, updated_at: "2026-02-01T00:00:00Z" };
    mocks.listChats.mockImplementation(async (key: string) => key === "fha_handbook" ? [newestFha] : key === "compliance" ? [complianceChat] : [chat, ...olderChats]);
    mocks.getChat.mockImplementation(async (id: string) => ({
      ...(id === fhaChat.id ? fhaChat : chat),
      messages: [{ id: "message-1", chat_id: id, role: "user", content: id === fhaChat.id ? "FHA question" : "Fannie question", sources: [], created_at: chat.created_at }],
    }));
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    await screen.findByRole("button", { name: "FHA chat" });
    const history = screen.getByRole("region", { name: "Recent conversations" });
    expect(within(history).getAllByRole("button", { pressed: false }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "FHA chat", "Chat one", "Compliance history", ...olderChats.map((item) => item.title),
    ]);
    expect(mocks.listChats).toHaveBeenCalledWith("mortgage_guidelines", expect.any(AbortSignal));
    expect(mocks.listChats).toHaveBeenCalledWith("fha_handbook", expect.any(AbortSignal));
    expect(mocks.listChats).toHaveBeenCalledWith("compliance", expect.any(AbortSignal));

    fireEvent.click(screen.getByRole("button", { name: "FHA chat" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("FHA question"));
    expect(screen.getByRole("button", { name: "Agent scope" })).toHaveTextContent("FHA");
    expect(mocks.push).toHaveBeenCalledWith("/category/fha?chat=chat-fha", { scroll: false });
    expect(screen.getByRole("button", { name: "Chat one" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chat one" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Fannie question"));
    expect(screen.getByRole("button", { name: "Agent scope" })).toHaveTextContent("Fannie Mae");
    expect(screen.getByRole("button", { name: "FHA chat" })).toBeInTheDocument();
  });

  it("loads, renames, and deletes chats from the black sidebar", async () => {
    mocks.listChats.mockResolvedValue([chat]);
    mocks.getChat.mockResolvedValue({ ...chat, messages: [] });
    mocks.renameChat.mockResolvedValue({ ...chat, title: "Renamed" });
    mocks.removeChat.mockResolvedValue({ status: "ok", id: chat.id });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);

    fireEvent.click(await screen.findByRole("button", { name: "Chat one" }));
    await waitFor(() => expect(mocks.getChat).toHaveBeenCalledWith(chat.id, expect.any(AbortSignal)));
    expect(mocks.push).toHaveBeenCalledWith("/category/mortgage?chat=chat-1", { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: "Rename Chat one" }));
    fireEvent.change(screen.getByLabelText("Chat title"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Renamed" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Delete Renamed" }));
    const confirmation = screen.getByRole("dialog", { name: "Delete conversation?" });
    expect(confirmation).toHaveTextContent("Renamed");
    expect(mocks.removeChat).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mocks.removeChat).toHaveBeenCalledWith(chat.id));
    expect(screen.queryByRole("button", { name: "Renamed" })).not.toBeInTheDocument();
  });

  it("restores quick questions for a new chat without changing the scope or history", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "New Question" }));

    expect(screen.queryByRole("complementary", { name: /category drawer/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat one" })).toBeInTheDocument();
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Fannie Mae Selling Guide quick questions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Good afternoon, Syed Ahmed" })).toBeInTheDocument();
    expect(screen.queryAllByText("Mortgage / Fannie Mae Selling Guide")).toHaveLength(0);
    expect(mocks.push).toHaveBeenCalledWith("/category/mortgage", { scroll: false });
  });

  it("restores the selected chat from the category URL after a refresh", async () => {
    mocks.listChats.mockResolvedValue([chat]);
    mocks.getChat.mockResolvedValue({
      ...chat,
      messages: [{
        id: "message-restored", chat_id: chat.id, role: "user", content: "Restored question",
        sources: [], status: null, audit_id: null, created_at: "2026-01-01T00:00:00Z",
      }],
    });

    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" initialChatId={chat.id} />);

    expect(await screen.findByRole("log")).toHaveTextContent("Restored question");
    expect(mocks.getChat).toHaveBeenCalledWith(chat.id, expect.any(AbortSignal));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("syncs category, chat query, home, and profile changes without reloading the shell", async () => {
    mocks.getChat.mockImplementation(async (id: string) => ({
      ...(id === fhaChat.id ? fhaChat : chat),
      messages: [{ id: `message-${id}`, chat_id: id, role: "user", content: `Restored ${id}`, sources: [], created_at: chat.created_at }],
    }));
    const { rerender } = render(<KnowledgeWorkspace categoryMode initialChatId={chat.id} />);
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent(`Restored ${chat.id}`));
    const sidebar = screen.getByRole("complementary", { name: "Main navigation" });

    rerender(<KnowledgeWorkspace categoryMode initialAgentSlug="fha" initialChatId={fhaChat.id} />);
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent(`Restored ${fhaChat.id}`));
    expect(screen.getByRole("button", { name: "Agent scope" })).toHaveTextContent("FHA");

    rerender(<KnowledgeWorkspace categoryMode initialAgentSlug="fha" />);
    await screen.findByRole("group", { name: "FHA Handbook 4000.1 quick questions" });
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    rerender(<KnowledgeWorkspace categoryMode initialAgentSlug="fha" initialChatId={fhaChat.id} />);
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent(`Restored ${fhaChat.id}`));

    rerender(<KnowledgeWorkspace profile><p>Profile content</p></KnowledgeWorkspace>);
    expect(screen.getByText("Profile content")).toBeInTheDocument();
    rerender(<KnowledgeWorkspace />);
    await screen.findByRole("heading", { name: "What do you need to check today?" });
    expect(screen.getByRole("link", { name: "All Libraries" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("complementary", { name: "Main navigation" })).toBe(sidebar);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    expect(mocks.agents).toHaveBeenCalledTimes(1);
    expect(mocks.listChats).toHaveBeenCalledTimes(agents.length);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("restores query-only history changes within the same category", async () => {
    mocks.getChat.mockImplementation(async (id: string) => ({
      ...chat, id, messages: [{ id: `message-${id}`, chat_id: id, role: "user", content: `Question ${id}`, sources: [], created_at: chat.created_at }],
    }));
    const { rerender } = render(<KnowledgeWorkspace categoryMode initialChatId="first" />);
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Question first"));
    rerender(<KnowledgeWorkspace categoryMode initialChatId="second" />);
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Question second"));
    rerender(<KnowledgeWorkspace categoryMode initialChatId="first" />);
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Question first"));
  });

  it("ignores chat restoration that finishes after leaving its route", async () => {
    let resolveChat!: (value: unknown) => void;
    mocks.getChat.mockReturnValue(new Promise((resolve) => { resolveChat = resolve; }));
    const { rerender } = render(<KnowledgeWorkspace categoryMode initialChatId={chat.id} />);
    await waitFor(() => expect(mocks.getChat).toHaveBeenCalled());
    const signal = mocks.getChat.mock.calls[0][1] as AbortSignal;
    rerender(<KnowledgeWorkspace />);
    expect(signal.aborted).toBe(true);
    await act(async () => resolveChat({ ...chat, messages: [{ id: "old", role: "user", content: "Stale question", sources: [], created_at: chat.created_at }] }));
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What do you need to check today?" })).toBeInTheDocument();
  });

  it("keeps a newly created chat streaming when its URL is acknowledged", async () => {
    let finish!: () => void;
    mocks.stream.mockImplementation((_question, _chatId, handlers) => new Promise<void>((resolve) => {
      finish = () => {
        handlers.onEvent({ event: "done", data: { status: "answered", answer: "Finished answer", sources: [] } });
        resolve();
      };
    }));
    const { rerender } = render(<KnowledgeWorkspace categoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask Fannie Mae Selling Guide: What is the rule?" }));
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(1));
    const signal = mocks.stream.mock.calls[0][3] as AbortSignal;
    rerender(<KnowledgeWorkspace categoryMode initialChatId={chat.id} />);
    expect(signal.aborted).toBe(false);
    expect(mocks.getChat).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(screen.getByRole("log")).toHaveTextContent("Finished answer");
  });

  it("preserves the login guard when restoring a chat returns 401", async () => {
    mocks.getChat.mockRejectedValue(new ApiError("Unauthorized", 401));
    render(<KnowledgeWorkspace categoryMode initialChatId={chat.id} />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
    expect(mocks.replace).not.toHaveBeenCalledWith("/category/mortgage", { scroll: false });
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

  it("starts one chat directly from a scope quick question", async () => {
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
    expect(mocks.replace).toHaveBeenCalledWith("/category/mortgage?chat=chat-1", { scroll: false });
    const conversation = await screen.findByRole("log");
    expect(conversation).toHaveTextContent("What is the rule?");
    expect(conversation).toHaveTextContent("Quick answer");
    expect(screen.queryByRole("group", { name: "Fannie Mae Selling Guide quick questions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: /category drawer/i })).not.toBeInTheDocument();
  });

  it("has a permanent desktop sidebar with no collapse or category controls", async () => {
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    const sidebar = await screen.findByRole("complementary", { name: "Main navigation" });
    expect(within(sidebar).getByRole("button", { name: "New Question" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Collapse sidebar|Expand sidebar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: /category drawer/i })).not.toBeInTheDocument();
  });

  it("opens the selected scope for a new question from the home screen", async () => {
    render(<KnowledgeWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "New Question" }));
    expect(mocks.push).toHaveBeenCalledWith("/category/mortgage", { scroll: false });
    expect(mocks.createChat).not.toHaveBeenCalled();
  });

  it("creates a chat, streams citations without duplicating done.answer, and submits feedback", async () => {
    const source: CitationSource = {
      index: 1, document_id: "doc", doc_name: "Guide.pdf", page_number: 4,
      section_id: "A1", sub_section_id: null, citation_url: "/api/v1/documents/doc/file#page=4", text_preview: "The applicable rule.",
      cited_passages: [{ claim: "The answer.", passage: "The applicable rule.", page_number: 4 }],
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
    expect(screen.getByRole("complementary", { name: "Citation details" })).toHaveTextContent("The applicable rule.");
    fireEvent.click(screen.getByRole("button", { name: "Close citation details" }));
    expect(screen.queryByRole("complementary", { name: "Citation details" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    await waitFor(() => expect(mocks.feedback).toHaveBeenCalledWith("audit-1", "up"));
  });

  it("replaces thinking with a presentation before done and debounces checklist persistence", async () => {
    const structured: AnswerPresentation = {
      scope: { label: "Mortgage", detail: "Selling Guide", not_found: false },
      verdict: { type: "fixable", kicker: "Verdict", text: "Check first", reason: "Three steps remain.", source_ids: [] },
      borrower_script: null,
      key_callout: "Use verified figures.",
      statuses: [],
      steps: [
        { title: "Step one", bullets: [], stop_if: null, watch_out: null, source_ids: [] },
        { title: "Step two", bullets: [], stop_if: null, watch_out: null, source_ids: [] },
        { title: "Step three", bullets: [], stop_if: null, watch_out: null, source_ids: [] },
      ],
      plan_b: [], easiest_fix: null, donts: [],
      documents: [{ label: "Paystubs", source_ids: [] }],
      next_fact_needed: null, verify_line: null,
    };
    mocks.stream.mockImplementation(async (_question, _chatId, handlers) => {
      handlers.onEvent({ event: "status", data: { message: "Formatting answer" } });
      handlers.onEvent({ event: "presentation", data: { presentation: structured } });
      handlers.onEvent({ event: "done", data: { status: "answered", message_id: "message-structured", presentation: structured, sources: [] } });
    });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    const input = await screen.findByRole("textbox", { name: "Write a message" });
    fireEvent.change(input, { target: { value: "Structured question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Check first")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Generating answer" })).not.toBeInTheDocument();
    const stepOne = screen.getByText("Step one").closest("li")!;
    fireEvent.click(within(stepOne).getByRole("checkbox"));
    fireEvent.click(within(stepOne).getByRole("checkbox"));
    fireEvent.click(within(stepOne).getByRole("checkbox"));

    await waitFor(() => expect(mocks.updateUiState).toHaveBeenCalledTimes(1));
    expect(mocks.updateUiState).toHaveBeenCalledWith(chat.id, "message-structured", {
      completed_step_ids: ["step-0"],
      checked_document_ids: [],
    });
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

  it("keeps navigation and all recent chats usable through the mobile drawer", async () => {
    mocks.listChats.mockImplementation(async (key: string) => key === "fha_handbook" ? [fhaChat] : key === "mortgage_guidelines" ? [chat] : []);
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    await screen.findByRole("button", { name: "FHA chat" });
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByRole("button", { name: "Chat one" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "FHA chat" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Mortgage" }));
    expect(dialog).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Agent scope" }));
    fireEvent.click(screen.getByRole("option", { name: "FHA" }));
    expect(mocks.push).toHaveBeenCalledWith("/category/fha", { scroll: false });
  });

  it("searches combined history and opens a matching chat through the router", async () => {
    mocks.listChats.mockImplementation(async (key: string) => key === "fha_handbook" ? [fhaChat] : key === "mortgage_guidelines" ? [chat] : []);
    mocks.getChat.mockResolvedValue({ ...fhaChat, messages: [{ id: "fha-message", role: "user", content: "Saved FHA question", sources: [], created_at: chat.created_at }] });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    const input = await screen.findByRole("textbox", { name: "Write a message" });
    await screen.findByRole("button", { name: "FHA chat" });
    expect(screen.getByRole("button", { name: "Export conversation" })).toBeDisabled();
    expect(mocks.stream).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search chat history" }));
    const dialog = screen.getByRole("dialog", { name: "Search chat history" });
    const search = within(dialog).getByRole("searchbox", { name: "Search chats" });
    expect(search).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Chat one" })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "  fHa  " } });
    expect(within(dialog).queryByRole("button", { name: "Chat one" })).not.toBeInTheDocument();
    expect(mocks.listChats).toHaveBeenCalledTimes(agents.length);
    expect(mocks.getChat).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
    fireEvent.click(within(dialog).getByRole("button", { name: "FHA chat" }));
    expect(screen.queryByRole("dialog", { name: "Search chat history" })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/category/fha?chat=chat-fha", { scroll: false }));
    expect(screen.getByRole("log")).toHaveTextContent("Saved FHA question");
  });

  it("can switch to a Mortgage scope while another library is selected", async () => {
    mocks.agents.mockResolvedValue([...agents.slice(0, 2), { ...agents[2], live: true }]);
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="compliance" />);
    const scope = await screen.findByRole("button", { name: "Agent scope" });
    expect(scope).toHaveTextContent("Compliance");
    fireEvent.click(scope);
    fireEvent.click(screen.getByRole("option", { name: "FHA" }));
    expect(mocks.push).toHaveBeenCalledWith("/category/fha", { scroll: false });
    expect(scope).toHaveTextContent("FHA");
  });

  it("preserves other scopes when the current scope's history refreshes after an answer", async () => {
    mocks.listChats.mockImplementation(async (key: string) => key === "fha_handbook" ? [fhaChat] : key === "mortgage_guidelines" ? [chat] : []);
    mocks.stream.mockImplementation(async (_question, _chatId, handlers) => {
      handlers.onEvent({ event: "done", data: { status: "answered", answer: "Fannie answer", sources: [], audit_id: null } });
    });
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    await screen.findByRole("button", { name: "FHA chat" });
    fireEvent.change(screen.getByRole("textbox", { name: "Write a message" }), { target: { value: "Fannie question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Fannie answer"));
    expect(screen.getByRole("button", { name: "FHA chat" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Chat one" })).toHaveLength(1);
    expect(mocks.listChats.mock.calls.filter(([key]) => key === "mortgage_guidelines")).toHaveLength(2);
  });

  it("ignores an older chat response after another scope's chat is opened", async () => {
    mocks.listChats.mockImplementation(async (key: string) => key === "fha_handbook" ? [fhaChat] : key === "mortgage_guidelines" ? [chat] : []);
    let resolveOld!: (value: unknown) => void;
    mocks.getChat.mockImplementation((id: string) => id === chat.id ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve({
      ...fhaChat, messages: [{ id: "fha-question", chat_id: fhaChat.id, role: "user", content: "Latest FHA question", sources: [], created_at: chat.created_at }],
    }));
    render(<KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />);
    fireEvent.click(await screen.findByRole("button", { name: "Chat one" }));
    fireEvent.click(screen.getByRole("button", { name: "FHA chat" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Latest FHA question"));
    await act(async () => resolveOld({ ...chat, messages: [] }));
    expect(screen.getByRole("log")).toHaveTextContent("Latest FHA question");
    expect(screen.getByRole("button", { name: "Agent scope" })).toHaveTextContent("FHA");
    expect(mocks.push).not.toHaveBeenCalledWith("/category/mortgage?chat=chat-1", { scroll: false });
  });

  it("keeps available history when one scope fails to load", async () => {
    mocks.listChats.mockImplementation(async (key: string) => {
      if (key === "fha_handbook") throw new Error("Unavailable");
      return key === "mortgage_guidelines" ? [chat] : [];
    });
    render(<KnowledgeWorkspace />);
    expect(await screen.findByRole("button", { name: "Chat one" })).toBeInTheDocument();
    expect(screen.getByText("Some conversations could not be loaded.")).toBeInTheDocument();
  });
});
