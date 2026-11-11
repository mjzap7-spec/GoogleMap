import { emojiCategories } from './emojiCatalog';

const withoutPresentation = (value: string) => value.replace(/\uFE0F/g, '');
const knownEmoji = new Set(
  emojiCategories.flatMap(({ emojis }) => emojis.map(withoutPresentation)),
);

/** Only a single supported emoji is enlarged; normal messages and emoji strings stay intact. */
export function messageEmoji(text: string): string | undefined {
  if (text.length > 40) return;
  const value = text.trim();
  return knownEmoji.has(withoutPresentation(value)) ? value : undefined;
}

export function emojiMotion(emoji: string): 'pulse' | 'wiggle' | 'bounce' {
  if (/[❤💕💞💓💗💖💘💝💟🔥]/u.test(emoji)) return 'pulse';
  if (/[😂🤣👋👏🙌🎉🎊]/u.test(emoji)) return 'wiggle';
  return 'bounce';
}
