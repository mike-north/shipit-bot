import { IDict } from 'shipit-bot/types';

/**
 * A dictionary may start empty
 */
const stringArrayDict: IDict<string[]> = {};

/**
 * A dictionary should constrain value types as specified
 */

// should accept string[]
stringArrayDict['foo'] = ['this is the foo string', 'and another one'];

// but shouldn't accept number[]

stringArrayDict['bar'] = [0]; // $ExpectError
