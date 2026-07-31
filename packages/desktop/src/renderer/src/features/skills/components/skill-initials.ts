export const getSkillInitials = (name: string): string => {
  const trimmedName = name.trim();
  const words = trimmedName.split(/[\s_-]+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  const fallback = words[0] ?? trimmedName.replace(/[\s_-]+/g, "");
  return (fallback.slice(0, 2) || "?").toUpperCase();
};
