import "server-only";

import { Agent, request } from "undici";

interface JsonRequestOptions {
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "HEAD";
  body?: string;
  timeoutMs: number;
  verifyTls: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

export class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

export async function requestJson<T>(
  url: URL,
  options: JsonRequestOptions,
): Promise<T> {
  const dispatcher = new Agent({
    connect: {
      rejectUnauthorized: options.verifyTls,
      ca: options.ca,
      cert: options.cert,
      key: options.key,
    },
  });

  try {
    const response = await request(url, {
      method: options.method ?? "GET",
      headers: {
        accept: "application/json",
        ...options.headers,
      },
      body: options.body,
      dispatcher,
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const responseText = await response.body.text();

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new HttpRequestError(
        `Request failed with HTTP ${response.statusCode}`,
        response.statusCode,
      );
    }

    return JSON.parse(responseText) as T;
  } catch (error) {
    if (error instanceof HttpRequestError) {
      throw error;
    }

    throw new HttpRequestError(
      error instanceof Error ? error.message : "Request failed",
    );
  } finally {
    await dispatcher.close();
  }
}
