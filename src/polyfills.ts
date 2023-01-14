import * as process from 'process';
// (window as any).process = process;
// global.process = process
(window as any).process = {
  env: { DEBUG: undefined },
};
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;