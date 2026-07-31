/**
 * Highlights the first occurrence of `query` within `text` using primary color.
 * Case-insensitive matching; preserves original casing in the output.
 */
export function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return <span>{text}</span>;

  return (
    <span>
      {text.slice(0, index)}
      <span className="text-primary font-semibold">{text.slice(index, index + query.length)}</span>
      {text.slice(index + query.length)}
    </span>
  );
}
