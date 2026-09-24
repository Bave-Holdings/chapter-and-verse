"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  ApiError,
  agentsApi,
  authApi,
  chatsApi,
  feedbackApi,
  streamQuestion,
  type Agent,
  type AnswerPresentation,
  type AnswerUiState,
  type Chat,
  type ChatMessage,
  type CitationSource,
  type StreamEvent,
  type User,
} from "../../lib/api";
import { AnswerPresentationView } from "./answer-presentation";
import { CitationPanel } from "./citation-panel";
import { HistorySearch } from "./history-search";
import { MarkdownMessage } from "./markdown-message";
import styles from "./workspace.module.css";

const MORTGAGE_AGENT_KEYS = new Set([
  "mortgage_guidelines",
  "fha_handbook",
]);

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  mortgage_guidelines: "Fannie Mae Selling Guide",
  fha_handbook: "FHA Handbook 4000.1",
};

type IconName = "menu" | "back" | "home" | "person" | "bell" | "logout" | "chevron" | "send" | "close" | "grid" | "chart" | "shield" | "history" | "download";
type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: string | null;
  sources: CitationSource[];
  auditId?: string | null;
  streaming?: boolean;
  error?: string;
  feedback?: "up" | "down";
  retryQuestion?: string;
  presentation?: AnswerPresentation | null;
  uiState?: AnswerUiState;
};
type ConversationScrollRequest =
  | { mode: "bottom" }
  | { mode: "turn-start"; messageId: string };
type CitationPanelState = {
  messageId: string;
  selectedIndex: number;
  sources: CitationSource[];
};

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    menu: <><path d="M8 6h12M4 6h.01M4 12h12M20 12h.01M8 18h12M4 18h.01" /></>,
    back: <path d="m11 5-7 7 7 7M4 12h16" />,
    home: <><path d="m4 8 6-4a4 4 0 0 1 4 0l6 4a3 3 0 0 1 1 3l-2 8a3 3 0 0 1-3 2H8a3 3 0 0 1-3-2l-2-8a3 3 0 0 1 1-3Z" /><path d="M9 17h6" /></>,
    person: <><circle cx="12" cy="6" r="2" /><path d="M8 12c-3 0-4 2-4 4s2 3 4 3h8c2 0 4-1 4-3s-1-4-4-4c-1 3-7 3-8 0Z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10ZM10 21h4" /></>,
    logout: <><path d="M13 5a5 5 0 0 0-5-3H6a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h2a5 5 0 0 0 5-3M10 12h12m-4-4 4 4-4 4" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    send: <path d="M12 19V5m-7 7 7-7 7 7" />,
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    chart: <path d="M4 3v18h17M7 15l4-7 4 4 5-7" />,
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" /><path d="M12 7v5l-3 2" /></>,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function formatTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function displayName(agent: Agent | null) {
  if (!agent) return "Knowledge";
  return AGENT_DISPLAY_NAMES[agent.key] ?? agent.name;
}

function scopeName(agent: Agent | null) {
  if (agent?.key === "mortgage_guidelines") return "Fannie Mae";
  if (agent?.key === "fha_handbook") return "FHA";
  return displayName(agent);
}

function mergeChats(...groups: Chat[][]) {
  const unique = new Map<string, Chat>();
  for (const chat of groups.flat()) {
    const previous = unique.get(chat.id);
    if (!previous || Date.parse(chat.updated_at) >= Date.parse(previous.updated_at)) unique.set(chat.id, chat);
  }
  return Array.from(unique.values()).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.id.localeCompare(b.id));
}

function displayUserName(user: User | null) {
  const fullName = user?.full_name?.trim();
  if (fullName) return fullName;
  const emailName = user?.email.split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!emailName) return "there";
  return emailName.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function userInitials(user: User | null) {
  const nameParts = displayUserName(user).split(/\s+/).filter(Boolean);
  const initials = nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : nameParts[0]?.slice(0, 2);
  return initials?.toUpperCase() || "U";
}

function dashboardQuestions(agents: Agent[], limit = 5) {
  const available = agents.filter((agent) => agent.live && agent.has_documents && agent.chips.length > 0);
  const cards: Array<{ agent: Agent; question: string }> = [];
  const longestList = Math.max(0, ...available.map((agent) => agent.chips.length));

  for (let questionIndex = 0; questionIndex < longestList && cards.length < limit; questionIndex += 1) {
    for (const agent of available) {
      const question = agent.chips[questionIndex];
      if (question) cards.push({ agent, question });
      if (cards.length === limit) break;
    }
  }

  return cards;
}

function messageFromApi(message: ChatMessage): UiMessage {
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: message.content,
    createdAt: message.created_at,
    status: message.status,
    sources: message.sources ?? [],
    auditId: message.audit_id,
    presentation: message.presentation ?? null,
    uiState: message.ui_state ?? {
      completed_step_ids: [],
      checked_document_ids: [],
    },
  };
}

type WorkspaceProps = {
  routeKey?: string;
  initialAgentSlug?: string;
  initialChatId?: string;
  categoryMode?: boolean;
  profile?: boolean;
  children?: React.ReactNode;
};

export function WorkspaceLoading() {
  return <main className={styles.loadingScreen} aria-busy="true">Loading your workspace…</main>;
}

