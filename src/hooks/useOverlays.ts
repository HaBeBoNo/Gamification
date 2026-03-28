import { useState, useCallback } from 'react';

/**
 * useOverlays — centraliserar all overlay/modal-state som tidigare
 * låg spridd i Index.tsx som enskilda useState-anrop.
 *
 * Exponerar stabila callbacks (useCallback) för att förhindra
 * onödiga re-renders i child-komponenter som tar emot dem som props.
 */
export function useOverlays() {
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [reward, setReward] = useState<{ reward: any; tier?: string } | null>(null);
  const [xpAmount, setXpAmount] = useState<number | null>(null);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [sidequestNudge, setSidequestNudge] = useState<any[] | null>(null);

  // Stable trigger callbacks — safe to pass as props without re-renders
  const showLU = useCallback((level: number) => setLevelUp(level), []);
  const showRW = useCallback((rw: any, tier?: string) => setReward({ reward: rw, tier }), []);
  const showXP = useCallback((amount: number) => setXpAmount(amount), []);
  const showSidequestNudge = useCallback((quests: any[]) => setSidequestNudge(quests), []);

  // Clears all overlay state in one call — used by the global closeAll handler
  const closeOverlays = useCallback(() => {
    setLevelUp(null);
    setReward(null);
    setXpAmount(null);
    setRefreshMsg('');
    setSidequestNudge(null);
  }, []);

  return {
    // State values (for JSX rendering)
    levelUp,
    reward,
    xpAmount,
    refreshMsg,
    sidequestNudge,
    // Direct setters (for onClose/onDone inline handlers)
    setLevelUp,
    setReward,
    setXpAmount,
    setRefreshMsg,
    setSidequestNudge,
    // Stable trigger callbacks (safe as props)
    showLU,
    showRW,
    showXP,
    showSidequestNudge,
    // Batch-close all overlays
    closeOverlays,
  };
}
