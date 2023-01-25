import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { tasks_v1 } from 'googleapis';
import { exportAll, getAllFolders, getAllTags } from './vtodo-google';
import { Auth } from "firebase/auth";
import { GoogleAuthProvider } from "firebase/auth";
import { GitHubTodoModule } from './todo-github';
import { encodeModule, parseModule } from '@fleker/standard-feeds';
import { TodoModule } from './module-todo';
import { MatSnackBar } from '@angular/material/snack-bar';

// If modifying these scopes, delete token.json.
const SCOPES = 'https://www.googleapis.com/auth/tasks';

const CLIENT_ID = '182076566691-9enoubad5scdd6vc0qdhkp5119rnqm6i.apps.googleusercontent.com'
declare var gapi: any;
declare var google: any;

const provider = new GoogleAuthProvider()
provider.addScope(SCOPES)

interface SyncOperations {
  // inserts: tasks_v1.Params$Resource$Tasks$Insert[]
  // updates: tasks_v1.Params$Resource$Tasks$Update[]
  // completes: tasks_v1.Params$Resource$Tasks$Update[] /* Complete */
  inserts: any[]
  updates: any[]
  completes: any[] /* Complete */
}

const connectedServices: Record<string, TodoModule> = {
  github: GitHubTodoModule
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
  @ViewChild('dsettings') dsettings?: ElementRef<HTMLDialogElement>
  @ViewChild('derrors') derrors?: ElementRef<HTMLDialogElement>
  title = 'Ethereal Tasks';
  folders: string[] = ['Uncategorized']
  tags: string[] = ['Uncategorized']
  allLists: tasks_v1.Schema$TaskList[] = []
  allTasks: tasks_v1.Schema$Task[] = []
  filteredTasks: tasks_v1.Schema$Task[] = []
  service?: tasks_v1.Tasks;
  auth?: Auth;
  authRes?: any
  loggedIn = false
  selection?: tasks_v1.Schema$Task
  toolbarMsg = ''
  toolbarSpin = false
  toolbarProgress = 0
  clientSettings: Record<string, Record<string, string>> = {}
  selectedTaskList?: tasks_v1.Schema$TaskList
  xs?: string
  gclient: any
  syncErrors: string[] = []

  constructor(private snackbar: MatSnackBar) {
    const localSettings = JSON.parse(localStorage.getItem('clientSettings') || '{}')
    for (const [key, module] of Object.entries(connectedServices)) {
      this.clientSettings[key] = {}
      // Pre-load
      module.getSyncParams().forEach(p => {
        if (localSettings[key]?.[p]) {
          this.clientSettings[key][p] = localSettings[key][p]
        } else {
          this.clientSettings[key][p] = ''
        }
      })
    }
  }

  iconClass(str?: string | null) {
    return str?.substring(1, 2).toLowerCase() ?? ''
  }

  dueStr(str?: string | null) {
    if (!str) return ''
    return new Date(str).toLocaleString()
  }

  async ngAfterViewInit() {
    this.setupApi()
    this.setupGSI()
  }

  async setupGSI() {
    setTimeout(() => {
      this.gclient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          console.debug(response)
          if (response.access_token) {
            this.loggedIn = true
            this.xs = response.access_token
            setTimeout(() => {
              this.loggedIn = false
            }, response.expires_in * 1000)
            this.pullGLists()
          }
        },
      });
    }, 500)
  }

  setupApi() {
    gapi.load('client', async () => {
      let tokenClient = await google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        ux_mode: 'popup',
        callback: '', // defined later
      });
      console.log('tc', tokenClient)
      if (gapi.client.getToken() === null) {
        console.debug('getToken is null')
        // Prompt the user to select a Google Account and ask for consent to share their data
        // when establishing a new session.
        // tokenClient.requestCode();
        // tokenClient.requestAccessToken()
      } else {
        console.debug('getToken has definition', gapi.client.getToken())
        // Skip display of account chooser and consent dialog for an existing session.
        // tokenClient.requestCode();
      }
    });
  }

  async pullGLists() {
    this.toolbarSpin = true
    const accessToken = this.xs
    gapi.client.setToken({access_token: accessToken})
    await gapi.client.init({
      clientId: CLIENT_ID,
      discoveryDocs: [
        'https://discovery.googleapis.com/$discovery/rest',
        'https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest',
      ]
    });

    try {
      // 3. Make the API request.
      const apiRequest = await gapi.client.tasks.tasklists.list({
        maxResults: 100
      })
      const result = JSON.parse(apiRequest.body);
      this.allLists = result.items
      this.selectedTaskList = result.items[0]
      this.pullGTasks(result.items[0].id)
    } catch (e) {
      console.error(e);
    } finally {
      this.toolbarSpin = false
    }
  }

  async pullGTasks(tasklist: string) {
    this.toolbarSpin = true
    const accessToken = this.xs
    console.debug(`AccTkn: ${accessToken}`)
    gapi.client.setToken({access_token: accessToken})
    await gapi.client.init({
      clientId: CLIENT_ID,
      discoveryDocs: [
        'https://discovery.googleapis.com/$discovery/rest',
        'https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest',
      ]
    });

    console.log(gapi)
    try {
      // 3. Make the API request.
      console.log(gapi.client)
      const apiRequest = await gapi.client.tasks.tasks.list({
        tasklist,
        maxResults: 100
      })
      const result = JSON.parse(apiRequest.body);
      this.allTasks = result.items.filter((x: tasks_v1.Schema$Task) => x.status === 'needsAction')
      this.tags = [...getAllTags(this.allTasks)]
      this.folders = [...getAllFolders(this.allTasks)]
      this.filteredTasks = this.allTasks
    } catch (e) {
      console.error(e);
    } finally {
      this.toolbarSpin = false
    }
  }

  filterFolder(folder: string) {
    this.unselect()
    if (folder === 'Uncategorized') {
      this.filteredTasks = this.allTasks.filter(x => !x.title?.toLowerCase().includes(':'))
    } else if (folder === 'All') {
      this.filteredTasks = this.allTasks
    } else {
      this.filteredTasks = this.allTasks.filter(x => x.title?.toLowerCase().startsWith(folder.toLowerCase()))
    }
  }

  filterTag(tag: string) {
    this.unselect()
    if (tag !== 'All') {
      this.filteredTasks = this.allTasks.filter(x => x.notes?.includes(`#${tag}`))
    } else {
      this.filteredTasks = this.allTasks
    }
  }

  async signin() {
    this.gclient.requestAccessToken()
  }

  signout() {
    google.accounts.oauth2.revoke(this.xs)
    this.loggedIn = false
    this.filteredTasks = []
    this.allLists = []
    this.folders = []
    this.tags = []
  }

  selectList(list: tasks_v1.Schema$TaskList) {
    if (list.id) {
      this.selectedTaskList = list
      this.pullGTasks(this.selectedTaskList.id!)
    }
  }

  selectTask(task: tasks_v1.Schema$Task) {
    console.debug(task)
    this.selection = task
  }

  unselect() {
    this.selection = undefined
  }

  async refresh() {
    this.gclient.requestAccessToken()
    // this.pullGTasks(this.selectedTaskList)
  }

  sync() {
    this.toolbarMsg = 'Starting sync...'
    this.syncTasks(this.selectedTaskList!.id!)
  }

  async completed() {
    console.log({
      id: this.selection!.id,
      completed: new Date().toISOString(), /* Close enough */
    })
    await gapi.client.tasks.tasks.update({
      tasklist: this.selectedTaskList!.id,
      task: this.selection!.id,
      id: this.selection!.id,
      completed: new Date().toISOString(), /* Close enough */
      status: 'completed',
    })
    this.snackbar.open('Way to go!', '', {duration: 3000})
    this.unselect()
    this.pullGTasks(this.selectedTaskList!.id!)
  }

  async syncTasks(listId: string) {
    this.syncErrors = []
    const res = await gapi.client.tasks.tasks.list({
      tasklist: listId,
      maxResults: 100,
    })
    const result = JSON.parse(res.body);
    const gtasks = result.items!;
  
    for (const [key, module] of Object.entries(connectedServices)) {
      if (!this.clientSettings[key]) continue // Not setup
      this.toolbarSpin = true
      console.log(`Syncing ${key}...`)
      setTimeout(() => {
        this.toolbarMsg = `Syncing ${key}...`
      }, 0)
      try {
        const mtasks = await module.onSync(this.clientSettings[key])
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
        let opCount = 0
        let opDone = 0
        for (const mtask of mtasks) {
          const taskUid = module.getUid(mtask.moduleParams).trim()
          const tags = `#${mtask.moduleId} ${mtask.categories?.map(c => `#${c}`)}`
          const encoding = encodeModule({module: mtask.moduleId, param: mtask.moduleParams})
          const notes = `${mtask.description ?? ''}\n${tags}\n${encoding}`
          if (existingUids.includes(taskUid)) {
            // Exists in both GTasks and Module service
            console.log(`  Updating: ${mtask.summary!}`)
            operations.updates.push({
              tasklist: listId,
              task: existingTasks[taskUid],
              id: existingTasks[taskUid],
              title: mtask.summary!,
              notes,
            })
            opCount++
            delete existingTasks[taskUid]
          } else if (!existingUids.includes(taskUid)) {
            // Exists in Module service but not GTasks
            console.log(`  Inserting: ${mtask.summary!}`)
            operations.inserts.push({
              tasklist: listId,
              title: mtask.summary!,
              notes,
            })
            opCount++
          }
        }
        // All tasks in GTasks but not in Module service are completed
        for (const remaining of Object.values(existingTasks)) {
          console.log(`  Completing: ${remaining!}`)
          if (!remaining) continue
          operations.completes.push({
            tasklist: listId,
            task: remaining,
            id: remaining,
            status: 'completed',
            completed: new Date().toISOString() /* Close enough */
          })
          opCount++
        }
    
        // Now perform all operations
        for (const op of operations.inserts) {
          await gapi.client.tasks.tasks.insert(op)
          opDone++
          setTimeout(() => {
            this.toolbarSpin = false
            this.toolbarProgress = opDone*100/opCount
            this.toolbarMsg = `Syncing ${key}... ${opDone}/${opCount}`
          }, 0)
        }
        for (const op of operations.updates) {
          await gapi.client.tasks.tasks.update(op)
          opDone++
          setTimeout(() => {
            this.toolbarSpin = false
            this.toolbarProgress = opDone*100/opCount
            this.toolbarMsg = `Syncing ${key}... ${opDone}/${opCount}`
          }, 0)
        }
        for (const op of operations.completes) {
          await gapi.client.tasks.tasks.update(op)
          opDone++
          setTimeout(() => {
            this.toolbarSpin = false
            this.toolbarProgress = opDone*100/opCount
            this.toolbarMsg = `Syncing ${key}... ${opDone}/${opCount}`
          }, 0)
        }
      } catch (e: any) {
        console.error(`Cannot sync ${key}`, e)
        this.syncErrors.push(`Cannot sync ${key}: ${e}`)
      }
    }
    setTimeout(() => {
      this.toolbarMsg = ``
      this.toolbarSpin = false
      this.toolbarProgress = 0
    }, 0)
    if (this.syncErrors.length) {
      this.derrors!.nativeElement.showModal()
    }
    this.pullGTasks(this.selectedTaskList!.id!)
  }

  export() {
    const ical = exportAll(this.allTasks)
    const link = document.createElement("a");
    link.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ical)}`
    link.download = 'exported-gtasks.ical'
    link.click();
  }

  settings() {
    this.dsettings!.nativeElement.showModal()
  }

  closeDialogs() {
    this.dsettings!.nativeElement.close()
    this.derrors!.nativeElement.close()
  }

  saveSettings() {
    console.log(this.clientSettings)
    localStorage.setItem('clientSettings', JSON.stringify(this.clientSettings))
    this.closeDialogs()
  }
}
