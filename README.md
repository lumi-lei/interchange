# Interchange

Interchange 是一个面向 AI 编程团队的本地优先协作工具。它可以把一份客观项目资料转换成面向不同角色的可行动信息，并进一步生成可交给 AI 编程软件执行的提示词，帮助团队完成确认、转发和长期规范沉淀。

在 AI 辅助开发过程中，同一份需求、会议纪要、缺陷说明或发布说明，往往需要分别改写给产品、测试、研发负责人、客户以及多个 AI 编程工具。这个过程耗时，也容易造成信息遗漏。Interchange 的目标是让项目事实只输入一次，然后按角色生成不同版本，让人和 AI 都能拿到适合自己的上下文。

## 项目亮点

- **多格式文件转 Markdown**：集成微软开源项目 MarkItDown，可将 Word、PDF、Excel、PowerPoint、HTML、CSV 等常见工作文件转换为 Markdown 内容，并提供下载。
- **角色化分析与改写**：同一份客观信息可以自动生成面向产品、测试、研发负责人、部门领导、客户、我的 AI 编程软件、同项目同事的 AI 编程软件等角色的不同内容。
- **面向多 Agent 协作的提示词生成**：两个 AI 编程软件角色会生成可直接交给下游 AI Agent 使用的任务提示词，包含任务边界、需要读取的文档、验收标准、协作边界和测试要求。
- **人工确认后再发送**：生成内容不会自动发出，用户可以先审阅、编辑，再决定复制或发送。
- **支持钉钉与 Webhook 转发**：已确认的消息可以通过钉钉群机器人或通用 Webhook 发送给多人。
- **封装为 Agent Skill**：项目能力被进一步封装为 Skill，支持建立类 OpenSpec 的长期规范文档结构，并在模块修改后归档项目知识。
- **本地优先的数据边界**：上传文件默认在本地解析，原始文件不会默认发送给外部文件模型或视觉模型。

## 适用场景

- AI 编程团队需要把同一份需求同步给多个岗位。
- 产品、测试、研发、客户对同一件事关注点不同，需要快速生成不同版本说明。
- 多个 AI 编程 Agent 需要围绕同一个任务分工协作。
- 项目希望把临时沟通沉淀为长期可读、可追踪、可复用的规范文档。
- 团队希望在使用 AI 提效的同时，保留人工确认和发送控制权。

## 工作流程

1. 输入项目事实，或上传 Word、PDF、Excel、PPT、HTML、截图等文件。
2. 将文件解析并转换为可编辑文本，支持下载转换后的 Markdown。
3. 选择收件人，并为每个收件人分配角色。
4. 调用模型生成面向不同角色的消息草稿。
5. 人工审阅、修改并确认草稿。
6. 通过钉钉机器人或 Webhook 转发给团队成员。
7. 使用项目 Skill 将确认后的变更沉淀为类 OpenSpec 的长期规范文档。

## 内置角色

- 产品
- 测试
- 研发组长
- 部门领导
- 客户
- 我的 AI 编程软件
- 同项目同事的 AI 编程软件

其中，“我的 AI 编程软件”和“同项目同事的 AI 编程软件”不是普通通知角色，而是面向多 Agent 协作设计的提示词角色。它们会要求下游 AI 先读取项目说明、相关文档和规范结构，明确任务边界与待确认问题，再进入实现阶段。

## 技术栈

- 前端：Vite、React、TypeScript
- 后端：Express、TypeScript
- 存储：SQLite、better-sqlite3
- AI 调用：OpenAI 兼容 Chat Completions 接口，默认使用 DeepSeek
- 文件解析：MarkItDown、Mammoth、pdf-parse、read-excel-file、Tesseract.js
- 消息发送：通用 Webhook、钉钉机器人 Markdown 消息
- 测试：Vitest、Supertest

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