export function KnowledgeWorkspace({ routeKey, initialAgentSlug = "mortgage", initialChatId, categoryMode = false, profile = false, children }: WorkspaceProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentKey, setAgentKey] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [popover, setPopover] = useState<"notifications" | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const [citationPanel, setCitationPanel] = useState<CitationPanelState | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const scopePicker = useRef<HTMLDivElement>(null);
  const scopeButton = useRef<HTMLButtonElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const pendingConversationScroll = useRef<ConversationScrollRequest | null>(null);
  const headerActions = useRef<HTMLDivElement>(null);
  const activeStream = useRef<AbortController | null>(null);
  const activeChatLoad = useRef<AbortController | null>(null);
  const askInFlight = useRef(false);
  const appliedRoute = useRef<string | null>(null);
  const uiStateSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const citationTrigger = useRef<HTMLElement | null>(null);
  const selectedAgent = agents.find((agent) => agent.key === agentKey) ?? null;
  const selectedAgentName = displayName(selectedAgent);
  const mortgageAgents = Array.from(MORTGAGE_AGENT_KEYS)
    .map((key) => agents.find((agent) => agent.key === key))
    .filter((agent): agent is Agent => Boolean(agent));
  const otherAgents = agents.filter((agent) => !MORTGAGE_AGENT_KEYS.has(agent.key));
  const mortgageSelected = MORTGAGE_AGENT_KEYS.has(agentKey);
  const dashboardCards = dashboardQuestions(agents);
  const showConversation = loadingChat || streaming || messages.length > 0;
  const hasCategoryContext = categoryMode;
  const mainCategoryName = mortgageSelected ? "Mortgage" : selectedAgentName;
  const headerLabel = showConversation ? `${mainCategoryName} / ${selectedAgentName}` : "Knowledge Hub";
  const headerTitle = showConversation ? selectedAgentName : `Good afternoon, ${displayUserName(user)}`;
  const activeCitationSource = citationPanel?.sources.find((source) => source.index === citationPanel.selectedIndex)
    ?? citationPanel?.sources[0]
    ?? null;

  const reportError = useCallback((cause: unknown, fallback = "Something went wrong. Please try again.") => {
    if (cause instanceof ApiError && cause.status === 401) {
      router.replace("/login");
      return;
    }
    setStatus(cause instanceof Error ? cause.message : fallback);
  }, [router]);

  useEffect(() => () => {
    uiStateSaveTimers.current.forEach((timer) => clearTimeout(timer));
    uiStateSaveTimers.current.clear();
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([authApi.me(), agentsApi.list()])
      .then(([nextUser, nextAgents]) => {
        if (cancelled) return;
        setUser(nextUser);
        setAgents(nextAgents);
      })
      .catch((cause) => {
        if (!cancelled) reportError(cause, "Unable to load your workspace.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; activeStream.current?.abort(); activeChatLoad.current?.abort(); };
  }, [reportError]);

  useEffect(() => {
    if (agents.length === 0) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    Promise.allSettled(agents.map((agent) => chatsApi.list(agent.key, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;
        const groups = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        setChats((current) => mergeChats(...groups, current));
        const failures = results.filter((result) => result.status === "rejected");
        if (failures.length) {
          setHistoryError(groups.length ? "Some conversations could not be loaded." : "Unable to load recent conversations.");
          const unauthorized = failures.find((result) => result.reason instanceof ApiError && result.reason.status === 401);
          if (unauthorized) reportError(unauthorized.reason);
        }
      })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [agents, reportError]);

  useEffect(() => {
    if (drawerOpen) drawer.current?.showModal();
    else if (drawer.current?.open) {
      drawer.current.close();
      menuButton.current?.focus();
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const smallScreen = window.matchMedia?.("(max-width: 767px)");
    if (!smallScreen) return;
    const closeOnDesktop = () => { if (!smallScreen.matches) setDrawerOpen(false); };
    smallScreen.addEventListener("change", closeOnDesktop);
    return () => smallScreen.removeEventListener("change", closeOnDesktop);
  }, [drawerOpen]);

  useEffect(() => {
    const dialog = deleteDialog.current;
    if (!dialog) return;
    if (deleteTarget && !dialog.open) dialog.showModal();
    if (!deleteTarget && dialog.open) dialog.close();
  }, [deleteTarget]);

  useEffect(() => {
    if (agents.length === 0) return;
    const chatId = categoryMode ? initialChatId || null : null;
    const route = JSON.stringify([routeKey, categoryMode, profile, initialAgentSlug, chatId]);
    if (appliedRoute.current === route) return;
    appliedRoute.current = route;
    setHistoryOpen(false);
    setDrawerOpen(false);
    setScopeMenuOpen(false);
    setPopover(null);
    setRenamingId(null);
    setDeleteTarget(null);

    const requested = agents.find((agent) => agent.slug === initialAgentSlug);
    if (categoryMode && !requested) {
      router.replace("/home");
      return;
    }
    const nextAgent = requested ?? agents.find((agent) => agent.live) ?? agents[0];
    // Selection and chat creation already update the view before pushing a URL.
    // Acknowledging that URL must not abort its stream or fetch the chat again.
    if (categoryMode && nextAgent.key === agentKey && chatId === activeChatId && !activeChatLoad.current) return;

    activeStream.current?.abort();
    activeStream.current = null;
    askInFlight.current = false;
    activeChatLoad.current?.abort();
    activeChatLoad.current = null;
    setLoadingChat(false);
    setStreaming(false);
    setAgentKey(nextAgent.key);
    setActiveChatId(null);
    setMessages([]);
    setDraft("");
    setStatus("");
    setCitationPanel(null);
    citationTrigger.current = null;
    if (!chatId) return;

    const controller = new AbortController();
    activeChatLoad.current = controller;
    setLoadingChat(true);
    chatsApi.get(chatId, controller.signal)
      .then((chat) => {
        if (controller.signal.aborted || activeChatLoad.current !== controller) return;
        if (chat.agent_key !== nextAgent.key) {
          throw new Error("This chat belongs to a different knowledge agent.");
        }
        pendingConversationScroll.current = { mode: "bottom" };
        setActiveChatId(chat.id);
        setMessages(chat.messages.map(messageFromApi));
      })
      .catch((cause) => {
        if (controller.signal.aborted || activeChatLoad.current !== controller) return;
        if (!(cause instanceof ApiError && cause.status === 401)) {
          router.replace(`/category/${nextAgent.slug}`, { scroll: false });
        }
        reportError(cause, "Unable to restore this chat.");
      })
      .finally(() => {
        if (activeChatLoad.current !== controller) return;
        activeChatLoad.current = null;
        setLoadingChat(false);
      });
  }, [activeChatId, agentKey, agents, categoryMode, initialAgentSlug, initialChatId, profile, reportError, routeKey, router]);

  useEffect(() => {
    const container = conversation.current;
    const request = pendingConversationScroll.current;
    if (!container || !request) return;

    if (request.mode === "bottom") {
      container.scrollTop = container.scrollHeight;
    } else {
      const targetMessage = Array.from(container.querySelectorAll<HTMLElement>("[data-message-id]"))
        .find((row) => row.dataset.messageId === request.messageId);
      if (targetMessage) {
        const offset = targetMessage.getBoundingClientRect().top - container.getBoundingClientRect().top;
        container.scrollTop = Math.max(0, container.scrollTop + offset - 16);
      }
    }

    pendingConversationScroll.current = null;
  }, [messages.length, loadingChat]);

  useEffect(() => {
    if (!popover) return;
    function dismiss(event: PointerEvent) {
      if (!headerActions.current?.contains(event.target as Node)) setPopover(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setPopover(null);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [popover]);

  useEffect(() => {
    if (!scopeMenuOpen) return;
    function dismiss(event: PointerEvent | FocusEvent) {
      if (!scopePicker.current?.contains(event.target as Node)) setScopeMenuOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setScopeMenuOpen(false);
        requestAnimationFrame(() => scopeButton.current?.focus());
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [scopeMenuOpen]);

  useEffect(() => {
    if (!citationPanel) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCitationPanel(null);
        requestAnimationFrame(() => citationTrigger.current?.focus());
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [citationPanel]);

  function openCitationPanel(messageId: string, source: CitationSource, sources: CitationSource[]) {
    const activeElement = document.activeElement;
    citationTrigger.current = activeElement instanceof HTMLElement ? activeElement : null;
    setCitationPanel({ messageId, selectedIndex: source.index, sources });
    if (window.matchMedia?.("(max-width: 1250px)").matches) {
      setDrawerOpen(false);
    }
  }

  function closeCitationPanel(restoreFocus = true) {
    setCitationPanel(null);
    if (restoreFocus) requestAnimationFrame(() => citationTrigger.current?.focus());
    else citationTrigger.current = null;
  }

  function selectAgent(agent: Agent) {
    if (!agent.live) return;
    setScopeMenuOpen(false);
    activeStream.current?.abort();
    activeChatLoad.current?.abort();
    activeChatLoad.current = null;
    setLoadingChat(false);
    closeCitationPanel(false);
    setAgentKey(agent.key);
    setActiveChatId(null);
    setMessages([]);
    setDraft("");
    setStatus("");
    setDrawerOpen(false);
    router.push(`/category/${agent.slug}`, { scroll: false });
  }

  function openScopeMenu(focus: "selected" | "first" | "last" = "selected") {
    setScopeMenuOpen(true);
    requestAnimationFrame(() => {
      const options = Array.from(scopePicker.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []);
      const target = focus === "first"
        ? options[0]
        : focus === "last"
          ? options.at(-1)
          : options.find((option) => option.getAttribute("aria-selected") === "true") ?? options[0];
      target?.focus();
    });
  }

  function handleScopeOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const options = Array.from(scopePicker.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []);
    const currentIndex = options.indexOf(event.currentTarget);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else return;
    event.preventDefault();
    options[nextIndex]?.focus();
  }

  function chooseScope(agent: Agent) {
    setScopeMenuOpen(false);
    if (!categoryMode || agent.key !== agentKey) selectAgent(agent);
    requestAnimationFrame(() => scopeButton.current?.focus());
  }

  async function loadChat(chatId: string) {
    setHistoryOpen(false);
    activeStream.current?.abort();
    activeChatLoad.current?.abort();
    closeCitationPanel(false);
    const controller = new AbortController();
    activeChatLoad.current = controller;
    setLoadingChat(true);
    setDraft("");
    setStatus("");
    setDrawerOpen(false);
    try {
      const chat = await chatsApi.get(chatId, controller.signal);
      if (activeChatLoad.current !== controller || controller.signal.aborted) return;
      const chatAgent = agents.find((agent) => agent.key === chat.agent_key);
      if (!chatAgent) throw new Error("The knowledge scope for this conversation is unavailable.");
      setAgentKey(chatAgent.key);
      pendingConversationScroll.current = { mode: "bottom" };
      setActiveChatId(chat.id);
      setMessages(chat.messages.map(messageFromApi));
      router.push(`/category/${chatAgent.slug}?chat=${encodeURIComponent(chat.id)}`, { scroll: false });
    } catch (cause) {
      if (activeChatLoad.current === controller && !controller.signal.aborted) reportError(cause, "Unable to load this chat.");
    } finally {
      if (activeChatLoad.current === controller) {
        activeChatLoad.current = null;
        setLoadingChat(false);
      }
    }
  }

  function newChat() {
    activeStream.current?.abort();
    activeChatLoad.current?.abort();
    activeChatLoad.current = null;
    setLoadingChat(false);
    setStreaming(false);
    setActiveChatId(null);
    setMessages([]);
    setDraft("");
    setStatus("");
    closeCitationPanel(false);
    if (selectedAgent) {
      router.push(`/category/${selectedAgent.slug}`, { scroll: false });
    }
    composer.current?.focus();
  }

  async function renameChat(event: FormEvent<HTMLFormElement>, chatId: string) {
    event.preventDefault();
    const title = renameDraft.trim();
    if (!title) return;
    try {
      const updated = await chatsApi.rename(chatId, title);
      setChats((items) => mergeChats(items.map((chat) => chat.id === chatId ? updated : chat)));
      setRenamingId(null);
    } catch (cause) {
      reportError(cause, "Unable to rename this chat.");
    }
  }

  function requestDelete(chat: Chat, trigger: HTMLButtonElement) {
    deleteTrigger.current = trigger;
    setDeleteTarget(chat);
  }

  function closeDeleteDialog() {
    if (deletingChat) return;
    setDeleteTarget(null);
    requestAnimationFrame(() => deleteTrigger.current?.focus());
  }

  async function deleteChat() {
    const chat = deleteTarget;
    if (!chat || deletingChat) return;
    setDeletingChat(true);
    try {
      await chatsApi.remove(chat.id);
      setChats((items) => items.filter((item) => item.id !== chat.id));
      if (activeChatId === chat.id) newChat();
      setDeleteTarget(null);
      requestAnimationFrame(() => deleteTrigger.current?.focus());
    } catch (cause) {
      reportError(cause, "Unable to delete this chat.");
    } finally {
      setDeletingChat(false);
    }
  }

  function updatePending(id: string, update: (message: UiMessage) => UiMessage) {
    setMessages((items) => items.map((message) => message.id === id ? update(message) : message));
  }

  function scheduleUiStateSave(chatId: string, messageId: string, uiState: AnswerUiState) {
    const key = `${chatId}:${messageId}`;
    const existing = uiStateSaveTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      uiStateSaveTimers.current.delete(key);
      void chatsApi.updateMessageUiState(chatId, messageId, uiState)
        .catch((cause) => reportError(cause, "Unable to save checklist progress."));
    }, 400);
    uiStateSaveTimers.current.set(key, timer);
  }

  async function ask(question: string, answeringAgent = selectedAgent, initialChatId = activeChatId) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || askInFlight.current || !answeringAgent?.live || !answeringAgent.has_documents) return;
    askInFlight.current = true;
    setDraft("");
    setStatus("Preparing your question…");
    setStreaming(true);
    const controller = new AbortController();
    activeStream.current = controller;

    let chatId = initialChatId;
    try {
      if (!chatId) {
        const created = await chatsApi.create(answeringAgent.key);
        if (controller.signal.aborted || activeStream.current !== controller) return;
        chatId = created.id;
        setActiveChatId(created.id);
        setChats((items) => mergeChats(items, [created]));
        if (categoryMode) {
          router.replace(`/category/${answeringAgent.slug}?chat=${encodeURIComponent(created.id)}`, { scroll: false });
        }
      }

      const now = new Date();
      const timestamp = now.getTime();
      const userMessageId = `user-${timestamp}`;
      const pendingId = `pending-${timestamp}`;
      pendingConversationScroll.current = { mode: "turn-start", messageId: userMessageId };
      setMessages((items) => [
        ...items,
        { id: userMessageId, role: "user", content: cleanQuestion, createdAt: now.toISOString(), sources: [] },
        { id: pendingId, role: "assistant", content: "", createdAt: now.toISOString(), sources: [], streaming: true, retryQuestion: cleanQuestion, presentation: null, uiState: { completed_step_ids: [], checked_document_ids: [] } },
      ]);

      let receivedText = "";
      let terminalError = false;
      await streamQuestion(cleanQuestion, chatId, {
        onEvent(event: StreamEvent) {
          if (controller.signal.aborted || activeStream.current !== controller) return;
          if (event.event === "status") {
            setStatus(event.data.message ?? "Working…");
          } else if (event.event === "sources") {
            updatePending(pendingId, (message) => ({ ...message, sources: event.data.sources }));
          } else if (event.event === "token") {
            receivedText += event.data.text;
            updatePending(pendingId, (message) => ({ ...message, content: message.content + event.data.text }));
          } else if (event.event === "presentation") {
            updatePending(pendingId, (message) => ({
              ...message,
              presentation: event.data.presentation,
            }));
          } else if (event.event === "done") {
            const result = event.data;
            updatePending(pendingId, (message) => ({
              ...message,
              id: result.message_id ?? message.id,
              content: receivedText ? message.content : (result.answer ?? message.content),
              presentation: result.presentation ?? message.presentation ?? null,
              sources: result.sources ?? message.sources,
              auditId: result.audit_id,
              status: result.status,
              streaming: false,
            }));
            setStatus(result.latency_ms ? `Answered in ${(result.latency_ms / 1000).toFixed(1)}s` : "Answer complete");
          } else if (event.event === "error") {
            terminalError = true;
            const message = event.data.error || "The answer could not be completed.";
            updatePending(pendingId, (item) => ({ ...item, streaming: false, error: message }));
            setStatus(message);
          }
        },
      }, controller.signal);

      if (!terminalError) chatsApi.list(answeringAgent.key)
        .then((updated) => setChats((current) => mergeChats(current, updated)))
        .catch(() => undefined);
    } catch (cause) {
      if (activeStream.current !== controller) return;
      const aborted = cause instanceof DOMException && cause.name === "AbortError";
      setMessages((items) => items.map((message) => message.streaming ? {
        ...message,
        streaming: false,
        error: aborted ? "Response cancelled." : (cause instanceof Error ? cause.message : "Unable to get an answer."),
      } : message));
      setStatus(aborted ? "Response cancelled." : "Unable to get an answer.");
      if (!aborted) reportError(cause);
    } finally {
      if (activeStream.current === controller) {
        activeStream.current = null;
        askInFlight.current = false;
        setStreaming(false);
        composer.current?.focus();
      }
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  function askDashboardQuestion(agent: Agent, question: string) {
    activeStream.current?.abort();
    activeChatLoad.current?.abort();
    closeCitationPanel(false);
    setAgentKey(agent.key);
    setActiveChatId(null);
    setMessages([]);
    setDraft("");
    setStatus("");
    void ask(question, agent, null);
  }

  async function rate(messageId: string, auditId: string, feedback: "up" | "down") {
    try {
      await feedbackApi.send(auditId, feedback);
      updatePending(messageId, (message) => ({ ...message, feedback }));
    } catch (cause) {
      reportError(cause, "Unable to save feedback.");
    }
  }

  async function logout() {
    activeStream.current?.abort();
    try {
      await authApi.logout();
    } finally {
      router.replace("/login");
    }
  }

  function exportConversation() {
    const data = JSON.stringify({
      title: chats.find((chat) => chat.id === activeChatId)?.title ?? selectedAgentName,
      agent: selectedAgentName,
      messages: messages.map(({ role, content, createdAt, sources, presentation }) => ({ role, content, createdAt, sources, presentation })),
    }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "chapter-and-verse-conversation.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showRecentChats() {
    setDrawerOpen(false);
    setScopeMenuOpen(false);
    setPopover(null);
    setHistoryOpen(true);
  }

  function navigation(mobile = false) {
    const agentButton = (agent: Agent) => {
      const active = agent.key === agentKey;
      return <button
        key={agent.key}
        type="button"
        disabled={!agent.live || streaming}
        title={!agent.live ? "Coming soon" : undefined}
        aria-label={`${displayName(agent)}${!agent.live ? " (Coming soon)" : ""}`}
        className={active ? styles.activeCategory : undefined}
        aria-pressed={active}
        onClick={() => selectAgent(agent)}
      >
        <Icon name={/invest/i.test(agent.key) ? "chart" : /compliance/i.test(agent.key) ? "shield" : "person"} /><span>{displayName(agent)}</span>{!agent.live ? <small>Request</small> : <Icon name="chevron" />}
      </button>;
    };

    return <>
      {mobile && <button className={styles.drawerBack} onClick={() => setDrawerOpen(false)} aria-label="Close navigation"><Icon name="back" /></button>}
      <Link href="/home" className={styles.brand} aria-label="Chapter and Verse home" onClick={() => setDrawerOpen(false)}>
        <Image src="/chapter-verse-mark.svg" alt="" width={58} height={60} priority />
        <strong>Chapter &amp; Verse</strong>
        <small>AN INTELLENCE PRODUCT</small>
      </Link>
      <button type="button" className={styles.newQuestion} aria-label="New Question" onClick={() => {
        setDrawerOpen(false);
        if (profile) router.push("/home");
        else newChat();
      }}><span aria-hidden="true">+</span><span>New Question</span></button>
      <nav className={styles.navigation} aria-label="Knowledge agents">
        <p>WORKSPACE</p>
        <Link href="/home" className={styles.allLibraries} aria-label="All Libraries" aria-current={!profile && !hasCategoryContext && !showConversation ? "page" : undefined} onClick={() => setDrawerOpen(false)}><Icon name="grid" /><span>All Libraries</span></Link>
        {mortgageAgents.length > 0 && <div className={styles.mortgageGroup}>
          <button
            type="button"
            className={`${styles.mortgageParent} ${mortgageSelected ? styles.activeCategory : ""}`}
            aria-label="Mortgage"
            aria-pressed={mortgageSelected}
            data-active={mortgageSelected}
            disabled={streaming || !mortgageAgents.some((agent) => agent.live)}
            onClick={() => {
              const agent = mortgageSelected && selectedAgent?.live ? selectedAgent : mortgageAgents.find((agent) => agent.live);
              if (agent) selectAgent(agent);
            }}
          >
            <Icon name="home" /><span>Mortgage</span><Icon name="chevron" />
          </button>
        </div>}
        {otherAgents.map((agent) => agentButton(agent))}
      </nav>
      <section className={styles.recentChats} aria-label="Recent conversations" tabIndex={-1}>
        <h2>RECENT</h2>
        {historyLoading && <p role="status">Loading conversations…</p>}
        {historyError && <p role="status">{historyError}</p>}
        {!historyLoading && !historyError && chats.length === 0 && <p>No conversations yet.</p>}
        <div className={styles.recentChatList}>
          {chats.map((chat) => renamingId === chat.id ? (
            <form className={styles.renameForm} key={chat.id} onSubmit={(event) => void renameChat(event, chat.id)}>
              <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} maxLength={200} aria-label="Chat title" autoFocus />
              <button type="submit">Save</button><button type="button" onClick={() => setRenamingId(null)}>Cancel</button>
            </form>
          ) : (
            <div className={styles.recentChatItem} key={chat.id} data-active={activeChatId === chat.id}>
              <button className={styles.recentChatTitle} type="button" title={chat.title} aria-label={chat.title} aria-pressed={activeChatId === chat.id} disabled={streaming} onClick={() => void loadChat(chat.id)}>
                <span>{chat.title}</span><small>{scopeName(agents.find((agent) => agent.key === chat.agent_key) ?? null)}</small>
              </button>
              <button className={styles.recentChatAction} type="button" aria-label={"Rename " + chat.title} onClick={() => { setRenamingId(chat.id); setRenameDraft(chat.title); }}>✎</button>
              <button className={styles.recentChatAction} type="button" aria-label={"Delete " + chat.title} onClick={(event) => requestDelete(chat, event.currentTarget)}>×</button>
            </div>
          ))}
        </div>
      </section>
      <div className={styles.sidebarAccount}>
        <Link href="/profile" aria-label="Account settings" onClick={() => setDrawerOpen(false)}><span className={styles.accountAvatar}>{userInitials(user)}</span><span className={styles.accountCopy}><strong>{displayUserName(user)}</strong><small>{user?.role ?? "Account"}</small></span></Link>
        <button type="button" onClick={() => void logout()} aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>
      </div>
    </>;
  }

  if (loading || (agents.length > 0 && !agentKey)) return <WorkspaceLoading />;

  return (
    <div className={`${styles.workspace} ${showConversation ? styles.chatMode : ""} ${categoryMode ? styles.categoryMode : ""} ${profile ? styles.profileMode : ""} ${citationPanel ? styles.citationOpen : ""}`}>
      <a className={styles.skipLink} href="#knowledge-content">Skip to content</a>
      <aside className={styles.sidebar} aria-label="Main navigation">
        {navigation()}
      </aside>
      <dialog ref={drawer} className={styles.drawer} aria-label="Navigation" onCancel={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
        {drawerOpen && <div className={styles.drawerContent}>{navigation(true)}</div>}
      </dialog>

      <header className={styles.header}>
        <div className={`${styles.headerLead} ${!profile ? styles.screenReaderOnly : ""}`}>
          <div className={styles.greeting}>{profile ? <h1>My Profile</h1> : <><span>{headerLabel}</span><h1>{headerTitle}</h1></>}</div>
        </div>
        {!profile && <div className={styles.conversationToolbar}>
          {(hasCategoryContext || showConversation) && <div className={styles.scopePicker} ref={scopePicker}>
            <button
              ref={scopeButton}
              type="button"
              className={styles.scopeControl}
              aria-label="Agent scope"
              aria-haspopup="listbox"
              aria-expanded={scopeMenuOpen}
              aria-controls={scopeMenuOpen ? "agent-scope-options" : undefined}
              disabled={streaming || loadingChat}
              onClick={() => scopeMenuOpen ? setScopeMenuOpen(false) : openScopeMenu()}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  openScopeMenu(event.key === "ArrowDown" ? "first" : "last");
                }
              }}
            >
              <span>Scope</span>
              <strong>{scopeName(selectedAgent)}</strong>
              <Icon name="chevron" />
            </button>
            {scopeMenuOpen && <div id="agent-scope-options" className={styles.scopeMenu} role="listbox" aria-label="Agent scope options">
              {mortgageAgents.length > 0 && <div className={styles.scopeGroup} role="group" aria-labelledby="mortgage-scope-label">
                <span className={styles.scopeGroupLabel} id="mortgage-scope-label">Mortgage</span>
                {mortgageAgents.map((agent) => <button
                  key={agent.key}
                  type="button"
                  className={styles.scopeOption}
                  role="option"
                  aria-selected={agent.key === agentKey}
                  disabled={!agent.live}
                  tabIndex={agent.key === agentKey ? 0 : -1}
                  onClick={() => chooseScope(agent)}
                  onKeyDown={handleScopeOptionKeyDown}
                ><span>{scopeName(agent)}</span>{agent.key === agentKey && <span className={styles.scopeOptionCheck} aria-hidden="true">✓</span>}</button>)}
              </div>}
              {otherAgents.length > 0 && <div className={styles.scopeGroup} role="group" aria-labelledby="library-scope-label">
                <span className={styles.scopeGroupLabel} id="library-scope-label">Knowledge libraries</span>
                {otherAgents.map((agent) => <button
                  key={agent.key}
                  type="button"
                  className={styles.scopeOption}
                  role="option"
                  aria-selected={agent.key === agentKey}
                  disabled={!agent.live}
                  tabIndex={agent.key === agentKey ? 0 : -1}
                  onClick={() => chooseScope(agent)}
                  onKeyDown={handleScopeOptionKeyDown}
                ><span>{displayName(agent)}</span>{agent.key === agentKey && <span className={styles.scopeOptionCheck} aria-hidden="true">✓</span>}</button>)}
              </div>}
            </div>}
          </div>}
          <button type="button" className={styles.historyButton} aria-label="Search chat history" title="Search chats" aria-haspopup="dialog" aria-expanded={historyOpen} onClick={showRecentChats}><Icon name="history" /></button>
          <button type="button" className={styles.exportButton} aria-label="Export conversation" disabled={!messages.length || streaming || loadingChat} title="Export conversation as JSON" onClick={exportConversation}><Icon name="download" /><span>Export</span></button>
        </div>}
        <div className={styles.mobileBrand}>
          <button ref={menuButton} className={styles.menuButton} aria-label="Open navigation" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Icon name="menu" /></button>
          {profile ? <h1>My Profile</h1> : <Link href="/home" className={styles.mobileHeaderCopy}><Image src="/chapter-verse-mark.svg" alt="Chapter and Verse home" width={38} height={40} /><span className={styles.screenReaderOnly}><small>{headerLabel}</small><strong>{headerTitle}</strong></span></Link>}
        </div>
        <div className={styles.headerActions} ref={headerActions}>
          <button className={styles.notificationButton} aria-label="Notifications unavailable" aria-expanded={popover === "notifications"} onClick={() => setPopover(popover === "notifications" ? null : "notifications")}><span><Icon name="bell" /></span></button>
          <Link className={styles.profileButton} aria-label="View profile" href="/profile"><span className={styles.profileInitials} aria-hidden="true">{userInitials(user)}</span></Link>
          <button className={styles.logoutButton} onClick={() => void logout()} aria-label="Log out"><Icon name="logout" /></button>
          {popover && <div className={styles.popover}>
            <strong>Notifications</strong>
            <p>Notifications are not available yet.</p>
          </div>}
        </div>
      </header>

      {profile ? <main className={styles.profileMain} id="knowledge-content">{children}</main> : <main className={`${styles.main} ${citationPanel ? styles.mainWithCitation : ""}`} id="knowledge-content">
        <section className={styles.center} aria-label={`${selectedAgentName} workspace`}>
          {showConversation ? <div className={styles.conversation} ref={conversation} role="log" aria-label="Conversation" aria-live="polite">
            {loadingChat && <p className={styles.emptyState}>Loading conversation…</p>}
            {messages.map((message) => <div key={message.id} data-message-id={message.id} className={`${styles.messageRow} ${message.role === "user" ? styles.outgoing : styles.incoming}`}>
              {message.role === "assistant" && <span className={styles.chatAvatar}><Image src="/chapter-verse-mark.svg" alt="Chapter & Verse" width={28} height={28} /><i /></span>}
              <div className={`${styles.messageBubble} ${message.presentation ? styles.structuredBubble : ""} ${message.role === "assistant" && message.streaming && !message.content && !message.presentation ? styles.pendingBubble : ""}`}>
                {message.role === "user" && <span className={styles.userMessageHeader}>{displayUserName(user)} · {selectedAgentName} · {formatTime(message.createdAt)}</span>}
                {message.role === "assistant" && !message.presentation && !message.streaming && <span className={styles.answerContext}><i aria-hidden="true" />Answering from {selectedAgentName}</span>}
                {message.role === "assistant" ? message.presentation
                  ? <AnswerPresentationView
                    presentation={message.presentation}
                    sources={message.sources}
                    uiState={message.uiState}
                    onUiStateChange={(uiState) => {
                      updatePending(message.id, (current) => ({ ...current, uiState }));
                      if (activeChatId && !message.id.startsWith("pending-")) {
                        scheduleUiStateSave(activeChatId, message.id, uiState);
                      }
                    }}
                    onCitationSelect={(source, visibleSources) => openCitationPanel(message.id, source, visibleSources)}
                  />
                  : message.streaming && !message.content
                    ? <span className={styles.thinkingIndicator} role="status" aria-label="Generating answer"><span /><span /><span /></span>
                    : <MarkdownMessage
                      content={message.content}
                      sources={message.sources}
                      onCitationSelect={(source, visibleSources) => openCitationPanel(message.id, source, visibleSources)}
                    />
                  : <p>{message.content}</p>}
                {message.error && <div className={styles.messageError}><span>{message.error}</span>{message.retryQuestion && <button onClick={() => void ask(message.retryQuestion!)} disabled={streaming}>Retry</button>}</div>}
                {message.role === "assistant" && !(message.streaming && !message.content && !message.presentation) && <div className={styles.messageMeta}>
                  <time>{formatTime(message.createdAt)}</time>
                  {message.role === "assistant" && message.auditId && !message.streaming && <span className={styles.feedback} aria-label="Rate this answer">
                    <button aria-pressed={message.feedback === "up"} onClick={() => void rate(message.id, message.auditId!, "up")}>Helpful</button>
                    <button aria-pressed={message.feedback === "down"} onClick={() => void rate(message.id, message.auditId!, "down")}>Not helpful</button>
                  </span>}
                </div>}
              </div>
              {message.role === "user" && <span className={styles.senderDot} aria-label="You" />}
            </div>)}
          </div> : <div className={styles.welcome}>
            {!hasCategoryContext ? <div className={styles.dashboardWelcome}>
              <span className={styles.dashboardMark}>Chapter &amp; Verse</span>
              <h2>What do you need to check today?</h2>
              <p>Pick a category on the left, or jump straight to one of the questions people ask most.</p>
              <div className={styles.dashboardGrid} aria-label="Most asked questions">
                {dashboardCards.map(({ agent, question }) => <button
                  className={styles.dashboardCard}
                  key={`${agent.key}-${question}`}
                  type="button"
                  aria-label={`Ask ${displayName(agent)}: ${question}`}
                  onClick={() => askDashboardQuestion(agent, question)}
                ><span>{MORTGAGE_AGENT_KEYS.has(agent.key) ? "Mortgage" : displayName(agent)}</span><strong>{question}</strong></button>)}
                {dashboardCards.length === 0 && <span className={styles.emptyState}>No suggested questions are available yet.</span>}
              </div>
            </div> : <div className={styles.subcategoryQuestions}>
              <span className={styles.dashboardMark}>{selectedAgentName}</span>
              <h2>Quick questions</h2>
              <div className={styles.dashboardGrid} role="group" aria-label={`${selectedAgentName} quick questions`}>
                {(selectedAgent?.chips ?? []).map((question) => <button
                  className={styles.dashboardCard}
                  key={`${selectedAgent?.key}-${question}`}
                  type="button"
                  disabled={!selectedAgent?.has_documents}
                  aria-label={`Ask ${selectedAgentName}: ${question}`}
                  onClick={() => void ask(question)}
                ><span>{selectedAgentName}</span><strong>{question}</strong></button>)}
                {(selectedAgent?.chips.length ?? 0) === 0 && <span className={styles.emptyState}>No quick questions are available.</span>}
              </div>
            </div>}
          </div>}
          <div className={`${styles.composerArea} ${!hasCategoryContext && !showConversation ? styles.homeComposer : ""}`}>
            {status && <p className={styles.status} role="status">{status}</p>}
            <form className={styles.composer} onSubmit={sendMessage}>
              <input ref={composer} aria-label="Write a message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Hey, quick question…" autoComplete="off" maxLength={4000} disabled={streaming || !selectedAgent?.live || !selectedAgent?.has_documents} />
              {streaming ? <button type="button" className={styles.cancelButton} aria-label="Cancel response" onClick={() => activeStream.current?.abort()}><Icon name="close" /></button> : <button type="submit" aria-label="Send message" disabled={!draft.trim() || !selectedAgent?.live || !selectedAgent?.has_documents}><Icon name="send" /></button>}
            </form>
            {selectedAgent && (!selectedAgent.live || !selectedAgent.has_documents) && <p className={styles.disabledReason}>{!selectedAgent.live ? "This agent is coming soon." : "Questions are disabled until documents are ingested."}</p>}
            <p className={styles.composerNote}>Answers come only from your firm’s documents. Check the cited page before acting. Not legal advice.</p>
          </div>
        </section>

        {citationPanel && activeCitationSource && <>
          <button type="button" className={styles.citationBackdrop} aria-label="Dismiss citation details" onClick={() => closeCitationPanel()} />
          <CitationPanel
            source={activeCitationSource}
            sources={citationPanel.sources}
            agentName={selectedAgentName}
            onSelect={(source) => setCitationPanel((current) => current ? { ...current, selectedIndex: source.index } : current)}
            onClose={() => closeCitationPanel()}
          />
        </>}

      </main>}
      {historyOpen && <HistorySearch
        chats={chats}
        loading={historyLoading}
        error={historyError}
        disabled={streaming}
        activeChatId={activeChatId}
        onSelect={(chatId) => void loadChat(chatId)}
        onClose={() => setHistoryOpen(false)}
      />}
      <dialog
        ref={deleteDialog}
        className={styles.deleteDialog}
        aria-labelledby="delete-chat-title"
        aria-describedby="delete-chat-description"
        onCancel={(event) => { event.preventDefault(); closeDeleteDialog(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeDeleteDialog(); }}
      >
        <div className={styles.deleteDialogContent}>
          <span className={styles.deleteDialogIcon} aria-hidden="true"><Icon name="close" /></span>
          <h2 id="delete-chat-title">Delete conversation?</h2>
          <p id="delete-chat-description">{deleteTarget ? `“${deleteTarget.title}” will be permanently deleted. This action cannot be undone.` : "This conversation will be permanently deleted."}</p>
          <div className={styles.deleteDialogActions}>
            <button type="button" onClick={closeDeleteDialog} disabled={deletingChat}>Cancel</button>
            <button type="button" onClick={() => void deleteChat()} disabled={deletingChat}>{deletingChat ? "Deleting…" : "Delete"}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
