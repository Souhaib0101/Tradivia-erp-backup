import Database from 'better-sqlite3'; import {mkdirSync} from 'node:fs'; import {dirname} from 'node:path'; import {env} from '../config/env.js';
mkdirSync(dirname(env.databasePath),{recursive:true}); export const db=new Database(env.databasePath); db.pragma('foreign_keys=ON');
