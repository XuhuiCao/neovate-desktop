import type React from "react";

import { Badge } from "@neo/ui/components/badge";
import { TriangleAlertIcon } from "lucide-react";

import type { ModelTag, ModelTagName } from "../../../../shared/features/provider/types";

import { getVisibleModelTags } from "../../../../shared/features/provider/model-tag-helper";

function tagVariant(name: ModelTagName): "warning" | "info" | "success" | "outline" | "secondary" {
  switch (name) {
    case "BETA":
    case "EXTERNAL":
      return "warning";
    case "MULTI_MODEL":
      return "info";
    case "DEFAULT":
      return "success";
    // Length/metadata tag — neutral outlined badge reads clearer than a tinted
    // fill against the dark dropdown.
    case "CONTEXT":
      return "outline";
    default:
      return "secondary";
  }
}

// Renders a model's tags as badges. The label is the server-provided `cname`
// (getVisibleModelTags drops any tag without one), so no i18n fallback — matching
// the web nchat dropdown. CONTEXT prefixes its length value (e.g. "1m 上下文").
export function ModelTags({ tags }: { tags?: ModelTag[] }): React.ReactElement | null {
  const visible = getVisibleModelTags({ tags });
  if (visible.length === 0) return null;
  return (
    <>
      {visible.map((tag) => {
        const text = tag.name === "CONTEXT" && tag.value ? `${tag.value} ${tag.cname}` : tag.cname;
        return (
          <Badge key={tag.name} variant={tagVariant(tag.name)} size="sm">
            {tag.name === "EXTERNAL" && <TriangleAlertIcon className="h-3 w-3" />}
            {text}
          </Badge>
        );
      })}
    </>
  );
}
