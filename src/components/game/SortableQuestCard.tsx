import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import QuestCard from './QuestCard';

interface SortableQuestCardProps {
  quest: any;
  rerender: () => void;
  showLU: (level: number) => void;
  showRW: (reward: any, tier?: string) => void;
  showXP?: (amount: number) => void;
  isDragging: boolean;
  isOtherDragging: boolean;
}

export default function SortableQuestCard({
  quest,
  rerender,
  showLU,
  showRW,
  showXP,
  isDragging,
  isOtherDragging,
}: SortableQuestCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isOver,
  } = useSortable({ id: quest.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : isOtherDragging ? 0.7 : 1,
    position: 'relative' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-quest-wrapper ${isOver ? 'drop-target' : ''}`}
      {...attributes}
    >
      <button
        className="drag-handle"
        {...listeners}
        aria-label="Dra för att ändra ordning"
      >
        <GripVertical size={16} />
      </button>
      <QuestCard
        quest={quest}
        rerender={rerender}
        showLU={showLU}
        showRW={showRW}
        showXP={showXP}
      />
    </div>
  );
}
