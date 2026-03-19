import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { Database, eq, and } from "../../storage/db"
import { ProjectTable } from "../../project/project.sql"
import { SessionTable, MessageTable, PartTable, TodoTable } from "../../session/session.sql"
import { SessionID, MessageID, PartID } from "../../session/schema"
import { ProjectID } from "../../project/schema"
import { Filesystem } from "../../util/filesystem"
import { EOL } from "os"
import path from "path"
import fs from "fs"

interface ImportPart {
  data: unknown
  time_created: number
}

interface ImportMessage {
  id?: string
  data: unknown
  time_created: number
  parts: ImportPart[]
}

interface ImportTodo {
  content: string
  status: string
  priority: string
  position: number
  time_created: number
  time_updated: number
}

interface ImportSession {
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
  messages: ImportMessage[]
  todos?: ImportTodo[]
}

interface ImportProject {
  worktree: string
  name?: string
  vcs?: string
  icon_url?: string
  icon_color?: string
  sandboxes?: string[]
  commands?: unknown
  time_created: number
  time_updated: number
  time_initialized?: number
  sessions: ImportSession[]
}

interface ImportData {
  version: number
  projects: ImportProject[]
}

const DB_FILES = ["opencode.db", "opencode.db-shm", "opencode.db-wal"]

function backup(dir: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const dest = path.join(dir, `.backup-${stamp}`)
  fs.mkdirSync(dest, { recursive: true })
  for (const name of DB_FILES) {
    const src = path.join(dir, name)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(dest, name))
    }
  }
  return dest
}

function restore(dir: string, from: string) {
  for (const name of DB_FILES) {
    const src = path.join(from, name)
    const dst = path.join(dir, name)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst)
    } else if (fs.existsSync(dst)) {
      fs.unlinkSync(dst)
    }
  }
}

