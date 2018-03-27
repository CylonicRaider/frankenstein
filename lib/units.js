
/* Parse byte sizes with SI and IEC prefixes */

const REGEX = /^\s*([0-9]+(?:\.[0-9]+)?)\s*(B|[KMGTPEZY](?:i?B)?)?\s*$/i;

const FACTORS = {
  b: 1,
  kib: 1024,
  mib: 1048576,
  gib: 1073741824,
  tib: 1099511627776,
  pib: 1125899906842624,
  eib: 1152921504606846976,
  zib: 1180591620717411303424,
  yib: 1208925819614629174706176,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
  pb: 1e15,
  eb: 1e18,
  zb: 1e21,
  yb: 1e24
};
'kmgtpezy'.split('').map(k => FACTORS[k] = FACTORS[k + 'ib']);

/* Parse a string specifying a byte size and return the result */
function parse(s) {
  const m = REGEX.exec(s);
  if (! m)
    throw new Error('Unrecognized byte size: ' + s);
  const value = parseFloat(m[1]), unit = (m[2] || 'B').toLowerCase();
  const result = value * FACTORS[unit];
  if (/[kmgtpezy]?b/.test(unit) && result % 1 !== 0)
    throw new Error('Fractional byte size: ' + s);
  return Math.round(result);
}

module.exports.parse = parse;
