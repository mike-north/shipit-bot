import { Probot, ApplicationFunction } from 'probot';

import appFn = require('./server');

Probot.run(appFn as ApplicationFunction);
