
/* Scatter/gather stream implementation */

const stream = require('stream');

/* A gathering Readable stream */
class GatherStream extends stream.Readable {

  /* Construct a new instance
   *
   * source is a function that is queried for stream objects to get data
   * from; it is called with no arguments and must return either a Readable
   * stream to gather data from or null to indicate that there are no further
   * streams to read.
   * options is forwarded to the Readable constructor; see the documentation
   * of it for details. */
  constructor(source, options) {
    super(options);
    this.source = source;
    this._curStream = null;
  }

  _getNextStream() {
    try {
      this._curStream = this.source();
    } catch (e) {
      this._curStream = null;
      process.nextTick(() => this.emit('error', e));
      return;
    }
    if (this._curStream === null) {
      this.push(null);
      return;
    }
    this._curStream.on('data', (chunk) => {
      if (! this.push(chunk)) this._curStream.pause();
    });
    this._curStream.on('end', () => {
      this._getNextStream();
    });
  }

  _read(size) {
    if (this._curStream === null) {
      this._getNextStream();
    } else {
      this._curStream.resume();
    }
  }

}

/* A scattering Writable stream */
class ScatterStream extends stream.Writable {

  /* Construct a new instance
   *
   * slice is a function that determines when to start using the next drain.
   * It is called with a Buffer of data to consider, and returns the amount
   * of bytes that go into the currently active drain. If the return value is
   * zero, a new drain is allocated immediately (and slice is called again);
   * if the value is equal to the buffer's length, all data are drained into
   * the current drain; if the return value is between the two extremes, some
   * data are drained into the current drain, a new drain is acquired, and
   * slice is called again (to determine how many bytes go into the new
   * drain).
   * drain is a function that, when called with no arguments, returns a new
   * Writable stream where new data should go, which becomes the current
   * "drain". Before a new drain is allocated, or when there are no more data
   * to write, the current drain is end()-ed.
   * options is forwarded to the Writable constructor; see the documentation
   * of it for details. */
  constructor(slice, drain, options) {
    super(options);
    this.slice = slice;
    this.drain = drain;
    this._curStream = null;
    this._getNextStream();
  }

  _getNextStream() {
    if (this._curStream !== null) this._curStream.end();
    try {
      this._curStream = this.drain();
      return true;
    } catch (e) {
      this._curStream = null;
      process.nextTick(() => this.emit('error', e));
      return false;
    }
  }

  _closeStream() {
    if (this._curStream !== null) this._curStream.end();
  }

  _write(data, encoding, callback) {
    let mayContinue = true;
    for (;;) {
      let cutoff;
      try {
        cutoff = this.slice(data);
      } catch (e) {
        callback(e);
        return;
      }
      if (cutoff > 0) {
        const wr = (cutoff >= data.length) ? data : data.slice(0, cutoff);
        mayContinue = this._curStream.write(wr);
      }
      if (cutoff >= data.length) break;
      if (! this._getNextStream()) return;
      data = data.slice(cutoff);
    }
    if (mayContinue) {
      process.nextTick(callback);
    } else {
      this._curStream.once('drain', callback);
    }
  }

  /* _finish() is not introduced until Node.js 8.x. */
  end(chunk, encoding, callback) {
    if (typeof chunk === 'function') {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }
    super.end(chunk, encoding, (err) => {
      this._closeStream();
      if (callback) callback(err);
    });
  }

}

/* A ScatterStream that splits the input into chunks of up to a given fixed
 * size */
class SplitStream extends ScatterStream {

  /* Construct a new instance
   *
   * blocksize is the maximal length of an output block; the last block may
   * be shorter than it, but all others other output streams will have
   * exactly blocksize bytes written to them.
   * drain and options are passed on to the ScatterStream constructor; see
   * there for details. */
  constructor(blocksize, drain, options) {
    super(block => this._slice(block), drain, options);
    this.blocksize = blocksize;
    this.remaining = blocksize;
  }

  _slice(block) {
    if (this.remaining >= block.length) {
      this.remaining -= block.length;
      return block.length;
    } else {
      const ret = this.remaining;
      this.remaining = this.blocksize;
      return ret;
    }
  }

}

module.exports.GatherStream = GatherStream;
module.exports.ScatterStream = ScatterStream;
module.exports.SplitStream = SplitStream;
