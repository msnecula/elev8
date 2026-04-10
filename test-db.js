require('dotenv').config({path:'.env.local'});
const postgres = require('./node_modules/postgres');
const sql = postgres(process.env.DATABASE_URL, {prepare:false, connect_timeout:10});
sql`SELECT 1 as ok`.then(r => { console.log('CONNECTED OK', r); process.exit(0); }).catch(e => { console.log('ERROR:', e.message); process.exit(1); });
