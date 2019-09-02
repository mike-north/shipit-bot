import { ICommitWithFileChanges, IChangedFile } from 'shipit-bot/types';

// tslint:disable-next-line: prefer-const
let changedFile!: IChangedFile;

changedFile.additions; // $ExpectType number
changedFile.deletions; // $ExpectType number
changedFile.changes; // $ExpectType number
changedFile.filename; // $ExpectType string
const { status } = changedFile;

switch (status) {
  case 'added':
    break;
  case 'removed':
    break;
  case 'modified':
    break;
  case 'renamed':
    break;
  default:
    status; // $ExpectType never
}

// tslint:disable-next-line: prefer-const
let commitInfo!: ICommitWithFileChanges;
commitInfo.sha; // $ExpectType string
const { files } = commitInfo;
if (!(files instanceof Array)) {
  files; // $ExpectType never
}
files[0]; // $ExpectType IChangedFile
