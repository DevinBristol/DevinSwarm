export interface RuntimeEvent {
  type: string;
  payload: unknown;
}

export function describeRuntimeEvent(
  event: RuntimeEvent,
): string {
  return `Event[${event.type}]`;
}

