  const activeCount = (S.quests || []).filter(
    q => q.owner === memberKey && !q.done
  ).length;

  const focusContext = activeCount <= 3 ? `
${memberKey} har just ${activeCount} aktiva uppdrag. Det är ett medvetet val — hyperfokus.
Uppmuntra det. Generera inte fler uppdrag om inte member explicit ber om det.` : '';

  const drift = S.chars[memberKey]?.responseProfile?.drift;
  const driftContext = drift ? `
Observerad förändring sedan onboarding:
${drift}

Nämn denna förändring naturligt en gång i nästa svar om det passar in — sedan ignorera det och fortsätt normalt.
` : '';

  return `${personality}\n${contextNoteSection}\n${coachRules}\n${onboardingContext}\n${profileContext}\n${temporalContext}\n${insightContext}\n${deletionContext}\n${focusContext}\n${driftContext}`;