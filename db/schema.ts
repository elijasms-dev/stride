import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
export const athleteState = sqliteTable('athlete_state', {
  owner: text('owner').primaryKey(),
  version: integer('version').notNull(),
  data: text('data').notNull(),
  writeToken: text('write_token').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
});
export const revisions = sqliteTable(
  'revisions',
  {
    owner: text('owner').notNull(),
    version: integer('version').notNull(),
    data: text('data').notNull(),
    label: text('label').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.version] })],
);
export const connections = sqliteTable('connections', {
  owner: text('owner').primaryKey(),
  encryptedKey: text('encrypted_key').notNull(),
  athleteName: text('athlete_name').notNull(),
  providerAthleteId: text('provider_athlete_id')
    .notNull()
    .default('__legacy__'),
  generation: text('generation').notNull().default('__legacy__'),
  connectedAt: text('connected_at').notNull(),
  activityCheck: text('activity_check'),
  activityAttempt: text('activity_attempt'),
  activityImportedAt: text('activity_imported_at'),
  activityImportCount: integer('activity_import_count').notNull().default(0),
});
export const deliveries = sqliteTable(
  'deliveries',
  {
    owner: text('owner').notNull(),
    workoutId: text('workout_id').notNull(),
    providerAthleteId: text('provider_athlete_id')
      .notNull()
      .default('__legacy__'),
    connectionGeneration: text('connection_generation'),
    attemptId: text('attempt_id'),
    createOutcome: text('create_outcome').notNull().default('unknown'),
    attemptedStartLocal: text('attempted_start_local'),
    prescriptionHash: text('prescription_hash'),
    version: integer('version').notNull(),
    remoteId: text('remote_id'),
    status: text('status').notNull(),
    message: text('message'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.providerAthleteId, t.workoutId] }),
    index('idx_delivery_owner_status').on(t.owner, t.status),
  ],
);

export const profiles = sqliteTable('profiles', {
  owner: text('owner').primaryKey(),
  displayName: text('display_name').notNull(),
  city: text('city').notNull(),
  units: text('units').notNull(),
  timezone: text('timezone').notNull(),
  accent: text('accent').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const accounts = sqliteTable('accounts', {
  owner: text('owner').primaryKey(),
  accountId: text('account_id').notNull().unique(),
  epoch: integer('epoch').notNull().default(0),
  revision: integer('revision').notNull().default(0),
  status: text('status').notNull().default('active'),
  operationId: text('operation_id'),
  createdAt: text('created_at').notNull(),
});
export const recoveryOperations = sqliteTable(
  'recovery_operations',
  {
    owner: text('owner').notNull(),
    id: text('id').notNull(),
    kind: text('kind').notNull(),
    digest: text('digest').notNull(),
    epoch: integer('epoch').notNull(),
    revision: integer('revision').notNull(),
    expiresAt: text('expires_at').notNull(),
    status: text('status').notNull().default('preview'),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);

export const requestLimits = sqliteTable(
  'request_limits',
  {
    owner: text('owner').notNull(),
    bucket: text('bucket').notNull(),
    count: integer('count').notNull().default(0),
    resetAt: integer('reset_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.bucket] })],
);

// Runs can be recorded before a training block exists. Activation transfers them atomically.
export const standaloneRuns = sqliteTable(
  'standalone_runs',
  {
    owner: text('owner').notNull(),
    id: text('id').notNull(),
    data: text('data').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
