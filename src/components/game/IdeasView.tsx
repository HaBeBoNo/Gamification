import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lightbulb, Send, Sparkles, ArrowRight, Users, Target } from 'lucide-react';
import { S, save, useGameStore } from '@/state/store';
import { callClaude } from '@/lib/claudeApi';
import type { IdeaEntry } from '@/types/game';

interface IdeasViewProps {
  onOpenCoach?: (initialMessage?: string) => void;
  onNavigate?: (tab: string) => void;
}

function formatIdeaStamp(ts: number): string {
  return new Date(ts).toLocaleString('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIdeaStatusLabel(status: IdeaEntry['status']): string {
  switch (status) {
    case 'captured':
      return 'Fångad';
    case 'shaping':
      return 'I rörelse';
    case 'shared':
      return 'Delad';
    case 'activated':
      return 'Aktiverad';
    default:
      return 'Idé';
  }
}

function buildIdeaPrompt(ideaText: string): string {
  return [
    'Du är en kreativ men konkret bandcoach.',
    'Nedan finns en rå idé från en medlem i ett band.',
    'Svara med exakt en kort svensk reflektion på högst 18 ord.',
    'Reflektionen ska antingen hjälpa idén att bli tydligare eller ställa en skarp följdfråga.',
    'Undvik listor, emojis och fluff.',
    `Idé: ${ideaText}`,
  ].join('\n');
}

function truncateIdea(text: string, maxLength = 80): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function getIdeas(): IdeaEntry[] {
  if (!S.me) return [];
  const char = S.chars[S.me];
  return Array.isArray(char?.ideaInbox) ? [...char.ideaInbox] : [];
}

function setIdeas(nextIdeas: IdeaEntry[]) {
  if (!S.me) return;
  S.chars[S.me].ideaInbox = nextIdeas;
  save();
}

export default function IdeasView({ onOpenCoach, onNavigate }: IdeasViewProps) {
  useGameStore((state) => state.tick);
  const [ideas, setIdeasState] = useState<IdeaEntry[]>(() => getIdeas());
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIdeasState(getIdeas());
  }, [S.me, S.chars[S.me || '']?.ideaInbox?.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [ideas]);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 110) + 'px';
    }
  }, [input]);

  const groupedIdeas = useMemo(() => {
    const sorted = [...ideas].sort((left, right) => right.createdAt - left.createdAt);
    const shaping = sorted.filter((idea) => idea.status === 'shaping' || idea.status === 'captured');
    const activated = sorted.filter((idea) => idea.status === 'activated');
    const shared = sorted.filter((idea) => idea.status === 'shared');
    return { shaping, activated, shared };
  }, [ideas]);

  function updateIdeas(updater: (prev: IdeaEntry[]) => IdeaEntry[]) {
    setIdeasState((prev) => {
      const next = updater(prev);
      setIdeas(next);
      return next;
    });
  }

  async function enrichIdea(newIdeaId: number, text: string) {
    try {
      const aiNote = (await callClaude(buildIdeaPrompt(text), 120)).trim();
      updateIdeas((prev) =>
        prev.map((idea) =>
          idea.id === newIdeaId
            ? { ...idea, aiLoading: false, aiNote: aiNote || 'Vad i den här idén är mest levande just nu?', status: 'shaping' }
            : idea
        )
      );
    } catch {
      updateIdeas((prev) =>
        prev.map((idea) =>
          idea.id === newIdeaId
            ? { ...idea, aiLoading: false, aiNote: 'Vilken del av idén känns mest värd att pröva först?', status: 'shaping' }
            : idea
        )
      );
    }
  }

  async function addIdea() {
    if (!input.trim() || !S.me || submitting) return;
    setSubmitting(true);

    const newIdeaId = Date.now();
    const newIdea: IdeaEntry = {
      id: newIdeaId,
      text: input.trim(),
      createdAt: Date.now(),
      status: 'captured',
      aiLoading: true,
    };

    updateIdeas((prev) => [...prev, newIdea]);
    const currentInput = input.trim();
    setInput('');
    setSubmitting(false);
    void enrichIdea(newIdeaId, currentInput);
  }

  function handleSendToCoach(idea: IdeaEntry) {
    const prompt = [
      `Jag har en idé: "${idea.text}"`,
      idea.aiNote ? `Din första läsning var: "${idea.aiNote}"` : '',
      'Hjälp mig avgöra om detta ska bli ett uppdrag, ett experiment eller få vila lite.',
    ].filter(Boolean).join('\n\n');

    onOpenCoach?.(prompt);
  }

  function handleCreateQuest(idea: IdeaEntry) {
    if (!S.me) return;

    const nextQuestId = Math.max(400, ...S.quests.map((quest) => Number(quest.id) || 0)) + 1;
    const newQuest = {
      id: nextQuestId,
      owner: S.me,
      title: truncateIdea(idea.text, 56),
      desc: idea.aiNote
        ? `${idea.text}\n\nCoachens första reflektion:\n${idea.aiNote}`
        : idea.text,
      cat: 'creative',
      xp: 45,
      stars: '',
      region: '🌐 Personal',
      recur: 'none' as const,
      type: 'idea',
      done: false,
      aiVerdict: null,
      personal: true,
      createdAt: Date.now(),
      motivation: 'Fångad från Idéer',
    };

    S.quests.push(newQuest);
    S.feed.unshift({
      id: `idea-quest-${idea.id}-${Date.now()}`,
      syncId: `idea-quest-${idea.id}-${Date.now()}`,
      who: S.me,
      action: `gjorde en idé till uppdrag: "${truncateIdea(idea.text, 48)}"`,
      created_at: new Date().toISOString(),
      ts: new Date().toISOString(),
      category: 'idea',
      metadata: { ideaId: idea.id, questId: nextQuestId },
    });

    updateIdeas((prev) =>
      prev.map((entry) =>
        entry.id === idea.id
          ? { ...entry, status: 'activated', questId: nextQuestId, aiLoading: false }
          : entry
      )
    );

    onNavigate?.('quests');
  }

  function handleShareToBand(idea: IdeaEntry) {
    if (!S.me) return;
    const nowIso = new Date().toISOString();
    S.feed.unshift({
      id: `idea-share-${idea.id}-${Date.now()}`,
      syncId: `idea-share-${idea.id}-${Date.now()}`,
      who: S.me,
      action: `delade en idé: "${truncateIdea(idea.text, 52)}" 💡`,
      created_at: nowIso,
      ts: nowIso,
      category: 'idea',
      metadata: { ideaId: idea.id, fullText: idea.text },
    });

    updateIdeas((prev) =>
      prev.map((entry) =>
        entry.id === idea.id
          ? { ...entry, status: 'shared', sharedAt: Date.now(), aiLoading: false }
          : entry
      )
    );
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void addIdea();
    }
  }

  const active = input.trim().length > 0;
  const totalIdeas = ideas.length;

  return (
    <div className="ideas-view">
      <div className="ideas-scroll" ref={scrollRef}>
        <div className="ideas-hero">
          <div className="ideas-hero-eyebrow">Idéer</div>
          <div className="ideas-hero-title">Fånga något innan det försvinner</div>
          <div className="ideas-hero-subtitle">
            Den här ytan ska hjälpa en lös tanke att bli tydligare, inte tvinga den att vara färdig.
          </div>
          <div className="ideas-hero-stats">
            <div className="ideas-stat-chip">
              <Sparkles size={14} />
              {groupedIdeas.shaping.length} i rörelse
            </div>
            <div className="ideas-stat-chip">
              <Target size={14} />
              {groupedIdeas.activated.length} blev uppdrag
            </div>
            <div className="ideas-stat-chip">
              <Users size={14} />
              {groupedIdeas.shared.length} delade med bandet
            </div>
          </div>
        </div>

        {totalIdeas === 0 && (
          <div className="empty-state">
            <Lightbulb size={48} strokeWidth={1} />
            <div className="empty-text">Vad bubblar just nu?</div>
          </div>
        )}

        {groupedIdeas.shaping.length > 0 && (
          <section className="ideas-section">
            <div className="ideas-section-title">I rörelse</div>
            <div className="ideas-section-subtitle">Tankar som fortfarande formas</div>
            <div className="ideas-list">
              {groupedIdeas.shaping.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onOpenCoach={() => handleSendToCoach(idea)}
                  onCreateQuest={() => handleCreateQuest(idea)}
                  onShare={() => handleShareToBand(idea)}
                />
              ))}
            </div>
          </section>
        )}

        {groupedIdeas.activated.length > 0 && (
          <section className="ideas-section">
            <div className="ideas-section-title">Blev handling</div>
            <div className="ideas-section-subtitle">Idéer som redan rör sig som uppdrag</div>
            <div className="ideas-list">
              {groupedIdeas.activated.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onOpenCoach={() => handleSendToCoach(idea)}
                  onCreateQuest={() => onNavigate?.('quests')}
                  onShare={() => handleShareToBand(idea)}
                />
              ))}
            </div>
          </section>
        )}

        {groupedIdeas.shared.length > 0 && (
          <section className="ideas-section">
            <div className="ideas-section-title">Delade</div>
            <div className="ideas-section-subtitle">Frön som redan lagts ut i bandets gemensamma rum</div>
            <div className="ideas-list">
              {groupedIdeas.shared.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onOpenCoach={() => handleSendToCoach(idea)}
                  onCreateQuest={() => handleCreateQuest(idea)}
                  onShare={() => handleShareToBand(idea)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="ideas-input-wrap">
        <div className="ideas-input-label">Ny tanke</div>
        <div className="cc-input-bar">
          <textarea
            ref={taRef}
            className="cc-input"
            placeholder="Skriv något som känns värt att fånga..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
          />
          <button
            className={`cc-send ${active ? 'active' : ''}`}
            onClick={() => void addIdea()}
            disabled={!active || submitting}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  onOpenCoach,
  onCreateQuest,
  onShare,
}: {
  idea: IdeaEntry;
  onOpenCoach: () => void;
  onCreateQuest: () => void;
  onShare: () => void;
}) {
  return (
    <div className={`idea-entry ${idea.status}`}>
      <div className="idea-entry-top">
        <span className={`idea-status-pill ${idea.status}`}>{getIdeaStatusLabel(idea.status)}</span>
        <span className="idea-ts">{formatIdeaStamp(idea.createdAt)}</span>
      </div>
      <div className="idea-text">{idea.text}</div>
      {idea.aiLoading && <div className="idea-ai-loading">Coachen tänker…</div>}
      {idea.aiNote && !idea.aiLoading && (
        <div className="idea-ai-note">{idea.aiNote}</div>
      )}
      <div className="idea-actions">
        <button className="idea-board-btn" onClick={onOpenCoach}>
          <Sparkles size={14} />
          Coachen
        </button>
        <button className="idea-board-btn" onClick={onCreateQuest}>
          <Target size={14} />
          {idea.status === 'activated' ? 'Öppna uppdrag' : 'Gör uppdrag'}
        </button>
        <button className="idea-board-btn" onClick={onShare}>
          <Users size={14} />
          {idea.status === 'shared' ? 'Dela igen' : 'Dela med bandet'}
        </button>
      </div>
      {idea.questId ? (
        <div className="idea-next-step">
          Ett uppdrag finns nu kopplat till idén.
          <ArrowRight size={14} />
        </div>
      ) : null}
    </div>
  );
}
