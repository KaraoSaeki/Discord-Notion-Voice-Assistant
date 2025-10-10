import { Client } from '@notionhq/client';
import { Intent } from '../../core/nlu/gpt-tools.js';
import {
  openPage,
  createBlock,
  // deleteBlock, // TODO: Implement when needed
  goBack,
  createPage,
  summarizePage,
  deletePage,
  generateContent,
  NotionActionResult,
} from '../../core/notion/actions.js';
import {
  createKanban,
  createTable,
  createDatabase,
  addDatabaseEntry,
  parseColumnDefinitions,
} from '../../core/notion/database-actions.js';
import { logger } from '../../core/logging.js';

/**
 * Execute a parsed intent on Notion
 */
export async function executeIntent(
  notion: Client,
  userId: string,
  intent: Intent,
  correlationId: string
): Promise<NotionActionResult> {
  const log = logger.child({ correlationId, userId, action: intent.action });

  log.info({ intent }, 'Executing intent');

  switch (intent.action) {
    case 'OPEN_PAGE':
      if (!intent.pageQuery) {
        return {
          success: false,
          message: 'Page query is required for OPEN_PAGE',
          duration: 0,
        };
      }
      return openPage(notion, userId, intent.pageQuery, correlationId);

    case 'CREATE_BLOCK':
    case 'APPEND_TODO':
      if (!intent.block) {
        return {
          success: false,
          message: 'Block data is required for CREATE_BLOCK',
          duration: 0,
        };
      }
      return createBlock(
        notion,
        userId,
        intent.block.type,
        intent.block.text,
        intent.options || {},
        correlationId
      );

    case 'UPDATE_BLOCK':
      // TODO: Implement block update
      return {
        success: false,
        message: 'UPDATE_BLOCK not yet implemented',
        duration: 0,
      };

    case 'DELETE_BLOCK':
      // TODO: Need blockId - could be enhanced with block search
      return {
        success: false,
        message: 'DELETE_BLOCK requires blockId',
        duration: 0,
      };

    case 'DELETE_PAGE':
      if (!intent.pageQuery) {
        return {
          success: false,
          message: 'Page name is required for DELETE_PAGE',
          duration: 0,
        };
      }
      return deletePage(notion, userId, intent.pageQuery, correlationId);

    case 'GO_BACK':
      return goBack(userId);

    case 'CREATE_PAGE':
      if (!intent.pageQuery) {
        return {
          success: false,
          message: 'Page title is required for CREATE_PAGE',
          duration: 0,
        };
      }
      return createPage(notion, userId, intent.pageQuery, correlationId);

    case 'SUMMARIZE_PAGE':
      return summarizePage(notion, userId, correlationId);

    case 'GENERATE_CONTENT':
      if (!intent.prompt) {
        return {
          success: false,
          message: 'Prompt is required for GENERATE_CONTENT',
          duration: 0,
        };
      }
      return generateContent(
        notion,
        userId,
        intent.prompt,
        intent.block?.type || 'paragraph',
        correlationId
      );

    case 'CREATE_KANBAN':
      if (!intent.databaseTitle) {
        return {
          success: false,
          message: 'Database title is required for CREATE_KANBAN',
          duration: 0,
        };
      }
      return createKanban(
        notion,
        userId,
        intent.databaseTitle,
        intent.columns || [],
        correlationId
      );

    case 'CREATE_TABLE': {
      if (!intent.databaseTitle) {
        return {
          success: false,
          message: 'Database title is required for CREATE_TABLE',
          duration: 0,
        };
      }
      // Parse columns from string array to column definitions
      const columns = intent.columns
        ? parseColumnDefinitions(intent.columns.join(', '))
        : [{ name: 'Name', type: 'title' as const }];
      return createTable(notion, userId, intent.databaseTitle, columns, correlationId);
    }

    case 'CREATE_DATABASE': {
      if (!intent.databaseTitle) {
        return {
          success: false,
          message: 'Database title is required for CREATE_DATABASE',
          duration: 0,
        };
      }
      // Create a generic database with basic properties
      const properties = [
        { name: 'Name', type: 'title' as const },
        { name: 'Status', type: 'select' as const, options: ['Not Started', 'In Progress', 'Complete'] },
        { name: 'Notes', type: 'rich_text' as const },
      ];
      return createDatabase(
        notion,
        userId,
        intent.databaseTitle,
        'table',
        properties,
        correlationId
      );
    }

    case 'ADD_DATABASE_ENTRY':
      if (!intent.databaseId) {
        return {
          success: false,
          message: 'Database ID is required for ADD_DATABASE_ENTRY',
          duration: 0,
        };
      }
      if (!intent.properties) {
        return {
          success: false,
          message: 'Properties are required for ADD_DATABASE_ENTRY',
          duration: 0,
        };
      }
      return addDatabaseEntry(
        notion,
        userId,
        intent.databaseId,
        intent.properties,
        correlationId
      );

    case 'SEARCH_PAGES':
      if (!intent.pageQuery) {
        return {
          success: false,
          message: 'Search query is required for SEARCH_PAGES',
          duration: 0,
        };
      }
      // Search pages and return results
      return searchPages(notion, intent.pageQuery, correlationId);

    default:
      return {
        success: false,
        message: `Unknown action: ${String(intent.action)}`,
        duration: 0,
      };
  }
}

/**
 * SEARCH_PAGES: Search for pages by query
 */
async function searchPages(
  notion: Client,
  query: string,
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();

  try {
    logger.info({ correlationId, query }, 'Searching pages');

    const response = await notion.search({
      query,
      filter: { property: 'object', value: 'page' },
      page_size: 10,
    });

    if (response.results.length === 0) {
      return {
        success: false,
        message: `No pages found for: "${query}"`,
        duration: Date.now() - startTime,
      };
    }

    const pageList = response.results
      .slice(0, 5)
      .map((page, index: number) => {
        if ('properties' in page && page.properties && 'title' in page.properties) {
          const titleProp = page.properties.title as { type: string; title?: Array<{ plain_text?: string }> };
          if (titleProp.type === 'title' && Array.isArray(titleProp.title)) {
            const title = titleProp.title[0]?.plain_text || 'Untitled';
            return `${index + 1}. ${title}`;
          }
        }
        return `${index + 1}. Untitled`;
      })
      .join('\n');

    return {
      success: true,
      message: `Found ${response.results.length} page(s):\n${pageList}`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to search pages');
    return {
      success: false,
      message: `Failed to search pages: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}
