import { MessageType } from '../enums/enums.js';

export interface DataEntry {
  keywords: string;
  message: string;
  caption?: string;
  type?: number;
}

export interface ScriptResult {
  message: string;
  type: MessageType;
  caption?: string;
  score?: number;
  label?: string;
}
