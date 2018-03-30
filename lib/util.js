
/* Miscellaneous utilities */

/* Escape regular expression metacharacters in str */
function escapeRegexInner(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};
}

module.exports.escapeRegexInner = escapeRegexInner;
