# Internal Agent Workspace

## 1. What this app is
A local-first desktop application built as an internal agent workspace for startup discovery, qualification, enrichment, evidence gathering, inbox operations, and outreach.

## 2. Architecture overview
- **Desktop Runtime**: Electron
- **Frontend**: Next.js (App Router) with Tailwind CSS
- **Database**: SQLite (better-sqlite3) with Drizzle ORM
- **Browser Surface**: Electron `WebContentsView` for isolated, multi-tab browsing.
- **Communication**: IPC bridges between the Next.js renderer and Electron main process.

## 3. Folder structure
- `/main/`: Electron main process, IPC handlers, and Browser Manager.
- `/app/`: Next.js renderer application.
- `/components/`: Reusable React components.
- `/db/`: SQLite schema, migrations, and seed scripts.
- `/packages/shared/`: Shared TypeScript types.
- `/packages/mail/`: Mail provider interfaces and mock implementations.
- `/packages/commands/`: Internal command handlers.

## 4. How to run locally
1. Install dependencies: `npm install`
2. Push database schema: `npm run db:migrate`
3. Seed database: `npm run db:seed`
4. Start desktop app: `npm run electron:dev`

*(Note: `npm run dev` starts only the web renderer for preview purposes. The browser tabs require the Electron environment.)*

## 5. Production Build
To build the packaged application:
`npm run electron:build`

**Production Loading Path**:
The application uses Next.js static export (`output: 'export'`). During the build process, Next.js generates static HTML/JS/CSS files in the `out/` directory. The Electron main process loads `out/index.html` in production, ensuring that the Next.js renderer works correctly within the packaged Electron app without needing a separate Node.js server.

## 5. Database schema summary
- `companies`, `contacts`: CRM core.
- `messages`, `threads`: Inbox storage.
- `browser_tabs`: Tracks active and historical browser sessions.
- `evidence_fragments`: Extracted claims and quotes.
- `tasks`: Workflow and escalation queue.
- `notebook_entries`: Audit log.
- `drafts`: Outreach staging.

## 6. Where browser logic lives
- Main process: `/main/browser-manager.ts`
- Renderer UI: `/app/browser/page.tsx`

## 7. Where inbox logic lives
- UI: `/app/inbox/page.tsx`
- Providers: `/packages/mail/`

## 8. Where CRM logic lives
- UI: `/app/crm/page.tsx`
- Schema: `/db/schema.ts`

## 9. Where notebook and task logic lives
- UI: `/app/notebook/page.tsx`, `/app/tasks/page.tsx`

## 10. Replace mocks with real providers
Implement the `MailProvider` interface in `/packages/mail/provider.ts` for Gmail or IMAP, and wire it up in the main process to ingest messages into SQLite.

## 11. Next integration steps
- Implement Gmail push ingestion.
- Add AI extraction commands to the browser side drawer.
- Connect the outreach draft system to an SMTP sender.
