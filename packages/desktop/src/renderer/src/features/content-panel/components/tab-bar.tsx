import { ScrollArea } from "@neo/ui/components/scroll-area";

import type { Tab } from "../types";

import { cn } from "../../../lib/utils";
import { NewTabMenu } from "./new-tab-menu";
import { TabItem } from "./tab-item";

export function TabBar({
  tabs,
  activeTabId,
  registeredViewTypes,
}: {
  tabs: Tab[];
  activeTabId: string | null;
  registeredViewTypes: Set<string>;
}) {
  return (
    <div className={cn("flex items-center h-10", tabs.length > 0 && "border-b border-border")}>
      <ScrollArea
        scrollFade
        className="min-w-0 flex-1 [&_[data-slot=scroll-area-scrollbar]]:hidden [&_[data-slot=scroll-area-viewport]]:!flex [&_[data-slot=scroll-area-viewport]]:items-center"
      >
        <div className="flex items-center gap-1 px-1">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={activeTabId === tab.id}
              isOrphan={!registeredViewTypes.has(tab.viewType)}
            />
          ))}
        </div>
      </ScrollArea>
      <NewTabMenu />
    </div>
  );
}
