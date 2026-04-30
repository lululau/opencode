import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { Database } from "@/storage/db"
import { eq, inArray } from "@/storage/db"
import { ProjectTable } from "@/project/project.sql"
import { SessionTable, MessageTable, PartTable, TodoTable } from "@/session/session.sql"
import type { SessionID } from "@/session/schema"
import type { ProjectID } from "@/project/schema"
import { EOL } from "os"

interface ExportPart {
  data: unknown
  time_created: number
}

interface ExportMessage {
  id?: string
  data: unknown
  time_created: number
  parts: ExportPart[]
}

interface ExportTodo {
  content: string
  status: string
  priority: string
  position: number
  time_created: number
  time_updated: number
}

interface ExportSession {
  title: string
  slug: string
  directory: string
  version: string
  parent_slug?: string
  share_url?: string
  summary_additions?: number
  summary_deletions?: number
  summary_files?: number
  summary_diffs?: unknown
  revert?: unknown
  permission?: unknown
  time_created: number
  time_updated: number
  time_compacting?: number
  time_archived?: number
  messages: ExportMessage[]
  todos: ExportTodo[]
}

interface ExportProject {
  worktree: string
  name?: string
  vcs?: string
  icon_url?: string
  icon_color?: string
  sandboxes: string[]
  commands?: unknown
  time_created: number
  time_updated: number
  time_initialized?: number
  sessions: ExportSession[]
}

interface ExportData {
  version: 1
  projects: ExportProject[]
}

export const ExportAllCommand = cmd({
  command: "export-all",
  describe: "export all data as JSON (projects, sessions, messages, parts, todos)",
  builder: (yargs: Argv) => {
    return yargs
      .option("session", {
        describe: "session IDs to export (repeatable)",
        type: "string",
        array: true,
      })
      .option("project", {
        describe: "project IDs to export (repeatable)",
        type: "string",
        array: true,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const result: ExportData = { version: 1, projects: [] }

      // Build the slug lookup for parent_id -> parent_slug resolution
      const slugMap = new Map<string, string>()

      // Determine which sessions to export
      let sessions: (typeof SessionTable.$inferSelect)[]
      if (args.session?.length) {
        sessions = Database.use((db) =>
          db.select().from(SessionTable).where(inArray(SessionTable.id, args.session! as SessionID[])).all(),
        )
      } else if (args.project?.length) {
        sessions = Database.use((db) =>
          db.select().from(SessionTable).where(inArray(SessionTable.project_id, args.project! as ProjectID[])).all(),
        )
      } else {
        sessions = Database.use((db) => db.select().from(SessionTable).all())
      }

      // Build slug map for parent resolution
      for (const s of sessions) {
        slugMap.set(s.id, s.slug)
      }

      // Collect project IDs
      const pids = [...new Set(sessions.map((s) => s.project_id))]
      const projects =
        pids.length > 0
          ? Database.use((db) => db.select().from(ProjectTable).where(inArray(ProjectTable.id, pids)).all())
          : []

      // Group sessions by project
      const grouped = new Map<string, (typeof SessionTable.$inferSelect)[]>()
      for (const s of sessions) {
        const list = grouped.get(s.project_id) ?? []
        list.push(s)
        grouped.set(s.project_id, list)
      }

      for (const proj of projects) {
        const projSessions = grouped.get(proj.id) ?? []
        const sids = projSessions.map((s) => s.id)

        // Fetch messages for these sessions
        const msgs =
          sids.length > 0
            ? Database.use((db) =>
                db
                  .select()
                  .from(MessageTable)
                  .where(inArray(MessageTable.session_id, sids))
                  .orderBy(MessageTable.time_created, MessageTable.id)
                  .all(),
              )
            : []

        // Fetch parts
        const mids = msgs.map((m) => m.id)
        const parts =
          mids.length > 0
            ? Database.use((db) =>
                db
                  .select()
                  .from(PartTable)
                  .where(inArray(PartTable.message_id, mids))
                  .orderBy(PartTable.message_id, PartTable.id)
                  .all(),
              )
            : []

        // Fetch todos
        const todos =
          sids.length > 0
            ? Database.use((db) =>
                db.select().from(TodoTable).where(inArray(TodoTable.session_id, sids)).all(),
              )
            : []

        // Group messages by session
        const msgBySess = new Map<string, (typeof MessageTable.$inferSelect)[]>()
        for (const m of msgs) {
          const list = msgBySess.get(m.session_id) ?? []
          list.push(m)
          msgBySess.set(m.session_id, list)
        }

        // Group parts by message
        const partByMsg = new Map<string, (typeof PartTable.$inferSelect)[]>()
        for (const p of parts) {
          const list = partByMsg.get(p.message_id) ?? []
          list.push(p)
          partByMsg.set(p.message_id, list)
        }

        // Group todos by session
        const todoBySess = new Map<string, (typeof TodoTable.$inferSelect)[]>()
        for (const t of todos) {
          const list = todoBySess.get(t.session_id) ?? []
          list.push(t)
          todoBySess.set(t.session_id, list)
        }

        const exported: ExportProject = {
          worktree: proj.worktree,
          name: proj.name ?? undefined,
          vcs: proj.vcs ?? undefined,
          icon_url: proj.icon_url ?? undefined,
          icon_color: proj.icon_color ?? undefined,
          sandboxes: proj.sandboxes,
          commands: proj.commands ?? undefined,
          time_created: proj.time_created,
          time_updated: proj.time_updated,
          time_initialized: proj.time_initialized ?? undefined,
          sessions: projSessions.map((s) => {
            const sessMsgs = msgBySess.get(s.id) ?? []
            const sessTodos = todoBySess.get(s.id) ?? []
            const sess: ExportSession = {
              title: s.title,
              slug: s.slug,
              directory: s.directory,
              version: s.version,
              parent_slug: s.parent_id ? slugMap.get(s.parent_id) : undefined,
              share_url: s.share_url ?? undefined,
              summary_additions: s.summary_additions ?? undefined,
              summary_deletions: s.summary_deletions ?? undefined,
              summary_files: s.summary_files ?? undefined,
              summary_diffs: s.summary_diffs ?? undefined,
              revert: s.revert ?? undefined,
              permission: s.permission ?? undefined,
              time_created: s.time_created,
              time_updated: s.time_updated,
              time_compacting: s.time_compacting ?? undefined,
              time_archived: s.time_archived ?? undefined,
              messages: sessMsgs.map((m) => ({
                id: m.id,
                data: m.data,
                time_created: m.time_created,
                parts: (partByMsg.get(m.id) ?? []).map((p) => ({
                  data: p.data,
                  time_created: p.time_created,
                })),
              })),
              todos: sessTodos.map((t) => ({
                content: t.content,
                status: t.status,
                priority: t.priority,
                position: t.position,
                time_created: t.time_created,
                time_updated: t.time_updated,
              })),
            }
            return sess
          }),
        }
        result.projects.push(exported)
      }

      process.stdout.write(JSON.stringify(result, null, 2))
      process.stdout.write(EOL)
    })
  },
})
