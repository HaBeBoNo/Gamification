import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, Send } from 'lucide-react';

interface Idea {
  id: number;
  text: string;
  ts: string;
  aiNote?: string;
  aiLoading?: boolean;
}

function now() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

export default function IdeasView() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [ideas]);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 80) + 'px';
    }
  }, [input]);

  function addIdea() {
    if (!input.trim()) return;
    const newId = Date.now();
    const newIdea: Idea = { id: newId, text: input.trim(), ts: now(), aiLoading: true };
    setIdeas(p => [...p, newIdea]);
    setInput('');

    // Simulate AI curiosity response
    setTimeout(() => {
      setIdeas(p =>
        p.map(i =>
          i.id === newId
            ? { ...i, aiNote: 'Intressant vinkel — hur kopplar det till er senaste release?', aiLoading: false }
            : i
        )
      );
    }, 1500);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addIdea(); }
  }

  const active = input.trim().length > 0;

  return (
    <div className="ideas-view">
      <div className="ideas-scroll" ref={scrollRef}>
        {ideas.length === 0 && (
          <div className="empty-state">
            <Lightbulb size={48} strokeWidth={1} />
            <div className="empty-text">Vad tänker du på?</div>
          </div>
        )}
        {ideas.map(idea => (
          <div key={idea.id} className="idea-entry">
            <div className="idea-text">{idea.text}</div>
            <div className="idea-ts">{idea.ts}</div>
            {idea.aiLoading && <div className="idea-ai-loading">thinking...</div>}
            {idea.aiNote && !idea.aiLoading && (
              <div className="idea-ai-note">{idea.aiNote}</div>
            )}
            <button className="idea-board-btn">Ta till styrelsen</button>
          </div>
        ))}
      </div>
      <div className="cc-input-bar">
        <textarea
          ref={taRef}
          className="cc-input"
          placeholder="Skriv en idé..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
        />
        <button
          className={`cc-send ${active ? 'active' : ''}`}
          onClick={addIdea}
          disabled={!active}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
