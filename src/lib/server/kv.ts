// Minimal key/value store used by the customer-account feature.
//
// Three backends, picked automatically at runtime in this order:
//
//   1. Netlify Blobs  — used whenever the app runs on Netlify (deployed, or
//      locally under `netlify dev`). This is the real, durable, cross-device
//      store: a customer who signs up on their phone can log in on a laptop
//      and find the same profile, addresses, orders and wishlist.
//   2. Local JSON file (.data/ras-account.json) — used during plain
//      `vite dev`, so you get persistence across restarts without needing
//      Netlify running.
//   3. In-memory Map — last resort (e.g. a read-only filesystem). Data is
//      lost on restart; a warning is logged once.
//
// To move to Postgres/Supabase/Mongo later, replace `createBackend()` below.
// Nothing above this file knows which backend is in use.

export type KvBackend = {
  name: string;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<void>;
};

const MEMORY = new Map<string, string>();
let warnedAboutMemory = false;

function memoryBackend(): KvBackend {
  if (!warnedAboutMemory) {
    warnedAboutMemory = true;
    console.warn(
      "[ras/account] No durable store available — customer accounts are being kept " +
        "in memory and will be lost on restart. Deploy to Netlify (Blobs) or allow " +
        "writes to ./.data to persist them.",
    );
  }
  return {
    name: "memory",
    get: async (key) => MEMORY.get(key) ?? null,
    set: async (key, value) => void MEMORY.set(key, value),
    del: async (key) => void MEMORY.delete(key),
  };
}

async function netlifyBlobsBackend(): Promise<KvBackend | null> {
  // Only attempt this when we're actually inside a Netlify runtime, otherwise
  // getStore() throws for missing site/token credentials.
  const onNetlify =
    typeof process !== "undefined" &&
    Boolean(
      process.env?.NETLIFY || process.env?.NETLIFY_LOCAL || process.env?.NETLIFY_BLOBS_CONTEXT,
    );
  if (!onNetlify) return null;

  try {
    // Indirect specifier so Vite doesn't try to resolve (and fail on) this
    // import at build time when @netlify/blobs isn't installed.
    const specifier = "@netlify/blobs";
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      getStore: (options: { name: string; consistency: string }) => {
        get: (key: string, options: { type: "text" }) => Promise<string | null>;
        set: (key: string, value: string) => Promise<void>;
        delete: (key: string) => Promise<void>;
      };
    };
    const store = mod.getStore({ name: "ras-account", consistency: "strong" });
    return {
      name: "netlify-blobs",
      get: (key) => store.get(key, { type: "text" }),
      set: (key, value) => store.set(key, value),
      del: (key) => store.delete(key),
    };
  } catch (error) {
    console.warn("[ras/account] Netlify Blobs unavailable, falling back to file store.", error);
    return null;
  }
}

async function fileBackend(): Promise<KvBackend | null> {
  try {
    const fs = await import(/* @vite-ignore */ "node:fs/promises");
    const path = await import(/* @vite-ignore */ "node:path");
    const dir = path.resolve(process.cwd(), ".data");
    const file = path.join(dir, "ras-account.json");

    await fs.mkdir(dir, { recursive: true });

    // Serialise writes: read-modify-write on one JSON file is not safe under
    // concurrency, and dev traffic is more than enough to interleave.
    let queue: Promise<unknown> = Promise.resolve();
    const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
      const next = queue.then(fn, fn);
      queue = next.catch(() => undefined);
      return next;
    };

    const readAll = async (): Promise<Record<string, string>> => {
      try {
        return JSON.parse(await fs.readFile(file, "utf8")) as Record<string, string>;
      } catch {
        return {};
      }
    };
    const writeAll = async (data: Record<string, string>) => {
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(tmp, file);
    };

    return {
      name: "file",
      get: (key) => enqueue(async () => (await readAll())[key] ?? null),
      set: (key, value) =>
        enqueue(async () => {
          const data = await readAll();
          data[key] = value;
          await writeAll(data);
        }),
      del: (key) =>
        enqueue(async () => {
          const data = await readAll();
          delete data[key];
          await writeAll(data);
        }),
    };
  } catch {
    return null;
  }
}

let backendPromise: Promise<KvBackend> | undefined;

async function createBackend(): Promise<KvBackend> {
  return (await netlifyBlobsBackend()) ?? (await fileBackend()) ?? memoryBackend();
}

function backend(): Promise<KvBackend> {
  if (!backendPromise) backendPromise = createBackend();
  return backendPromise;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const raw = await (await backend()).get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await (await backend()).set(key, JSON.stringify(value));
}

export async function kvDel(key: string): Promise<void> {
  await (await backend()).del(key);
}
