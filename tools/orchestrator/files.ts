import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

export function isWithin(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Resolve existing files against the real checkout, including symlink targets. */
export async function repositoryFile(root: string, path: string): Promise<string> {
  if (!path || isAbsolute(path) || path.includes('\\')) throw new Error(`Expected a repository-relative path: ${path}`);
  const absoluteRoot = await realpath(root);
  const lexical = resolve(absoluteRoot, path);
  if (!isWithin(absoluteRoot, lexical)) throw new Error(`Path escapes repository: ${path}`);
  const actual = await realpath(lexical);
  if (!isWithin(absoluteRoot, actual)) throw new Error(`Symlink escapes repository: ${path}`);
  if (!(await stat(actual)).isFile()) throw new Error(`Expected a regular file: ${path}`);
  return actual;
}

export async function readBoundedBytes(path: string, maxBytes: number): Promise<Buffer> {
  if ((await stat(path)).size > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes: ${path}`);
  const content = await readFile(path);
  if (content.byteLength > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes: ${path}`);
  return content;
}

export async function readBounded(path: string, maxBytes: number): Promise<string> {
  return (await readBoundedBytes(path, maxBytes)).toString('utf8');
}
