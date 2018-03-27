
/* Frankenstein -- Automated file splitter/recombiner. */

const fs = require('fs');
const path = require('path');

const units = require('./lib/units.js');

/* Configuration / data file */
class Configuration {

  constructor(path) {
    this.path = path;
    this.data = null;
    this._rawBlocksize = null;
    this._blocksize = null;
  }

  create() {
    this.data = {dirs: path.resolve(this.path), blocksize: '16M'};
  }

  load() {
    const rawData = fs.readFileSync(this.path, 'utf-8');
    const data = JSON.parse(rawData);
    this.data = data;
  }

  save() {
    fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
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
