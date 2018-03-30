
/* Miscellaneous utilities */

/* Escape regular expression metacharacters in str */
function escapeRegexInner(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* Call callback once the returned function has been called counter times
 *
 * The return value is a closure that decrements counter, and, when it
 * reaches zero, calls callback with any arguments the closure is given.
 * The return has an additional method, add(), that can be used to increase
 * the counter after the fact.
 *
 * Example:
 * > let wg = waitgroup(3, () => console.log('Callback called'));
 * ...
 * > wg()
 * > wg()
 * > wg()
 * Callback called
 * > wg = waitgroup(0, () => console.log('Callback called'));
 * ...
 * > wg.add(2);
 * > wg()
 * > wg()
 * Callback called
 * >
 */
function waitgroup(counter, callback) {
  const ret = function waitgroupCallback() {
    if (--counter > 0) return;
    callback.apply(this, arguments);
  };
  ret.add = (n) => {
    counter += n;
  };
  return ret;
}

/* Show a progress display for some process
 *
 * template is a template for progress lines; the substrings #c and #l in it
 * are replaced with the values of the counter and the limit, respectively.
 * The return value is a closure that takes three parameters, counter, limit,
 * and final; counter is the current progress, limit is how far the process
 * will go, final indicates whether a line break should be appended to the
 * progress report.
 * If template is null or undefined, no progress display is made at all, but
 * the return value is still a valid function. */
function progress(template) {
  return function progressDisplay(counter, limit, final) {
    if (template == null) return;
    const output = template.replace(/#c/g, counter).replace(/#l/g, limit);
    process.stderr.write('\r' + output + (final ? '\n' : ' '));
  };
}

module.exports.escapeRegexInner = escapeRegexInner;
module.exports.waitgroup = waitgroup;
module.exports.progress = progress;
