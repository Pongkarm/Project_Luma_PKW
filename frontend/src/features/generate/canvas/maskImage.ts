/**
 * Turn a black-and-white mask image into the mask editor's paint layer, in place.
 *
 * The editor stores "repaint here" as opaque paint and "leave alone" as clear,
 * and exports white/black from that alpha — so a mask made elsewhere has to be
 * converted to paint before it can be shown, brushed over and exported again.
 *
 * `invert` swaps which side is repainted: a background-removal mask marks the
 * subject, and replacing the background means repainting everything else.
 * A transparent pixel counts as black, whatever colour it carries.
 */
export function maskToPaint(
  data: Uint8ClampedArray,
  invert: boolean,
  paint: readonly [number, number, number],
): void {
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const white = (luminance * data[i + 3]) / 255 >= 128;
    data[i] = paint[0];
    data[i + 1] = paint[1];
    data[i + 2] = paint[2];
    data[i + 3] = white !== invert ? 255 : 0;
  }
}
