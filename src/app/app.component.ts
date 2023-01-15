import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { JWTInput } from 'google-auth-library';
import { JSONClient } from 'google-auth-library/build/src/auth/googleauth';
// import { authenticate } from '@google-cloud/local-auth';
import { tasks_v1 } from 'googleapis';
import { GoogleAuth } from 'googleapis-common';
import { exportAll, getAllFolders, getAllTags } from './vtodo-google';
import { initializeApp } from 'firebase/app';
import { Auth, getAuth, onAuthStateChanged, reauthenticateWithPopup, signInWithCredential, signInWithPopup, signOut } from "firebase/auth";
import { GoogleAuthProvider } from "firebase/auth";
import { GitHubTodoModule } from './todo-github';
import { encodeModule, parseModule } from '@fleker/standard-feeds';
import { TodoModule } from './module-todo';
import { MatSnackBar } from '@angular/material/snack-bar';

// If modifying these scopes, delete token.json.
const SCOPES = 'https://www.googleapis.com/auth/tasks';

const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';

const CLIENT_ID = '182076566691-9enoubad5scdd6vc0qdhkp5119rnqm6i.apps.googleusercontent.com'
const GOOGLE_CONFIG = {"type":"authorized_user","client_id":"182076566691-3jh4774q0ru2vnd6ihimbslono6p5l9q.apps.googleusercontent.com","client_secret":"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","refresh_token":"1//015hUGcJeD-u4CgYIARAAGAESNwF-L9Ir_b8fvmVXgjydbpUbg-pfSVNtc9y5rPIKfnLFFbewfsVEDEBSkHBVXwpcag-ZlY443pg"}
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
  title = 'Ethereal Tasks';
  folders: string[] = ['Uncategorized']
  tags: string[] = ['Uncategorized']
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
  selectedTaskList = 'MDI2MjE1MjYzMDk2ODM3MDg2MTk6MDow'

  // /**
  //  * Reads previously authorized credentials from the save file.
  //  */
  // async loadSavedCredentialsIfExist() {
  //   try {
  //     const content = localStorage.getItem(TOKEN_PATH)
  //     const credentials = JSON.parse(content ?? '');
  //     return google.auth.fromJSON(credentials);
  //   } catch (err) {
  //     return null;
  //   }
  // }

  // /**
  //  * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
  //  *
  //  * @param {OAuth2Client} client
  //  * @return {Promise<void>}
  //  */
  // async saveCredentials(client: { credentials: { refresh_token: any; }; }) {
  //   const content = localStorage.getItem(CREDENTIALS_PATH)
  //   const keys = JSON.parse(content ?? '');
  //   const key = keys.installed || keys.web;
  //   const payload = JSON.stringify({
  //     type: 'authorized_user',
  //     client_id: key.client_id,
  //     client_secret: key.client_secret,
  //     refresh_token: client.credentials.refresh_token,
  //   });
  //   localStorage.setItem(TOKEN_PATH, payload)
  // }

  // async authorize() {
  //   let client: any = await this.loadSavedCredentialsIfExist();
  //   if (client) {
  //     return client;
  //   }
  //   client = await authenticate({
  //     scopes: SCOPES,
  //     keyfilePath: CREDENTIALS_PATH,
  //   });
  //   if (client!.credentials) {
  //     await this.saveCredentials(client!);
  //   }
  //   return client;
  // }

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

  async ngAfterViewInit() {
    setInterval(() => {
      // this.folders = [Math.random().toString()]
    }, 500)
    // this.setupApi()
    // this.setupHello()
    await this.setupFirebase()
    // this.auth = google.auth.fromJSON(GOOGLE_CONFIG as JWTInput)
    // this.service = google.tasks({version: 'v1', auth: this.auth})
    // Load your tasks on a hardcoded list.
    // const googleTasks = await this.service.tasks.list({
    //   tasklist: 'MDI2MjE1MjYzMDk2ODM3MDg2MTk6MDow',
    //   maxResults: 100,
    // });
    // this.allTasks = googleTasks.data.items ?? []
    // console.log('Found', this.filteredTasks.length)
    /*
    this.tags = getAllTags(this.allTasks)
    this.folders = getAllFolders(this.allTasks)
    this.filteredTasks = this.allTasks
    */
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
        tokenClient.requestAccessToken()
      } else {
        console.debug('getToken has definition', gapi.client.getToken())
        // Skip display of account chooser and consent dialog for an existing session.
        // tokenClient.requestCode();
      }
      // tokenClient.c
      // setTimeout(() => {
      //   client.requestCode()
      // }, 15);
      // client.callback = async (res: any) => {
      //   console.debug(res)
      //   let {tokens} = await client.getToken(res.code)
      //   console.log(tokens)
      //   client.setCredentials(tokens)
      //   // localStorage.s
      //   if (res.error) {
      //     throw (res)
      //   }
      // }
    });
  }

  async getAccessToken() {
    console.log(this.auth?.currentUser)
    const idToken = await this.auth?.currentUser?.getIdToken()
    const cFR = GoogleAuthProvider.credentialFromResult({
      user: this.auth!.currentUser!,
      operationType: 'signIn',
      providerId: 'google.com',
    })
    console.log(cFR)
    // GoogleAuthProvider.
    const fbToken = (this.auth?.currentUser?.toJSON() as any)['stsTokenManager']['accessToken']
    const oaToken = GoogleAuthProvider.credential(idToken)
    return oaToken.accessToken
  }

  async setupFirebase() {
    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyCE-Op7_Tc4LYgo-EKhn3krtDpgvDfMLnc",
      authDomain: "taskflow-cloud.firebaseapp.com",
      projectId: "taskflow-cloud",
      storageBucket: "taskflow-cloud.appspot.com",
      messagingSenderId: "182076566691",
      appId: "1:182076566691:web:d1288bd455642da987a316"
    };

    const app = initializeApp(firebaseConfig);
    this.auth = getAuth(app);
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.loggedIn = true
        console.log(`Welcome back ${user.displayName}`)
        this.authRes = await reauthenticateWithPopup(user, provider)
        gapi.load('client', () => {
          this.pullGTasks(this.selectedTaskList)
        })
      } else {
        console.log('Nobody there?')
        this.loggedIn = false
      }
    })
  }

  async pullGTasks(tasklist: string) {
    this.toolbarSpin = true
    const credential = GoogleAuthProvider.credentialFromResult(this.authRes);
    const accessToken = credential!.accessToken;
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
    this.authRes = await signInWithPopup(this.auth!, provider)
    console.log(this.authRes)
  }

  signout() {
    signOut(this.auth!)
    this.loggedIn = false
  }

  selectTask(task: tasks_v1.Schema$Task) {
    console.debug(task)
    this.selection = task
  }

  unselect() {
    this.selection = undefined
  }

  async refresh() {
    this.authRes = await reauthenticateWithPopup(this.auth!.currentUser!, provider)
    this.pullGTasks(this.selectedTaskList)
  }

  sync() {
    this.toolbarMsg = 'Starting sync...'
    this.syncTasks(this.selectedTaskList)
  }

  async completed() {
    console.log({
      id: this.selection!.id,
      completed: new Date().toISOString(), /* Close enough */
    })
    await gapi.client.tasks.tasks.update({
      tasklist: this.selectedTaskList,
      task: this.selection!.id,
      id: this.selection!.id,
      completed: new Date().toISOString(), /* Close enough */
      status: 'completed',
    })
    this.snackbar.open('Way to go!', '', {duration: 3000})
    this.unselect()
    this.pullGTasks(this.selectedTaskList)
  }

  async syncTasks(listId: string) {
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
    }
    setTimeout(() => {
      this.toolbarMsg = ``
      this.toolbarSpin = false
      this.toolbarProgress = 0
    }, 0)
    this.pullGTasks(this.selectedTaskList)
  }

  export() {
    console.log(exportAll(this.allTasks))
  }

  settings() {
    this.dsettings!.nativeElement.showModal()
  }

  saveSettings() {
    console.log(this.clientSettings)
    localStorage.setItem('clientSettings', JSON.stringify(this.clientSettings))
    this.dsettings!.nativeElement.close()
  }
}