export const ImportAllCommand = cmd({
  command: "import-all <file>",
  describe: "import data from JSON file (projects, sessions, messages, parts, todos)",
  builder: (yargs: Argv) => {
    return yargs
      .positional("file", {
        describe: "path to JSON file",
        type: "string",
        demandOption: true,
      })
      .option("rename-dup-session", {
        describe: "rename duplicate sessions with a suffix instead of skipping them",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const raw = await Filesystem.readText(args.file)
      if (!raw) {
        process.stderr.write(`File not found: ${args.file}${EOL}`)
        process.exit(1)
      }

      let data: ImportData
      try {
        data = JSON.parse(raw)
      } catch {
        process.stderr.write(`Invalid JSON: ${args.file}${EOL}`)
        process.exit(1)
      }

      if (data.version !== 1) {
        process.stderr.write(`Unsupported version: ${data.version}${EOL}`)
        process.exit(1)
      }

      // Determine database directory from Database.Path
      const dbPath = Database.Path
      const dir = path.dirname(dbPath)

      // Close database before backup
      Database.close()

      const backupDir = backup(dir)
      process.stderr.write(`Backup created at: ${backupDir}${EOL}`)

      // Re-open database
      try {
        let projects = 0
        let sessions = 0
        let skipped = 0
        let renamed = 0
        let messages = 0
        let parts = 0
        let todos = 0
        const rename = args.renameDupSession

        Database.transaction((tx) => {
          for (const proj of data.projects) {
            // Find existing project by worktree
            const existing = tx
              .select()
              .from(ProjectTable)
              .where(eq(ProjectTable.worktree, proj.worktree))
              .get()

            let pid: string
            if (existing) {
              pid = existing.id
              // Update project fields
              tx.update(ProjectTable)
                .set({
                  name: proj.name ?? existing.name,
                  vcs: proj.vcs ?? existing.vcs,
                  icon_url: proj.icon_url ?? existing.icon_url,
                  icon_color: proj.icon_color ?? existing.icon_color,
                  time_updated: Math.max(proj.time_updated, existing.time_updated),
                })
                .where(eq(ProjectTable.id, pid as any))
                .run()
            } else {
              pid = ProjectID.make(proj.worktree)
              tx.insert(ProjectTable)
                .values({
                  id: pid as any,
                  worktree: proj.worktree,
                  vcs: proj.vcs ?? null,
                  name: proj.name ?? null,
                  icon_url: proj.icon_url ?? null,
                  icon_color: proj.icon_color ?? null,
                  time_created: proj.time_created,
                  time_updated: proj.time_updated,
                  time_initialized: proj.time_initialized ?? null,
                  sandboxes: proj.sandboxes ?? [],
                  commands: proj.commands ?? null,
                })
                .run()
              projects++
            }

            // Build slug -> sessionID map for parent resolution
            const slugToId = new Map<string, string>()
            // Track which sessions are newly created (need messages imported)
            const created = new Set<string>()

            // Pre-populate from existing sessions
            const existingSessions = tx
              .select()
              .from(SessionTable)
              .where(eq(SessionTable.project_id, pid as any))
              .all()
            for (const s of existingSessions) {
              slugToId.set(s.slug, s.id)
            }

            // First pass: create sessions or skip/rename duplicates
            for (const sess of proj.sessions) {
              const dup = tx
                .select()
                .from(SessionTable)
                .where(
                  and(
                    eq(SessionTable.project_id, pid as any),
                    eq(SessionTable.slug, sess.slug),
                  ),
                )
                .get()

              if (dup) {
                if (rename) {
                  // Create a renamed copy
                  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
                  const slug = `${sess.slug}-imported-${stamp}`
                  const sid = SessionID.descending()
                  slugToId.set(sess.slug, sid)
                  created.add(sess.slug)
                  tx.insert(SessionTable)
                    .values({
                      id: sid,
                      project_id: pid as any,
                      slug,
                      directory: sess.directory,
                      title: `${sess.title} (imported)`,
                      version: sess.version,
                      share_url: sess.share_url ?? null,
                      summary_additions: sess.summary_additions ?? null,
                      summary_deletions: sess.summary_deletions ?? null,
                      summary_files: sess.summary_files ?? null,
                      summary_diffs: (sess.summary_diffs as any) ?? null,
                      revert: (sess.revert as any) ?? null,
                      permission: (sess.permission as any) ?? null,
                      time_created: sess.time_created,
                      time_updated: sess.time_updated,
                      time_compacting: sess.time_compacting ?? null,
                      time_archived: sess.time_archived ?? null,
                    })
                    .run()
                  renamed++
                  sessions++
                } else {
                  // Skip and warn
                  slugToId.set(sess.slug, dup.id)
                  process.stderr.write(`WARN: skipping duplicate session "${sess.title}" (slug: ${sess.slug}) in project "${proj.name ?? proj.worktree}"${EOL}`)
                  skipped++
                }
              } else {
                const sid = SessionID.descending()
                slugToId.set(sess.slug, sid)
                created.add(sess.slug)
                tx.insert(SessionTable)
                  .values({
                    id: sid,
                    project_id: pid as any,
                    slug: sess.slug,
                    directory: sess.directory,
                    title: sess.title,
                    version: sess.version,
                    share_url: sess.share_url ?? null,
                    summary_additions: sess.summary_additions ?? null,
                    summary_deletions: sess.summary_deletions ?? null,
                    summary_files: sess.summary_files ?? null,
                    summary_diffs: (sess.summary_diffs as any) ?? null,
                    revert: (sess.revert as any) ?? null,
                    permission: (sess.permission as any) ?? null,
                    time_created: sess.time_created,
                    time_updated: sess.time_updated,
                    time_compacting: sess.time_compacting ?? null,
                    time_archived: sess.time_archived ?? null,
                  })
                  .run()
                sessions++
              }
            }

            // Second pass: set parent_id for sessions with parent_slug
            for (const sess of proj.sessions) {
              if (!sess.parent_slug) continue
              if (!created.has(sess.slug)) continue
              const sid = slugToId.get(sess.slug)
              const parentId = slugToId.get(sess.parent_slug)
              if (sid && parentId) {
                tx.update(SessionTable)
                  .set({ parent_id: parentId as any })
                  .where(eq(SessionTable.id, sid as any))
                  .run()
              }
            }

            // Import messages, parts, and todos only for newly created sessions
            for (const sess of proj.sessions) {
              if (!created.has(sess.slug)) continue
              const sid = slugToId.get(sess.slug)!

              // Build old messageID -> new messageID mapping
              const msgIdMap = new Map<string, string>()
              const msgEntries: { msg: ImportMessage; mid: string }[] = []
              for (const msg of sess.messages) {
                const mid = MessageID.ascending()
                if (msg.id) {
                  msgIdMap.set(msg.id, mid)
                }
                msgEntries.push({ msg, mid })
              }

              for (const { msg, mid } of msgEntries) {
                const data = { ...(msg.data as Record<string, unknown>) }
                // Rewrite embedded IDs
                data.id = mid
                data.sessionID = sid
                // Remap parentID for assistant messages
                if (typeof data.parentID === "string") {
                  data.parentID = msgIdMap.get(data.parentID) ?? data.parentID
                }
                tx.insert(MessageTable)
                  .values({
                    id: mid,
                    session_id: sid,
                    time_created: msg.time_created,
                    data,
                  } as any)
                  .run()
                messages++

                for (const part of msg.parts) {
                  const partId = PartID.ascending()
                  const pdata = { ...(part.data as Record<string, unknown>) }
                  // Rewrite embedded IDs in part data
                  pdata.id = partId
                  pdata.sessionID = sid
                  pdata.messageID = mid
                  tx.insert(PartTable)
                    .values({
                      id: partId,
                      message_id: mid,
                      session_id: sid,
                      time_created: part.time_created,
                      data: pdata,
                    } as any)
                    .run()
                  parts++
                }
              }

              if (sess.todos) {
                for (const todo of sess.todos) {
                  tx.insert(TodoTable)
                    .values({
                      session_id: sid as any,
                      content: todo.content,
                      status: todo.status,
                      priority: todo.priority,
                      position: todo.position,
                      time_created: todo.time_created,
                      time_updated: todo.time_updated,
                    })
                    .onConflictDoNothing()
                    .run()
                  todos++
                }
              }
            }
          }
        })

        const summary = [
          `${projects} new projects`,
          `${sessions} new sessions`,
          skipped > 0 ? `${skipped} skipped (duplicate)` : "",
          renamed > 0 ? `${renamed} renamed (duplicate)` : "",
          `${messages} messages`,
          `${parts} parts`,
          `${todos} todos`,
        ].filter(Boolean).join(", ")
        process.stderr.write(`Import complete: ${summary}${EOL}`)
      } catch (err) {
        process.stderr.write(`Import failed, restoring backup...${EOL}`)
        Database.close()
        restore(dir, backupDir)
        process.stderr.write(`Backup restored from: ${backupDir}${EOL}`)
        throw err
      }
    })
  },
})
