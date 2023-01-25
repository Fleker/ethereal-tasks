import { authenticate } from '@google-cloud/local-auth';
import { google, tasks_v1 } from 'googleapis';
import { GoogleAuth } from 'googleapis-common';
import { encodeModule, parseModule } from '@fleker/standard-feeds';
import { TodoModule } from './module-todo';
import { GitHubTodoModule } from './todo-github';
import { exportAll, getAllFolders, getAllTags } from './vtodo-google';
const fs = require('fs').promises;
const path = require('path');
const process = require('process');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/tasks'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

interface SyncOperations {
  inserts: tasks_v1.Params$Resource$Tasks$Insert[]
  updates: tasks_v1.Params$Resource$Tasks$Update[]
  completes: tasks_v1.Params$Resource$Tasks$Update[] /* Complete */
}

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client: { credentials: { refresh_token: any; }; }) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client: any = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client!.credentials) {
    await saveCredentials(client!);
  }
  return client;
}

/**
 * Lists the user's first 10 task lists.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listTaskLists(auth: GoogleAuth) {
  const service = google.tasks({version: 'v1', auth});
  const res = await service.tasklists.list({
    maxResults: 10,
  });
  const taskLists = res.data.items;
  if (!taskLists || taskLists.length === 0) {
    console.log('No task lists found.');
    return;
  }
  console.log('Task lists:');
  taskLists.forEach((taskList) => {
    console.log(`     ${taskList.title} (${taskList.id})`);
  });
}

async function listTasksForList(auth: GoogleAuth, listId: string) {
  const service = google.tasks({version: 'v1', auth});
  const res = await service.tasks.list({
    tasklist: listId,
    maxResults: 100,
  });
  const tasks = res.data.items;
  if (!tasks || tasks.length === 0) {
    console.log('No tasks found for list.');
    return;
  }
  console.log('Tasks:');
  tasks.forEach((task) => {
    console.log(`    ${task.title} (${task.id} ${task.etag})`);
  });
  console.log('Tags:')
  getAllTags(tasks).forEach(t => console.log(`  #${t}`))
  console.log('Folders:')
  getAllFolders(tasks).forEach(t => console.log(`  ${t}:`))
}

async function syncTasks(auth: GoogleAuth, listId: string) {
  const connectedServices: Record<string, TodoModule> = {
    github: GitHubTodoModule
  }
  const service = google.tasks({version: 'v1', auth});
  const res = await service.tasks.list({
    tasklist: listId,
    maxResults: 100,
  });
  const gtasks = res.data.items!;

  for (const [key, module] of Object.entries(connectedServices)) {
    console.log(`Syncing ${key}...`)
    const mtasks = await module.onSync({ auth: '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' })
    const existingTasks: Record<string, string> = {}
    for (const gtask of gtasks) {
      const parsedModules = parseModule(gtask.notes ?? '')
      const usesThisModule = parsedModules.find(x => x.module === key)
      if (usesThisModule) {
        existingTasks[module.getUid(usesThisModule.param).trim()] = gtask.id!
      }
    }
    const existingUids = Object.keys(existingTasks)
    const operations: SyncOperations = {
      inserts: [],
      updates: [],
      completes: [],
    }
    for (const mtask of mtasks) {
      const taskUid = module.getUid(mtask.moduleParams).trim()
      const tags = `#${mtask.moduleId} ${mtask.categories?.map(c => `#${c}`)}`
      const encoding = encodeModule({module: mtask.moduleId, param: mtask.moduleParams})
      const notes = `${mtask.description}\n${tags}\n${encoding}`
      if (existingUids.includes(taskUid)) {
        // Exists in both GTasks and Module service
        console.log(`  Updating: ${mtask.summary!}`)
        operations.updates.push({
          tasklist: listId,
          task: existingTasks[taskUid],
          requestBody: {
            id: existingTasks[taskUid],
            title: mtask.summary!,
            notes,
          }
        })
        delete existingTasks[taskUid]
      } else if (!existingUids.includes(taskUid)) {
        // Exists in Module service but not GTasks
        console.log(`  Inserting: ${mtask.summary!}`)
        operations.inserts.push({
          tasklist: listId,
          requestBody: {
            title: mtask.summary!,
            notes,
          }
        })
      }
    }
    // All tasks in GTasks but not in Module service are completed
    for (const remaining of Object.values(existingTasks)) {
      console.log(`  Completing: ${remaining!}`)
      if (!remaining) continue
      operations.completes.push({
        tasklist: listId,
        task: remaining,
        requestBody: {
          id: remaining,
          status: 'completed',
          completed: new Date().toISOString() /* Close enough */
        }
      })
    }

    // Now perform all operations
    for (const op of operations.inserts) {
      await service.tasks.insert(op)
    }
    for (const op of operations.updates) {
      await service.tasks.update(op)
    }
    for (const op of operations.completes) {
      await service.tasks.update(op)
    }
  }
}

async function printVTodo(auth: GoogleAuth, listId: string) {
  const service = google.tasks({version: 'v1', auth});
  const res = await service.tasks.list({
    tasklist: listId,
    maxResults: 100,
  });
  const tasks = res.data.items;
  if (!tasks || tasks.length === 0) {
    console.log('No tasks found for list.');
    return;
  }
  exportAll(tasks)
  // console.log(exportAll(tasks))
}

(async () => {
  const auth = await authorize()
  await listTaskLists(auth)
  await listTasksForList(auth, 'MDI2MjE1MjYzMDk2ODM3MDg2MTk6MDow')
  await syncTasks(auth, 'MDI2MjE1MjYzMDk2ODM3MDg2MTk6MDow')
  await printVTodo(auth, 'MDI2MjE1MjYzMDk2ODM3MDg2MTk6MDow')
})()
