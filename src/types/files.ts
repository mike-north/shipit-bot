/**
 * A file, with a file name and some content
 */
export interface IFile<T = unknown> {
  name: string;
  content: T;
}
