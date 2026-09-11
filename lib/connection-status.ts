/** Public connection metadata only. No keys, provider bodies or journal notes. */
export type ActivityCheck = {
  at: string;
  from: string;
  to: string;
  count: number;
  excluded: number;
  duplicates: number;
};
export type ActivityAttempt = {
  id: string;
  at: string;
  outcome: 'checking' | 'success' | 'failed';
  category?:
    | 'rate-limited'
    | 'authorization'
    | 'connection-changed'
    | 'service-unavailable';
};
export type ConnectionSummary = {
  athlete_name: string;
  connected_at: string;
  provider_athlete_id?: string;
  generation?: string;
  activity_check?: ActivityCheck | null;
  activity_attempt?: ActivityAttempt | null;
  activity_imported_at?: string | null;
  activity_import_count?: number;
};

export type WatchConnectionCheck = {
  checkedAt: string;
  trainingAccess: boolean | null;
  workoutUploads: boolean | null;
  hasUploadFilters: boolean;
  lastUploadAt: string | null;
};
