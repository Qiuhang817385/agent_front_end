export function parseReActResponse(content: string) {
  const lines = content.split('\n')
  const result: any = {}

  for (const line of lines) {
    if (line.startsWith('思考：')) {
      result.thought = line.slice(3).trim()
    } else if (line.startsWith('行动：')) {
      result.action = line.slice(3).trim()
    } else if (line.startsWith('行动输入：')) {
      try {
        result.actionInput = JSON.parse(line.slice(5).trim())
      } catch {
        result.actionInput = line.slice(5).trim()
      }
    } else if (line.startsWith('观察：')) {
      result.observation = line.slice(3).trim()
    } else if (line.startsWith('最终答案：')) {
      result.answer = line.slice(5).trim()
    }
  }

  return result
}
