import { Presentation, Construction } from "lucide-react";
import { useTranslation } from "react-i18next";

export function CanvasModeShell() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-muted-foreground bg-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-border/20 via-background to-background pointer-events-none" />
      
      <div className="flex flex-col items-center max-w-md p-8 border border-border/50 bg-card rounded-3xl shadow-sm relative z-10 backdrop-blur-sm">
        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-primary mb-6 ring-4 ring-background shadow-inner">
          <Presentation className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">{t("Canvas Mode")}</h2>
        <p className="text-sm leading-relaxed mb-6">
          {t("A spatial canvas for infinite mapping of reasoning trees and node visualization. Coming in a future update.")}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest">
          <Construction className="w-4 h-4" />
          {t("Under Construction")}
        </div>
      </div>
    </div>
  );
}
