import { BookOpenIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Built-in skills tab (stub).
 *
 * The internal Neovate build renders a list of built-in skills sourced from
 * `useSkillsStore.builtin` via a `listBuiltin` RPC. The open-source build does
 * not expose that RPC nor any built-in skills data, so this component renders
 * an empty state only — no data fetching, no RPC calls.
 */
export const SkillBuiltinTab = () => {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl bg-card/60 border border-border/30 py-12 flex flex-col items-center gap-3">
      <div className="flex items-center justify-center size-10 rounded-lg bg-muted text-muted-foreground">
        <BookOpenIcon className="size-5" />
      </div>
      <p className="text-sm text-muted-foreground text-center">
        {t("settings.skills.builtin.empty")}
      </p>
    </div>
  );
};
