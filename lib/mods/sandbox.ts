import ivm from "isolated-vm";

export const MAX_MOD_CODE_LENGTH = 20_000;
const MAX_OUTPUT_BYTES = 4_096;
const COMPILE_TIMEOUT_MS = 200;
const CALL_TIMEOUT_MS = 100;
const MEMORY_LIMIT_MB = 8;

export type ModValidationResult =
  | { ok: true; output: unknown }
  | { ok: false; error: string };

// A fixture context passed to the mod's applyRule() during validation. Kept
// tiny and hand-written (not live game state) — this step only proves the
// mod runs safely and returns a well-formed value, it does not execute
// against the real world.
const FIXTURE_CONTEXT = {
  tick: 0,
  world: { width: 64, height: 64 },
  self: { x: 0, y: 0 },
};

// Runs untrusted, user-submitted mod code in a real V8 isolate (not Node's
// built-in `vm`, which is not a security boundary, and not vm2, which is
// unmaintained with known sandbox escapes). The isolate shares no memory,
// no `require`, no `process`, and no filesystem/network access with the
// host — the only thing that crosses the boundary is the plain JSON fixture
// context in, and a plain JSON value out, both under strict size limits.
export async function validateModCode(code: string): Promise<ModValidationResult> {
  if (code.length > MAX_MOD_CODE_LENGTH) {
    return { ok: false, error: "mod code exceeds the maximum allowed length" };
  }

  let isolate: ivm.Isolate | undefined;
  try {
    isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
    const context = await isolate.createContext();

    const script = await isolate.compileScript(code, { filename: "mod.js" });
    await script.run(context, { timeout: COMPILE_TIMEOUT_MS });

    const applyRule = await context.global.get("applyRule", { reference: true });
    if (!(applyRule instanceof ivm.Reference) || applyRule.typeof !== "function") {
      return {
        ok: false,
        error: "the mod must define a top-level applyRule(context) function",
      };
    }

    const result = await applyRule.apply(undefined, [FIXTURE_CONTEXT], {
      arguments: { copy: true },
      result: { copy: true },
      timeout: CALL_TIMEOUT_MS,
    });

    const serialized = JSON.stringify(result ?? null);
    if (serialized.length > MAX_OUTPUT_BYTES) {
      return { ok: false, error: "mod return value exceeds the maximum allowed size" };
    }

    return { ok: true, output: JSON.parse(serialized) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `failed to run mod: ${message}` };
  } finally {
    isolate?.dispose();
  }
}
