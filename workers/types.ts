export interface WorkerTask<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface WorkerResponse<TResult = unknown> {
  ok: boolean;
  result?: TResult;
  error?: string;
}

export function createWorkerPlaceholderMessage(name: string) {
  return `Worker ${name} ainda não implementado. Este ponto existe para futura execução isolada de tarefas pesadas.`;
}