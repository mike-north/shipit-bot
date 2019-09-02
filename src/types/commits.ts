/**
 * A commit, and associated file changes
 */
export interface ICommitWithFileChanges {
  sha: string;
  files: IChangedFile[];
}

export type FileChangeStatus = 'added' | 'removed' | 'modified' | 'renamed';

/**
 * A changed file associated with a commit
 */
export interface IChangedFile {
  filename: string;
  status: FileChangeStatus;
  deletions: number;
  additions: number;
  changes: number;
}
