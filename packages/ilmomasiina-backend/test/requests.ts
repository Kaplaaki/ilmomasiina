import { FastifyInstance } from "fastify";

/** Handles server errors from injected requests. */
// eslint-disable-next-line import/prefer-default-export
export function handleTestResponse<R>(response: Awaited<ReturnType<FastifyInstance["inject"]>>) {
  if (response.statusCode >= 500) {
    throw new Error(`Request failed with status ${response.statusCode}: ${response.payload}`);
  }
  return [response.json<R>(), response] as const;
}
