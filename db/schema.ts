import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
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

// Compact durable receipts, scoped to an account lifetime. No journal snapshots
// or user notes: replay returns the current journal and this acknowledgement.
export const journalMutations = sqliteTable(
  'journal_mutations',
  {
    owner: text('owner').notNull(),
    epoch: integer('epoch').notNull(),
    id: text('id').notNull(),
    requestHash: text('request_hash').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.epoch, t.id] })],
);

export const deliveryJobs = sqliteTable(
  'delivery_jobs',
  {
    owner: text('owner').notNull(),
    epoch: integer('epoch').notNull(),
    id: text('id').notNull(),
    workoutId: text('workout_id').notNull(),
    version: integer('version').notNull(),
    action: text('action').notNull(),
    providerAthleteId: text('provider_athlete_id').notNull(),
    connectionGeneration: text('connection_generation').notNull(),
    prescriptionHash: text('prescription_hash'),
    status: text('status').notNull(),
    attempts: integer('attempts').notNull().default(0),
    availableAt: text('available_at').notNull(),
    leaseToken: text('lease_token'),
    leaseUntil: text('lease_until'),
    result: text('result'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.epoch, t.id] }),
    uniqueIndex('idx_delivery_job_intent').on(
      t.owner,
      t.epoch,
      t.connectionGeneration,
      t.workoutId,
      t.version,
      t.action,
    ),
    index('idx_delivery_job_due').on(t.owner, t.epoch, t.status, t.availableAt),
  ],
);

// Sandbox only. Provider payloads and card details are deliberately not stored.
export const billingEvents = sqliteTable(
  'billing_events',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id').notNull(),
    type: text('type').notNull(),
    eventCreated: integer('event_created').notNull(),
    payloadHash: text('payload_hash').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: integer('next_attempt_at').notNull().default(0),
    lastError: text('last_error'),
    receivedAt: integer('received_at').notNull(),
    processedAt: integer('processed_at'),
  },
  (t) => [
    index('idx_billing_event_queue').on(
      t.status,
      t.nextAttemptAt,
      t.subscriptionId,
    ),
  ],
);
export const billingSubscriptions = sqliteTable(
  'billing_subscriptions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id'),
    accountEpoch: integer('account_epoch'),
    customerId: text('customer_id'),
    status: text('status').notNull().default('unknown'),
    periodEnd: integer('period_end').notNull().default(0),
    lastEntitledPeriodEnd: integer('last_entitled_period_end')
      .notNull()
      .default(0),
    graceUntil: integer('grace_until').notNull().default(0),
    cancelAtPeriodEnd: integer('cancel_at_period_end').notNull().default(0),
    verifiedAt: integer('verified_at').notNull().default(0),
    lastEventAt: integer('last_event_at').notNull().default(0),
    revision: integer('revision').notNull().default(0),
    leaseToken: text('lease_token'),
    leaseUntil: integer('lease_until').notNull().default(0),
  },
  (t) => [
    index('idx_billing_subscription_account').on(t.accountId, t.accountEpoch),
  ],
);
