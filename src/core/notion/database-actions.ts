import { Client } from '@notionhq/client';
import { logger } from '../logging.js';
import { userContextStore } from '../context/user-context.js';
import { buildRichText } from './rich-text-formatter.js';
import { NotionActionResult } from './actions.js';

/**
 * Database view types
 */
export type DatabaseViewType = 'table' | 'board' | 'list' | 'calendar' | 'gallery' | 'timeline';

/**
 * Property types for database columns
 */
export interface DatabaseProperty {
  name: string;
  type: 'title' | 'rich_text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url' | 'email' | 'phone_number' | 'files' | 'status';
  options?: string[]; // For select/multi_select/status
}

/**
 * CREATE_DATABASE: Create a new database with specified properties
 */
export async function createDatabase(
  notion: Client,
  userId: string,
  title: string,
  viewType: DatabaseViewType,
  properties: DatabaseProperty[],
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();
  const context = userContextStore.get(userId);
  const parentPageId = context.currentPageId || context.targetPageId;

  if (!parentPageId) {
    return {
      success: false,
      message: 'No parent page is currently open. Use /target-page or say "open page..."',
      duration: Date.now() - startTime,
    };
  }

  try {
    logger.info({ correlationId, userId, title, viewType, properties }, 'Creating database');

    // Build property schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propertiesSchema: Record<string, any> = {};
    
    // Ensure we have at least a title property
    let hasTitleProperty = false;
    
    for (const prop of properties) {
      if (prop.type === 'title') {
        hasTitleProperty = true;
        propertiesSchema[prop.name] = {
          title: {},
        };
      } else if (prop.type === 'select' && prop.options) {
        propertiesSchema[prop.name] = {
          select: {
            options: prop.options.map((opt) => ({ name: opt })),
          },
        };
      } else if (prop.type === 'multi_select' && prop.options) {
        propertiesSchema[prop.name] = {
          multi_select: {
            options: prop.options.map((opt) => ({ name: opt })),
          },
        };
      } else if (prop.type === 'status' && prop.options) {
        // Status property for Kanban boards
        propertiesSchema[prop.name] = {
          status: {
            options: prop.options.map((opt, index) => ({ 
              name: opt,
              color: ['gray', 'blue', 'green', 'yellow', 'red'][index % 5],
            })),
          },
        };
      } else {
        propertiesSchema[prop.name] = {
          [prop.type]: {},
        };
      }
    }

    // Add default title property if none exists
    if (!hasTitleProperty) {
      propertiesSchema['Name'] = {
        title: {},
      };
    }

    // Create the database
    const response = await notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: buildRichText(title, false),
      properties: propertiesSchema,
    });

    const databaseId = response.id;

    logger.info({ correlationId, databaseId, viewType }, 'Database created successfully');

    return {
      success: true,
      message: `✅ ${getViewTypeEmoji(viewType)} **${title}** created successfully!\n🆔 Database ID: ${databaseId}`,
      pageId: databaseId,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to create database');
    return {
      success: false,
      message: `Failed to create database: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * CREATE_KANBAN: Create a Kanban board with status columns
 */
export async function createKanban(
  notion: Client,
  userId: string,
  title: string,
  columns: string[],
  correlationId: string
): Promise<NotionActionResult> {
  const defaultColumns = columns.length > 0 ? columns : ['To Do', 'In Progress', 'Done'];
  
  const properties: DatabaseProperty[] = [
    { name: 'Task', type: 'title' },
    { name: 'Status', type: 'status', options: defaultColumns },
    { name: 'Assignee', type: 'select', options: [] },
    { name: 'Due Date', type: 'date' },
  ];

  return createDatabase(notion, userId, title, 'board', properties, correlationId);
}

/**
 * CREATE_TABLE: Create a simple table database
 */
export async function createTable(
  notion: Client,
  userId: string,
  title: string,
  columns: Array<{ name: string; type: DatabaseProperty['type'] }>,
  correlationId: string
): Promise<NotionActionResult> {
  const properties: DatabaseProperty[] = columns.map((col) => ({
    name: col.name,
    type: col.type,
  }));

  // Ensure first column is title
  if (properties.length > 0 && properties[0].type !== 'title') {
    properties[0].type = 'title';
  }

  return createDatabase(notion, userId, title, 'table', properties, correlationId);
}

/**
 * ADD_DATABASE_ENTRY: Add a new row/card to an existing database
 */
export async function addDatabaseEntry(
  notion: Client,
  userId: string,
  databaseId: string,
  properties: Record<string, any>,
  correlationId: string
): Promise<NotionActionResult> {
  const startTime = Date.now();

  try {
    logger.info({ correlationId, userId, databaseId, properties }, 'Adding database entry');

    // Build properties for the new page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageProperties: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === 'string') {
        // Simple text - could be title or rich_text
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        pageProperties[key] = {
          rich_text: buildRichText(value, false),
        } as any;
      } else if (typeof value === 'boolean') {
        pageProperties[key] = {
          checkbox: value,
        };
      } else if (typeof value === 'number') {
        pageProperties[key] = {
          number: value,
        };
      } else if (Array.isArray(value)) {
        // Multi-select
        pageProperties[key] = {
          multi_select: value.map((v) => ({ name: v })),
        };
      } else if (value && typeof value === 'object') {
        // Could be date, select, etc.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        pageProperties[key] = value;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const response = await notion.pages.create({
      parent: {
        type: 'database_id',
        database_id: databaseId,
      },
      properties: pageProperties as any,
    });

    return {
      success: true,
      message: `✅ Entry added to database`,
      pageId: response.id,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to add database entry');
    return {
      success: false,
      message: `Failed to add entry: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * QUERY_DATABASE: Query a database and return results
 */
export async function queryDatabase(
  notion: Client,
  databaseId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sorts?: any,
  correlationId?: string
): Promise<NotionActionResult> {
  const startTime = Date.now();

  try {
    logger.info({ correlationId, databaseId, filters, sorts }, 'Querying database');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: filters as any,
      sorts: sorts as any,
      page_size: 100,
    });

    return {
      success: true,
      message: `Found ${response.results.length} entries`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ correlationId, error }, 'Failed to query database');
    return {
      success: false,
      message: `Failed to query database: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Get emoji for view type
 */
function getViewTypeEmoji(viewType: DatabaseViewType): string {
  const emojis: Record<DatabaseViewType, string> = {
    table: '📊',
    board: '📋',
    list: '📝',
    calendar: '📅',
    gallery: '🖼️',
    timeline: '⏰',
  };
  return emojis[viewType] || '📊';
}

/**
 * Parse column definitions from text
 * Example: "Name (title), Status (select: todo,done), Priority (number)"
 */
export function parseColumnDefinitions(columnsText: string): Array<{ name: string; type: DatabaseProperty['type']; options?: string[] }> {
  const columns: Array<{ name: string; type: DatabaseProperty['type']; options?: string[] }> = [];
  
  const columnParts = columnsText.split(',').map((s) => s.trim());
  
  for (const part of columnParts) {
    // Match pattern: "Name (type: option1,option2)"
    const match = part.match(/^(.+?)\s*\((\w+)(?::(.+?))?\)$/);
    
    if (match) {
      const name = match[1].trim();
      const type = match[2].trim() as DatabaseProperty['type'];
      const optionsStr = match[3]?.trim();
      
      const column: { name: string; type: DatabaseProperty['type']; options?: string[] } = {
        name,
        type,
      };
      
      if (optionsStr) {
        column.options = optionsStr.split(',').map((s) => s.trim());
      }
      
      columns.push(column);
    } else {
      // Simple format: "Name" -> default to rich_text
      columns.push({
        name: part,
        type: 'rich_text',
      });
    }
  }
  
  return columns;
}
