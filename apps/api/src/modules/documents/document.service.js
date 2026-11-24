import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {join} from 'node:path';import {env} from '../../config/env.js';const exec=promisify(execFile);
export const fillTemplate=(template,output,variables)=>exec('python3',[join(env.documentWorkerPath,'fill_template.py'),template,output,JSON.stringify(variables)]);
