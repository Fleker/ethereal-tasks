import { ExtendedTodo, TodoModule } from "./module-todo";
import { Octokit } from "octokit";

const ghToTodo = (issue: GitHubIssue): ExtendedTodo => {
  return {
    dtstamp: new Date(issue.created_at),
    uid: issue.html_url,
    dtstart: new Date(issue.created_at),
    url: issue.html_url,
    summary: issue.title,
    description: issue.body,
    completed: issue.closed_at ? new Date(issue.closed_at) : undefined,
    categories: issue.labels?.map(label => label.name),
    moduleId: 'github',
    moduleParams: issue.html_url,
  }
}

interface GitHubIssue {
  created_at: string
  html_url: string
  title: string
  body: string
  closed_at?: string
  labels?: {
    name: string
    description?: string 
  }[]
}

interface GitHubParams extends Record<string, string> {
  auth: string
}

export const GitHubTodoModule: TodoModule = {
  onSync: async (params) => {
    const {auth} = params! as GitHubParams
    const octokit = new Octokit({ auth });
    const assignedIssues = await octokit.request('GET /issues{?filter,state,labels,sort,direction,since,per_page,page}', {})
    const data = assignedIssues.data as GitHubIssue[]
    return data.map(d => ghToTodo(d))
  },
  getSyncParams: () => ['auth'],
  getUid: (params) => params as string,
}
