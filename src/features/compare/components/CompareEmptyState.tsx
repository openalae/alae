import { GitCompare } from "lucide-react";
import { useTranslation } from "react-i18next";

export function CompareEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="flex flex-col items-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-5">
          <GitCompare className="w-6 h-6 text-primary/60" />
        </div>
        <h2 className="text-base font-semibold text-foreground mb-2">
          {t("No outputs to compare")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(
            "Run a multi-model analysis in Chat mode first. When a turn has outputs from 2 or more models, switch here to compare them side by side.",
          )}
        </p>
      </div>
    </div>
  );
}
