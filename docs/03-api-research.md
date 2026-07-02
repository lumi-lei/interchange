# API Research

This project follows the repository instruction to use `ctx7` for current library documentation. Each library lookup used `npx ctx7@latest library <name> "<query>"` first, followed by `npx ctx7@latest docs <libraryId> "<query>"`.

## DeepSeek API

- Selected ID: `/websites/api-docs_deepseek_zh-cn`
- Key result: Chat Completions is OpenAI-compatible.
- Base URL: `https://api.deepseek.com`
- Endpoint: `POST /chat/completions`
- Auth: `Authorization: Bearer ${DEEPSEEK_API_KEY}`
- Node usage: instantiate OpenAI SDK with `baseURL: "https://api.deepseek.com"` and `apiKey: process.env.DEEPSEEK_API_KEY`.
- Default model in this app: `deepseek-v4-flash`
- Higher-quality option: `deepseek-v4-pro`

## React

- Selected ID: `/reactjs/react.dev`
- Key result: React + Vite is an officially documented app creation path.
- State-driven UI is built with functional components and hooks such as `useState`.
- The app uses Vite React TypeScript and ordinary controlled form state for this MVP.

## Express

- Selected ID: `/expressjs/express/v5.2.0`
- Key result: Express 5 automatically passes rejected promises from async middleware to error handlers.
- JSON parsing uses `express.json()`.
- Error middleware must use the four-parameter signature `(err, req, res, next)`.
- Static files can be served with `express.static()`.

## better-sqlite3

- Selected ID: `/wiselibs/better-sqlite3/v12.6.2`
- Key result: create a connection with `new Database(file)`.
- Use `db.pragma("journal_mode = WAL")` for local write performance.
- Use `prepare().run/get/all()` for statements.
- Use `db.transaction(fn)` for grouped writes.

## Multer

- Selected ID: `/expressjs/multer`
- Key result: use `memoryStorage` to receive file buffers directly for parsing.
- Use `limits.fileSize` to protect memory.
- Handle `multer.MulterError` such as `LIMIT_FILE_SIZE`.

## Mammoth

- Selected ID: `/mwilliamson/mammoth.js`
- Key result: `mammoth.extractRawText({ buffer })` extracts text from `.docx`.
- `convertToMarkdown` exists but is deprecated in favor of HTML conversion plus a dedicated markdown converter. This app only needs raw text.

## Tesseract.js

- Selected ID: `/naptha/tesseract.js`
- Key result: use `createWorker(language)` and `worker.recognize(image)` to extract text.
- Terminate the worker after processing, or reuse it for batches.
- This MVP uses `eng+chi_sim` for screenshots that may contain English or Simplified Chinese.

## pdf-parse

- Selected ID: `/mehmet-kozan/pdf-parse`
- Key result: instantiate `new PDFParse({ data: buffer })`, call `getText()`, then `destroy()`.
- The returned `result.text` is used as normalized text.

## SheetJS

- Selected ID: `/websites/sheetjs`
- Key result: parse buffers with `XLSX.read(buffer)` and convert worksheets to CSV with `XLSX.utils.sheet_to_csv(ws)`.
- Follow-up: npm audit reported unresolved vulnerabilities in `xlsx`, so the implementation switched to ExcelJS before final delivery.

## ExcelJS

- Selected ID: `/exceljs/exceljs`
- Key result: create `new ExcelJS.Workbook()` and load uploaded XLSX content with `workbook.xlsx.load(buffer)`.
- Iterate sheets with `workbook.eachSheet`, rows with `sheet.eachRow`, and cells with `row.eachCell`.
- Follow-up: npm audit reported a vulnerable transitive `uuid` chain in ExcelJS, so the implementation switched to `read-excel-file`.

## read-excel-file

- Selected ID: `/gitlab_catamphetamine/read-excel-file`
- Key result: import `readSheet` from `read-excel-file/node` and read a Node Buffer directly.
- `readSheet(buffer)` returns a two-dimensional row/cell array for `.xlsx`.
- This app converts the first worksheet to comma-separated text. CSV is decoded directly. Legacy `.xls` returns a clear unsupported-file error.

## DingTalk Robot Webhook

- Selected ID: `/websites/open_dingtalk_document`
- Key result: custom robot webhooks support Markdown messages with `msgtype: "markdown"`.
- Markdown payload shape:
  - `markdown.title`: message title.
  - `markdown.text`: Markdown body; @ targets must also appear in the text when @ support is used later.
- Secret signing uses HmacSHA256 and Base64. The string to sign is `timestamp + "\n" + secret`.
- Signed robot webhook requests append `timestamp` and `sign` query parameters to the webhook URL.
- This app implements DingTalk group robot Markdown delivery only. It does not implement enterprise app private messages or @ mentions in this version.

## concurrently

- Selected ID: `/open-cli-tools/concurrently`
- Key result: this is only needed for local development scripts that run Vite and Express together.
- This app keeps it in `devDependencies`, not runtime dependencies.
