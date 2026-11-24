import {readFileSync,readdirSync} from 'node:fs'; import {join} from 'node:path'; import {db} from './connection.js';
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
for(const name of readdirSync(new URL('./migrations/',import.meta.url)).sort()){if(!db.prepare('SELECT 1 FROM schema_migrations WHERE name=?').get(name)){db.exec(readFileSync(new URL(`./migrations/${name}`,import.meta.url),'utf8'));db.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(name);}}
