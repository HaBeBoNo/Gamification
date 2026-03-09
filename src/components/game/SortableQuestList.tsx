import React, { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { S } from '@/state/store';
import SortableQuestCard from './SortableQuestCard';
import QuestCard from './QuestCard';

function getStorageKey(memberId: string) {
  return `hq_quest_order_${memberId}`;
}

function loadOrder(memberId: string): string[] | null {
  try {
    const raw = localStorage.getItem(getStorageKey(memberId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveOrder(memberId: string, order: string[]) {
  localStorage.setItem(getStorageKey(memberId), JSON.stringify(order));
}

function clearOrder(memberId: string) {
  localStorage.removeItem(getStorageKey(memberId));
}

function applyOrder(quests: any[], order: string[] | null): any[] {
  if (!order || order.length === 0) return quests;
  const map = new Map(quests.map(q => [q.id, q]));
  const ordered: any[] = [];
  for (const id of order) {
    const q = map.get(id);
    if (q) { ordered.push(q); map.delete(id); }
  }
  // append any quests not in saved order
  map.forEach(q => ordered.push(q));
  return ordered;
}

interface SortableQuestListProps {
  quests: any[];
  rerender: () => void;
  showLU: (level: number) => void;
  showRW: (reward: any, tier?: string) => void;
  showXP?: (amount: number) => void;
}

export default function SortableQuestList({ quests, rerender, showLU, showRW, showXP }: SortableQuestListProps) {
  const me = S.me || '';
  const [savedToast, setSavedToast] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const hasCustomOrder = !!loadOrder(me);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const [activeId, setActiveId] = useState<string | null>(null);

  // Apply saved order
  const order = loadOrder(me);
  const sortedQuests = applyOrder(quests, order);
  const questIds = sortedQuests.map((q: any) => q.id);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questIds.indexOf(active.id as string);
    const newIndex = questIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    // Build full order: start from current global quest list order
    const allQuests = S.quests || [];
    const currentOrder = loadOrder(me) || allQuests.map((q: any) => q.id);

    // Apply the move within the filtered view to the global order
    const activeQuestId = active.id as string;
    const overQuestId = over.id as string;

    // Remove active from its current position in global order
    const globalOrder = currentOrder.filter((id: string) => id !== activeQuestId);
    // Find where overQuestId is in global order and insert active there
    const overGlobalIdx = globalOrder.indexOf(overQuestId);
    if (overGlobalIdx === -1) return;

    // If moving down (oldIndex < newIndex), insert after; if up, insert before
    const insertIdx = oldIndex < newIndex ? overGlobalIdx + 1 : overGlobalIdx;
    globalOrder.splice(insertIdx, 0, activeQuestId);

    saveOrder(me, globalOrder);

    // Show toast
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1500);

    rerender();
  }, [questIds, me, rerender]);

  const handleReset = useCallback(() => {
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 2000);
      return;
    }
    clearOrder(me);
    setResetConfirm(false);
    rerender();
  }, [resetConfirm, me, rerender]);

  const activeQuest = activeId ? sortedQuests.find((q: any) => q.id === activeId) : null;

  return (
    <div className="sortable-quest-list">
      {hasCustomOrder && (
        <div className="sqlist-reset-row">
          <button className="sqlist-reset-btn" onClick={handleReset}>
            {resetConfirm ? 'Säker?' : 'Återställ ordning'}
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={questIds} strategy={verticalListSortingStrategy}>
          {sortedQuests.map((q: any) => (
            <SortableQuestCard
              key={q.id}
              quest={q}
              rerender={rerender}
              showLU={showLU}
              showRW={showRW}
              showXP={showXP}
              isDragging={activeId === q.id}
              isOtherDragging={activeId !== null && activeId !== q.id}
            />
          ))}
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeQuest ? (
            <div className="drag-overlay-card">
              <QuestCard
                quest={activeQuest}
                rerender={() => {}}
                showLU={() => {}}
                showRW={() => {}}
                showXP={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {savedToast && (
        <div className="sqlist-toast">Ordning sparad</div>
      )}
    </div>
  );
}
