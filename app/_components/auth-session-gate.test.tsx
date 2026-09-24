import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, authApi, type User } from "../../lib/api";
import { AuthSessionGate } from "./auth-session-gate";

const router = { replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("AuthSessionGate", () => {
  beforeEach(() => router.replace.mockReset());

  it("keeps forms hidden while checking and redirects an active session home", async () => {
    let resolveSession!: (user: User) => void;
    vi.spyOn(authApi, "me").mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    render(<AuthSessionGate><h1>Log in</h1></AuthSessionGate>);
    expect(screen.getByRole("status")).toHaveAccessibleName("Loading");
    expect(screen.queryByText(/Checking your session/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    await act(async () => resolveSession({ id: "user", email: "test@example.test", role: "user", created_at: "now" }));
    expect(router.replace).toHaveBeenCalledWith("/home");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it.each([
    new ApiError("Unauthorized", 401),
    new ApiError("Unavailable", 503),
    new TypeError("Failed to fetch"),
  ])("allows sign-in when the session check fails: %s", async (error) => {
    vi.spyOn(authApi, "me").mockRejectedValue(error);
    render(<AuthSessionGate><h1>Log in</h1></AuthSessionGate>);
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("cancels the session check when navigating away", async () => {
    let resolveSession!: (user: User) => void;
    const me = vi.spyOn(authApi, "me").mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    const view = render(<AuthSessionGate><h1>Log in</h1></AuthSessionGate>);
    await waitFor(() => expect(me).toHaveBeenCalledOnce());
    const signal = me.mock.calls[0][0];
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolveSession({ id: "user", email: "test@example.test", role: "user", created_at: "now" }));
    expect(router.replace).not.toHaveBeenCalled();
  });
});
