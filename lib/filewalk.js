
/* Recursively locate entries in a directory whose stat()-s pass a filter */

const fs = require('fs');
const path = require('path');

const DEFAULT_VERBOSE_TEMPLATE = 'Enumerating files... (#f/#s)';

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
          if (p === null) return maybeFinish();
          callback(p);
        });
      });
    });
  });
}

/* Perform the same as filewalk() whilst providing status information on
 * standard error
 *
 * dirs, filter, and callback are passed on to filewalk(); see there for
 * details.
 * template is a template of the status string to display; it should (but
 * does not necessarily have to) contain up to one instance of the substring
 * "#f" (without quotes), which is replaced by the amount of files positively
 * matched ("found"), and up to one instance of the substring "#s", which is
 * replaced with the amount of files scanned. */
function verboseFilewalk(dirs, filter, callback,
                         template = DEFAULT_VERBOSE_TEMPLATE) {
  let found = 0, scanned = 0, pending = false;
  const update = (final) => {
    const output = template.replace('#f', found).replace('#s', scanned);
    process.stderr.write('\r' + output + (final ? '\n' : ' '));
  };
  const scheduleUpdate = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      if (! pending) return;
      pending = false;
      update();
    }, 0);
  };
  filewalk(dirs, (path, stats) => {
    scanned++;
    scheduleUpdate();
    return filter(path, stats);
  }, (data) => {
    if (typeof data === 'string') {
      found++;
      scheduleUpdate();
    } else if (data === null) {
      pending = false;
      update(true);
    }
    callback(data);
  });
}

module.exports.filewalk = filewalk;
module.exports.verboseFilewalk = verboseFilewalk;
