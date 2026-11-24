import {db} from '../../database/connection.js'; export const findByUsername=username=>db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
