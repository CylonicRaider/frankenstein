
/* Recursively locate entries in a directory whose stat()-s pass a filter */

const fs = require('fs');
const path = require('path');

/* Locate entries of a directory structure passing filter and report them to
 * callback
 *
 * dirs is an array of paths to start with; if any of them are directories,
 * all their contents are enumerated.
 * filter is a function that takes two arguments, the path of the file (or
 * other filesystem node) in question and an fs.Stats structure corresponding
 * to it, and returns a truthy value if the file should be passed to the
 * caller of filewalk().
 * callback is called with the path of each file that passed filter as an
 * argument, with an Error object if something fails somewhere (processing of
 * other paths continues independently) and with a null argument after all
 * files have been examined. The return value is ignored. */
function filewalk(dirs, filter, callback) {
  let counter = dirs.length;
  const maybeFinish = (data) => {
    if (data != null) callback(data);
    if (--counter === 0) callback(null);
  };
  if (dirs.length == 0) return callback(null);
  dirs.forEach((p) => {
    fs.stat(p, (err, stats) => {
      if (err !== null) return maybeFinish(err);
      if (filter(p, stats)) callback(p);
      if (! stats.isDirectory()) return maybeFinish();
      fs.readdir(p, (err, files) => {
        if (err !== null) return maybeFinish(err);
        filewalk(files.map(f => path.resolve(p, f)), filter, (p) => {
          if (p === null) {
            maybeFinish();
          } else {
            callback(p);
          }
        });
      });
    });
  });
}

module.exports = filewalk;
