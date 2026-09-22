"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  ApiError,
  agentsApi,
  authApi,
  chatsApi,
  feedbackApi,
  streamQuestion,
  type Agent,
  type Chat,
  type CitationSource,
  type StreamEvent,
  type User,
} from "../../lib/api";
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

type IconName = "menu" | "back" | "home" | "person" | "bell" | "logout" | "chevron" | "send" | "close" | "sidebarCollapse" | "sidebarExpand";
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
};
type ConversationScrollRequest =
  | { mode: "bottom" }
  | { mode: "turn-start"; messageId: string };

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    menu: <><path d="M8 6h12M4 6h.01M4 12h12M20 12h.01M8 18h12M4 18h.01" /></>,
    back: <path d="m11 5-7 7 7 7M4 12h16" />,
    home: <><path d="m4 8 6-4a4 4 0 0 1 4 0l6 4a3 3 0 0 1 1 3l-2 8a3 3 0 0 1-3 2H8a3 3 0 0 1-3-2l-2-8a3 3 0 0 1 1-3Z" /><path d="M9 17h6" /></>,
    person: <><circle cx="12" cy="6" r="2" /><path d="M8 12c-3 0-4 2-4 4s2 3 4 3h8c2 0 4-1 4-3s-1-4-4-4c-1 3-7 3-8 0Z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10ZM10 21h4" /></>,
    logout: <><path d="M13 5a5 5 0 0 0-5-3H6a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h2a5 5 0 0 0 5-3M10 12h12m-4-4 4 4-4 4" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    send: <><path d="m4 4 17 8-17 8 3-8-3-8ZM7 12h14" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    sidebarCollapse: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16m8-11-3 3 3 3" /></>,
    sidebarExpand: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16m5-11 3 3-3 3" /></>,
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

function dashboardQuestions(agents: Agent[], limit = 6) {
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

function messageFromApi(message: {
  id: string;
  role: string;
  content: string;
  created_at: string;
  status: string | null;
  sources: CitationSource[];
  audit_id: string | null;
}): UiMessage {
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: message.content,
    createdAt: message.created_at,
    status: message.status,
    sources: message.sources ?? [],
    auditId: message.audit_id,
  };
}

type WorkspaceProps = {
  initialAgentSlug?: string;
  categoryMode?: boolean;
  profile?: boolean;
  children?: React.ReactNode;
};

