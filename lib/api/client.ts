import type { Agent, AnswerUiState, Chat, ChatDetail, User } from "./types";

const API_PREFIX = "/api/v1";

type FastApiIssue = { loc?: Array<string | number>; msg?: string };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const issues = detail as FastApiIssue[];
      const message = issues
        .map((issue) => {
          const field = issue.loc?.filter((part) => part !== "body").join(".");
          return [field, issue.msg].filter(Boolean).join(": ");
        })
        .filter(Boolean)
        .join("; ");
      if (message) return message;
    }
  }

  const defaults: Record<number, string> = {
    401: "Your session has expired. Please log in again.",
    403: "You do not have permission to do that.",
    404: "The requested item was not found.",
    409: "That change conflicts with an existing record.",
    422: "Please check the information you entered.",
  };
  return defaults[status] ?? `Request failed (${status}).`;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(errorMessage(response.status, body), response.status, body);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authApi = {
  signup: (fullName: string, email: string, password: string) =>
    apiRequest<User>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ full_name: fullName, email, password }),
    }),
  login: (email: string, password: string, rememberMe = false) =>
    apiRequest<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember_me: rememberMe }),
    }),
  me: (signal?: AbortSignal) => apiRequest<User>("/auth/me", { cache: "no-store", signal }),
  logout: () => apiRequest<{ status: string }>("/auth/logout", { method: "POST" }),
};

export const agentsApi = {
  list: () => apiRequest<Agent[]>("/agents"),
};

export const chatsApi = {
  list: (agentKey: string, signal?: AbortSignal) =>
    apiRequest<Chat[]>(`/chats?agent_key=${encodeURIComponent(agentKey)}`, { signal }),
  create: (agentKey: string) =>
    apiRequest<Chat>("/chats", {
      method: "POST",
      body: JSON.stringify({ agent_key: agentKey }),
    }),
  get: (chatId: string, signal?: AbortSignal) =>
    apiRequest<ChatDetail>(`/chats/${encodeURIComponent(chatId)}`, { signal }),
  rename: (chatId: string, title: string) =>
    apiRequest<Chat>(`/chats/${encodeURIComponent(chatId)}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  remove: (chatId: string) =>
    apiRequest<{ status: string; id: string }>(`/chats/${encodeURIComponent(chatId)}`, {
      method: "DELETE",
    }),
  updateMessageUiState: (
    chatId: string,
    messageId: string,
    uiState: AnswerUiState,
  ) =>
    apiRequest<{
      message_id: string;
      ui_state: AnswerUiState;
    }>(
      `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/ui-state`,
      {
        method: "PATCH",
        body: JSON.stringify(uiState),
      },
    ),
};

export const feedbackApi = {
  send: (auditId: string, feedback: "up" | "down") =>
    apiRequest<{ status: string; audit_id: string; feedback: "up" | "down" }>("/feedback", {
      method: "POST",
      body: JSON.stringify({ audit_id: auditId, feedback }),
    }),
};
