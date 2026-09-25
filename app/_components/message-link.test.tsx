import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MessageLink } from "./message-link";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("answer links", () => {
  beforeEach(() => push.mockReset());

  it("uses a Next.js link for app pages without losing query or fragment", () => {
    render(<MessageLink href="/category/fha?chat=chat%2F1#answer">FHA</MessageLink>);
    const link = screen.getByRole("link", { name: "FHA" });
    expect(link).toHaveAttribute("href", "/category/fha?chat=chat%2F1#answer");
    expect(link).not.toHaveAttribute("target");
  });

  it("routes absolute same-origin page links and leaves modified clicks to the browser", () => {
    render(<MessageLink href={`${window.location.origin}/profile?tab=account#details`}>Profile</MessageLink>);
    const link = screen.getByRole("link", { name: "Profile" });
    expect(fireEvent.click(link)).toBe(false);
    expect(push).toHaveBeenCalledExactlyOnceWith("/profile?tab=account#details");
    push.mockClear();
    fireEvent.click(link, { ctrlKey: true });
    expect(push).not.toHaveBeenCalled();
  });

  it.each(["https://example.com/category/fha", "//example.com/profile", "/api/v1/documents/guide/file#page=12", "/guide.pdf", "mailto:person@example.test", "#answer"])("keeps reference/action link %s native", (href) => {
    render(<MessageLink href={href}>Reference</MessageLink>);
    const link = screen.getByRole("link", { name: "Reference" });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    fireEvent.click(link);
    expect(push).not.toHaveBeenCalled();
  });
});
