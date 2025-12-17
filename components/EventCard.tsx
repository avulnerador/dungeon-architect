import React from 'react';
import { GameEvent, AppSettings, GameSystem } from '../types';
import { Skull, Sword, ShoppingBag, BedDouble, AlertTriangle, Gem, HelpCircle, Map, Crown } from 'lucide-react';
import { toPng } from 'html-to-image';

interface EventCardProps {
  event: GameEvent;
  settings: AppSettings;
  system: GameSystem | undefined;
  t: Record<string, string>;
  index?: number; // Para gerar IDs únicos quando houver múltiplos cartões
}

export const EventCard: React.FC<EventCardProps> = ({ event, settings, system, t, index = 0 }) => {
  
  const elementId = `event-card-capture-${index}`;

  const getIcon = () => {
    const type = event.type.toLowerCase().trim();
    
    // Logic handles both English (Legacy) and Portuguese (New Default)
    if (type === 'combat' || type === 'combate') return <Sword size={48} />;
    if (type === 'elite' || type === 'boss') return <Skull size={48} />;
    if (type === 'shop' || type === 'loja' || type === 'mercador') return <ShoppingBag size={48} />;
    if (type === 'rest' || type === 'descanso' || type === 'acampamento') return <BedDouble size={48} />;
    if (type === 'trap' || type === 'armadilha') return <AlertTriangle size={48} />;
    if (type === 'treasure' || type === 'tesouro') return <Gem size={48} />;
    if (type === 'event' || type === 'evento') return <Map size={48} />;
    
    return <HelpCircle size={48} />;
  };

  const exportImage = async () => {
    const element = document.getElementById(elementId);
    if (!element) return;

    let styleTag: HTMLStyleElement | null = null;

    try {
        // 1. Fetch manual do CSS da fonte para evitar erro de CORS ao acessar o <link>
        const fontUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Cinzel:wght@600;800&display=swap';
        let fontCss = '';
        try {
            const res = await fetch(fontUrl);
            fontCss = await res.text();
        } catch (e) {
            console.warn("Falha ao baixar fontes para exportação, usando fallback.", e);
        }

        // 2. Injetar o CSS da fonte em uma tag <style> local dentro do elemento
        // Isso permite que o html-to-image leia os estilos sem violar segurança
        if (fontCss) {
            styleTag = document.createElement('style');
            styleTag.textContent = fontCss;
            element.appendChild(styleTag);
        }

        // 3. Gerar a imagem
        const dataUrl = await toPng(element, { 
            cacheBust: true, 
            pixelRatio: 3, // Alta resolução (3x)
            quality: 1.0,
            backgroundColor: 'transparent',
            skipFonts: true, // SILENCIA O ERRO: Impede a lib de tentar ler stylesheets externos protegidos
            filter: (node) => {
                // IGNORA tags <link> para evitar tentativas de acesso a CSS externo
                if (node.tagName === 'LINK') {
                    return false;
                }
                return true;
            }
        });
        
        const link = document.createElement('a');
        link.download = `event-${system?.name || 'card'}-${event.id}.png`;
        link.href = dataUrl;
        link.click();
    } catch (error) {
        console.error("Erro ao exportar imagem:", error);
        alert("Erro ao gerar imagem. Verifique o console para detalhes.");
    } finally {
        // Limpar a tag de estilo injetada
        if (styleTag && element.contains(styleTag)) {
            element.removeChild(styleTag);
        }
    }
  };

  // Função para parsear o texto e aplicar negrito onde houver **
  const renderFormattedDescription = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <span 
            key={i} 
            className="font-bold brightness-125"
            style={{ color: settings.theme.accentColor }} 
          >
            {part.slice(2, -2)}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full justify-center">
      <div 
        id={elementId}
        className="w-full max-w-[400px] min-h-[500px] p-6 rounded-xl shadow-2xl flex flex-col relative overflow-hidden border-2 transition-all duration-300 bg-clip-padding"
        style={{
          backgroundColor: settings.theme.cardBackground,
          color: settings.theme.cardText,
          borderColor: settings.theme.cardBorder,
        }}
      >
        {/* Decorative Background Elements */}
        <div 
          className="absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-2xl pointer-events-none"
          style={{ 
              backgroundColor: settings.theme.accentColor,
              marginRight: '-20px',
              marginTop: '-20px'
          }} 
        />
        <div 
          className="absolute bottom-0 left-0 w-40 h-40 opacity-10 rounded-full blur-3xl pointer-events-none"
          style={{ 
              backgroundColor: settings.theme.accentColor,
              marginLeft: '-30px',
              marginBottom: '-30px'
          }} 
        />

        {/* Header */}
        <div className="flex justify-between items-start w-full mb-6 border-b border-white/10 pb-4 z-10 relative">
            <span className="font-display font-bold text-sm tracking-widest uppercase opacity-80 truncate max-w-[65%] mt-1">
              {system?.name || event.systemTag}
            </span>
            <div 
              className="flex items-center justify-center px-3 py-1 rounded border border-white/20"
              style={{ color: settings.theme.accentColor, borderColor: settings.theme.accentColor }}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider leading-none">
                {event.type}
              </span>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-grow flex flex-col items-center justify-center text-center gap-6 z-10 relative">
          <div 
            className="p-6 rounded-full bg-white/5 border border-white/10 shadow-inner mb-2 flex items-center justify-center"
            style={{ color: settings.theme.accentColor }}
          >
            {getIcon()}
          </div>
          
          <p className="font-sans text-lg leading-relaxed font-medium">
            {renderFormattedDescription(event.description)}
          </p>
        </div>

        {/* Footer / Stats */}
        <div className="w-full mt-8 grid grid-cols-2 gap-4 text-sm z-10 relative">
          {event.difficulty && (
            <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex flex-col justify-center">
              <span className="block text-[10px] uppercase opacity-50 mb-1 leading-none">{t.cardDifficulty}</span>
              <span className="font-bold font-display tracking-wider text-red-400 text-xs">{event.difficulty}</span>
            </div>
          )}
          {event.reward && (
            <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex flex-col justify-center">
               <span className="block text-[10px] uppercase opacity-50 mb-1 leading-none">{t.cardReward}</span>
               <span className="font-bold text-yellow-400 text-xs leading-tight">{event.reward}</span>
            </div>
          )}
        </div>
        
        {/* System Specific Stats */}
        {system && system.stats.length > 0 && (
            <div className="w-full mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2 justify-center z-10 relative">
                {system.stats.map(stat => (
                    <span key={stat} className="text-[10px] px-2 py-1 bg-white/10 rounded-full opacity-70 leading-none">
                        {stat}
                    </span>
                ))}
            </div>
        )}
      </div>

      <button 
        onClick={exportImage}
        className="px-4 py-2 bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 transition-colors shadow-lg text-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        {t.cardExport}
      </button>
    </div>
  );
};