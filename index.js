
/* Frankenstein -- Automated file splitter/recombiner. */

const fs = require('fs');
const path = require('path');

const filewalk = require('./lib/filewalk.js');
const { GatherStream, SplitStream } = require('./lib/scattergather.js');
const units = require('./lib/units.js');
const { escapeRegexInner, waitgroup } = require('./lib/util.js');

/* Configuration / data file */
class Configuration {

  constructor(path) {
    this.path = path;
    this.data = null;
    this._rawBlocksize = null;
    this._blocksize = null;
    this._saveScheduled = false;
  }

  create() {
    this.data = {dirs: path.resolve(path.dirname(this.path)),
                 blocksize: '16M', expanded: {}};
  }

  load(create = false) {
    try {
      const rawData = fs.readFileSync(this.path, 'utf-8');
      this.data = JSON.parse(rawData);
      return true;
    } catch (e) {
      if (! create || e instanceof SyntaxError || e.code !== 'ENOENT')
        throw e;
      this.create();
      return false;
    }
  }

  save() {
    fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2) + '\n');
  }

  scheduleSave() {
    if (this._saveScheduled) return;
    setTimeout(() => {
      this.save();
      this._saveScheduled = false;
    }, 0);
    this._saveScheduled = true;
  }

  get dirs() {
    if (Array.isArray(this.data.dirs)) {
      return this.data.dirs;
    } else {
      return [this.data.dirs];
    }
  }

  get blocksize() {
    if (this.data.blocksize !== this._rawBlocksize) {
      this._rawBlocksize = this.data.blocksize;
      if (typeof this._rawBlocksize === 'number') {
        this._blocksize = this._rawBlocksize;
      } else {
        this._blocksize = units.parse(this._rawBlocksize);
      }
    }
    return this._blocksize;
  }

}

/* Locate the files among/inside dirs that are larger than blocksize
 *
 * dirs is an array of files or directories; files are checked directly,
 * directories are scanned recursively. blocksize is the minimum size for a
 * file to have to be reported. callback gets called with two arguments for
 * each found file, its path and a a suffix to (directly) append to it to
 * obtain a prefix for use with splitFile() such that no collisions with
 * other files occur; additionally, callback is called with any error that
 * occurs (as a single argument), and a single null argument once all files
 * are handled. */
function locateLargeFiles(dirs, blocksize, callback, verbose = false) {
  const func = verbose ? filewalk.verboseFilewalk : filewalk.filewalk;
  func(dirs, (file, stats) => {
    return stats.isFile() && stats.size > blocksize;
  }, (file, listing) => {
    if (file === null) {
      callback(null);
    } else if (typeof file === 'string') {
      /* The original argument is not necessarily a directory listing */
      if (listing === dirs) {
        try {
          listing = fs.readdirSync(path.dirname(file));
        } catch (e) {
          callback(e);
          return;
        }
      }
      /* Locate a suffix that does not collide with any other files */
      let suffix = '.fr';
      const baseRE = escapeRegexInner(file);
      for (let counter = 1;; suffix = '.fr' + (counter++)) {
        const re = new RegExp('^' + baseRE + escapeRegexInner(suffix) +
                              '\\.[0-9]+$');
        if (! listing.some(re.test, re)) break;
      }
      /* Done */
      callback(file, suffix);
    } else {
      callback(file);
    }
  });
}

/* Partition a single file
 *
 * source is the path of the file to decompose. destPrefix is the
 * prefix of the output files, it gets sequentially increasing integers
 * appended after a dot (.) character. blocksize is the maximal size
 * of an output file (in bytes). callback is invoked with any errors
 * that occur during the process, as well as with a Boolean indicating
 * whether the operation succeeded or not.
 *
 * Upon completion, the source file is unlinked. */
function splitFile(source, destPrefix, blocksize, callback) {
  let counter = 1;
  const finish = (err) => {
    if (err != null) {
      callback(err);
      return callback(false);
    }
    fs.unlink(source, (err) => {
      if (err != null) callback(err);
      callback(true);
    });
  };
  fs.createReadStream(source).pipe(new SplitStream(blocksize, () => {
    return fs.createWriteStream(destPrefix + '.' + (counter++));
  })).on('finish', finish).on('error', finish);
}

