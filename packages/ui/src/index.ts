// @neo/ui 共享原语包。
// 组件按具名从子路径导入：`import { Button } from "@neo/ui/components/button"`。
// 主入口仅暴露通用工具，避免 barrel 导致的循环依赖与编译开销。
export { cn } from "./lib/utils";
export { useIsMobile } from "./hooks/use-mobile";
