import React, { useState, useEffect, useMemo } from 'react';
import { 
  Menu, Database, Settings as SettingsIcon, Dices, Plus, 
  Trash2, Download, Upload, RefreshCw, Save, Table2, Edit2, X, Check,
  Filter, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle, AlertTriangle
} from 'lucide-react';
import { 
  AppState, DEFAULT_SETTINGS, GameSystem, GameEvent, EventType, Language 
} from './types';
import { TRANSLATIONS, EVENT_TYPES } from './constants';
import { saveState, loadState, generateTemplate, parseExcel } from './services/dataService';
import { EventCard } from './components/EventCard';

export default function App() {
  // --- State Management ---
  const [state, setState] = useState<AppState>({
    currentView: 'generator',
    selectedSystemIds: [],
    generationCount: 1,
    events: [],
    systems: [],
    settings: DEFAULT_SETTINGS,
    generatedEvents: [],
  });

  // State local para o Editor (Modal de Edição e Filtros)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<GameEvent>>({});
  
  // State para o Modal de Ajuda
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  
  // Filtros Avançados
  const [editorSystemFilter, setEditorSystemFilter] = useState<string>('');
  const [editorTypeFilter, setEditorTypeFilter] = useState<string>('');
  const [editorDiffFilter, setEditorDiffFilter] = useState<string>('');
  
  // Ordenação
  const [sortConfig, setSortConfig] = useState<{ key: keyof GameEvent, direction: 'asc' | 'desc' } | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const loaded = loadState();
    const initialState = {
      ...DEFAULT_SETTINGS, // Fallback
      ...loaded,
      systems: loaded.systems || [],
      events: loaded.events || [],
      settings: loaded.settings || DEFAULT_SETTINGS
    };
    
    // Garantir compatibilidade com dados antigos que podem não ter array
    if (!initialState.selectedSystemIds && (loaded as any).selectedSystemId) {
        initialState.selectedSystemIds = [(loaded as any).selectedSystemId];
    }
    if (!initialState.selectedSystemIds) {
        initialState.selectedSystemIds = [];
    }
    if (!initialState.generatedEvents) {
        initialState.generatedEvents = [];
    }
    if (!initialState.generationCount) {
        initialState.generationCount = 1;
    }
    
    setState(prev => ({
      ...prev,
      ...initialState,
    }));

    // Set default filter if systems exist
    if (initialState.systems.length > 0 && !editorSystemFilter) {
      setEditorSystemFilter(initialState.systems[0].name);
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (state.systems.length > 0 || state.events.length > 0) {
      saveState(state);
    }
  }, [state.systems, state.events, state.settings, state.selectedSystemIds, state.generationCount]);

  // Derived state
  const t = TRANSLATIONS[state.settings.language];
  // const currentSystem = state.systems.find(s => s.id === state.selectedSystemId); // DEPRECATED for Generator
  
  // Helper to get system object by name/tag
  const getSystemByName = (name: string) => state.systems.find(s => s.name.toLowerCase() === name.toLowerCase());

  // Helper to render bold text in UI
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // --- Logic Helpers ---

  const handleSystemCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const statsStr = formData.get('stats') as string;

    const newSystem: GameSystem = {
      id: Date.now().toString(),
      name,
      stats: statsStr.split(',').map(s => s.trim()).filter(s => s.length > 0)
    };

    setState(prev => ({
      ...prev,
      systems: [...prev.systems, newSystem],
      selectedSystemIds: [...prev.selectedSystemIds, newSystem.id]
    }));
    e.currentTarget.reset();
  };

  const handleDeleteSystem = (id: string) => {
    setState(prev => ({
      ...prev,
      systems: prev.systems.filter(s => s.id !== id),
      selectedSystemIds: prev.selectedSystemIds.filter(sid => sid !== id)
    }));
  };

  const toggleSystemSelection = (systemId: string) => {
    setState(prev => {
        const exists = prev.selectedSystemIds.includes(systemId);
        let newSelection;
        if (exists) {
            newSelection = prev.selectedSystemIds.filter(id => id !== systemId);
        } else {
            newSelection = [...prev.selectedSystemIds, systemId];
        }
        return { ...prev, selectedSystemIds: newSelection };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const newEvents = await parseExcel(e.target.files[0]);
        
        setState(prev => {
          // 1. Extrair todas as tags de sistema únicas do arquivo importado
          const importedTags = Array.from(new Set(newEvents.map(e => e.systemTag).filter(tag => tag && tag.trim().length > 0)));

          // 2. Identificar quais sistemas ainda não existem no estado atual (comparação case-insensitive)
          const existingSystemNames = new Set(prev.systems.map(s => s.name.toLowerCase().trim()));
          const newSystems: GameSystem[] = [];

          importedTags.forEach(tagName => {
            if (!existingSystemNames.has(tagName.toLowerCase().trim())) {
              newSystems.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5), // ID único
                name: tagName,
                stats: [] // Inicializa sem stats extras, usuário pode editar depois no Construtor
              });
              existingSystemNames.add(tagName.toLowerCase().trim());
            }
          });

          const createdMsg = newSystems.length > 0 
            ? `\n${newSystems.length} novo(s) sistema(s) criado(s): ${newSystems.map(s => s.name).join(', ')}`
            : '';

          setTimeout(() => {
             alert(`Importação concluída com sucesso!\n${newEvents.length} eventos adicionados.${createdMsg}`);
          }, 100);

          return {
            ...prev,
            events: [...prev.events, ...newEvents],
            systems: [...prev.systems, ...newSystems]
          };
        });

      } catch (err) {
        console.error(err);
        alert("Erro ao ler o arquivo. Verifique se é um Excel/CSV válido.");
      }
    }
  };

  const generateEvents = (type: EventType | 'Random') => {
    if (state.selectedSystemIds.length === 0) {
        alert("Selecione pelo menos um sistema.");
        return;
    }

    // 1. Identificar nomes dos sistemas selecionados
    const selectedSystemNames = state.systems
        .filter(s => state.selectedSystemIds.includes(s.id))
        .map(s => s.name.toLowerCase());

    // 2. Filtrar pool base (Eventos que pertencem a qualquer um dos sistemas selecionados)
    let pool = state.events.filter(e => 
        selectedSystemNames.includes(e.systemTag.toLowerCase())
    );

    // 3. Filtrar por Tipo (se não for Random)
    if (type !== 'Random') {
      pool = pool.filter(e => e.type.toLowerCase() === type.toLowerCase());
    }

    if (pool.length === 0) {
      alert(t.genNoEvents);
      return;
    }

    // 4. Gerar N eventos
    const newEvents: GameEvent[] = [];
    for (let i = 0; i < state.generationCount; i++) {
        const randomEvent = pool[Math.floor(Math.random() * pool.length)];
        // Clonar para evitar referência direta se precisarmos modificar algo na exibição futura
        newEvents.push({...randomEvent});
    }

    setState(prev => ({ ...prev, generatedEvents: newEvents }));
  };

  // --- Editor Logic ---
  const openEditorModal = (event?: GameEvent) => {
    if (event) {
      setEditingEvent({ ...event });
    } else {
      // New Event
      setEditingEvent({
        id: '', // Will be set on save
        type: 'Combate',
        description: '',
        reward: '',
        difficulty: '',
        systemTag: editorSystemFilter || (state.systems.length > 0 ? state.systems[0].name : '')
      });
    }
    setIsModalOpen(true);
  };

  const saveEditedEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent.description || !editingEvent.systemTag) {
        alert("Descrição e Sistema são obrigatórios!");
        return;
    }

    setState(prev => {
      let updatedEvents = [...prev.events];
      
      if (editingEvent.id) {
        // Update existing
        updatedEvents = updatedEvents.map(ev => 
          ev.id === editingEvent.id ? { ...ev, ...editingEvent } as GameEvent : ev
        );
      } else {
        // Create new
        const newEvent: GameEvent = {
          ...editingEvent as GameEvent,
          id: Date.now().toString(),
        };
        updatedEvents.push(newEvent);
      }
      
      return { ...prev, events: updatedEvents };
    });
    
    setIsModalOpen(false);
  };

  const deleteEvent = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este evento?')) {
      setState(prev => ({
        ...prev,
        events: prev.events.filter(ev => ev.id !== id)
      }));
    }
  };

  const handleSort = (key: keyof GameEvent) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };


  // --- Render Sub-Components ---

  const renderSidebar = () => (
    <div className="w-64 bg-slate-900 border-r border-slate-700 h-screen flex flex-col p-4 fixed left-0 top-0 z-50">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-purple-600 p-2 rounded-lg">
          <Dices className="text-white" size={24} />
        </div>
        <h1 className="font-display font-bold text-lg text-slate-100 leading-tight">
          {t.appTitle}
        </h1>
      </div>

      <nav className="flex flex-col gap-2">
        <button 
          onClick={() => setState(s => ({ ...s, currentView: 'generator' }))}
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${state.currentView === 'generator' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <Dices size={20} />
          {t.navGenerator}
        </button>
        <button 
          onClick={() => setState(s => ({ ...s, currentView: 'builder' }))}
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${state.currentView === 'builder' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <Plus size={20} />
          {t.navBuilder}
        </button>
        <button 
          onClick={() => setState(s => ({ ...s, currentView: 'editor' }))}
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${state.currentView === 'editor' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <Table2 size={20} />
          {t.navEditor}
        </button>
        <button 
          onClick={() => setState(s => ({ ...s, currentView: 'database' }))}
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${state.currentView === 'database' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <Database size={20} />
          {t.navDatabase}
        </button>
        <button 
          onClick={() => setState(s => ({ ...s, currentView: 'settings' }))}
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${state.currentView === 'settings' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <SettingsIcon size={20} />
          {t.navSettings}
        </button>
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-700 flex justify-between items-center">
        <span className="text-xs text-slate-500">v1.6.0</span>
        <button 
          onClick={() => setIsHelpOpen(true)}
          className="w-6 h-6 rounded-full bg-yellow-500 text-slate-900 font-bold flex items-center justify-center text-xs shadow-[0_0_10px_rgba(234,179,8,0.5)] hover:bg-yellow-400 transition-all cursor-pointer"
          title="Ajuda e Instruções"
        >
          ?
        </button>
      </div>
    </div>
  );

  const renderHelpModal = () => (
    isHelpOpen && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
          
          {/* Header Aviso IA */}
          <div className="bg-red-900/30 p-4 border-b border-red-900/50 rounded-t-xl flex gap-3 items-start">
            <AlertTriangle className="text-red-400 shrink-0" size={24} />
            <div>
              <h3 className="text-red-400 font-bold text-sm uppercase mb-1">Aviso Importante: Conteúdo Gerado por IA</h3>
              <p className="text-red-200/80 text-xs leading-relaxed">
                Os eventos de exemplo pré-cadastrados neste aplicativo foram gerados utilizando Inteligência Artificial. 
                Embora sirvam como ótimas ideias iniciais, eles podem conter discrepâncias de regras, valores desbalanceados 
                ou inconsistências com o lore oficial dos sistemas. Recomendamos que o Mestre revise e ajuste os eventos conforme necessário antes de utilizá-los em jogo.
              </p>
            </div>
            <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-white ml-auto">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            <h2 className="text-2xl font-display font-bold text-white mb-4">Como usar o Arquiteto</h2>
            
            <div className="space-y-6 text-slate-300">
              <section>
                <h4 className="text-purple-400 font-bold flex items-center gap-2 mb-2">
                  <Dices size={18} /> 1. Gerador
                </h4>
                <p className="text-sm">
                  O painel principal. Selecione um ou mais <strong>Sistemas Ativos</strong> na lista lateral. 
                  Escolha quantos eventos deseja gerar e clique em "Aleatório" ou em um tipo específico (Combate, Elite, etc.). 
                  O app sorteará cartas baseadas no seu banco de dados.
                </p>
              </section>

              <section>
                <h4 className="text-purple-400 font-bold flex items-center gap-2 mb-2">
                  <Plus size={18} /> 2. Criar Sistemas
                </h4>
                <p className="text-sm">
                  Vá na aba "Sistemas" para cadastrar novos jogos (ex: Pathfinder, Vampiro). 
                  Você pode definir atributos personalizados (ex: Sangue, Sanidade) que aparecerão no rodapé das cartas.
                </p>
              </section>

              <section>
                <h4 className="text-purple-400 font-bold flex items-center gap-2 mb-2">
                  <Table2 size={18} /> 3. Gerenciar e Editar
                </h4>
                <p className="text-sm">
                  Use o "Gerenciador" para ver todos os eventos cadastrados. Você pode filtrar por sistema ou tipo, 
                  editar textos (use <code>**texto**</code> para <strong>negrito</strong>) e excluir eventos indesejados.
                </p>
              </section>

              <section>
                <h4 className="text-purple-400 font-bold flex items-center gap-2 mb-2">
                  <Database size={18} /> 4. Banco de Dados
                </h4>
                <p className="text-sm">
                  Baixe o modelo Excel, preencha com seus próprios eventos em massa e faça o upload para povoar o aplicativo instantaneamente.
                  Você também pode limpar todo o banco se quiser começar do zero.
                </p>
              </section>
            </div>
          </div>

          <div className="p-4 border-t border-slate-700 bg-slate-900/50 rounded-b-xl text-center">
            <button 
              onClick={() => setIsHelpOpen(false)}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    )
  );

  const renderGenerator = () => (
    <div className="flex flex-col md:flex-row gap-8 h-full overflow-hidden">
      {/* Controls */}
      <div className="w-full md:w-1/3 bg-slate-800/50 p-6 rounded-xl border border-slate-700 backdrop-blur-sm h-full flex flex-col overflow-y-auto">
        <h2 className="text-2xl font-display font-bold mb-6 text-purple-400 border-b border-slate-700 pb-2">
          {t.genTitle}
        </h2>
        
        {/* System Multi-Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-400 mb-2">{t.genSelectSystem}</label>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar bg-slate-900/50 p-2 rounded-lg border border-slate-700">
            {state.systems.map(s => {
                const isSelected = state.selectedSystemIds.includes(s.id);
                return (
                    <button 
                        key={s.id}
                        onClick={() => toggleSystemSelection(s.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isSelected ? 'bg-purple-900/40 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                        <span className="text-sm font-medium">{s.name}</span>
                        {isSelected && <Check size={16} className="text-purple-400" />}
                    </button>
                )
            })}
          </div>
        </div>

        {/* Quantity Selector */}
        <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">{t.genQuantity}</label>
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                {[1, 2, 3, 4].map(num => (
                    <button
                        key={num}
                        onClick={() => setState(s => ({ ...s, generationCount: num }))}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${state.generationCount === num ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {num}
                    </button>
                ))}
            </div>
        </div>

        {/* Action Buttons */}
        {state.selectedSystemIds.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 mt-auto">
            <button 
              onClick={() => generateEvents('Random')}
              className="col-span-2 p-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg font-bold text-white shadow-lg transform transition active:scale-95 flex justify-center items-center gap-2"
            >
              <Dices size={18} /> {t.genRandom}
            </button>
            {EVENT_TYPES.map(type => (
              <button 
                key={type}
                onClick={() => generateEvents(type as EventType)}
                className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors border border-slate-600 truncate"
              >
                {type}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-yellow-200 text-sm mt-auto">
            {t.genNoSystem}
          </div>
        )}
      </div>

      {/* Output Area */}
      <div className={`w-full md:w-2/3 bg-slate-800/20 rounded-xl border border-slate-700/50 overflow-y-auto p-4 custom-scrollbar`}>
        {state.generatedEvents.length > 0 ? (
          <div className={`h-full w-full ${state.generatedEvents.length > 1 ? 'grid grid-cols-1 xl:grid-cols-2 gap-4' : 'flex justify-center items-center'}`}>
            {state.generatedEvents.map((event, index) => (
                <div key={`${event.id}-${index}`} className="flex justify-center">
                    <EventCard 
                        event={event} 
                        settings={state.settings}
                        system={getSystemByName(event.systemTag)}
                        t={t}
                        index={index}
                    />
                </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Dices size={64} className="mb-4 opacity-20" />
            <p className="text-center max-w-xs">Selecione sistemas, escolha a quantidade e clique em gerar para começar sua aventura.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderEditor = () => {
    // 1. First, get all events for the selected system (base list)
    const systemEvents = state.events.filter(e => 
        editorSystemFilter ? e.systemTag.toLowerCase() === editorSystemFilter.toLowerCase() : true
    );

    // 2. Extract unique values for dropdowns based on current system data
    const availableTypes = Array.from(new Set(systemEvents.map(e => e.type)));
    const availableDiffs = Array.from(new Set(systemEvents.map(e => e.difficulty).filter(Boolean)));

    // 3. Apply extra filters
    let filteredEvents = systemEvents.filter(e => {
        const matchesType = editorTypeFilter ? e.type === editorTypeFilter : true;
        const matchesDiff = editorDiffFilter ? e.difficulty === editorDiffFilter : true;
        return matchesType && matchesDiff;
    });

    // 4. Apply Sorting
    if (sortConfig) {
      filteredEvents.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    // Helper for table headers
    const SortableHeader = ({ label, sortKey }: { label: string, sortKey: keyof GameEvent }) => {
        const isActive = sortConfig?.key === sortKey;
        return (
            <th 
                onClick={() => handleSort(sortKey)}
                className="p-4 font-bold text-slate-300 border-b border-slate-700 text-sm uppercase cursor-pointer hover:bg-slate-700/50 transition-colors select-none group"
            >
                <div className="flex items-center gap-2">
                    {label}
                    {isActive ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-purple-400" /> : <ArrowDown size={14} className="text-purple-400" />
                    ) : (
                        <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-30" />
                    )}
                </div>
            </th>
        );
    };

    return (
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-3xl font-display font-bold text-white">{t.editTitle}</h2>
           <button 
              onClick={() => openEditorModal()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 shadow-lg"
           >
              <Plus size={18} /> {t.editNew}
           </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
           {/* System Filter */}
           <div className="flex flex-col gap-1">
             <label className="text-xs text-slate-400 font-medium">{t.editFilterSystem}</label>
             <select 
                value={editorSystemFilter}
                onChange={(e) => {
                    setEditorSystemFilter(e.target.value);
                    setEditorTypeFilter(''); // Reset subs when changing system
                    setEditorDiffFilter('');
                }}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none w-full"
             >
                {state.systems.length === 0 && <option value="">Nenhum sistema</option>}
                {state.systems.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
             </select>
           </div>

           {/* Type Filter */}
           <div className="flex flex-col gap-1">
             <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Filter size={10} /> {t.editFilterType}
             </label>
             <select 
                value={editorTypeFilter}
                onChange={(e) => setEditorTypeFilter(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none w-full"
                disabled={!editorSystemFilter}
             >
                <option value="">{t.editAll}</option>
                {availableTypes.sort().map(type => (
                    <option key={type} value={type}>{type}</option>
                ))}
             </select>
           </div>

           {/* Difficulty Filter */}
           <div className="flex flex-col gap-1">
             <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Filter size={10} /> {t.editFilterDiff}
             </label>
             <select 
                value={editorDiffFilter}
                onChange={(e) => setEditorDiffFilter(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none w-full"
                disabled={!editorSystemFilter}
             >
                <option value="">{t.editAll}</option>
                {availableDiffs.sort().map(diff => (
                    <option key={diff as string} value={diff as string}>{diff}</option>
                ))}
             </select>
           </div>

            {/* Stats */}
           <div className="flex items-end justify-end pb-2">
             <span className="text-xs text-slate-500">
               Mostrando {filteredEvents.length} de {systemEvents.length} eventos
             </span>
           </div>
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 flex-grow overflow-hidden flex flex-col">
           <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-grow">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                    <tr>
                       <SortableHeader label={t.colType} sortKey="type" />
                       <SortableHeader label={t.colDesc} sortKey="description" />
                       <SortableHeader label={t.colDiff} sortKey="difficulty" />
                       <SortableHeader label={t.colReward} sortKey="reward" />
                       <th className="p-4 font-bold text-slate-300 border-b border-slate-700 text-sm uppercase text-right">Ações</th>
                    </tr>
                 </thead>
                 <tbody>
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                          Nenhum evento encontrado com estes filtros.
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map(event => (
                        <tr key={event.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors group">
                           <td className="p-4">
                              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300 border border-slate-600">
                                {event.type}
                              </span>
                           </td>
                           {/* Apply Render Formatter */}
                           <td className="p-4 text-sm text-slate-200">{renderFormattedText(event.description)}</td>
                           <td className="p-4 text-sm text-slate-400">{event.difficulty || '-'}</td>
                           <td className="p-4 text-sm text-yellow-500/80">{event.reward || '-'}</td>
                           <td className="p-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => openEditorModal(event)}
                                className="p-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded transition-colors"
                                title={t.editEdit}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => deleteEvent(event.id)}
                                className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded transition-colors"
                                title={t.editDelete}
                              >
                                <Trash2 size={16} />
                              </button>
                           </td>
                        </tr>
                      ))
                    )}
                 </tbody>
              </table>
           </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                   <h3 className="text-xl font-bold text-white">
                      {editingEvent.id ? t.modalTitleEdit : t.modalTitleAdd}
                   </h3>
                   <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                      <X size={24} />
                   </button>
                </div>
                <form onSubmit={saveEditedEvent} className="p-6 space-y-4">
                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">{t.cardSystem}</label>
                      <select 
                        required
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white"
                        value={editingEvent.systemTag}
                        onChange={(e) => setEditingEvent({ ...editingEvent, systemTag: e.target.value })}
                      >
                         <option value="" disabled>Selecione...</option>
                         {state.systems.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                   </div>

                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">{t.colType}</label>
                      <select 
                        required
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:border-purple-500 transition-colors"
                        value={editingEvent.type}
                        onChange={(e) => setEditingEvent({ ...editingEvent, type: e.target.value })}
                      >
                        {EVENT_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                   </div>

                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">{t.colDesc}</label>
                      <textarea 
                         required
                         rows={3}
                         className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                         value={editingEvent.description}
                         onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                         placeholder="Descreva o evento..."
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">{t.colDiff}</label>
                        <input 
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white"
                            value={editingEvent.difficulty || ''}
                            onChange={(e) => setEditingEvent({ ...editingEvent, difficulty: e.target.value })}
                            placeholder="Ex: Difícil, DL 15"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">{t.colReward}</label>
                        <input 
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white"
                            value={editingEvent.reward || ''}
                            onChange={(e) => setEditingEvent({ ...editingEvent, reward: e.target.value })}
                            placeholder="Ex: 50 Gold, Item"
                        />
                      </div>
                   </div>

                   <div className="pt-4 flex gap-3">
                      <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm"
                      >
                        {t.editCancel}
                      </button>
                      <button 
                        type="submit" 
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-bold text-sm"
                      >
                        {t.editSave}
                      </button>
                   </div>
                </form>
             </div>
          </div>
        )}
      </div>
    );
  };

  const renderBuilder = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-display font-bold mb-8 text-white">{t.buildTitle}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleSystemCreate} className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">{t.buildNameLabel}</label>
            <input 
              name="name" 
              required 
              placeholder="e.g., D&D 5e, Call of Cthulhu"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">{t.buildStatsLabel}</label>
            <input 
              name="stats" 
              placeholder="e.g., HP, Sanity, Gold (Optional)"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
            />
          </div>
          <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-bold flex items-center justify-center gap-2">
            <Save size={18} /> {t.buildSave}
          </button>
        </form>

        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold mb-4 text-slate-300">{t.buildList}</h3>
          <ul className="space-y-3">
            {state.systems.length === 0 && <li className="text-slate-500 italic">No systems created yet.</li>}
            {state.systems.map(s => (
              <li key={s.id} className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-700">
                <div>
                  <span className="font-bold text-slate-200">{s.name}</span>
                  <div className="text-xs text-slate-500 mt-1">
                    {s.stats.length > 0 ? s.stats.join(', ') : 'No custom stats'}
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteSystem(s.id)}
                  className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                  title={t.buildDelete}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderDatabase = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-display font-bold mb-8 text-white">{t.dbTitle}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
            <Download size={48} className="mx-auto text-blue-400 mb-4" />
            <h3 className="font-bold text-lg mb-2">{t.dbStep1Title}</h3>
            <p className="text-slate-400 text-sm mb-4">{t.dbStep1Desc}</p>
            <button 
              onClick={generateTemplate}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium"
            >
              {t.dbDownloadTemplate}
            </button>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center relative group">
            <Upload size={48} className="mx-auto text-green-400 mb-4" />
            <h3 className="font-bold text-lg mb-2">{t.dbStep2Title}</h3>
            <p className="text-slate-400 text-sm mb-4">{t.dbStep2Desc}</p>
            <label className="inline-block cursor-pointer">
              <span className="px-6 py-2 bg-green-700 group-hover:bg-green-600 rounded-lg text-white text-sm font-medium transition-colors">
                {t.dbUpload}
              </span>
              <input type="file" accept=".xlsx, .csv" onChange={handleFileUpload} className="hidden" />
            </label>
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-300">{t.dbStats}</h3>
          <button 
            onClick={() => {
              const input = window.prompt("ATENÇÃO: Isso apagará todos os eventos e sistemas do banco de dados (revertendo para o padrão vazio).\nPara confirmar, digite EXCLUIR:");
              if (input === 'EXCLUIR') {
                setState(s => ({ ...s, events: [], systems: [] }));
                alert("Banco de dados limpo com sucesso.");
              }
            }}
            className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 px-3 py-1 rounded border border-red-900/50 transition-colors"
          >
            {t.dbClear}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 p-4 rounded text-center">
            <span className="block text-2xl font-bold text-white">{state.events.length}</span>
            <span className="text-xs text-slate-500 uppercase">{t.dbTotalEvents}</span>
          </div>
          {/* Dynamic Breakdown by all types */}
          {EVENT_TYPES.map(type => (
             <div key={type} className="bg-slate-800 p-4 rounded text-center">
             <span className="block text-xl font-bold text-slate-300">
               {state.events.filter(e => e.type === type).length}
             </span>
             <span className="text-xs text-slate-500 uppercase">{type}</span>
           </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-display font-bold mb-8 text-white">{t.setTitle}</h2>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <RefreshCw size={18} /> {t.setLanguage}
        </h3>
        <div className="flex gap-2">
          {(['pt-BR', 'en', 'es'] as Language[]).map(lang => (
            <button
              key={lang}
              onClick={() => setState(s => ({ ...s, settings: { ...s.settings, language: lang } }))}
              className={`px-4 py-2 rounded border ${state.settings.language === lang ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="font-bold text-lg mb-4">{t.setTheme}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.setBgColor}</label>
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={state.settings.theme.cardBackground}
                onChange={(e) => setState(s => ({ ...s, settings: { ...s.settings, theme: { ...s.settings.theme, cardBackground: e.target.value } } }))}
                className="h-10 w-10 rounded cursor-pointer bg-transparent"
              />
              <span className="text-xs font-mono">{state.settings.theme.cardBackground}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.setTextColor}</label>
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={state.settings.theme.cardText}
                onChange={(e) => setState(s => ({ ...s, settings: { ...s.settings, theme: { ...s.settings.theme, cardText: e.target.value } } }))}
                className="h-10 w-10 rounded cursor-pointer bg-transparent"
              />
              <span className="text-xs font-mono">{state.settings.theme.cardText}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.setBorderColor}</label>
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={state.settings.theme.cardBorder}
                onChange={(e) => setState(s => ({ ...s, settings: { ...s.settings, theme: { ...s.settings.theme, cardBorder: e.target.value } } }))}
                className="h-10 w-10 rounded cursor-pointer bg-transparent"
              />
              <span className="text-xs font-mono">{state.settings.theme.cardBorder}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.setAccentColor}</label>
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={state.settings.theme.accentColor}
                onChange={(e) => setState(s => ({ ...s, settings: { ...s.settings, theme: { ...s.settings.theme, accentColor: e.target.value } } }))}
                className="h-10 w-10 rounded cursor-pointer bg-transparent"
              />
              <span className="text-xs font-mono">{state.settings.theme.accentColor}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pl-64 transition-all">
      {renderSidebar()}
      
      <main className="p-8 h-screen overflow-y-auto">
        {state.currentView === 'generator' && renderGenerator()}
        {state.currentView === 'builder' && renderBuilder()}
        {state.currentView === 'editor' && renderEditor()}
        {state.currentView === 'database' && renderDatabase()}
        {state.currentView === 'settings' && renderSettings()}
      </main>
      
      {/* Help Modal Overlay */}
      {renderHelpModal()}
    </div>
  );
}