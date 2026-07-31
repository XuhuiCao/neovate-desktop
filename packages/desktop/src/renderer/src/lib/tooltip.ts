/**
 * Tooltip 延迟标准。
 *
 * 图标按钮的 tooltip 充当可见 label,用 0(instant)——这类 trigger 通常孤立出现,
 * 即时反馈不会造成视觉噪音,与工具栏其余图标按钮保持一致。
 *
 * 富内容 / 消歧型 tooltip(用量明细、截断文本的完整值等)用 hover-intent 延迟:
 * 鼠标划过密集 trigger 区域时,延迟可区分"路过"与"想看",避免连续闪现。
 */
export const TOOLTIP_HOVER_INTENT_DELAY = 400;
