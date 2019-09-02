import { IFile } from 'shipit-bot/types';

// tslint:disable-next-line: prefer-const
let f!: IFile<string>;

f.name; // $ExpectType string
f.content; // $ExpectType string
