
/* Frankenstein -- Automated file splitter/recombiner. */

const fs = require('fs');
const path = require('path');

/* Configuration / data file */
class Configuration {

  constructor(path) {
    this.path = path;
    this.data = null;
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

}
