import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function RecipeEditorShell() {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 p-4 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t("Turn Recipe")}</h3>
        </div>
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-5">
                {t("Tweak verification methods, select specific models, and adjust temperature parameters for the current node execution.")}
            </p>
            <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                {t("Open Editor (Coming Soon)")}
            </Button>
        </div>
    </div>
  );
}
