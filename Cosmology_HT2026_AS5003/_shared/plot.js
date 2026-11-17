// Helpers for Observable Plot charts (global Plot).

// Plot draws tick marks but no axis lines, so add the bottom and left edges of the frame as the
// x and y axes (except for an axis hidden with axis: null). stroke: the colour of the lines.
export function withAxes(opts, stroke) {
  const lines = [];
  if (opts.x?.axis !== null) lines.push(Plot.frame({ anchor: "bottom", stroke, strokeWidth: 1.5 }));
  if (opts.y?.axis !== null) lines.push(Plot.frame({ anchor: "left", stroke, strokeWidth: 1.5 }));
  return { ...opts, marks: [...(opts.marks ?? []), ...lines] };
}
