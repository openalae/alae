import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReasoningTreeExplorer } from "@/features/reasoning-tree/explorer";

describe("ReasoningTreeExplorer", () => {
  it("renders the chat history section", () => {
    render(
      <ReasoningTreeExplorer
        conversations={[
          {
            id: "conversation-1",
            title: "Research session",
            updatedAt: "2026-04-01T08:00:00.000Z",
            branchCount: 2,
            nodeCount: 4,
            latestNodeStatus: "completed",
          },
        ]}
        activeConversationId="conversation-1"
        onSelectConversation={vi.fn()}
      />,
    );

    expect(screen.getByText("Chat History")).toBeInTheDocument();
    expect(screen.getByText("Research session")).toBeInTheDocument();
  });

  it("handles conversation selection", async () => {
    const user = userEvent.setup();
    const onSelectConversation = vi.fn();

    render(
      <ReasoningTreeExplorer
        conversations={[
          {
            id: "conversation-1",
            title: "Research session",
            updatedAt: "2026-04-01T08:00:00.000Z",
            branchCount: 2,
            nodeCount: 4,
            latestNodeStatus: "completed",
          },
        ]}
        activeConversationId={null}
        onSelectConversation={onSelectConversation}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Research session/i }));

    expect(onSelectConversation).toHaveBeenCalledWith("conversation-1");
  });
});
