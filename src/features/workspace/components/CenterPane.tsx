import type { WorkspaceController } from "@/features/workspace/controller";
import { ConversationTimeline } from "@/features/chat/components/ConversationTimeline";
import { BottomComposer } from "@/features/chat/components/BottomComposer";

export function CenterPane({ controller }: { controller: WorkspaceController }) {
  return (
    <div className="flex flex-col h-full w-full relative bg-surface overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <ConversationTimeline controller={controller} />
      </div>
      <BottomComposer controller={controller} />
    </div>
  );
}
