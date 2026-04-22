const { QuickDB } = require('quick.db');
const db = new QuickDB({ filePath: 'db.sqlite' });
module.exports = db;
