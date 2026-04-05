import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SynthesisReportSplitView } from "@/features/workspace";
import { useSettingsStore } from "@/store/settings";
import type { ConversationNode, SynthesisReport } from "@/schema";

const report: SynthesisReport = {
  id: "report-shortcuts-1",
  prompt: "Compare two approaches.",
  summary: "Two candidate answers are ready for review.",
  status: "partial",
  candidateMode: "dual",
  pendingJudge: true,
  reportStage: "awaiting_judge",
  judgeStatus: "pending",
  executionPlan: null,
  consensus: {
    summary: "Both candidates agree that a migration is needed.",
    items: [],
  },
  conflicts: [
    {
      id: "conflict-1",
      title: "Migration order",
      summary: "The models disagree on whether to migrate storage or UI first.",
      category: "approach",
      severity: "high",
      question: "Which migration step should happen first?",
      positions: [
        {
          modelRunId: "run-strong-1",
          label: "Strong candidate",
          stance: "Migrate storage first.",
          evidence: "Storage unlocks the rest of the rollout.",
        },
        {
          modelRunId: "run-fast-1",
          label: "Fast candidate",
          stance: "Migrate the UI first.",
          evidence: "UI lets the team validate the interaction model early.",
        },
      ],
    },
  ],
  resolution: null,
  nextActions: ["Resolve the migration conflict."],
  modelRuns: [
    {
      id: "run-strong-1",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      role: "strong",
      status: "completed",
      startedAt: "2026-04-05T00:00:00.000Z",
      completedAt: "2026-04-05T00:00:02.000Z",
      latencyMs: 2000,
      usage: {
        inputTokens: 320,
        outputTokens: 180,
        totalTokens: 500,
      },
      rawText: "{\"summary\":\"storage first\"}",
      parsed: {
        outputType: "candidate",
        summary: "Migrate storage first.",
        consensusItems: [],
        conflictObservations: [],
        recommendedActions: [],
      },
      validation: {
        status: "passed",
        issues: [],
      },
      error: null,
    },
    {
      id: "run-fast-1",
      provider: "google",
      model: "gemini-2.5-flash",
      role: "fast",
      status: "completed",
      startedAt: "2026-04-05T00:00:00.000Z",
      completedAt: "2026-04-05T00:00:01.000Z",
      latencyMs: 1000,
      usage: {
        inputTokens: 280,
        outputTokens: 120,
        totalTokens: 400,
      },
      rawText: "{\"summary\":\"ui first\"}",
      parsed: {
        outputType: "candidate",
        summary: "Migrate the UI first.",
        consensusItems: [],
        conflictObservations: [],
        recommendedActions: [],
      },
      validation: {
        status: "passed",
        issues: [],
      },
      error: null,
    },
  ],
  createdAt: "2026-04-05T00:00:02.000Z",
};

const outlineNodes: ConversationNode[] = [
  {
    id: "node-1",
    conversationId: "conversation-1",
    branchId: "branch-main-1",
    parentNodeId: null,
    title: "Compare rendering patterns.",
    prompt: "Compare rendering patterns.",
    status: "completed",
    synthesisReport: report,
    truthPanelSnapshot: null,
    createdAt: "2026-04-05T00:00:00.000Z",
    updatedAt: "2026-04-05T00:00:00.000Z",
  },
  {
    id: "node-2",
    conversationId: "conversation-1",
    branchId: "branch-main-1",
    parentNodeId: "node-1",
    title: "Compare two approaches.",
    prompt: "Compare two approaches.",
    status: "completed",
    synthesisReport: report,
    truthPanelSnapshot: null,
    createdAt: "2026-04-05T00:00:02.000Z",
    updatedAt: "2026-04-05T00:00:02.000Z",
  },
];

describe("SynthesisReportSplitView", () => {
  beforeEach(() => {
    useSettingsStore.setState({ developerMode: false });
  });

  it("opens the directory tab and focuses panes via keyboard shortcuts", () => {
    const onSelectOutlineNode = vi.fn();
    render(
      <SynthesisReportSplitView
        report={report}
        onResolve={vi.fn()}
        isBusy={false}
        conversationOutlineNodes={outlineNodes}
        activeOutlineNodeId="node-2"
        onSelectOutlineNode={onSelectOutlineNode}
      />,
    );

    fireEvent.keyDown(window, { key: "o", metaKey: true, shiftKey: true });
    expect(screen.queryByText("Jump to")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Compare rendering patterns\./i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Compare two approaches\./i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Compare rendering patterns\./i }));
    expect(onSelectOutlineNode).toHaveBeenCalledWith("node-1");

    fireEvent.keyDown(window, { key: "2", metaKey: true });
    expect(screen.getByLabelText(/Pane 2/i)).toHaveFocus();
  });

  it("runs the resolve action from the keyboard when judge work is pending", () => {
    const onResolve = vi.fn();
    render(<SynthesisReportSplitView report={report} onResolve={onResolve} isBusy={false} />);

    fireEvent.keyDown(window, { key: "r", ctrlKey: true, shiftKey: true });

    expect(onResolve).toHaveBeenCalledTimes(1);
  });
});
