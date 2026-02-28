export function calculateReadingTime(content: string): number {
  // Average reading speed is about 200-250 words per minute
  // Using 225 as a middle ground
  const wordsPerMinute = 225;

  // Remove markdown syntax, HTML tags, and extra whitespace
  const plainText = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '') // Remove inline code
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[#*_\[\]()]/g, '') // Remove markdown syntax
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Count words
  const wordCount = plainText.length > 0 ? plainText.split(/\s+/).length : 0;

  // Calculate reading time in minutes
  const readingTime = Math.ceil(wordCount / wordsPerMinute);

  return readingTime;
}

export function formatReadingTime(minutes: number): string {
  if (minutes === 1) {
    return '1 min read';
  }
  return `${minutes} min read`;
}
