#!/usr/bin/env node

/* Frankenstein -- Automated file splitter/recombiner. */

const fs = require('fs');
const path = require('path');

const minimist = require('minimist');

const frankenstein = require('./index.js');

function usage(code = 2) {
  process.stderr.write('USAGE: frankenstein [-c|--config config] ' +
    '[-b|--block blocksize] [-v|--verbose] ' +
    'help|init|rip|split|stitch|recombine [dir ...]\n');
  if (code !== null) process.exit(code);
}

function help(code = 0) {
  usage(null);
  process.stderr.write(`
-c       : Configuration/state file path; defaults to ".frankenstein".
-b       : Size of blocks files larger than the block size will be split into;
           saved in the configuration file; defaults to 16M.
-v       : Verbose output; not enabled by default.
help     : This help.
init     : Initialize a configuration file with command-line parameters.
rip      : Locate files that are too large and split them into blocks.
split    : Same as rip.
stitch   : Recombine previously-split files (as determined by the
           configuration file) into their original form; using this together
           with a dir argument is an error.
recombine: Same as stitch.
dir      : A directory to scan for large files recursively (or an individual
           file); where applicable, defaults to the directory the
           configuration file is in.
`.substr(1));
  if (code !== null) process.exit(code);
}

function make_config(options, createNew = false) {
  const config = new frankenstein.Configuration(options.config);
  if (createNew) {
    config.create();
  } else {
    config.load(true);
  }
  if (options.blocksize !== undefined)
    config.data.blocksize = options.blocksize;
  if (options.dirs !== undefined)
    config.data.dirs = options.dirs.map(d => path.resolve(d));
  return config;
}

function do_init(options) {
  try {
    fs.statSync(options.config);
    process.stderr.write('ERROR: Refusing to overwrite existing ' +
      'configuration\n');
    return 1;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (options.verbose)
    console.log('Creating configuration...');
  make_config(options, true).save();
  if (options.verbose)
    console.log('Done');
}

function do_split(options) {
  const config = make_config(options);
  let exitCode = 0;
  frankenstein.split(config, {verbose: options.verbose}, (res) => {
    if (res !== null) {
      exitCode = 1;
    } else {
      config.save();
      process.exit(exitCode);
    }
  });
}

function do_recombine(options) {
  if (options.dirs) {
    process.stderr.write('ERROR: stitch ignores command-line ' +
      'directories\n');
    return 1;
  }
  const config = make_config(options);
  let exitCode = 0;
  frankenstein.recombine(config, {verbose: options.verbose}, (res) => {
    if (res !== null) {
      exitCode = 1;
    } else {
      config.save();
      process.exit(exitCode);
    }
  });
}

function main() {
  const values = minimist(process.argv.slice(2));
  if (values.help) return help();
  if (values._.length == 0)
    return usage(0);
  const options = {
    config: values.config || values.c || '.frankenstein',
    blocksize: values.block || values.b || undefined,
    dirs: (values._.length > 1) ? values._.slice(1) : undefined,
    verbose: values.verbose || values.v || false
  };
  const command = values._[0];
  switch (command) {
    case 'help':
      help();
      break;
    case 'init':
      do_init(options);
      break;
    case 'rip': case 'split':
      do_split(options);
      break;
    case 'stitch': case 'recombine':
      do_recombine(options);
      break;
    default:
      usage();
      break;
  }
}

if (require.main === module) main();
