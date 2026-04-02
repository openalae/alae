import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { GitFork, GitBranch, History, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
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



function formatStatusLabel(status: string | null) {
  if (!status) {
    return "No runs";
  }
  return status.replace(/_/g, " ");
}

function getStatusBadgeClasses(status: string) {
  if (status === "completed") {
    return "badge-success";
  }
  if (status === "failed") {
    return "badge-error";
  }
  return "badge-neutral";
}

function Badge(props: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
        props.className,
      )}
    >
      {props.children}
    </span>
  );
}

function SectionLabel(props: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{props.icon}</span>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {props.title}
        </h3>
      </div>
      {props.action}
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
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      {/* Conversations */}
      <section>
        <SectionLabel
          icon={<History className="h-3 w-3" />}
          title={t("Saved analyses")}
        />
        <div className="space-y-0.5">
          {conversations.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground italic">
              {t("No saved analyses yet.")}
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
                    "w-full rounded-md px-3 py-2 text-left transition-colors",
                    isActive
                      ? "border-l-2 border-primary bg-primary/5 text-primary"
                      : "border-l-2 border-transparent text-foreground hover:bg-accent",
                  )}
                >
                  <div className="truncate text-xs font-medium">{conversation.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{conversation.branchCount} {t("branches")}</span>
                    <span>·</span>
                    <span>{conversation.nodeCount} {t("nodes")}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Branches */}
      <section>
        <SectionLabel
          icon={<GitBranch className="h-3 w-3" />}
          title={t("Paths")}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[9px]"
              onClick={onForkSelectedNode}
              disabled={isForkDisabled}
              aria-label={t("Branch from selected step")}
            >
              <GitFork className="h-3 w-3" />
            </Button>
          }
        />
        <div className="space-y-0.5">
          {branches.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground italic">
              {t("No branches available.")}
            </div>
          ) : (
            branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => onSelectBranch(branch.id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left transition-colors",
                  branch.isActive
                    ? "border-l-2 border-primary bg-primary/5 text-primary"
                    : "border-l-2 border-transparent text-foreground hover:bg-accent",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium">
                    {branch.name}
                    {branch.isMain ? ` (${t("main")})` : ""}
                  </span>
                  {branch.isActive && (
                    <Badge className="badge-info">{t("active")}</Badge>
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {branch.nodeCount} {t("nodes")}
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Nodes / Saved Steps */}
      <section>
        <SectionLabel
          icon={<Sparkles className="h-3 w-3" />}
          title={t("Saved steps")}
        />
        <div className="space-y-0.5">
          {nodes.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground italic">
              {t("No nodes available.")}
            </div>
          ) : (
            nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left transition-colors",
                  node.isSelected
                    ? "border-l-2 border-primary bg-primary/5 text-primary"
                    : "border-l-2 border-transparent text-foreground hover:bg-accent",
                )}
              >
                <div className="truncate text-xs font-medium">{node.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {node.isHead && <Badge className="badge-info">{t("head")}</Badge>}
                  {node.isForkSource && <Badge className="badge-warning">{t("fork source")}</Badge>}
                  <Badge className={getStatusBadgeClasses(node.status)}>
                    {formatStatusLabel(node.status)}
                  </Badge>
                  <Badge className={node.hasSynthesisReport ? "badge-success" : "badge-neutral"}>
                    {node.hasSynthesisReport ? t("report saved") : t("no report")}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
