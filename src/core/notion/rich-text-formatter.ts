import { logger } from '../logging.js';

/**
 * Notion color types
 */
type NotionColor =
  | 'default'
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'
  | 'gray_background'
  | 'brown_background'
  | 'orange_background'
  | 'yellow_background'
  | 'green_background'
  | 'blue_background'
  | 'purple_background'
  | 'pink_background'
  | 'red_background';

/**
 * Notion Rich Text Object (compatible with RichTextItemRequest)
 */
export interface NotionRichText {
  type: 'text';
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: NotionColor;
  };
}

/**
 * Parse Markdown-style text into Notion rich text format
 * Supports: **bold**, *italic*, ***bold+italic***, ~~strikethrough~~, `code`, [links](url)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseMarkdownToRichText(text: string): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const richTextArray: any[] = [];
  
  // Regex patterns for different markdown elements
  // Order matters - more specific patterns first
  const patterns = [
    // Bold + Italic: ***text***
    {
      regex: /\*\*\*(.+?)\*\*\*/g,
      annotations: { bold: true, italic: true },
    },
    // Bold: **text**
    {
      regex: /\*\*(.+?)\*\*/g,
      annotations: { bold: true },
    },
    // Italic: *text* or _text_
    {
      regex: /(\*|_)(.+?)\1/g,
      annotations: { italic: true },
    },
    // Strikethrough: ~~text~~
    {
      regex: /~~(.+?)~~/g,
      annotations: { strikethrough: true },
    },
    // Code: `text`
    {
      regex: /`(.+?)`/g,
      annotations: { code: true },
    },
    // Links: [text](url)
    {
      regex: /\[(.+?)\]\((.+?)\)/g,
      isLink: true,
    },
  ];

  // Split text into segments, identifying formatted portions
  let segments: Array<{
    text: string;
    annotations?: NotionRichText['annotations'];
    link?: string;
  }> = [{ text }];

  // Process each pattern
  for (const pattern of patterns) {
    const newSegments: typeof segments = [];

    for (const segment of segments) {
      // Skip if already has formatting
      if (segment.annotations || segment.link) {
        newSegments.push(segment);
        continue;
      }

      let lastIndex = 0;
      const matches = Array.from(segment.text.matchAll(pattern.regex));

      if (matches.length === 0) {
        newSegments.push(segment);
        continue;
      }

      for (const match of matches) {
        const matchIndex = match.index!;
        
        // Add text before match
        if (matchIndex > lastIndex) {
          newSegments.push({
            text: segment.text.slice(lastIndex, matchIndex),
          });
        }

        // Add formatted text
        if (pattern.isLink) {
          // Link: [text](url)
          newSegments.push({
            text: match[1],
            link: match[2],
          });
        } else {
          // Other formatting
          const captureIndex = pattern.regex.source.includes('\\1') ? 2 : 1;
          newSegments.push({
            text: match[captureIndex],
            annotations: pattern.annotations,
          });
        }

        lastIndex = matchIndex + match[0].length;
      }

      // Add remaining text
      if (lastIndex < segment.text.length) {
        newSegments.push({
          text: segment.text.slice(lastIndex),
        });
      }
    }

    segments = newSegments;
  }

  // Convert segments to Notion rich text objects
  for (const segment of segments) {
    if (segment.text) {
      const richText: NotionRichText = {
        type: 'text',
        text: {
          content: segment.text,
          link: segment.link ? { url: segment.link } : undefined,
        },
      };
      
      if (segment.annotations) {
        richText.annotations = segment.annotations;
      }
      
      richTextArray.push(richText);
    }
  }

  // If no formatting was found, return simple text
  if (richTextArray.length === 0) {
    richTextArray.push({
      type: 'text',
      text: { content: text },
    });
  }

  logger.debug({ input: text, output: richTextArray }, 'Parsed markdown to rich text');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return richTextArray as any[];
}

/**
 * Build simple rich text (no formatting) - for backward compatibility
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSimpleRichText(text: string): any[] {
  return [
    {
      type: 'text',
      text: { content: text },
    },
  ];
}

/**
 * Build rich text with markdown parsing enabled
 * Returns type compatible with Notion API (RichTextItemRequest[])
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRichText(text: string, parseMarkdown = true): any[] {
  if (parseMarkdown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parseMarkdownToRichText(text) as any[];
  }
  return buildSimpleRichText(text);
}

/**
 * Split long text into multiple rich text blocks (Notion limit: 2000 chars per block)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function splitIntoBlocks(
  text: string,
  blockType: string,
  maxLength = 1900
): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];
  
  if (text.length <= maxLength) {
    blocks.push({
      type: blockType,
      [blockType]: { rich_text: buildRichText(text) },
    });
  } else {
    // Split by paragraphs first to avoid breaking in the middle of sentences
    const paragraphs = text.split('\n\n');
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + para).length <= maxLength) {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      } else {
        if (currentChunk) {
          blocks.push({
            type: blockType,
            [blockType]: { rich_text: buildRichText(currentChunk) },
          });
        }
        currentChunk = para;
      }
    }

    if (currentChunk) {
      blocks.push({
        type: blockType,
        [blockType]: { rich_text: buildRichText(currentChunk) },
      });
    }
  }

  return blocks;
}
