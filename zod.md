# Zod 库在 MCP 开发中的全面指南

## 概述

Zod 是一个 TypeScript-first 的模式声明和验证库，在现代 MCP（Model Context Protocol）开发中被广泛使用。本文档将详细介绍 Zod 的作用、优势以及在 MCP 开发中的实际应用。

## 为什么选择 Zod？

### 1. 类型安全与运行时验证的双重保障

```typescript
// 传统TypeScript的局限性
interface User {
  id: number
  name: string
  email: string
  age?: number
}

// 问题：TypeScript只在编译时检查类型，运行时无法验证API返回的数据
const user: User = await fetchUser() // 如果API返回的数据不符合接口，TypeScript无法检测

// Zod解决方案
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
})

type User = z.infer<typeof UserSchema> // 自动生成TypeScript类型

// 运行时验证
const data = UserSchema.parse(apiResponse) // 验证数据并抛出错误
const safeData = UserSchema.safeParse(apiResponse) // 安全验证返回结果对象
```

### 2. 在 civitai-mcp-server 中的实际应用

查看`civitai-mcp-server/src/types.ts`文件，可以看到 Zod 的完整应用：

```typescript
import { z } from 'zod'

// 定义枚举类型
export const ModelType = z.enum([
  'Checkpoint',
  'TextualInversion',
  'Hypernetwork',
  'AestheticGradient',
  'LORA',
  'Controlnet',
  'Poses',
])

// 定义复杂的数据结构
export const ModelSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  type: ModelType,
  nsfw: z.boolean(),
  tags: z.array(z.string()),
  mode: ModelMode,
  creator: CreatorSchema,
  stats: StatsSchema.optional(),
  modelVersions: z.array(ModelVersionSchema),
  poi: z.boolean().optional(),
})

// 自动生成TypeScript类型
export type Model = z.infer<typeof ModelSchema>
```

## Zod 的核心功能

### 1. 基本类型验证

```typescript
// 字符串验证
z.string().min(1).max(100) // 长度限制
z.string().email() // 邮箱格式
z.string().url() // URL格式
z.string().uuid() // UUID格式
z.string().regex(/^[A-Z][a-z]+$/) // 正则表达式

// 数字验证
z.number().int() // 整数
z.number().min(0).max(100) // 范围限制
z.number().positive() // 正数
z.number().negative() // 负数

// 数组验证
z.array(z.string()) // 字符串数组
z.array(z.number()).min(1).max(10) // 带长度限制的数组

// 对象验证
z.object({
  name: z.string(),
  age: z.number().optional(),
})
```

### 2. 高级特性

```typescript
// 联合类型
z.union([z.string(), z.number()]) // 字符串或数字
z.discriminatedUnion('type', [
  // 鉴别联合类型
  z.object({ type: z.literal('admin'), permissions: z.array(z.string()) }),
  z.object({ type: z.literal('user'), email: z.string().email() }),
])

// 字面量类型
z.literal('admin') // 只能是'admin'
z.literal(42) // 只能是42
z.literal(true) // 只能是true

// 可选和可为空
z.string().optional() // 可选字段
z.string().nullable() // 可为null
z.string().nullish() // 可为null或undefined

// 默认值
z.string().default('unknown') // 默认值
z.number().default(0)
```

### 3. 转换和预处理

```typescript
// 类型转换
z.string().transform((val) => val.length) // 字符串转长度
z.string().transform((val) => new Date(val)) // 字符串转日期

// 预处理
z.preprocess(
  (val) => String(val), // 预处理：转换为字符串
  z.string() // 然后验证为字符串
)

// 管道操作
z.string()
  .min(1)
  .transform((val) => val.toUpperCase())
  .pipe(z.string().max(10))
```

## MCP 开发中的 Zod 最佳实践

### 1. API 响应验证

```typescript
// 定义API响应schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
})

// 在MCP工具中使用
async function handleToolRequest(input: any) {
  // 验证输入
  const validatedInput = ToolInputSchema.parse(input)

  // 调用API
  const response = await fetch(apiUrl)
  const data = await response.json()

  // 验证API响应
  const validatedResponse = ApiResponseSchema.parse(data)

  // 返回验证后的数据
  return validatedResponse
}
```

### 2. 处理 API 不一致性

在`civitai-mcp-server`中，我们看到如何处理 API 的不一致性：

```typescript
// API有时返回字符串，有时返回数字
export const NSFWLevel = z.enum(['None', 'Soft', 'Mature', 'X'])
export const nsfwLevel = z.union([NSFWLevel, z.number()]).optional()

// 处理可选字段
export const ModelFileSchema = z.object({
  sizeKb: z.number().optional(), // 可选字段
  pickleScanResult: z.string().optional(), // 可选字段
  metadata: FileMetadataSchema.optional(), // 嵌套可选
})
```

### 3. 错误处理

