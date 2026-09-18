import type { Plan, Workout } from '@/lib/engine';

export type Props = {
  plan: Plan;
  today: string;
  onWorkout: (workout: Workout) => void;
  onDay: (date: string) => void;
  onAdjust: () => void;
  onNew: () => void;
  onVariety: () => void;
  selected: number;
  onSelect: (week: number) => void;
  isDemo: boolean;
  initialView?: 'week' | 'full';
};
