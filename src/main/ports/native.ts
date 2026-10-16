// Identifies a window of the host without exposing the host's own window type.
export interface WindowHandle {
  readonly id: number;
}

export interface FolderPicker {
  pickFolder(window: WindowHandle | null, title: string): Promise<string | null>;
}
