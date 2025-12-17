import * as XLSX from 'xlsx';
import { GameEvent, GameSystem, AppSettings, AppState, DEFAULT_SETTINGS } from '../types';

// Importing Data Files
import { SYSTEM_GENERIC, EVENTS_GENERIC } from '../data/generic';
import { SYSTEM_CTHULHU, EVENTS_CTHULHU } from '../data/cthulhu';
import { SYSTEM_DAGGERHEART, EVENTS_DAGGERHEART } from '../data/daggerheart';
import { SYSTEM_DND, EVENTS_DND } from '../data/dnd5e';
import { SYSTEM_FABULA, EVENTS_FABULA } from '../data/fabula';
import { SYSTEM_ORDEM, EVENTS_ORDEM } from '../data/ordem';
import { SYSTEM_T20, EVENTS_T20 } from '../data/tormenta20';


const STORAGE_KEY = 'dungeon_architect_v1';

// Consolidated Initial Data
const INITIAL_SYSTEMS: GameSystem[] = [
  SYSTEM_GENERIC,
  SYSTEM_DND,
  SYSTEM_DAGGERHEART,
  SYSTEM_T20,
  SYSTEM_FABULA,
  SYSTEM_ORDEM,
  SYSTEM_CTHULHU
];

const INITIAL_EVENTS: GameEvent[] = [
  ...EVENTS_GENERIC,
  ...EVENTS_DND,
  ...EVENTS_DAGGERHEART,
  ...EVENTS_T20,
  ...EVENTS_FABULA,
  ...EVENTS_ORDEM,
  ...EVENTS_CTHULHU
];

export const getInitialData = (): Partial<AppState> => {
  return {
    systems: INITIAL_SYSTEMS,
    events: INITIAL_EVENTS,
    settings: DEFAULT_SETTINGS,
    selectedSystemIds: [SYSTEM_GENERIC.id], 
    generationCount: 1, 
    generatedEvents: [] 
  };
};

export const saveState = (state: Partial<AppState>) => {
  try {
    const existing = loadState();
    const newState = { ...existing, ...state };
    // Don't save transient state like generatedEvents or currentView
    const persistable = {
        systems: newState.systems,
        events: newState.events,
        settings: newState.settings,
        selectedSystemIds: newState.selectedSystemIds,
        generationCount: newState.generationCount
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch (e) {
    console.error('Failed to save state', e);
  }
};

export const loadState = (): Partial<AppState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
       return getInitialData();
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load state', e);
    return getInitialData();
  }
};

export const generateTemplate = () => {
  const headers = ['ID', 'Type', 'Description', 'Reward', 'Difficulty', 'System_Tag'];
  
  const data = [
    headers,
    ['1', 'Combate', 'Um grupo de bandidos ou saqueadores embosca o grupo exigindo pedágio.', 'Ouro, Equipamento Básico', 'Média', 'Sistema Generico'],
    ['2', 'Combate', 'Bestas selvagens famintas cercam o acampamento ou bloqueiam o caminho.', 'Materiais de Criatura, Comida', 'Fácil', 'Sistema Generico'],
    ['3', 'Elite', 'Mini-Boss: O líder dos bandidos, um veterano de guerra bem armado.', 'Arma de Qualidade, Ouro', 'Difícil', 'Sistema Generico'],
    ['4', 'Elite', 'Uma Besta Alpha (Urso-Coruja, Worg Gigante, etc.) protege seu ninho.', 'Ouro, Ovos raros, Troféu', 'Difícil', 'Sistema Generico'],
    ['5', 'Descanso', 'Uma fonte de água limpa e cristalina em um local seguro.', 'Recupera HP e MP moderado', 'Seguro', 'Sistema Generico'],
    ['6', 'Descanso', 'Uma caverna seca e escondida, fácil de defender.', 'Recupera HP, mas não MP', 'Seguro', 'Sistema Generico'],
    ['7', 'Evento', 'Enigma da Esfinge/Porta: Responda ou sofra as consequências.', 'Sucesso: Tesouro / Falha: Dano', 'Média', 'Sistema Generico'],
    ['8', 'Evento', 'Ponte Quebrada: Um abismo separa o caminho. Teste de Atletismo/Acrobacia.', 'Falha: Queda (Dano alto)', 'Fácil', 'Sistema Generico'],
    ['9', 'Armadilha', 'Fosso Oculto coberto por folhas ou tapete.', 'Dano de Queda + Perfurante', 'Média', 'Sistema Generico'],
    ['10', 'Armadilha', 'Gás Venenoso liberado ao abrir uma porta sem checar.', 'Dano de Veneno (DoT)', 'Difícil', 'Sistema Generico'],
    ['11', 'Tesouro', 'Baú de Madeira simples, sem tranca.', 'Pequena quantia de Ouro', 'Fácil', 'Sistema Generico'],
    ['12', 'Tesouro', 'Esqueleto de aventureiro antigo com uma mochila intacta.', 'Poções, Mapa, Diário', 'N/A', 'Sistema Generico']
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Events");
  XLSX.writeFile(wb, "Dungeon_Architect_Template.xlsx");
};

export const parseExcel = (file: File): Promise<GameEvent[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        // Map excel columns to GameEvent
        const events: GameEvent[] = json.map((row: any) => ({
          id: String(row.ID || Math.random().toString(36).substr(2, 9)),
          type: row.Type,
          description: row.Description,
          reward: row.Reward,
          difficulty: row.Difficulty,
          systemTag: row.System_Tag
        }));
        
        resolve(events);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};