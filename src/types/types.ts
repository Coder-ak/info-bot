import { MessageType } from '../enums/enums.js';

export interface DataEntry {
  keywords: string;
  message: string;
  inlineKeyboard?: Record<string, string>[][];
  caption?: string;
  type?: number;
}

export interface ScriptResult {
  message: string;
  type: MessageType;
  inlineKeyboard?: Record<string, string>[][];
  caption?: string;
  score?: number;
  label?: string;
}
