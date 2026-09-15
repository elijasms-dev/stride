import type { ConnectionSummary } from '@/lib/connection-status';
import type { State } from '@/lib/engine';

export type Delivery = {
  workout_id: string;
  version: number;
  status: string;
  message?: string;
};
export type AppData = State & {
  connection: ConnectionSummary | null;
  history: { version: number; label: string; created_at: string }[];
  deliveries: Delivery[];
};
export const empty: AppData = {
  version: 0,
  plan: null,
  updatedAt: null,
  history: [],
  deliveries: [],
  connection: null,
};