export function KnowledgeWorkspace({ initialAgentSlug = "mortgage", categoryMode = false, profile = false, children }: WorkspaceProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentKey, setAgentKey] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(categoryMode);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [popover, setPopover] = useState<"notifications" | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const pendingConversationScroll = useRef<ConversationScrollRequest | null>(null);
  const headerActions = useRef<HTMLDivElement>(null);
  const activeStream = useRef<AbortController | null>(null);
  const activeChatLoad = useRef<AbortController | null>(null);
  const askInFlight = useRef(false);
  const selectedAgent = agents.find((agent) => agent.key === agentKey) ?? null;
  const selectedAgentName = displayName(selectedAgent);
  const mortgageAgents = Array.from(MORTGAGE_AGENT_KEYS)
    .map((key) => agents.find((agent) => agent.key === key))
    .filter((agent): agent is Agent => Boolean(agent));
  const otherAgents = agents.filter((agent) => !MORTGAGE_AGENT_KEYS.has(agent.key));
  const mortgageSelected = MORTGAGE_AGENT_KEYS.has(agentKey);
  const dashboardCards = dashboardQuestions(agents);
  const showConversation = loadingChat || streaming || messages.length > 0;
  const hasCategoryContext = categoryMode || categoryDrawerOpen;
  const mainCategoryName = mortgageSelected ? "Mortgage" : selectedAgentName;
  const headerLabel = showConversation ? `${mainCategoryName} / ${selectedAgentName}` : "Knowledge Hub";
  const headerTitle = showConversation ? selectedAgentName : `Good afternoon, ${displayUserName(user)}`;

  const reportError = useCallback((cause: unknown, fallback = "Something went wrong. Please try again.") => {
    if (cause instanceof ApiError && cause.status === 401) {
      router.replace("/login");
      return;
    }
    setStatus(cause instanceof Error ? cause.message : fallback);
  }, [router]);

  function categoryPanelPersists() {
    return !window.matchMedia?.("(max-width: 767px)").matches;
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([authApi.me(), agentsApi.list()])
      .then(([nextUser, nextAgents]) => {
        if (cancelled) return;
        setUser(nextUser);
        setAgents(nextAgents);
        const requested = nextAgents.find((agent) => agent.slug === initialAgentSlug);
        const fallback = nextAgents.find((agent) => agent.live) ?? nextAgents[0];
        if (categoryMode && !requested) {
          router.replace("/home");
          return;
        }
        setAgentKey((requested ?? fallback)?.key ?? "");
      })
      .catch((cause) => {
        if (!cancelled) reportError(cause, "Unable to load your workspace.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; activeStream.current?.abort(); activeChatLoad.current?.abort(); };
  }, [categoryMode, initialAgentSlug, reportError, router]);

  useEffect(() => {
    if (!agentKey || profile) return;
    const controller = new AbortController();
    let cancelled = false;
    setChats([]);
    chatsApi.list(agentKey, controller.signal)
      .then((nextChats) => { if (!cancelled) setChats(nextChats); })
      .catch((cause) => { if (!cancelled && !(cause instanceof DOMException && cause.name === "AbortError")) reportError(cause); });
    return () => { cancelled = true; controller.abort(); };
  }, [agentKey, profile, reportError]);

  useEffect(() => {
    if (drawerOpen) drawer.current?.showModal();
    else if (drawer.current?.open) {
      drawer.current.close();
      menuButton.current?.focus();
    }
  }, [drawerOpen]);

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
    if (!categoryDrawerOpen) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && window.matchMedia?.("(max-width: 767px)").matches) {
        setCategoryDrawerOpen(false);
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [categoryDrawerOpen]);

  function selectAgent(agent: Agent, keepCategoryDrawer = false) {
    if (!agent.live) return;
    activeStream.current?.abort();
    activeChatLoad.current?.abort();
    setAgentKey(agent.key);
    setChats([]);
    setActiveChatId(null);
    setMessages([]);
    setDraft("");
    setStatus("");
    setCategoryDrawerOpen(keepCategoryDrawer);
    setDrawerOpen(false);
    router.push(`/category/${agent.slug}`);
  }

  async function loadChat(chatId: string) {
    activeStream.current?.abort();
    activeChatLoad.current?.abort();
    const controller = new AbortController();
    const requestedAgentKey = agentKey;
    activeChatLoad.current = controller;
    setSidebarCollapsed(true);
    setCategoryDrawerOpen(categoryPanelPersists());
    setLoadingChat(true);
    setStatus("");
    try {
      const chat = await chatsApi.get(chatId, controller.signal);
      if (chat.agent_key !== requestedAgentKey) throw new Error("This chat belongs to a different knowledge agent.");
      pendingConversationScroll.current = { mode: "bottom" };
      setActiveChatId(chat.id);
      setMessages(chat.messages.map(messageFromApi));
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) reportError(cause, "Unable to load this chat.");
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
    setLoadingChat(false);
    setStreaming(false);
    setActiveChatId(null);
    setMessages([]);
    setDraft("");
    setStatus("");
    setCategoryDrawerOpen(categoryPanelPersists());
    composer.current?.focus();
  }

  async function renameChat(event: FormEvent<HTMLFormElement>, chatId: string) {
    event.preventDefault();
    const title = renameDraft.trim();
    if (!title) return;
    try {
      const updated = await chatsApi.rename(chatId, title);
      setChats((items) => items.map((chat) => chat.id === chatId ? updated : chat));
      setRenamingId(null);
    } catch (cause) {
      reportError(cause, "Unable to rename this chat.");
    }
  }

  async function deleteChat(chat: Chat) {
    if (!window.confirm(`Delete “${chat.title}”? This cannot be undone.`)) return;
    try {
      await chatsApi.remove(chat.id);
      setChats((items) => items.filter((item) => item.id !== chat.id));
      if (activeChatId === chat.id) newChat();
    } catch (cause) {
      reportError(cause, "Unable to delete this chat.");
    }
  }

  function updatePending(id: string, update: (message: UiMessage) => UiMessage) {
    setMessages((items) => items.map((message) => message.id === id ? update(message) : message));
  }

  async function ask(question: string, answeringAgent = selectedAgent, initialChatId = activeChatId) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || askInFlight.current || !answeringAgent?.live || !answeringAgent.has_documents) return;
    askInFlight.current = true;
    setSidebarCollapsed(true);
    setCategoryDrawerOpen(categoryPanelPersists());
    setDraft("");
    setStatus("Preparing your question…");
    setStreaming(true);

    let chatId = initialChatId;
    try {
      if (!chatId) {
        const created = await chatsApi.create(answeringAgent.key);
        chatId = created.id;
        setActiveChatId(created.id);
        setChats((items) => [created, ...items]);
      }

      const now = new Date();
      const timestamp = now.getTime();
      const userMessageId = `user-${timestamp}`;
      const pendingId = `pending-${timestamp}`;
      pendingConversationScroll.current = { mode: "turn-start", messageId: userMessageId };
      setMessages((items) => [
        ...items,
        { id: userMessageId, role: "user", content: cleanQuestion, createdAt: now.toISOString(), sources: [] },
        { id: pendingId, role: "assistant", content: "", createdAt: now.toISOString(), sources: [], streaming: true, retryQuestion: cleanQuestion },
      ]);

      const controller = new AbortController();
      activeStream.current = controller;
      let receivedText = "";
      let terminalError = false;
      await streamQuestion(cleanQuestion, chatId, {
        onEvent(event: StreamEvent) {
          if (event.event === "status") {
            setStatus(event.data.message ?? "Working…");
          } else if (event.event === "sources") {
            updatePending(pendingId, (message) => ({ ...message, sources: event.data.sources }));
          } else if (event.event === "token") {
            receivedText += event.data.text;
            updatePending(pendingId, (message) => ({ ...message, content: message.content + event.data.text }));
          } else if (event.event === "done") {
            const result = event.data;
            updatePending(pendingId, (message) => ({
              ...message,
              content: receivedText ? message.content : (result.answer ?? message.content),
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

      if (!terminalError) chatsApi.list(answeringAgent.key).then(setChats).catch(() => undefined);
    } catch (cause) {
      const aborted = cause instanceof DOMException && cause.name === "AbortError";
      setMessages((items) => items.map((message) => message.streaming ? {
        ...message,
        streaming: false,
        error: aborted ? "Response cancelled." : (cause instanceof Error ? cause.message : "Unable to get an answer."),
      } : message));
      setStatus(aborted ? "Response cancelled." : "Unable to get an answer.");
      if (!aborted) reportError(cause);
    } finally {
      activeStream.current = null;
      askInFlight.current = false;
      setStreaming(false);
      composer.current?.focus();
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  function askDashboardQuestion(agent: Agent, question: string) {
    activeStream.current?.abort();
    activeChatLoad.current?.abort();
    setAgentKey(agent.key);
    setChats([]);
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

  function navigation(mobile = false) {
    const agentButton = (agent: Agent) => {
      const active = agent.key === agentKey;
      return <button
        key={agent.key}
        type="button"
        disabled={!agent.live}
        title={!agent.live ? "Coming soon" : undefined}
        aria-label={`${displayName(agent)}${!agent.live ? " (Coming soon)" : ""}`}
        className={active ? styles.activeCategory : undefined}
        aria-pressed={active}
        onClick={() => selectAgent(agent)}
      >
        <Icon name="person" /><span>{displayName(agent)}</span>{!agent.live && <small>SOON</small>}
      </button>;
    };

    return <>
      {categoryMode && !mobile && <Link className={styles.categoryBack} href="/home" aria-label="Back to home"><Icon name="back" /></Link>}
      {mobile && <button className={styles.drawerBack} onClick={() => setDrawerOpen(false)} aria-label="Close navigation"><Icon name="back" /></button>}
      <Link href="/home" className={styles.brand} aria-label="Chapter and Verse home">
        <Image src="/chapter-verse-mark.svg" alt="" width={58} height={60} priority />
        <strong>Chapter &amp; Verse</strong>
        <span>&ldquo;Hey, quick question.&rdquo;</span>
        <small>AN INTELLENCE PRODUCT</small>
      </Link>
      <nav className={styles.navigation} aria-label="Knowledge agents">
        <p>KNOWLEDGE</p>
        {mortgageAgents.length > 0 && <div className={styles.mortgageGroup}>
          <button
            type="button"
            className={`${styles.mortgageParent} ${mortgageSelected || categoryDrawerOpen ? styles.activeCategory : ""}`}
            aria-label="Mortgage"
            aria-expanded={categoryDrawerOpen}
            aria-controls="mortgage-category-drawer"
            data-active={mortgageSelected || categoryDrawerOpen}
            onClick={() => {
              setCategoryDrawerOpen(true);
              if (mobile) setDrawerOpen(false);
            }}
          >
            <Icon name="home" /><span>Mortgage</span>
          </button>
        </div>}
        {otherAgents.map((agent) => agentButton(agent))}
      </nav>
      {(mobile || categoryMode) && <button className={`${styles.drawerLogout} ${!mobile ? styles.categoryLogout : ""}`} onClick={() => void logout()}><Icon name="logout" />Log Out</button>}
    </>;
  }

  if (loading) return <main className={styles.loadingScreen} aria-busy="true">Loading your workspace…</main>;

  return (
    <div className={`${styles.workspace} ${showConversation ? styles.chatMode : ""} ${categoryMode ? styles.categoryMode : ""} ${categoryDrawerOpen ? styles.categoryDrawerOpen : ""} ${sidebarCollapsed ? styles.sidebarCollapsed : ""} ${profile ? styles.profileMode : ""}`}>
      <a className={styles.skipLink} href="#knowledge-content">Skip to content</a>
      <aside className={styles.sidebar} aria-label="Main navigation">
        <button
          className={styles.sidebarToggle}
          type="button"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        ><Icon name={sidebarCollapsed ? "sidebarExpand" : "sidebarCollapse"} /></button>
        {navigation()}
      </aside>
      <dialog ref={drawer} className={styles.drawer} aria-label="Navigation" onCancel={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
        <div className={styles.drawerContent}>{navigation(true)}</div>
      </dialog>

      {categoryDrawerOpen && mortgageAgents.length > 0 && <>
        <div className={styles.categoryBackdrop} aria-hidden="true" onClick={() => setCategoryDrawerOpen(false)} />
        <aside className={styles.categoryRail} id="mortgage-category-drawer" aria-label="Mortgage category drawer">
          <div className={styles.categoryHeading}><span>Category</span><h2>Mortgage</h2></div>

          <section className={styles.categoryChooser} aria-labelledby="mortgage-categories-heading">
            <h3 id="mortgage-categories-heading">Categories</h3>
            <div className={styles.categoryList} role="group" aria-label="Mortgage agents">
              {mortgageAgents.map((agent) => <button
                key={agent.key}
                type="button"
                disabled={!agent.live}
                title={!agent.live ? "Coming soon" : undefined}
                className={agent.key === agentKey ? styles.activeDrawerCategory : undefined}
                aria-pressed={agent.key === agentKey}
                onClick={() => selectAgent(agent, categoryPanelPersists())}
              ><span className={styles.categoryDot} aria-hidden="true" /><span>{displayName(agent)}</span>{!agent.live && <small>SOON</small>}</button>)}
            </div>
          </section>

          <section className={styles.chatHistory} aria-labelledby="chat-history-heading">
            <div className={styles.chatHistoryHeading}>
              <div><h3 id="chat-history-heading">Chat history</h3><span>{selectedAgentName}</span></div>
              <button className={styles.newChatButton} onClick={newChat} aria-label="New chat"><span className={styles.newChatIcon} aria-hidden="true">+</span><span>New</span></button>
            </div>
            <div className={styles.policyList}>
          {chats.length === 0 && <p className={styles.emptyChats}>No conversations yet.</p>}
          {chats.map((chat) => renamingId === chat.id ? (
            <form className={styles.renameForm} key={chat.id} onSubmit={(event) => void renameChat(event, chat.id)}>
              <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} maxLength={200} aria-label="Chat title" autoFocus />
              <button type="submit">Save</button><button type="button" onClick={() => setRenamingId(null)}>Cancel</button>
            </form>
          ) : (
            <div className={`${styles.chatListItem} ${activeChatId === chat.id ? styles.selectedPolicy : ""}`} key={chat.id}>
              <button className={styles.chatTitle} title={chat.title} aria-pressed={activeChatId === chat.id} onClick={() => void loadChat(chat.id)}><span className={styles.chatTitleText}>{chat.title}</span></button>
              <button className={styles.chatAction} aria-label={`Rename ${chat.title}`} onClick={() => { setRenamingId(chat.id); setRenameDraft(chat.title); }}>✎</button>
              <button className={styles.chatAction} aria-label={`Delete ${chat.title}`} onClick={() => void deleteChat(chat)}>×</button>
            </div>
          ))}
            </div>
          </section>
        </aside>
      </>}

      <header className={styles.header}>
        <div className={styles.headerLead}>
          <div className={styles.greeting}>{profile ? <h1>My Profile</h1> : <><span>{headerLabel}</span><h1>{headerTitle}</h1></>}</div>
        </div>
        <div className={styles.mobileBrand}>
          <button ref={menuButton} className={styles.menuButton} aria-label="Open navigation" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Icon name="menu" /></button>
          {profile ? <h1>My Profile</h1> : <Link href="/home" className={styles.mobileHeaderCopy}><small>{headerLabel}</small><strong>{headerTitle}</strong></Link>}
        </div>
        <div className={styles.headerActions} ref={headerActions}>
          <button className={styles.notificationButton} aria-label="Notifications unavailable" aria-expanded={popover === "notifications"} onClick={() => setPopover(popover === "notifications" ? null : "notifications")}><span><Icon name="bell" /></span></button>
          <button className={styles.profileButton} aria-label="View profile" onClick={() => router.push("/profile")}><span className={styles.profileInitials} aria-hidden="true">{userInitials(user)}</span></button>
          <button className={styles.logoutButton} onClick={() => void logout()} aria-label="Log out"><Icon name="logout" /></button>
          {popover && <div className={styles.popover}>
            <strong>Notifications</strong>
            <p>Notifications are unavailable until the backend provides a notifications API.</p>
          </div>}
        </div>
      </header>

      {profile ? <main className={styles.profileMain} id="knowledge-content">{children}</main> : <main className={styles.main} id="knowledge-content">
        <section className={styles.center} aria-label={`${selectedAgentName} workspace`}>
          {showConversation ? <div className={styles.conversation} ref={conversation} role="log" aria-label="Conversation" aria-live="polite">
            {loadingChat && <p className={styles.emptyState}>Loading conversation…</p>}
            {messages.map((message) => <div key={message.id} data-message-id={message.id} className={`${styles.messageRow} ${message.role === "user" ? styles.outgoing : styles.incoming}`}>
              {message.role === "assistant" && <span className={styles.chatAvatar}><Image src="/chapter-verse-mark.svg" alt="Chapter & Verse" width={28} height={28} /><i /></span>}
              <div className={`${styles.messageBubble} ${message.role === "assistant" && message.streaming && !message.content ? styles.pendingBubble : ""}`}>
                {message.role === "assistant" ? message.streaming && !message.content
                  ? <span className={styles.thinkingIndicator} role="status" aria-label="Generating answer"><span /><span /><span /></span>
                  : <MarkdownMessage content={message.content} sources={message.sources} />
                  : <p>{message.content}</p>}
                {message.error && <div className={styles.messageError}><span>{message.error}</span>{message.retryQuestion && <button onClick={() => void ask(message.retryQuestion!)} disabled={streaming}>Retry</button>}</div>}
                {!(message.role === "assistant" && message.streaming && !message.content) && <div className={styles.messageMeta}>
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
                ><span>{`Mortgage / ${displayName(agent)}`}</span><strong>{question}</strong></button>)}
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
          {(hasCategoryContext || showConversation) && <div className={styles.composerArea}>
            {status && <p className={styles.status} role="status">{status}</p>}
            <form className={styles.composer} onSubmit={sendMessage}>
              <input ref={composer} aria-label="Write a message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={selectedAgent?.placeholder || "Write here…"} autoComplete="off" maxLength={4000} disabled={streaming || !selectedAgent?.live || !selectedAgent?.has_documents} />
              {streaming ? <button type="button" className={styles.cancelButton} aria-label="Cancel response" onClick={() => activeStream.current?.abort()}><Icon name="close" /></button> : draft.trim() && <button type="submit" aria-label="Send message"><Icon name="send" /></button>}
            </form>
            {selectedAgent && (!selectedAgent.live || !selectedAgent.has_documents) && <p className={styles.disabledReason}>{!selectedAgent.live ? "This agent is coming soon." : "Questions are disabled until documents are ingested."}</p>}
          </div>}
        </section>

      </main>}
    </div>
  );
}
