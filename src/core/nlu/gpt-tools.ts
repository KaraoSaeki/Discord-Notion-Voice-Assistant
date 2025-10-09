import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../logging.js';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Intent schema
export const IntentSchema = z.object({
  action: z.enum([
    'OPEN_PAGE',
    'CREATE_BLOCK',
    'UPDATE_BLOCK',
    'DELETE_BLOCK',
    'DELETE_PAGE',
    'GO_BACK',
    'CREATE_PAGE',
    'APPEND_TODO',
    'SUMMARIZE_PAGE',
    'GENERATE_CONTENT',
  ]),
  pageQuery: z.string().optional(),
  blockId: z.string().optional(),
  block: z
    .object({
      type: z.enum([
        'paragraph',
        'heading_1',
        'heading_2',
        'heading_3',
        'bulleted_list_item',
        'to_do',
        'callout',
        'code',
        'toggle',
      ]),
      text: z.string(),
    })
    .optional(),
  prompt: z.string().optional(), // For GENERATE_CONTENT
  position: z.string().optional(), // "start" | "end" | "after:blockId"
  options: z
    .object({
      language: z.string().optional(),
      emoji: z.string().optional(),
      dryRun: z.boolean().optional(),
    })
    .optional(),
});

export type Intent = z.infer<typeof IntentSchema>;

const SYSTEM_PROMPT = `Tu es un assistant vocal pour Notion. L'utilisateur te dicte des commandes pour manipuler ses pages Notion.

Tu dois analyser la transcription et retourner une intention structurée en JSON.

Actions disponibles:
- OPEN_PAGE: ouvrir une page (par nom ou ID)
- CREATE_BLOCK: créer un bloc avec du texte LITTÉRAL (l'utilisateur dicte exactement ce qu'il veut)
- UPDATE_BLOCK: mettre à jour un bloc existant
- DELETE_BLOCK: supprimer un bloc spécifique (nécessite blockId)
- DELETE_PAGE: supprimer une page entière (par nom avec pageQuery)
- GO_BACK: revenir à la page précédente
- CREATE_PAGE: créer une nouvelle page
- APPEND_TODO: ajouter une tâche à faire
- SUMMARIZE_PAGE: résumer le contenu de la page courante
- GENERATE_CONTENT: générer du contenu avec l'IA (l'utilisateur donne une instruction/prompt)

Types de blocs:
- paragraph: paragraphe normal
- heading_1, heading_2, heading_3: titres
- bulleted_list_item: liste à puces
- to_do: case à cocher
- callout: encadré d'information
- code: bloc de code
- toggle: bloc repliable

Exemples de commandes:

Texte LITTÉRAL (CREATE_BLOCK):
- "Ajoute un paragraphe avec le texte bonjour" → CREATE_BLOCK avec block.type=paragraph, block.text="bonjour"
- "Crée un titre niveau 1 Introduction" → CREATE_BLOCK avec block.type=heading_1, block.text="Introduction"
- "Écris exactement ceci : Rendez-vous demain" → CREATE_BLOCK avec block.text="Rendez-vous demain"

GÉNÉRATION de contenu (GENERATE_CONTENT):
- "Écris un paragraphe sur l'intelligence artificielle" → GENERATE_CONTENT avec prompt="écris un paragraphe sur l'intelligence artificielle", block.type=paragraph
- "Génère une introduction pour mon projet" → GENERATE_CONTENT avec prompt="génère une introduction pour mon projet"
- "Rédige un email de remerciement" → GENERATE_CONTENT avec prompt="rédige un email de remerciement"
- "Crée une liste de 5 idées pour..." → GENERATE_CONTENT avec prompt="crée une liste de 5 idées pour..."

Autres actions:
- "Ouvre la page projet alpha" → OPEN_PAGE avec pageQuery="projet alpha"
- "Ajoute une tâche appeler Jean" → APPEND_TODO avec block.text="appeler Jean"
- "Supprime la page test" → DELETE_PAGE avec pageQuery="test"
- "Reviens en arrière" → GO_BACK
- "Résume cette page" → SUMMARIZE_PAGE

RÈGLE IMPORTANTE:
Si l'utilisateur demande de "générer", "écrire", "rédiger", "créer" du contenu SANS donner le texte exact, utilise GENERATE_CONTENT.
Si l'utilisateur dicte le texte exact (« avec le texte... », « exactement ceci... »), utilise CREATE_BLOCK.

Sois précis et extrait toutes les informations pertinentes de la transcription.`;

const intentFunction: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'execute_notion_intent',
    description: 'Execute a Notion action based on user voice command',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'OPEN_PAGE',
            'CREATE_BLOCK',
            'UPDATE_BLOCK',
            'DELETE_BLOCK',
            'DELETE_PAGE',
            'GO_BACK',
            'CREATE_PAGE',
            'APPEND_TODO',
            'SUMMARIZE_PAGE',
            'GENERATE_CONTENT',
          ],
          description: 'The action to perform in Notion',
        },
        pageQuery: {
          type: 'string',
          description: 'Page name or ID to search/open/delete',
        },
        blockId: {
          type: 'string',
          description: 'Block ID for UPDATE_BLOCK or DELETE_BLOCK actions',
        },
        prompt: {
          type: 'string',
          description: 'Prompt/instruction for GENERATE_CONTENT action - what content to generate',
        },
        block: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'paragraph',
                'heading_1',
                'heading_2',
                'heading_3',
                'bulleted_list_item',
                'to_do',
                'callout',
                'code',
                'toggle',
              ],
              description: 'Block type',
            },
            text: {
              type: 'string',
              description: 'Block text content',
            },
          },
          required: ['type', 'text'],
        },
        position: {
          type: 'string',
          description: 'Position to insert block: "start", "end", or "after:blockId"',
        },
        options: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              description: 'Programming language for code blocks',
            },
            emoji: {
              type: 'string',
              description: 'Emoji for callout blocks',
            },
          },
        },
      },
      required: ['action'],
    },
  },
};

export interface NLUResult {
  intent: Intent;
  duration: number;
}

/**
 * Parse user transcription into structured intent using GPT function-calling
 */
export async function parseIntent(
  transcription: string,
  correlationId: string
): Promise<NLUResult> {
  const startTime = Date.now();

  try {
    logger.debug({ correlationId, transcription }, 'Parsing intent with GPT');

    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL_GPT,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcription },
      ],
      tools: [intentFunction],
      tool_choice: { type: 'function', function: { name: 'execute_notion_intent' } },
      temperature: 1,
    });

    const duration = Date.now() - startTime;

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'execute_notion_intent') {
      throw new Error('No valid tool call returned from GPT');
    }

    const rawIntent = JSON.parse(toolCall.function.arguments) as unknown;
    const intent = IntentSchema.parse(rawIntent);

    logger.info({ correlationId, intent, duration }, 'Intent parsed successfully');

    return { intent, duration };
  } catch (error) {
    logger.error({ correlationId, error, transcription }, 'Intent parsing failed');
    throw new Error(`Intent parsing failed: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}
