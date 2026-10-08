// Recovery bridge for the local integration runner. The preserved bundle was
// made from the last working import runtime; it is never loaded by the public
// application or Worker build. The original modules are restored separately.
// @ts-nocheck
export * from "../_recovery/live-import-runtime.mjs";
