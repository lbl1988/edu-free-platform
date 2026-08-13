export class LightRAGUnavailableError extends Error {
  constructor(message = 'LightRAG service is unavailable') {
    super(message);
    this.name = 'LightRAGUnavailableError';
  }
}

export interface QueryResult {
  answer: string;
  refs?: any[];
}

export interface InsertTaskResult {
  taskId: string;
  status: string;
}

export interface TaskStatusResult {
  status: 'QUEUED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  progress?: number;
  message?: string;
}

export class LightRAGClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl ?? process.env.LIGHTRAG_BASE_URL ?? 'http://127.0.0.1:9621';
    this.apiKey = apiKey ?? process.env.LIGHTRAG_API_KEY ?? '';
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async safeFetch(url: string, options: RequestInit): Promise<Response> {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (e) {
      throw new LightRAGUnavailableError(
        `LightRAG network error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async query(opts: {
    workspaceId: string;
    query: string;
    topK?: number;
    stream?: false;
  }): Promise<QueryResult>;
  async query(opts: {
    workspaceId: string;
    query: string;
    topK?: number;
    stream: true;
  }): Promise<AsyncGenerator<string, void, unknown>>;
  async query(opts: {
    workspaceId: string;
    query: string;
    topK?: number;
    stream?: boolean;
  }): Promise<QueryResult | AsyncGenerator<string, void, unknown>> {
    const { workspaceId, query, topK = 6, stream = false } = opts;
    const url = `${this.baseUrl}/query`;
    const body = {
      workspace: workspaceId,
      query,
      top_k: topK,
      stream,
    };

    const res = await this.safeFetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errMsg = `LightRAG query failed: ${res.status}`;
      try {
        const errData = await res.json();
        if (errData && typeof errData === 'object' && 'message' in errData) {
          errMsg = String((errData as any).message);
        }
      } catch {}
      throw new LightRAGUnavailableError(errMsg);
    }

    if (!stream) {
      let data: any;
      try {
        data = await res.json();
      } catch (e) {
        throw new LightRAGUnavailableError(
          `Failed to parse LightRAG query response: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      const answer = typeof data?.answer === 'string' ? data.answer : '';
      const refs = Array.isArray(data?.refs) ? data.refs : undefined;
      return { answer, refs };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new LightRAGUnavailableError('LightRAG stream response has no body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const self = this;
    return (async function* () {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          let idx: number;
          while ((idx = buffer.indexOf('\ndata:')) !== -1 || (idx = buffer.indexOf('data:')) === 0) {
            if (idx === -1) break;
            const start = idx + (buffer.startsWith('data:') ? 5 : 6);
            const end = buffer.indexOf('\n', start);
            if (end === -1) break;
            const line = buffer.slice(start, end).trim();
            buffer = buffer.slice(end + 1);

            if (!line) continue;
            if (line === '[DONE]') return;

            let content = line;
            try {
              const parsed = JSON.parse(line);
              if (parsed && typeof parsed === 'object') {
                if (typeof parsed.answer === 'string') {
                  content = parsed.answer;
                } else if (typeof parsed.data === 'string') {
                  content = parsed.data;
                } else if (typeof parsed.content === 'string') {
                  content = parsed.content;
                } else if (typeof parsed.delta === 'string') {
                  content = parsed.delta;
                } else {
                  content = JSON.stringify(parsed);
                }
              }
            } catch {}

            yield content;
          }
        }

        if (buffer.trim()) {
          let tail = buffer.trim();
          if (tail.startsWith('data:')) {
            tail = tail.slice(5).trim();
          }
          if (tail && tail !== '[DONE]') {
            try {
              const parsed = JSON.parse(tail);
              if (parsed && typeof parsed === 'object') {
                if (typeof parsed.answer === 'string') tail = parsed.answer;
                else if (typeof parsed.data === 'string') tail = parsed.data;
              }
            } catch {}
            yield tail;
          }
        }
      } catch (e) {
        if (e instanceof LightRAGUnavailableError) throw e;
        throw new LightRAGUnavailableError(
          `LightRAG stream error: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        try { reader.releaseLock(); } catch {}
      }
    })();
  }

  async insertDocument(opts: {
    workspaceId: string;
    objectKey: string;
    docType?: string;
  }): Promise<InsertTaskResult> {
    const { workspaceId, objectKey, docType } = opts;
    const url = `${this.baseUrl}/insert`;
    const body: any = {
      workspace: workspaceId,
      object_key: objectKey,
    };
    if (docType !== undefined) {
      body.doc_type = docType;
    }

    const res = await this.safeFetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errMsg = `LightRAG insert failed: ${res.status}`;
      try {
        const errData = await res.json();
        if (errData && typeof errData === 'object' && 'message' in errData) {
          errMsg = String((errData as any).message);
        }
      } catch {}
      throw new LightRAGUnavailableError(errMsg);
    }

    let data: any;
    try {
      data = await res.json();
    } catch (e) {
      throw new LightRAGUnavailableError(
        `Failed to parse LightRAG insert response: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const taskId =
      (data && typeof data === 'object' && (data.taskId ?? data.task_id ?? data.id)) as
        | string
        | undefined;
    const status =
      (data && typeof data === 'object' && (data.status ?? data.state)) as string | undefined;

    return {
      taskId: taskId ?? '',
      status: status ?? 'QUEUED',
    };
  }

  async getTaskStatus(taskId: string): Promise<TaskStatusResult> {
    const url = `${this.baseUrl}/tasks/${encodeURIComponent(taskId)}`;

    const res = await this.safeFetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { status: 'FAILED', message: 'Task not found' };
      }
      let errMsg = `LightRAG task status failed: ${res.status}`;
      try {
        const errData = await res.json();
        if (errData && typeof errData === 'object' && 'message' in errData) {
          errMsg = String((errData as any).message);
        }
      } catch {}
      throw new LightRAGUnavailableError(errMsg);
    }

    let data: any;
    try {
      data = await res.json();
    } catch (e) {
      throw new LightRAGUnavailableError(
        `Failed to parse LightRAG task status response: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const rawStatus =
      (data && typeof data === 'object' && (data.status ?? data.state)) as string | undefined;
    const normalized = (rawStatus ?? 'QUEUED').toUpperCase();
    const valid: TaskStatusResult['status'][] = ['QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED'];
    const status = valid.includes(normalized as any)
      ? (normalized as TaskStatusResult['status'])
      : ('QUEUED' as const);

    const progress =
      data && typeof data === 'object' && typeof data.progress === 'number' ? data.progress : undefined;
    const message =
      data && typeof data === 'object' && typeof data.message === 'string' ? data.message : undefined;

    return { status, progress, message };
  }
}

export const lightrag = new LightRAGClient();
