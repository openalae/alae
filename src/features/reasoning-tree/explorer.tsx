import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { History, MessageSquare } from "lucide-react";


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
  onSelectConversation,
}: Pick<ReasoningTreeExplorerProps, "conversations" | "activeConversationId" | "onSelectConversation">) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      {/* Conversations */}
      <section>
        <SectionLabel
          icon={<MessageSquare className="h-3 w-3" />}
          title={t("Chat History")}
        />
        <div className="space-y-0.5">
          {conversations.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground italic">
              {t("No chat history yet.")}
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
                  <div className="mt-0.5 text-[10px] text-muted-foreground flex gap-1 items-center">
                    <History className="h-3 w-3 inline-block" />
                    {new Date(conversation.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
