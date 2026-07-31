"use client";

import { cn } from "#lib/utils";
import * as React from "react";
import * as RechartsPrimitive from "recharts";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

export function useChart(): ChartContextValue {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer");
  }
  return context;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ReactElement;
}): React.ReactElement {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const THEMES = { light: "", dark: ".dark" } as const;

function ChartStyle({
  id,
  config,
}: {
  id: string;
  config: ChartConfig;
}): React.ReactElement | null {
  const colorConfig = Object.entries(config).filter(([, item]) => item.color);
  if (colorConfig.length === 0) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([, prefix]) => `${prefix} [data-chart=${id}] {
${colorConfig.map(([key, item]) => `  --color-${key}: ${item.color};`).join("\n")}
}`,
          )
          .join("\n"),
      }}
    />
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

type ChartTooltipPayloadItem = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: unknown;
  payload?: Record<string, unknown>;
};

export function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  formatter,
  color,
  nameKey,
  labelKey,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  className?: string;
  indicator?: "line" | "dot" | "dashed";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  label?: React.ReactNode;
  labelFormatter?: (label: React.ReactNode, payload: ChartTooltipPayloadItem[]) => React.ReactNode;
  formatter?: (
    value: unknown,
    name: string | number | undefined,
    item: ChartTooltipPayloadItem,
    index: number,
    payload: ChartTooltipPayloadItem[],
  ) => React.ReactNode;
  color?: string;
  nameKey?: string;
  labelKey?: string;
}): React.ReactElement | null {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const key = `${labelKey ?? item?.dataKey ?? item?.name ?? ""}`;
  const itemConfig = getPayloadConfig(config, item, key);
  const labelValue = itemConfig?.label ?? label;
  const tooltipLabel = hideLabel ? null : labelFormatter ? (
    <div className="font-medium">{labelFormatter(labelValue, payload)}</div>
  ) : labelValue ? (
    <div className="font-medium">{labelValue}</div>
  ) : null;

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg border bg-popover px-2.5 py-1.5 text-popover-foreground text-xs shadow-xl",
        className,
      )}
    >
      {tooltipLabel}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey ?? item.name ?? item.dataKey ?? ""}`;
          const itemConfig = getPayloadConfig(config, item, key);
          const indicatorColor = color ?? item.color ?? itemConfig?.color;

          return (
            <div
              key={`${item.dataKey ?? item.name ?? index}`}
              className={cn(
                "flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5 [&>svg]:text-muted-foreground",
                indicator === "dot" && "items-center",
              )}
            >
              {formatter?.(item.value, item.name, item, index, payload) ?? (
                <>
                  {!hideIndicator && (
                    <div
                      className={cn(
                        "shrink-0 rounded-[2px] border-[var(--color-border)] bg-[var(--color-bg)]",
                        {
                          "h-2.5 w-2.5": indicator === "dot",
                          "w-1": indicator === "line",
                          "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                          "my-0.5": tooltipLabel && indicator === "dashed",
                        },
                      )}
                      style={
                        {
                          "--color-bg": indicatorColor,
                          "--color-border": indicatorColor,
                        } as React.CSSProperties
                      }
                    />
                  )}
                  <div className="flex flex-1 justify-between gap-4 leading-none">
                    <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
                    {item.value !== undefined && (
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {String(item.value)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getPayloadConfig(
  config: ChartConfig,
  payload: ChartTooltipPayloadItem | undefined,
  key: string,
): ChartConfig[string] | undefined {
  if (!payload) return config[key];
  const nestedPayload = payload.payload;
  const nestedKey = nestedPayload?.[key];
  const configKey = typeof nestedKey === "string" ? nestedKey : key;
  return config[configKey] ?? config[key];
}
