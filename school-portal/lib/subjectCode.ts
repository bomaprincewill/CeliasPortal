const IGNORED_WORDS = new Set(["and", "of", "the"]);

/** Create a short, readable subject code from a subject name. */
export function abbreviateSubjectName(name: string): string {
  const words = name
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) return "";

  if (words.length === 1) {
    const word = words[0].toUpperCase();
    return word.length <= 5 ? word : word.slice(0, 3);
  }

  const meaningfulWords = words.filter(word => !IGNORED_WORDS.has(word.toLowerCase()));
  const source = meaningfulWords.length > 0 ? meaningfulWords : words;
  return source.map(word => word[0]).join("").toUpperCase().slice(0, 5);
}
