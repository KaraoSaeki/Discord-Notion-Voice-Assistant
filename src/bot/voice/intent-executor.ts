import { Client } from '@notionhq/client';
import { Intent } from '../../core/nlu/gpt-tools.js';
import {
  openPage,
  createBlock,
  // deleteBlock, // TODO: Implement when needed
  goBack,
  createPage,
  summarizePage,
  NotionActionResult,
} from '../../core/notion/actions.js';
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

    default:
      return {
        success: false,
        message: `Unknown action: ${intent.action}`,
        duration: 0,
      };
  }
}
