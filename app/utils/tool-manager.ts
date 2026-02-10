import { BaseTool, CalculatorTool, SearchTool, TimeTool } from './tools'

export class ToolManager {
  private tools: Map<string, BaseTool> = new Map<string, BaseTool>()

  constructor() {
    this.register(SearchTool)
    this.register(CalculatorTool)
    this.register(TimeTool)
  }

  register(tool: any) {
    this.tools.set(tool.name, tool)
  }

  getTool(name: string) {
    return this.tools.get(name)
  }

  getAllTools() {
    return Array.from(this.tools.values())
  }

  async execute(name: string, args: any) {
    const tool = this.getTool(name)
    if (!tool) throw new Error(`工具 ${name} 不存在`)
    // return await tool._call(args)
    return await tool.func(args)
  }
}
