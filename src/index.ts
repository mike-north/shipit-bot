import { Probot } from 'probot';
import { join } from 'path';

process.stdout.write('starting...');
Probot.run(['', '', join(__dirname, 'index.js')]);
