export class QlooContextError extends Error {
  constructor() { super('Qloo rejected this recommendation context. No evidence was invented; review the book match.'); this.name = 'QlooContextError'; }
}
