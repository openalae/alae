import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReasoningTreeExplorer } from "@/features/reasoning-tree/explorer";

describe("ReasoningTreeExplorer", () => {
  it("renders the three explorer sections", () => {
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
        branches={[
          {
            id: "branch-1",
            name: "main",
            updatedAt: "2026-04-01T08:05:00.000Z",
            isMain: true,
            isActive: true,
            nodeCount: 3,
            headNodeId: "node-2",
            sourceNodeId: null,
            rootNodeId: "node-1",
          },
        ]}
        nodes={[
          {
            id: "node-1",
            title: "Root note",
            prompt: "Start the conversation.",
            status: "completed",
            createdAt: "2026-04-01T08:01:00.000Z",
            isHead: false,
            isSelected: true,
            isForkSource: true,
            hasSynthesisReport: true,
          },
        ]}
        onSelectConversation={vi.fn()}
        onSelectBranch={vi.fn()}
        onSelectNode={vi.fn()}
        onForkSelectedNode={vi.fn()}
      />,
    );

    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Branches")).toBeInTheDocument();
    expect(screen.getByText("Nodes")).toBeInTheDocument();
  });

  it("shows node badges and triggers fork actions", async () => {
    const user = userEvent.setup();
    const onForkSelectedNode = vi.fn();

    render(
      <ReasoningTreeExplorer
        conversations={[]}
        activeConversationId={null}
        branches={[]}
        nodes={[
          {
            id: "node-1",
            title: "Selected head",
            prompt: "Refine the branch head.",
            status: "completed",
            createdAt: "2026-04-01T08:01:00.000Z",
            isHead: true,
            isSelected: true,
            isForkSource: true,
            hasSynthesisReport: true,
          },
          {
            id: "node-2",
            title: "Failed branch point",
            prompt: "A failed experiment.",
            status: "failed",
            createdAt: "2026-04-01T08:02:00.000Z",
            isHead: false,
            isSelected: false,
            isForkSource: false,
            hasSynthesisReport: false,
          },
        ]}
        onSelectConversation={vi.fn()}
        onSelectBranch={vi.fn()}
        onSelectNode={vi.fn()}
        onForkSelectedNode={onForkSelectedNode}
      />,
    );

    expect(screen.getByText("head")).toBeInTheDocument();
    expect(screen.getByText("fork source")).toBeInTheDocument();
    expect(screen.getAllByText("completed")).toHaveLength(1);
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("report saved")).toBeInTheDocument();
    expect(screen.getByText("no report")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /fork selected node/i }));

    expect(onForkSelectedNode).toHaveBeenCalledTimes(1);
  });
});

