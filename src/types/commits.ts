export interface ICommitWithFileChanges {
  sha: string;
  files: IChangedFile[];
}

export interface IChangedFile {
  filename: string;
  status: string;
  deletions: number;
  additions: number;
  changes: number;
}
