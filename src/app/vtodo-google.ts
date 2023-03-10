import { tasks_v1 } from "googleapis";
import { toString } from "@fleker/standard-feeds";

export function getAllFolders(tasks: tasks_v1.Schema$Task[]): Set<string> {
  const foldersRegex = new RegExp('([a-zA-Z]*)\s?[:;>]\s?', 'g')
  const folders = new Set<string>()
  folders.add('All')
  folders.add('Uncategorized')
  const parsedFolders = []
  for (const task of tasks) {
    let entries: RegExpExecArray | null;
    while ((entries = foldersRegex.exec(task.title ?? '')) !== null) {
      if (entries[1].trim() === 'http') continue
      if (entries[1].trim() === 'https') continue
      parsedFolders.push(entries[1])
    }
  }
  parsedFolders.sort().forEach(f => folders.add(f))
  return folders
}

export function getAllTags(tasks: tasks_v1.Schema$Task[]): Set<string> {
  const tagsRegex = new RegExp('#([a-z]*)', 'g')
  const tags = new Set<string>()
  tags.add('All')
  const parsedTags = []
  for (const task of tasks) {
    let entries: RegExpExecArray | null;
    while ((entries = tagsRegex.exec(task.notes?.toLowerCase() ?? '')) !== null) {
      if (!entries[1].trim().length) continue
      parsedTags.push(entries[1])
    }
    if (task.due) {
      const d = new Date(task.due)
      const pastDue = d < new Date()
      if (pastDue) {
        parsedTags.push('due-past')
      } else {
        parsedTags.push('due-soon')
      }
    }
  }
  parsedTags.sort().forEach(t => tags.add(t))
  return tags
}

export function exportAll(tasks: tasks_v1.Schema$Task[]) {
  const vtodos = tasks.map(task => {
    const categories = []
    if (task.notes) {
      const hashtags = task.notes.split('#')
      for (let i = 1; i < hashtags.length; i++) {
        categories.push(hashtags[i].trim())
      }
    }
    return {
      dtstamp: new Date(task.updated!),
      uid: task.id!,
      summary: task.title ?? 'Untitled',
      description: task.notes ?? '',
      completed: task.completed ? new Date(task.completed) : undefined,
      url: task.links?.length ? task.links[0].link : '',
      status: task.status === 'needsAction' ? 'NEEDS-ACTION' : 'COMPLETED',
      categories,
    }
  })
  return toString('GTasks', {
    todo: vtodos,
  })
}