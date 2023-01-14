import { tasks_v1 } from "googleapis";
import { toString } from "@fleker/standard-feeds";

export function getAllFolders(tasks: tasks_v1.Schema$Task[]): Set<string> {
  const foldersRegex = new RegExp('([a-zA-Z]*)\s?[:;>]\s?', 'g')
  const folders = new Set<string>()
  folders.add('Uncategorized')
  for (const task of tasks) {
    let entries: RegExpExecArray | null;
    while ((entries = foldersRegex.exec(task.title ?? '')) !== null) {
      if (entries[1].trim() === 'http') continue
      if (entries[1].trim() === 'https') continue
      folders.add(entries[1])
    }
  }
  return folders
}

export function getAllTags(tasks: tasks_v1.Schema$Task[]): Set<string> {
  const tagsRegex = new RegExp('#([a-z]*)', 'g')
  const tags = new Set<string>()
  tags.add('Uncategorized')
  for (const task of tasks) {
    let entries: RegExpExecArray | null;
    while ((entries = tagsRegex.exec(task.notes ?? '')) !== null) {
      if (!entries[1].trim().length) continue
      tags.add(entries[1])
    }
  }
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