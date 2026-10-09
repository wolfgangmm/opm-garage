// Python sources are bundled as text (esbuild --loader:.py=text).
declare module '*.py' {
  const source: string;
  export default source;
}

// File System Access API (Chromium), beyond what TypeScript's DOM types cover.
type FileSystemPermissionMode = 'read' | 'readwrite';
interface FileSystemHandle {
  queryPermission(d?: { mode?: FileSystemPermissionMode }): Promise<PermissionState>;
  requestPermission(d?: { mode?: FileSystemPermissionMode }): Promise<PermissionState>;
}
interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
}
interface Window {
  showDirectoryPicker?(o?: { id?: string; mode?: FileSystemPermissionMode }): Promise<FileSystemDirectoryHandle>;
}
/** Change notifications for a folder (Chromium 129+); polling stands in elsewhere. */
declare class FileSystemObserver {
  constructor(callback: (records: unknown[], observer: FileSystemObserver) => void);
  observe(handle: FileSystemHandle, o?: { recursive?: boolean }): Promise<void>;
  disconnect(): void;
}
