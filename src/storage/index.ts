import type { LocalRepository } from './LocalRepository';
import { BrowserRepository } from './browserRepository';
import { TauriRepository } from './tauriRepository';

declare global {
  interface Window { __TAURI_INTERNALS__?: unknown }
}

export const localRepository: LocalRepository = window.__TAURI_INTERNALS__
  ? new TauriRepository()
  : new BrowserRepository();
