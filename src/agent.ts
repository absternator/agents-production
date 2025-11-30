import { addMessages, getMessages, saveToolResponse } from './memory'
import { runApprovalCheck, runLLM } from './llm'
import { showLoader, logMessage } from './ui'
import { runTool } from './toolRunner'
import type { AIMessage } from '../types'
import { movieSearchToolDefinition } from './tools/movieSearch'

const handleMovieFindApprovalFlow = async (
  history: AIMessage[],
  userMessage: string
) => {
  const lastMessage = history[history.length - 1]
  const toolCall = lastMessage?.tool_calls?.[0]

  if (!toolCall || toolCall.function.name !== movieSearchToolDefinition.name) {
    return false
  }

  const loader = showLoader('Checking for movie search approval...')
  const approved = await runApprovalCheck(userMessage)

  if (approved) {
    loader.update('User approved movie search. Continuing...')
    const toolResponse = await runTool(toolCall, userMessage)

    loader.update('Saving movie search results...')
    await saveToolResponse(toolCall.id, toolResponse)
  } else {
    loader.update('User did not approve movie search. Saving refusal...')
    await saveToolResponse(
      toolCall.id,
      'User did not approve the movie search tool call.'
    )
  }

  loader.stop()

  return true
}

export const runAgent = async ({
  userMessage,
  tools,
}: {
  userMessage: string
  tools: any[]
}) => {
  const history = await getMessages()
  const isApproval = await handleMovieFindApprovalFlow(history, userMessage)

  // If this was not an approval flow, add the user message to history
  if (!isApproval) {
    await addMessages([{ role: 'user', content: userMessage }])
  }

  const loader = showLoader('🤔')

  while (true) {
    const history = await getMessages()
    const response = await runLLM({ messages: history, tools })
    await addMessages([response])

    if (response.content) {
      loader.stop()
      logMessage(response)
      return getMessages()
    }

    if (response.tool_calls) {
      const toolCall = response.tool_calls[0]
      logMessage(response)
      loader.update(`executing: ${toolCall.function.name}`)

      if (toolCall.function.name === movieSearchToolDefinition.name) {
        loader.update('Waiting for user approval for movie search...')
        loader.stop()
        return getMessages()
      }

      const toolResponse = await runTool(toolCall, userMessage)
      await saveToolResponse(toolCall.id, toolResponse)
      loader.update(`done: ${toolCall.function.name}`)
    }
  }
}