/* Undo the partitioning of a single file
 *
 * sourcePrefix is the prefix of the input file (see the destPrefix
 * parameter of splitFile()); dest is the path of the output file; callback
 * gets invoked with any error that occurs during the operation, as well as
 * with a Boolean indicating whether the operation succeeded or not.
 *
 * Upon completion, the source files are unlinked. */
function recombineFile(sourcePrefix, dest, callback) {
  let counter = 1;
  const finish = (err) => {
    if (err != null) {
      callback(err);
      return callback(false);
    }
    const wg = waitgroup(counter - 1, callback);
    for (let i = 1; i < counter; i++) {
      fs.unlink(sourcePrefix + '.' + i, (err) => {
        if (err != null) callback(err);
        wg(true);
      });
    }
  };
  new GatherStream(() => {
    const file = sourcePrefix + '.' + counter;
    try {
      fs.statSync(file);
    } catch (e) {
      if (e.code !== 'ENOENT') callback(e);
      return null;
    }
    counter++;
    return fs.createReadStream(file);
  }).pipe(fs.createWriteStream(dest)).on('finish', finish)
    .on('error', finish);
}

/* Split up files as given by the configuration
 *
 * options is an object which may have a "verbose" property with a truthy
 * value to enable verbose output; or it can be omitted. callback is called
 * with no arguments when done, and with any errors that occur. */
function split(config, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  const maybeFinish = (data) => {
    if (data === null && options.verbose)
      console.log('Done');
    callback(data);
  };
  const toSplit = [];
  locateLargeFiles(config.dirs, config.blocksize, (file, suffix) => {
    if (file === null) {
      if (options.verbose)
        console.log('Splitting files...');
      const wg = waitgroup(toSplit.length, maybeFinish);
      toSplit.forEach((entry) => {
        const file = entry[0], suffix = entry[1];
        splitFile(file, file + suffix, config.blocksize, (res) => {
          if (typeof res === 'boolean') {
            if (res) {
              config.data.expanded[file] = {suffix: suffix};
              config.scheduleSave();
              if (options.verbose)
                console.log(file + ': OK');
            } else {
              if (options.verbose)
                console.log(file + ': FAIL (see error messages above)');
            }
            wg(null);
          } else {
            if (options.verbose) console.error('ERROR:', res);
            callback(res);
          }
        });
      });
      if (toSplit.length === 0) maybeFinish(null);
    } else if (typeof file === 'string') {
      toSplit.push([file, suffix]);
    } else {
      if (options.verbose) console.error('ERROR:', file);
      callback(file);
    }
  }, options.verbose);
}

/* Restore split-up files as given by the configuration
 *
 * See split() for details about the parameters. */
function recombine(config, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (options.verbose)
    console.log('Recombining files...');
  const maybeFinish = (data) => {
    if (data === null && options.verbose)
      console.log('Done');
    callback(data);
  };
  const files = Object.keys(config.data.expanded);
  const wg = waitgroup(files.length, maybeFinish);
  files.forEach((k) => {
    const v = config.data.expanded[k];
    recombineFile(k + v.suffix, k, (res) => {
      if (typeof res === 'boolean') {
        if (res) {
          delete config.data.expanded[k];
          config.scheduleSave();
          if (options.verbose)
            console.log(k + ': OK');
        } else {
          if (options.verbose)
            console.log(k + ': FAIL (see error messages above)');
        }
        wg(null);
      } else {
        if (options.verbose)
          console.log('ERROR:', res);
        callback(res);
      }
    });
  });
  if (files.length === 0) maybeFinish(null);
}

module.exports.Configuration = Configuration;
module.exports.locateLargeFiles = locateLargeFiles;
module.exports.splitFile = splitFile;
module.exports.recombineFile = recombineFile;
module.exports.split = split;
module.exports.recombine = recombine;
