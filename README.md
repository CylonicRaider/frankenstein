# frankenstein

Frankenstein rips files apart and stiches them back together.

More specifically, in “ripping” mode, Frankenstein looks for files within a
set of directories that are larger than a set block size and splits them into
chunks no larger than the block size. This operation is undone in “stitching”
mode. The paths of the ripped-apart files are recorded into a JSON file to
allow unambiguously identifying them upon stitching. The same JSON file is
also used to record Frankenstein's settings for easy reuse.

Frankenstein is somewhat similar to *multi-volume archive files*, but does not
archive or compress the files it splits. Instead, the original file can be
reconstructed by simply concatenating the parts.
