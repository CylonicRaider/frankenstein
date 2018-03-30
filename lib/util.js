
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

module.exports.escapeRegexInner = escapeRegexInner;
module.exports.waitgroup = waitgroup;