```typescript
// 安全解析
const result = UserSchema.safeParse(data)
if (result.success) {
  const user = result.data // 类型安全的用户数据
} else {
  console.error('验证失败:', result.error.errors)
  // 错误格式:
  // [
  //   {
  //     "code": "invalid_type",
  //     "expected": "string",
  //     "received": "number",
  //     "path": ["name"],
  //     "message": "Expected string, received number"
  //   }
  // ]
}

// 自定义错误消息
const UserSchema = z.object({
  name: z
    .string({
      required_error: '姓名是必填项',
      invalid_type_error: '姓名必须是字符串',
    })
    .min(1, '姓名不能为空'),
  age: z
    .number({
      invalid_type_error: '年龄必须是数字',
    })
    .min(0, '年龄不能小于0')
    .max(150, '年龄不能大于150'),
})
```

## 与其他验证库的对比

| 特性                | Zod        | Joi    | Yup      | class-validator |
| ------------------- | ---------- | ------ | -------- | --------------- |
| **TypeScript 支持** | ⭐⭐⭐⭐⭐ | ⭐⭐   | ⭐⭐⭐   | ⭐⭐⭐⭐        |
| **运行时性能**      | ⭐⭐⭐⭐   | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐          |
| **API 简洁性**      | ⭐⭐⭐⭐   | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐            |
| **链式调用**        | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐              |
| **包大小**          | 60KB       | 200KB  | 45KB     | 250KB           |
| **零依赖**          | ✅         | ❌     | ❌       | ❌              |
| **浏览器支持**      | ✅         | ❌     | ✅       | ✅              |

## 在 MCP 开发中的具体应用场景

### 1. 工具输入验证

```typescript
// MCP工具输入schema
const SearchModelsToolSchema = z.object({
  query: z.string().min(1).max(100).describe('搜索查询词'),
  limit: z.number().min(1).max(100).default(20).describe('返回结果数量'),
  types: z.array(ModelType).optional().describe('模型类型过滤'),
  sort: SortOrder.default('Most Downloaded').describe('排序方式'),
  period: TimePeriod.default('Week').describe('时间范围'),
  nsfw: z.boolean().default(false).describe('是否包含NSFW内容'),
})

// 在MCP服务器中使用
server.setRequestHandler(async (request) => {
  // 验证工具输入
  const validatedInput = SearchModelsToolSchema.parse(request.params)

  // 执行业务逻辑
  const results = await civitaiClient.searchModels(validatedInput)

  // 返回验证后的结果
  return ModelsResponseSchema.parse(results)
})
```

### 2. 资源响应标准化

```typescript
// MCP资源响应schema
const ResourceResponseSchema = z.object({
  uri: z.string().describe('资源URI'),
  mimeType: z.string().describe('MIME类型'),
  content: z.string().describe('资源内容'),
  metadata: z.record(z.any()).optional().describe('元数据'),
})

// 确保所有资源返回一致格式
async function getDocumentationResource(uri: string) {
  const content = await fetchDocumentation(uri)

  return ResourceResponseSchema.parse({
    uri,
    mimeType: 'text/markdown',
    content,
    metadata: { lastUpdated: new Date().toISOString() },
  })
}
```

### 3. 配置验证

```typescript
// MCP服务器配置schema
const ServerConfigSchema = z.object({
  name: z.string().min(1).describe('服务器名称'),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('版本号'),
  description: z.string().optional().describe('描述'),
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        inputSchema: z.any(),
        handler: z.function(),
      })
    )
    .min(1)
    .describe('工具列表'),
  resources: z
    .array(
      z.object({
        uri: z.string().min(1),
        name: z.string().min(1),
      })
    )
    .optional()
    .describe('资源列表'),
})

// 验证配置文件
const config = ServerConfigSchema.parse(configFile)
```

## 实战示例：构建 MCP 工具

### 示例 1：天气查询工具

```typescript
import { z } from 'zod'

// 定义工具输入schema
const WeatherToolSchema = z.object({
  city: z.string().min(1).describe('城市名称'),
  country: z
    .string()
    .length(2)
    .optional()
    .describe('国家代码（ISO 3166-1 alpha-2）'),
  units: z.enum(['metric', 'imperial']).default('metric').describe('单位制'),
  forecastDays: z.number().min(1).max(7).default(3).describe('预报天数'),
})

// 定义API响应schema
const WeatherResponseSchema = z.object({
  location: z.object({
    name: z.string(),
    country: z.string(),
    lat: z.number(),
    lon: z.number(),
  }),
  current: z.object({
    temp: z.number(),
    feels_like: z.number(),
    humidity: z.number(),
    pressure: z.number(),
    weather: z.array(
      z.object({
        main: z.string(),
        description: z.string(),
        icon: z.string(),
      })
    ),
  }),
  forecast: z.array(
    z.object({
      date: z.string().datetime(),
      temp_min: z.number(),
      temp_max: z.number(),
      precipitation: z.number(),
    })
  ),
})

// 工具实现
async function getWeather(input: unknown) {
  // 1. 验证输入
  const validatedInput = WeatherToolSchema.parse(input)

  // 2. 调用外部API
  const apiUrl = buildWeatherApiUrl(validatedInput)
  const response = await fetch(apiUrl)
  const data = await response.json()

  // 3. 验证API响应
  const validatedData = WeatherResponseSchema.parse(data)

  // 4. 返回标准化结果
  return {
    location: validatedData.location,
    current: validatedData.current,
    forecast: validatedData.forecast,
  }
}
```

