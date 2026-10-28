// Tests always use disposable local storage, including inside Netlify builds.
import { randomUUID } from 'node:crypto';
import path from 'node:path';
process.env.FOLIOECHO_HOSTED='0';
process.env.FOLIOECHO_DATA_DIR=path.resolve('.folioecho','tests',randomUUID());
