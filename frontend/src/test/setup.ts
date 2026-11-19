import '@testing-library/jest-dom/vitest';
import * as matchersDom from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { handlers, reinitialiserDb } from './handlers';

// Vitest 5 : le `expect` global (globals: true) n'est pas la même instance que celui importé
// depuis 'vitest' → on étend aussi le global, sinon toBeInTheDocument() est parfois inconnu.
expect.extend(matchersDom);

// jsdom + fetch avec URL relative : on fixe une origine.
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (input, init) =>
  fetchOriginal(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init);

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => reinitialiserDb());
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
