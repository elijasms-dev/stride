/** Plan errors responsibilities; extracted without changing policy or behavior. */

export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanError';
  }
}
