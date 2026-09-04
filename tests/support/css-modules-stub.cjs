/**
 * Lets the renderer tests import the CSS Module the way the bundler does.
 *
 * `tsx` runs these tests through Node's CommonJS loader, which has no idea what
 * a `.css` file is, so register a handler for it. Class names come back as the
 * identity mapping (`styles["lay-split"]` -> `"lay-split"`), which is exactly
 * what a test wants: assertions read as the composition choices the spec made,
 * rather than as build hashes.
 *
 *   node --require ./tests/support/css-modules-stub.cjs --import tsx <test>
 */
const IDENTITY = new Proxy(
  {},
  {
    get(_target, key) {
      // Interop markers must stay absent, or the default import resolves to the
      // string "default" instead of the class map.
      if (typeof key !== "string") return undefined;
      if (key === "__esModule" || key === "default" || key === "then") return undefined;
      return key;
    }
  }
);

require.extensions[".css"] = (module) => {
  module.exports = IDENTITY;
};
