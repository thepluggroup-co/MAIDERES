import { anthropic, CLAUDE_MODEL } from './client'

const SYSTEM_PROMPT = `Tu es l'assistant intelligent de MAIDERES, une marketplace d'intermédiation
de services multi-prestataires basée à Douala, Cameroun.
Tu aides les opérateurs avec le traitement des demandes, le matching prestataire/client et les analyses.
Réponds toujours en français. Sois concis, pratique et orienté action.
La devise utilisée est le FCFA (XAF).`

export async function askMaideresAI(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<string> {
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text
}
