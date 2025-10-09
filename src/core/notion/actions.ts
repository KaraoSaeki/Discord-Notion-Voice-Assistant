import { Client } from '@notionhq/client';
import { logger } from '../logging.js';
import { userContextStore } from '../context/user-context.js';
import OpenAI from 'openai';
import { env } from '../../config/env.js';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export interface NotionActionResult {
  success: boolean;
  message: string;
  pageId?: string;
  blockId?: string;
  duration: number;
}

/**
 * Build rich text object for Notion API
 */
function buildRichText(text: string) {
  return [
    {
      type: 'text' as const,
      text: { content: text },
    },
  ];
}

/**
 * OPEN_PAGE: Search and open a page
 */
export async function openPage(
  notion: Client,
  userId: string,
  query: string,
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();

  try {
    logger.info({ correlationId, userId, query }, 'Opening page');

    // Try as UUID first
    if (query.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      try {
        const page = await notion.pages.retrieve({ page_id: query });
        const pageId = page.id;
        userContextStore.setCurrentPage(userId, pageId);
        return {
          success: true,
          message: `Page opened: ${pageId}`,
          pageId,
          duration: Date.now() - startTime,
        };
      } catch {
        // Fall through to search
      }
    }

    // Search by title
    const searchResults = await notion.search({
      query,
      filter: { property: 'object', value: 'page' },
      page_size: 5,
    });

    if (searchResults.results.length === 0) {
      return {
        success: false,
        message: `No page found for query: ${query}`,
        duration: Date.now() - startTime,
      };
    }

    const page = searchResults.results[0];
    if (!('id' in page)) {
      return {
        success: false,
        message: 'Invalid page result',
        duration: Date.now() - startTime,
      };
    }

    const pageId = page.id;
    userContextStore.setCurrentPage(userId, pageId);

    return {
      success: true,
      message: `Page opened: ${pageId}`,
      pageId,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to open page');
    return {
      success: false,
      message: `Failed to open page: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * CREATE_BLOCK: Append a block to current page
 */
export async function createBlock(
  notion: Client,
  userId: string,
  blockType: string,
  text: string,
  options: { language?: string; emoji?: string } = {},
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();
  const context = userContextStore.get(userId);
  const pageId = context.targetPageId || context.currentPageId;

  if (!pageId) {
    return {
      success: false,
      message: 'No page is currently open. Use /target-page or say "open page..."',
      duration: Date.now() - startTime,
    };
  }

  try {
    logger.info({ correlationId, userId, pageId, blockType, text }, 'Creating block');

    let blockData: Record<string, unknown>;

    switch (blockType) {
      case 'paragraph':
        blockData = {
          type: 'paragraph',
          paragraph: { rich_text: buildRichText(text) },
        };
        break;

      case 'heading_1':
        blockData = {
          type: 'heading_1',
          heading_1: { rich_text: buildRichText(text) },
        };
        break;

      case 'heading_2':
        blockData = {
          type: 'heading_2',
          heading_2: { rich_text: buildRichText(text) },
        };
        break;

      case 'heading_3':
        blockData = {
          type: 'heading_3',
          heading_3: { rich_text: buildRichText(text) },
        };
        break;

      case 'bulleted_list_item':
        blockData = {
          type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: buildRichText(text) },
        };
        break;

      case 'to_do':
        blockData = {
          type: 'to_do',
          to_do: { rich_text: buildRichText(text), checked: false },
        };
        break;

      case 'callout':
        blockData = {
          type: 'callout',
          callout: {
            rich_text: buildRichText(text),
            icon: { type: 'emoji', emoji: options.emoji || '💡' },
          },
        };
        break;

      case 'code':
        blockData = {
          type: 'code',
          code: {
            rich_text: buildRichText(text),
            language: options.language || 'plain text',
          },
        };
        break;

      case 'toggle':
        blockData = {
          type: 'toggle',
          toggle: { rich_text: buildRichText(text) },
        };
        break;

      default:
        return {
          success: false,
          message: `Unsupported block type: ${blockType}`,
          duration: Date.now() - startTime,
        };
    }

    const response = await notion.blocks.children.append({
      block_id: pageId,
      // @ts-expect-error - Notion API types are complex
      children: [blockData],
    });

    return {
      success: true,
      message: `Block created: ${blockType}`,
      blockId: response.results[0]?.id,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to create block');
    return {
      success: false,
      message: `Failed to create block: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * DELETE_BLOCK: Delete a block (archive it)
 */
export async function deleteBlock(
  notion: Client,
  blockId: string,
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();

  try {
    logger.info({ correlationId, blockId }, 'Deleting block');

    await notion.blocks.update({
      block_id: blockId,
      archived: true,
    });

    return {
      success: true,
      message: 'Block deleted',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to delete block');
    return {
      success: false,
      message: `Failed to delete block: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * GO_BACK: Navigate to previous page
 */
export async function goBack(userId: string): Promise<NotionActionResult> {
  const startTime = Date.now();
  const prevPageId = userContextStore.goBack(userId);

  if (!prevPageId) {
    return {
      success: false,
      message: 'No previous page in history',
      duration: Date.now() - startTime,
    };
  }

  return {
    success: true,
    message: `Navigated back to page: ${prevPageId}`,
    pageId: prevPageId,
    duration: Date.now() - startTime,
  };
}

/**
 * CREATE_PAGE: Create a new page
 */
export async function createPage(
  notion: Client,
  userId: string,
  title: string,
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();
  const context = userContextStore.get(userId);
  const parentPageId = context.currentPageId;

  if (!parentPageId) {
    return {
      success: false,
      message: 'No parent page is currently open',
      duration: Date.now() - startTime,
    };
  }

  try {
    logger.info({ correlationId, userId, title, parentPageId }, 'Creating page');

    const response = await notion.pages.create({
      parent: { page_id: parentPageId },
      properties: {
        title: {
          title: buildRichText(title),
        },
      },
    });

    const newPageId = response.id;
    userContextStore.setCurrentPage(userId, newPageId);

    return {
      success: true,
      message: `Page created: ${title}`,
      pageId: newPageId,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to create page');
    return {
      success: false,
      message: `Failed to create page: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * SUMMARIZE_PAGE: Read page blocks and generate summary
 */
export async function summarizePage(
  notion: Client,
  userId: string,
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();
  const context = userContextStore.get(userId);
  const pageId = context.targetPageId || context.currentPageId;

  if (!pageId) {
    return {
      success: false,
      message: 'No page is currently open',
      duration: Date.now() - startTime,
    };
  }

  try {
    logger.info({ correlationId, userId, pageId }, 'Summarizing page');

    // Fetch page blocks
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });

    // Extract text content
    const textContent: string[] = [];
    for (const block of blocks.results) {
      if ('type' in block) {
        const blockType = block.type;
        // @ts-expect-error - Dynamic block type access
        const richText = block[blockType]?.rich_text;
        if (Array.isArray(richText)) {
          const text = richText.map((rt: { plain_text: string }) => rt.plain_text).join('');
          if (text) textContent.push(text);
        }
      }
    }

    if (textContent.length === 0) {
      return {
        success: false,
        message: 'Page has no content to summarize',
        duration: Date.now() - startTime,
      };
    }

    // Generate summary with GPT
    const summary = await openai.chat.completions.create({
      model: env.OPENAI_MODEL_GPT,
      messages: [
        {
          role: 'system',
          content: 'Résume le contenu suivant de manière concise (2-3 phrases maximum).',
        },
        { role: 'user', content: textContent.join('\n\n') },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    const summaryText = summary.choices[0]?.message?.content || 'Unable to generate summary';

    // Append summary to page
    await notion.blocks.children.append({
      block_id: pageId,
      children: [
        {
          type: 'heading_2',
          heading_2: { rich_text: buildRichText('📝 Summary') },
        },
        {
          type: 'paragraph',
          paragraph: { rich_text: buildRichText(summaryText) },
        },
      ],
    });

    return {
      success: true,
      message: `Summary added to page`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to summarize page');
    return {
      success: false,
      message: `Failed to summarize page: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * GENERATE_CONTENT: Generate content using GPT and add it to the page
 */
export async function generateContent(
  notion: Client,
  userId: string,
  prompt: string,
  blockType: string = 'paragraph',
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();
  const context = userContextStore.get(userId);
  const pageId = context.currentPageId;

  if (!pageId) {
    return {
      success: false,
      message: 'No page is currently open',
      duration: Date.now() - startTime,
    };
  }

  try {
    logger.info({ correlationId, userId, prompt, blockType }, 'Generating content with GPT');

    // Use GPT to generate the content
    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL_GPT,
      messages: [
        {
          role: 'system',
          content: 'Tu es un assistant qui génère du contenu pour Notion. Génère du contenu de qualité, bien structuré et pertinent. Réponds uniquement avec le contenu demandé, sans introduction ni conclusion supplémentaire.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000, // Limit to avoid very long content
    });

    const generatedText = completion.choices[0]?.message?.content?.trim();

    if (!generatedText) {
      return {
        success: false,
        message: 'Failed to generate content',
        duration: Date.now() - startTime,
      };
    }

    logger.info({ correlationId, generatedLength: generatedText.length }, 'Content generated');

    // Notion has a 2000 character limit per block
    // If content is too long, split it into multiple blocks
    const MAX_BLOCK_LENGTH = 1900; // Use 1900 to be safe
    const blocks = [];

    if (generatedText.length <= MAX_BLOCK_LENGTH) {
      // Single block
      blocks.push({
        type: blockType,
        [blockType]: { rich_text: buildRichText(generatedText) },
      });
      logger.info({ correlationId, blockCount: 1 }, 'Single block created');
    } else {
      // Split into multiple blocks
      logger.info({ correlationId, totalLength: generatedText.length, maxLength: MAX_BLOCK_LENGTH }, 'Splitting content into multiple blocks');
      
      const chunks = [];
      for (let i = 0; i < generatedText.length; i += MAX_BLOCK_LENGTH) {
        chunks.push(generatedText.slice(i, i + MAX_BLOCK_LENGTH));
      }

      logger.info({ correlationId, chunkCount: chunks.length, chunkLengths: chunks.map(c => c.length) }, 'Content split into chunks');

      for (const chunk of chunks) {
        blocks.push({
          type: blockType,
          [blockType]: { rich_text: buildRichText(chunk) },
        });
      }
    }

    await notion.blocks.children.append({
      block_id: pageId,
      children: blocks as any,
    });

    return {
      success: true,
      message: `✨ Content generated and added (${generatedText.length} characters, ${blocks.length} block${blocks.length > 1 ? 's' : ''})`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to generate content');
    return {
      success: false,
      message: `Failed to generate content: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * DELETE_PAGE: Delete a page by searching for it first
 */
export async function deletePage(
  notion: Client,
  userId: string,
  pageQuery: string,
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();

  try {
    logger.info({ correlationId, userId, pageQuery }, 'Searching page to delete');

    // First, search for the page
    const searchResponse = await notion.search({
      query: pageQuery,
      filter: { property: 'object', value: 'page' },
      page_size: 5,
    });

    if (searchResponse.results.length === 0) {
      return {
        success: false,
        message: `No page found with name "${pageQuery}"`,
        duration: Date.now() - startTime,
      };
    }

    // Get the first matching page
    const page = searchResponse.results[0];
    if (!('id' in page)) {
      return {
        success: false,
        message: 'Invalid page object returned',
        duration: Date.now() - startTime,
      };
    }

    const pageId = page.id;
    
    // Extract page title safely
    let pageTitle = pageQuery;
    if ('properties' in page && 'title' in page.properties) {
      const titleProp = page.properties.title;
      if (titleProp.type === 'title' && Array.isArray(titleProp.title) && titleProp.title.length > 0) {
        pageTitle = titleProp.title[0]?.plain_text || pageQuery;
      }
    }

    logger.info({ correlationId, userId, pageId, pageTitle }, 'Deleting page');

    // Archive (soft delete) the page
    await notion.pages.update({
      page_id: pageId,
      archived: true,
    });

    return {
      success: true,
      message: `Page "${pageTitle}" deleted successfully`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to delete page');
    return {
      success: false,
      message: `Failed to delete page: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}
