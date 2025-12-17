export type Language = 'pt-BR' | 'en' | 'es';

export type EventType = string; 

export interface GameEvent {
  id: string;
  type: EventType;
  description: string;
  reward?: string;
  difficulty?: string;
  systemTag: string; // Links event to a specific GameSystem
  metadata?: Record<string, any>;
}

export interface GameSystem {
  id: string;
  name: string;
  stats: string[]; // e.g., ['HP', 'Sanity', 'Gold']
  description?: string;
}

export interface AppSettings {
  language: Language;
  theme: {
    cardBackground: string;
    cardText: string;
    cardBorder: string;
    accentColor: string;
  };
}

export interface AppState {
  currentView: 'generator' | 'builder' | 'database' | 'settings' | 'editor';
  selectedSystemIds: string[]; // Alterado para Array
  generationCount: number; // Novo campo
  events: GameEvent[];
  systems: GameSystem[];
  settings: AppSettings;
  generatedEvents: GameEvent[]; // Alterado para Array
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'pt-BR',
  theme: {
    cardBackground: '#1e293b',
    cardText: '#f8fafc',
    cardBorder: '#475569',
    accentColor: '#8b5cf6',
  }
};