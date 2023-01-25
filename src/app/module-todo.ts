import { Todo, ModuleParams } from '@fleker/standard-feeds';

export interface ExtendedTodo extends Todo {
  moduleId: string
  moduleParams: ModuleParams
}

export interface TodoModule {
  onSync: (params?: Record<string, string>) => Promise<ExtendedTodo[]>
  getSyncParams: () => string[]
  getUid: (params: ModuleParams) => string
}
