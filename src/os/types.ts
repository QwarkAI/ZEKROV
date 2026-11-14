export interface VFSFile {
  type: 'file';
  name: string;
  content: string;
  updatedAt: number;
  size: number;
  executable?: boolean;
}

export interface VFSDirectory {
  type: 'dir';
  name: string;
  children: Record<string, VFSNode>;
  updatedAt: number;
}

export type VFSNode = VFSFile | VFSDirectory;

export type AppId = 'terminal' | 'files' | 'editor' | 'monitor' | 'settings' | 'calc' | 'help';

export interface AppMetadata {
  id: AppId;
  name: string;
  iconName: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
}

export interface OSWindow {
  id: string;
  appId: AppId;
  title: string;
  iconName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  props?: Record<string, any>;
}

export type TerminalTheme = 'monokai' | 'matrix' | 'amber' | 'nord' | 'dracula' | 'cyberpunk';

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'ascii' | 'table';
  text: string;
  cwd?: string;
  timestamp?: number;
  color?: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number; // in MB
  status: 'running' | 'sleeping' | 'stopped';
  command: string;
}
