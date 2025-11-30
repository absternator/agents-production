import type { Scorer } from 'autoevals'
import type { ChatCompletionMessage } from 'openai/src/resources/index.js'

export const ToolCallMatch: Scorer<any, {}> = async ({
  input,
  output,
  expected,
}: {
  input: any
  output: ChatCompletionMessage
  expected: ChatCompletionMessage
}) => {
  const score =
    output.role === 'assistant' &&
    Array.isArray(output.tool_calls) &&
    output.tool_calls.length === 1 &&
    Array.isArray(expected.tool_calls) &&
    output.tool_calls[0].function?.name ===
      expected.tool_calls[0].function?.name
      ? 1
      : 0

  return {
    name: 'ToolCallMatch',
    score,
  }
}
