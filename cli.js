#!/usr/bin/env node

/* Frankenstein -- Automated file splitter/recombiner. */

const fs = require('fs');
const path = require('path');

const minimist = require('minimist');

const frankenstein = require('./index.js');

function usage(code = 2) {
  process.stderr.write('USAGE: frankenstein [-c|--config config] ' +
    '[-b|--block blocksize] [-v|--verbose] init|rip|stitch [dir ...]\n');
  process.exit(code);
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
  make_config(options, true).save();
}

function do_split(options) {
  const config = make_config(options);
  frankenstein.split(config, {verbose: options.verbose}, (res) => {
    if (res === null && options.verbose)
      console.log('Done');
  });
}

function do_recombine(options) {
  if (options.dirs) {
    process.stderr.write('ERROR: stitch ignores command-line ' +
      'directories\n');
    return 1;
  }
  const config = make_config(options);
  frankenstein.recombine(config, {verbose: options.verbose}, (res) => {
    if (res === null && options.verbose)
      console.log('Done');
  });
}

function main() {
  const values = minimist(process.argv.slice(2));
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
