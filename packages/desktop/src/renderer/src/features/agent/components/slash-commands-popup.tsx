import { forwardRef, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useProjectCapabilities } from "../hooks/use-project-capabilities";
import { SuggestionList, type SuggestionItem, type SuggestionListHandle } from "./suggestion-list";

type Props = {
  cwd: string;
  query: string;
  command: (item: SuggestionItem) => void;
  icon?: ReactNode;
};

export const SlashCommandsPopup = forwardRef<SuggestionListHandle, Props>(
  ({ cwd, query, command, icon }, ref) => {
    const { t } = useTranslation();
    const { data: capabilities, isLoading, error } = useProjectCapabilities(cwd);

    const items = useMemo<SuggestionItem[]>(() => {
      const commands = capabilities?.commands ?? [];
      const all: SuggestionItem[] = commands.map((cmd) => ({
        id: `/${cmd.name} ${cmd.description}`,
        label: `/${cmd.name}`,
        description: cmd.description,
      }));
      if (!query) return all;
      const lower = query.toLowerCase();
      return all.filter((c) => c.label.toLowerCase().includes(lower));
    }, [capabilities?.commands, query]);

    return (
      <SuggestionList
        ref={ref}
        items={items}
        command={command}
        header={t("chat.slashCommands.header")}
        icon={icon}
        isLoading={isLoading}
        errorMessage={error ? t("chat.slashCommands.error") : undefined}
        emptyMessage={t("chat.slashCommands.empty")}
      />
    );
  },
);

SlashCommandsPopup.displayName = "SlashCommandsPopup";