### 示例 2：文件操作工具

```typescript
import { z } from 'zod'

// 文件操作工具schema
const FileOperationsSchema = z.discriminatedUnion('operation', [
  // 读取文件
  z.object({
    operation: z.literal('read'),
    path: z.string().min(1).describe('文件路径'),
    encoding: z.enum(['utf8', 'base64', 'binary']).default('utf8'),
  }),
  // 写入文件
  z.object({
    operation: z.literal('write'),
    path: z.string().min(1).describe('文件路径'),
    content: z.string().describe('文件内容'),
    encoding: z.enum(['utf8', 'base64']).default('utf8'),
    append: z.boolean().default(false),
  }),
  // 列出目录
  z.object({
    operation: z.literal('list'),
    path: z.string().min(1).describe('目录路径'),
    recursive: z.boolean().default(false),
  }),
])

// 响应schema
const FileResponseSchema = z.object({
  success: z.boolean(),
  operation: z.string(),
  path: z.string(),
  result: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
})

async function handleFileOperation(input: unknown) {
  const operation = FileOperationsSchema.parse(input)

  try {
    let result
    switch (operation.operation) {
      case 'read':
        result = await fs.readFile(operation.path, operation.encoding)
        break
      case 'write':
        if (operation.append) {
          await fs.appendFile(
            operation.path,
            operation.content,
            operation.encoding
          )
        } else {
          await fs.writeFile(
            operation.path,
            operation.content,
            operation.encoding
          )
        }
        result = { written: true }
        break
      case 'list':
        const files = await fs.readdir(operation.path)
        result = { files, count: files.length }
        break
    }

    return FileResponseSchema.parse({
      success: true,
      operation: operation.operation,
      path: operation.path,
      result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return FileResponseSchema.parse({
      success: false,
      operation: operation.operation,
      path: operation.path,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}
```

## 性能优化技巧

### 1. Schema 复用

```typescript
// 基础schema
const BaseEntitySchema = z.object({
  id: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
})

// 复用基础schema
const UserSchema = BaseEntitySchema.extend({
  name: z.string(),
  email: z.string().email(),
})

const ProductSchema = BaseEntitySchema.extend({
  name: z.string(),
  price: z.number().positive(),
  category: z.string(),
})
```

### 2. 懒加载验证

```typescript
// 对于复杂的嵌套schema，使用懒加载
const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    value: z.string(),
    children: z.array(TreeNodeSchema).optional(),
  })
)
```

### 3. 选择性验证

```typescript
// 只验证需要的字段
const PartialUserSchema = UserSchema.pick({ name: true, email: true })
const UpdateUserSchema = UserSchema.partial() // 所有字段可选
```

## 常见问题与解决方案

### 1. 循环依赖问题

```typescript
// 错误：循环依赖
const UserSchema = z.object({
  name: z.string(),
  friends: z.array(UserSchema), // 错误：UserSchema还未定义
})

// 解决方案：使用z.lazy()
const UserSchema: z.ZodType<User> = z.lazy(() =>
  z.object({
    name: z.string(),
    friends: z.array(UserSchema),
  })
)
```

### 2. 处理未知字段

```typescript
// 默认情况下，Zod会忽略未知字段
const StrictSchema = z
  .object({
    name: z.string(),
  })
  .strict() // 遇到未知字段会报错

const PassthroughSchema = z
  .object({
    name: z.string(),
  })
  .passthrough() // 保留未知字段
```

### 3. 自定义验证逻辑

```typescript
const PasswordSchema = z
  .string()
  .min(8, '密码至少8位')
  .max(100, '密码最多100位')
  .refine((val) => /[A-Z]/.test(val), '密码必须包含至少一个大写字母')
  .refine((val) => /[0-9]/.test(val), '密码必须包含至少一个数字')
  .refine((val) => /[!@#$%^&*]/.test(val), '密码必须包含至少一个特殊字符')
```

## 总结

Zod 在 MCP 开发中扮演着至关重要的角色：

1. **类型安全**：提供编译时和运行时的双重类型保障
2. **开发效率**：一份 schema 定义，自动生成 TypeScript 类型，减少重复代码
3. **可靠性**：确保外部 API 数据符合预期格式，防止运行时错误
4. **可维护性**：清晰的 schema 定义，便于团队协作和代码维护
5. **灵活性**：丰富的验证功能，满足各种复杂场景需求

对于 MCP 开发这种需要处理不可信外部数据、要求高可靠性的场景，Zod 是一个不可或缺的工具。通过合理使用 Zod，可以显著提高代码质量、减少 bug，并提升开发效率。

## 进一步学习资源

1. **官方文档**: https://zod.dev/
2. **TypeScript 集成指南**: https://zod.dev/?id=typescript-integration
3. **MCP 官方示例**: https://github.com/modelcontextprotocol/serv
