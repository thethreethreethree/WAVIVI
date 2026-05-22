/**
 * Request a downsized version of a remote photo where the host supports it.
 *
 * Most of our place photos come from Google (`*.googleusercontent.com`), whose
 * URLs accept a trailing size directive (`=w800`). Without it the browser
 * downloads the full-resolution original — often several MB — for a thumbnail
 * or cover that's at most a few hundred pixels wide. Appending the directive
 * lets Google serve a right-sized image, which is the single biggest win for
 * list/detail load times.
 *
 * Hosts we don't recognise are returned untouched.
 */
export function photoThumb(src: string, width = 800): string {
  try {
    const u = new URL(src);
    if (u.hostname.endsWith("googleusercontent.com")) {
      // The size directive is a path suffix after `=`; replace any existing
      // one (e.g. `=s1600`, `=w1920-h1080`) with our target width.
      return `${src.split("=")[0]}=w${width}`;
    }
    return src;
  } catch {
    return src;
  }
}
