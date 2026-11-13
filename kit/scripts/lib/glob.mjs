// Minimal glob → RegExp, no dependencies. Supports `**` (any path, including
// none), `*` (anything but `/`), `?` (one char but `/`) and `{a,b}` (either).
// Paths are repo-relative with forward slashes.

export function globToRegExp(glob) {
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // `**/` matches zero or more directories; a trailing `**` matches the rest.
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*";
        i += 1;
      }
    } else if (c === "?") {
      re += "[^/]";
      i += 1;
    } else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end < 0) {
        re += "\\{";
        i += 1;
      } else {
        const alts = glob.slice(i + 1, end).split(",").map((a) => globToRegExp(a).source.slice(1, -1));
        re += `(?:${alts.join("|")})`;
        i = end + 1;
      }
    } else {
      re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

/** Does `path` match any of `globs`? */
export function matchesAny(path, globs = []) {
  return globs.some((g) => globToRegExp(g).test(path));
}
