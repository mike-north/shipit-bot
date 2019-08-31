import { Probot } from 'probot';
import { join } from 'path';
console.log('starting..');
Probot.run(['', '', join(__dirname, 'index.js')]);
