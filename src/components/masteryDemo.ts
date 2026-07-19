import type { DemoState } from '../data/demo-store';
import type { SupportLevel } from '../domain/mastery';

export type SupportRequest = 'show' | 'help' | 'break';

export type CanonicalChoiceId = 'return-cart' | 'shelf-now' | 'front-desk';

export type MasterySession = {
  id: string;
  label: string;
  dateLabel: string;
  activity: string;
  supportLevel: string;
  evidence: string;
  status: 'completed' | 'attempted';
};

export type CanonicalChoice = {
  id: CanonicalChoiceId;
  label: string;
  description: string;
  isCanonical: boolean;
};

export type MasteryDemoViewModel = {
  learner: {
    name: string;
    initials: string;
    notice: string;
  };
  learningGoal: string;
  activity: {
    title: string;
    context: string;
    prompt: string;
    attemptLabel: string;
    choices: CanonicalChoice[];
  };
  previousSessions: MasterySession[];
  futureStage: {
    title: string;
    description: string;
  };
};

export const masteryDemo: MasteryDemoViewModel = {
  learner: {
    name: 'Alex M.',
    initials: 'AM',
    notice: 'Synthetic learner for adult evaluator review only'
  },
  learningGoal: 'Complete both observable steps with no more than visual choices.',
  activity: {
    title: 'Library Assistant',
    context: 'A visitor has returned a book at the library desk.',
    prompt: 'What should happen to the returned book first?',
    attemptLabel: 'Session 3 · Current attempt',
    choices: [
      {
        id: 'return-cart',
        label: 'Place it on the return cart',
        description: 'Keep returned books together before they are sorted.',
        isCanonical: true
      },
      {
        id: 'shelf-now',
        label: 'Put it directly on a shelf',
        description: 'Move it to a shelf before checking its location.',
        isCanonical: false
      },
      {
        id: 'front-desk',
        label: 'Leave it at the front desk',
        description: 'Keep it where the visitor returned it.',
        isCanonical: false
      }
    ]
  },
  previousSessions: [
    {
      id: 'session-1',
      label: 'Session 1',
      dateLabel: 'Earlier exploration',
      activity: 'Noticed the main parts of the library return area.',
      supportLevel: 'Show me · visual scene labels',
      evidence: 'Located the return cart when it was named in the scene.',
      status: 'completed'
    },
    {
      id: 'session-2',
      label: 'Session 2',
      dateLabel: 'Previous attempt',
      activity: 'Compared the return cart with the shelf label.',
      supportLevel: 'Help · one guided prompt',
      evidence: 'Explained that returned books are grouped before shelving.',
      status: 'completed'
    }
  ],
  futureStage: {
    title: 'Interview practice',
    description: 'Future phase · not part of this prototype'
  }
};

export function supportLevelLabel(level: SupportLevel): string {
  if (level === 'none') return 'Independent response';
  if (level === 'visual_choice') return 'Visual choices';
  if (level === 'verbal_prompt') return 'One verbal prompt';
  return 'Direct model';
}

/** Maps only synthetic local records into presentation copy. It never derives a
 * learner score or asks a model to interpret the record. */
export function createMasteryDemoView(state: DemoState): MasteryDemoViewModel {
  const learner = state.profiles.find((profile) => profile.role === 'learner')!;
  const goal = state.goals[0];
  const previousSessions = state.sessions.slice(0, 2).map((session, index) => {
    const attempt = state.attempts.find((item) => item.sessionId === session.id);
    return {
      id: session.id,
      label: `Session ${index + 1}`,
      dateLabel: index === 0 ? 'Earlier exploration' : 'Previous attempt',
      activity: session.activityLabel,
      supportLevel: attempt ? supportLevelLabel(attempt.supportLevel) : 'No attempt recorded',
      evidence: attempt?.criterionMet
        ? 'Completed the visible library routine step.'
        : 'A different step was selected; instruction continues.',
      status: 'completed' as const
    };
  });

  return {
    ...masteryDemo,
    learner: { ...masteryDemo.learner, name: learner.displayName },
    learningGoal: goal.observableCriterion,
    previousSessions
  };
}

export function feedbackForChoice(choice: CanonicalChoice): string {
  if (choice.isCanonical) {
    return 'You chose the return cart. That matches the library process: returned books stay together before they are sorted.';
  }

  return `You chose “${choice.label}.” This attempt is recorded. In this library process, the return cart comes first so books can be sorted before shelving.`;
}

export function supportLabel(request: SupportRequest | null): string {
  if (request === 'show') return 'Show me · visual choices';
  if (request === 'help') return 'Help · one guiding prompt';
  if (request === 'break') return 'Break · activity paused into one step';
  return 'Independent view · support available';
}
