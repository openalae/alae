import type { ReactNode } from "react";

import { GitFork, GitBranch, History, PanelLeft, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ReasoningTreeConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  branchCount: number;
  nodeCount: number;
  latestNodeStatus: string | null;
};

export type ReasoningTreeBranchSummary = {
  id: string;
  name: string;
  updatedAt: string;
  isMain: boolean;
  isActive: boolean;
  nodeCount: number;
  headNodeId: string | null;
  sourceNodeId: string | null;
  rootNodeId: string | null;
};

export type ReasoningTreeNodeSummary = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  createdAt: string;
  isHead: boolean;
  isSelected: boolean;
  isForkSource: boolean;
  hasSynthesisReport: boolean;
};

export type ReasoningTreeExplorerProps = {
  conversations: ReasoningTreeConversationSummary[];
  activeConversationId: string | null;
  branches: ReasoningTreeBranchSummary[];
  nodes: ReasoningTreeNodeSummary[];
  onSelectConversation: (id: string) => void;
  onSelectBranch: (id: string) => void;
  onSelectNode: (id: string) => void;
  onForkSelectedNode: () => void;
  isForkDisabled?: boolean;
};

function formatDatetime(value: string) {
  return value.replace("T", " ").replace(".000Z", "Z");
}

function formatStatusLabel(status: string | null) {
  if (!status) {
    return "No runs";
  }

  return status.replace(/_/g, " ");
}

function getStatusBadgeClasses(status: string) {
  if (status === "completed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900";
  }

  if (status === "failed") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-900";
  }

  return "border-border/80 bg-background/80 text-muted-foreground";
}

function Badge(props: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]",
        props.className,
      )}
    >
      {props.children}
    </span>
  );
}

function SectionHeader(props: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-primary">
        {props.icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">{props.title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{props.description}</p>
      </div>
    </div>
  );
}

export function ReasoningTreeExplorer({
  conversations,
  activeConversationId,
  branches,
  nodes,
  onSelectConversation,
  onSelectBranch,
  onSelectNode,
  onForkSelectedNode,
  isForkDisabled = false,
}: ReasoningTreeExplorerProps) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b border-border/70 bg-card/85">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <PanelLeft className="h-3.5 w-3.5 text-primary" />
              History
            </div>
            <div>
              <CardTitle className="text-2xl tracking-[-0.03em]">Analysis history</CardTitle>
              <CardDescription className="mt-2 max-w-sm">
                Reopen saved questions, switch paths, and continue from any earlier step.
              </CardDescription>
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={onForkSelectedNode} disabled={isForkDisabled}>
            <GitFork className="h-4 w-4" />
            Branch from selected step
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        <section className="space-y-3">
          <SectionHeader
            icon={<History className="h-4 w-4" />}
            title="Saved analyses"
            description="Pick a saved question to reopen its history."
          />
          <div className="space-y-2">
            {conversations.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
                No saved analyses yet.
              </div>
            ) : (
              conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className={cn(
                      "w-full rounded-[1.5rem] border px-4 py-4 text-left transition-colors",
                      isActive
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/70 bg-background/75 hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{conversation.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Updated {formatDatetime(conversation.updatedAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge className="border-border/80 bg-background/80 text-muted-foreground">
                          {conversation.branchCount} branches
                        </Badge>
                        <Badge className="border-border/80 bg-background/80 text-muted-foreground">
                          {conversation.nodeCount} nodes
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Badge className={getStatusBadgeClasses(conversation.latestNodeStatus ?? "idle")}>
                        {formatStatusLabel(conversation.latestNodeStatus)}
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader
            icon={<GitBranch className="h-4 w-4" />}
            title="Paths"
            description="Switch between the main path and any alternate branch."
          />
          <div className="space-y-2">
            {branches.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
                No branches available.
              </div>
            ) : (
              branches.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => onSelectBranch(branch.id)}
                  className={cn(
                    "w-full rounded-[1.5rem] border px-4 py-4 text-left transition-colors",
                    branch.isActive
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/70 bg-background/75 hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {branch.name}
                        {branch.isMain ? " (main)" : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Updated {formatDatetime(branch.updatedAt)} · {branch.nodeCount} nodes
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {branch.isMain ? <Badge className="border-border/80 bg-background/80 text-muted-foreground">main</Badge> : null}
                      {branch.isActive ? (
                        <Badge className="border-primary/30 bg-primary/10 text-primary">active</Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader
            icon={<Sparkles className="h-4 w-4" />}
            title="Saved steps"
            description="Each step keeps the question and, when available, the saved answer."
          />
          <div className="space-y-2">
            {nodes.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
                No nodes available.
              </div>
            ) : (
              nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className={cn(
                    "w-full rounded-[1.5rem] border px-4 py-4 text-left transition-colors",
                    node.isSelected
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/70 bg-background/75 hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{node.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Created {formatDatetime(node.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {node.isHead ? (
                        <Badge className="border-sky-500/30 bg-sky-500/10 text-sky-900">head</Badge>
                      ) : null}
                      {node.isForkSource ? (
                        <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-900">
                          fork source
                        </Badge>
                      ) : null}
                      <Badge className={getStatusBadgeClasses(node.status)}>{node.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {node.prompt}
                  </p>
                  <div className="mt-3">
                    <Badge
                      className={cn(
                        node.hasSynthesisReport
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900"
                          : "border-border/80 bg-background/80 text-muted-foreground",
                      )}
                    >
                      {node.hasSynthesisReport ? "report saved" : "no report"}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
