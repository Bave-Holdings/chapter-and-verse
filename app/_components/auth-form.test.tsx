import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, authApi } from "../../lib/api";
import { AuthForm } from "./auth-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

describe("AuthForm", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.spyOn(authApi, "login").mockReset();
    vi.spyOn(authApi, "signup").mockReset();
  });

  it("logs in through the API and routes to the workspace", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({ id: "u", email: "user@example.com", role: "user", created_at: "now" });
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith("user@example.com", "secret"));
    expect(replace).toHaveBeenCalledWith("/home");
  });

  it("shows normalized API failures", async () => {
    vi.spyOn(authApi, "login").mockRejectedValue(new ApiError("Invalid credentials", 401));
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
  });
});
