import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { Database } from "../../storage"
import { desc, inArray, isNull, and } from "../../storage/db"
import type { SQL } from "../../storage/db"
import { SessionTable } from "../../session/session.sql"
import { ProjectTable } from "../../project/project.sql"
import type { ProjectID } from "../../project/schema"
import { Session } from "../../session"
import { Locale } from "../../util"
import { EOL } from "os"

export const ListAllCommand = cmd({
  command: "list-all",
  describe: "list sessions across all projects",
  builder: (yargs: Argv) => {
    return yargs
      .option("project", {
        describe: "filter by project ID (repeatable)",
        type: "string",
        array: true,
      })
      .option("max-count", {
        alias: "n",
        describe: "limit to N most recent sessions",
        type: "number",
      })
      .option("format", {
        describe: "output format",
        type: "string",
        choices: ["table", "json"],
        default: "table",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const conditions: SQL[] = [isNull(SessionTable.parent_id)]

      if (args.project?.length) {
        conditions.push(inArray(SessionTable.project_id, args.project as ProjectID[]))
      }

      const limit = args.maxCount ?? 100

      const rows = Database.use((db) =>
        db
          .select()
          .from(SessionTable)
          .where(and(...conditions))
          .orderBy(desc(SessionTable.time_updated))
          .limit(limit)
          .all(),
      )

      if (rows.length === 0) return

      // Fetch project info
      const pids = [...new Set(rows.map((r) => r.project_id))]
      const projects = new Map<string, { name?: string; worktree: string }>()
      if (pids.length > 0) {
        const items = Database.use((db) =>
          db
            .select({ id: ProjectTable.id, name: ProjectTable.name, worktree: ProjectTable.worktree })
            .from(ProjectTable)
            .where(inArray(ProjectTable.id, pids))
            .all(),
        )
        for (const item of items) {
          projects.set(item.id, { name: item.name ?? undefined, worktree: item.worktree })
        }
      }

      const sessions = rows.map((row) => {
        const info = Session.fromRow(row)
        const proj = projects.get(row.project_id)
        return { ...info, project: proj }
      })

      if (args.format === "json") {
        const json = sessions.map((s) => ({
          id: s.id,
          title: s.title,
          updated: s.time.updated,
          created: s.time.created,
          projectId: s.projectID,
          projectName: s.project?.name,
          projectWorktree: s.project?.worktree,
          directory: s.directory,
        }))
        console.log(JSON.stringify(json, null, 2))
        return
      }

      // Table format
      const lines: string[] = []
      const maxIdW = Math.max(20, ...sessions.map((s) => s.id.length))
      const maxTitleW = Math.max(20, ...sessions.map((s) => s.title.length))
      const maxProjIdW = Math.max(20, ...sessions.map((s) => s.projectID.length))
      const maxProjW = Math.max(10, ...sessions.map((s) => (s.project?.name ?? s.project?.worktree ?? "").length))

      const header = `${"Session ID".padEnd(maxIdW)}  ${"Title".padEnd(maxTitleW)}  ${"Project ID".padEnd(maxProjIdW)}  ${"Project".padEnd(maxProjW)}  Updated`
      lines.push(header)
      lines.push("─".repeat(header.length))

      for (const s of sessions) {
        const title = Locale.truncate(s.title, maxTitleW)
        const proj = Locale.truncate(s.project?.name ?? s.project?.worktree ?? "", maxProjW)
        const time = Locale.todayTimeOrDateTime(s.time.updated)
        lines.push(`${s.id.padEnd(maxIdW)}  ${title.padEnd(maxTitleW)}  ${s.projectID.padEnd(maxProjIdW)}  ${proj.padEnd(maxProjW)}  ${time}`)
      }

      console.log(lines.join(EOL))
    })
  },
})
