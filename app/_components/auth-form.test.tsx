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

  it("validates sign-up fields and sends only the supported API values", async () => {
    let resolveSignup!: (user: { id: string; email: string; role: string; created_at: string }) => void;
    const signup = vi.spyOn(authApi, "signup").mockReturnValue(new Promise((resolve) => { resolveSignup = resolve; }));
    render(<AuthForm mode="signup" />);

    const submit = screen.getByRole("button", { name: "Sign Up" });
    const form = submit.closest("form")!;
    expect(Array.from(form.querySelectorAll("input"), (input) => input.name)).toEqual([
      "full_name", "email", "password", "confirm_password",
    ]);
    for (const input of form.querySelectorAll("input")) expect(input).toBeRequired();

    fireEvent.click(submit);
    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(screen.getByText("Confirm password is required.")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "  Taylor Smith  " } });
    fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "invalid-email" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "different" } });
    fireEvent.click(submit);
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password8" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "password8" } });
    fireEvent.click(submit);

    await waitFor(() => expect(signup).toHaveBeenCalledWith("Taylor Smith", "taylor@example.com", "password8"));
    expect(submit).toBeDisabled();
    resolveSignup({ id: "u", email: "taylor@example.com", role: "user", created_at: "now" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("keeps login limited to email and password", () => {
    render(<AuthForm mode="login" />);
    const form = screen.getByRole("button", { name: "Log In" }).closest("form")!;
    expect(Array.from(form.querySelectorAll("input"), (input) => input.name)).toEqual(["email", "password"]);
    expect(screen.queryByLabelText("Full Name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm Password")).not.toBeInTheDocument();
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