至少需要配置：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-v4-flash
TEXT_MODEL_PROVIDER=deepseek
PORT=4120
SQLITE_PATH=./data/interchange.sqlite
MARKITDOWN_COMMAND=markitdown
MARKITDOWN_TIMEOUT_MS=15000
```

如果没有配置 `DEEPSEEK_API_KEY`，应用仍然可以启动，但生成角色化草稿时会返回清晰的配置错误。

### 3. 安装 MarkItDown

Interchange 默认调用系统中的 `markitdown` 命令：

```bash
pip install "markitdown[all]"
```

如果 MarkItDown 安装在其他位置，可以通过 `.env` 中的 `MARKITDOWN_COMMAND` 指定命令名或可执行文件路径。

### 4. 本地启动

```bash
npm run dev
```

后端 Express 服务使用 `.env` 中的 `PORT`，前端由 Vite 开发服务启动。

### 5. 构建与测试

```bash
npm run build
npm test
```

## 主要环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 空 | 服务端调用文本模型所需的 API Key。 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | 默认 DeepSeek 模型。 |
| `TEXT_MODEL_PROVIDER` | `deepseek` | 文本模型提供方。 |
| `VISION_MODEL_PROVIDER` | `none` | 外部视觉模型默认关闭。 |
| `FILE_MODEL_PROVIDER` | `none` | 外部文件模型默认关闭。 |
| `SQLITE_PATH` | `./data/interchange.sqlite` | 本地 SQLite 数据库路径。 |
| `UPLOAD_LIMIT_MB` | `25` | 上传文件大小限制。 |
| `MARKITDOWN_COMMAND` | `markitdown` | MarkItDown CLI 命令。 |
| `MARKITDOWN_TIMEOUT_MS` | `15000` | MarkItDown 转换超时时间。 |

## 项目结构

```text
.
├── src/                  # React 前端
├── server/               # Express API、文件解析、消息发送、AI 路由、SQLite 持久化
├── docs/                 # 需求、方案、调研与演示材料
├── tests/                # API、解析器、提示词、发送逻辑与模型路由测试
├── agent-skills/         # 早期项目本地 Skill
├── agent-skills-v2/      # 可迁移的 Agent Skills 与 OpenSpec-like 工作流
└── agent-skills-dist/    # Skill 分发产物
```

## API 概览

- `GET /api/health`：服务状态与模型配置
- `GET /api/roles`：查看内置角色与角色偏好
- `PUT /api/roles/:key`：更新角色偏好
- `GET /api/contacts`：查看收件人
- `POST /api/contacts`：创建收件人
- `PUT /api/contacts/:id`：更新收件人
- `DELETE /api/contacts/:id`：删除收件人
- `POST /api/inputs/parse`：解析文本或上传文件
- `POST /api/generate`：生成角色化草稿
- `POST /api/send`：发送已确认消息
- `GET /api/records`：查看最近生成与发送记录

## 安全与合规边界

- 浏览器端不会接触模型 API Key。
- 钉钉机器人 Secret 仅保存在服务端，不会通过联系人 API 返回。
- 上传文件默认在本地解析。
- 外部视觉模型和外部文件模型默认关闭。
- 生成内容不会自动发送，必须由用户确认后才会投递。

## Agent Skills 与长期规范沉淀

`agent-skills-v2` 将 Interchange 的协作能力扩展到 Web 应用之外，提供以下能力：

- 角色化消息转换
- AI 编程上下文生成
- 人工确认关口
- 确认后的 Webhook 发送
- 类 OpenSpec 的项目工作流：探索、提案、上下文、实现、归档

通过这套 Skill，项目变更可以从一份客观事实开始，生成面向一个或多个 AI Agent 的执行提示词，并在实现和验证后归档为长期项目规范。这样，团队沟通不再只是一次性消息，而会变成可持续复用的工程记忆。

## 许可证

当前项目尚未声明许可证。正式公开发布或接受外部贡献前，建议补充明确的开源许可证。
