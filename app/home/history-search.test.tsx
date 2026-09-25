import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HistorySearch } from "./history-search";

const chats = ["Income analysis", "Credit requirements"].map((title, index) => ({
  id: `chat-${index}`, title, agent_key: "mortgage_guidelines", user_id: "user",
  created_at: "2026-09-24T08:00:00Z", updated_at: "2026-09-24T08:00:00Z",
}));
const props = { chats, loading: false, error: "", disabled: false, activeChatId: null, onSelect: vi.fn(), onClose: vi.fn() };

describe("HistorySearch", () => {
  it("supports keyboard selection, search, and no matching results", () => {
    const onSelect = vi.fn();
    render(<HistorySearch {...props} onSelect={onSelect} />);
    const dialog = screen.getByRole("dialog", { name: "Search chat history" });
    const search = within(dialog).getByRole("searchbox");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    const first = within(dialog).getByRole("button", { name: chats[0].title });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(within(dialog).getByRole("button", { name: chats[1].title })).toHaveFocus();
    fireEvent.change(search, { target: { value: "no matches" } });
    expect(screen.getByRole("status")).toHaveTextContent("No chats match");
    expect(screen.queryByRole("button", { name: chats[0].title })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "  CREDIT  " } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(chats[1].id);
  });

  it("handles close, Escape, and the backdrop without closing on content clicks", () => {
    const onClose = vi.fn();
    render(<HistorySearch {...props} onClose={onClose} />);
    fireEvent.click(screen.getByRole("heading", { name: "Recent chats" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close history search" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("shows loading, empty history, and partial failures without hiding available chats", () => {
    const { rerender } = render(<HistorySearch {...props} chats={[]} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading recent chats");
    expect(screen.getByRole("status")).not.toHaveTextContent("No conversations yet");
    rerender(<HistorySearch {...props} chats={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("No conversations yet");
    rerender(<HistorySearch {...props} error="Some conversations could not be loaded." />);
    expect(screen.getByRole("status")).toHaveTextContent("Some conversations could not be loaded");
    expect(screen.getByRole("button", { name: chats[0].title })).toBeEnabled();
  });

  it("prevents opening a result while an answer is streaming", () => {
    const onSelect = vi.fn();
    render(<HistorySearch {...props} disabled onSelect={onSelect} />);
    const result = screen.getByRole("button", { name: chats[0].title });
    expect(result).toBeDisabled();
    fireEvent.click(result);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
