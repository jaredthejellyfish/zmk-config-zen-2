// converter.ts
// A TypeScript re‑implementation of the original PHP image‑to‑LVGL converter.
//
// ▸ Depends on the `sharp` image library (npm i sharp) for decoding.
// ▸ Targets Node ≥18.  No browser‑specific APIs are used.
// ▸ Covers the same public surface as the PHP script, but in a cleaner,
//   strongly‑typed style.  All heavy lifting (pixel loops, dithering,
//   C / binary generation) happens in pure TypeScript so the behaviour
//   is deterministic across platforms.
//
// ---------------------------------------------------------------------------
// Example usage:
// ---------------------------------------------------------------------------
// import { Converter, ColorFormat } from "./converter";
//
// const main = async () => {
//   const conv = await Converter.create("./test.png", {
//     outputName: "test_img",
//     dithering: true,
//   });
//
//   // Convert to 16‑bit 5‑6‑5 little‑endian and write an LVGL‑compatible .c file
//   conv.convert(ColorFormat.TRUE_COLOR_565);
//   await conv.writeC();
// };
//
// main();
// ---------------------------------------------------------------------------
// SPDX‑License‑Identifier: MIT

import sharp from "sharp";
import * as fs from "fs/promises";
import path from "path";

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

enum ColorFormat {
  // True colour family
  TRUE_COLOR_332 = 0,
  TRUE_COLOR_565 = 1,
  TRUE_COLOR_565_SWAP = 2,
  TRUE_COLOR_888 = 3,

  // Alpha‑only bitmaps
  ALPHA_1_BIT = 4,
  ALPHA_2_BIT = 5,
  ALPHA_4_BIT = 6,
  ALPHA_8_BIT = 7,

  // Indexed
  INDEXED_1_BIT = 8,
  INDEXED_2_BIT = 9,
  INDEXED_4_BIT = 10,
  INDEXED_8_BIT = 11,

  // Raw passthrough (no per‑pixel processing)
  RAW = 12,
  RAW_ALPHA = 13,
  RAW_CHROMA = 14,

  // Helper groups → correspond to LVGL enums
  TRUE_COLOR = 100,
  TRUE_COLOR_ALPHA = 101,
  TRUE_COLOR_CHROMA = 102,
}

type LVGLcf =
  | ColorFormat.TRUE_COLOR
  | ColorFormat.TRUE_COLOR_ALPHA
  | ColorFormat.TRUE_COLOR_CHROMA
  | ColorFormat.INDEXED_1_BIT
  | ColorFormat.INDEXED_2_BIT
  | ColorFormat.INDEXED_4_BIT
  | ColorFormat.INDEXED_8_BIT
  | ColorFormat.ALPHA_1_BIT
  | ColorFormat.ALPHA_2_BIT
  | ColorFormat.ALPHA_4_BIT
  | ColorFormat.ALPHA_8_BIT
  | ColorFormat.RAW
  | ColorFormat.RAW_ALPHA
  | ColorFormat.RAW_CHROMA;

interface ConverterOptions {
  /** Output C symbol/file base name (no extension). */
  outputName: string;
  /** Enable Floyd‑Steinberg dithering when reducing colours. Default: false. */
  dithering?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                                    CORE                                    */
/* -------------------------------------------------------------------------- */

interface PaletteColor {
  r: number;
  g: number;
  b: number;
}

export class Converter {
  /* ---------------------------- public properties --------------------------- */
  readonly width: number;
  readonly height: number;
  readonly outputName: string;
  dithering: boolean;

  /* ---------------------------- internal fields ---------------------------- */
  private pixels: Uint8Array; // RGBA8888 from sharp
  private cf: ColorFormat = ColorFormat.TRUE_COLOR_565;
  private withAlpha = false;
  private out: number[] = []; // result byte stream
  private palette: PaletteColor[] = []; // for indexed formats

  // Dithering error buffers (per row)
  private rErrRow!: Int16Array;
  private gErrRow!: Int16Array;
  private bErrRow!: Int16Array;
  private rNextErr = 0;
  private gNextErr = 0;
  private bNextErr = 0;

  /* ------------------------------------------------------------------------ */
  /*                             Static constructor                            */
  /* ------------------------------------------------------------------------ */

  static async create(imagePath: string, options: ConverterOptions) {
    const { data, info } = await sharp(imagePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return new Converter(data, info.width, info.height, options);
  }

  /* ------------------------------------------------------------------------ */
  /*                               ctor (private)                              */
  /* ------------------------------------------------------------------------ */

  private constructor(
    pixels: Uint8Array,
    width: number,
    height: number,
    { outputName, dithering = false }: ConverterOptions
  ) {
    this.width = width;
    this.height = height;
    this.outputName = outputName;
    this.dithering = dithering;
    this.pixels = pixels;

    // +2 for boundary checks (Floyd‑Steinberg requires x+2 access)
    this.rErrRow = new Int16Array(width + 2);
    this.gErrRow = new Int16Array(width + 2);
    this.bErrRow = new Int16Array(width + 2);
  }

  /* ------------------------------------------------------------------------ */
  /*                          High‑level public helpers                        */
  /* ------------------------------------------------------------------------ */

  /** Convert the currently loaded image to a given color format. */
  convert(cf: ColorFormat, withAlpha = false) {
    this.cf = cf;
    this.withAlpha = withAlpha;
    this.out = [];
    this.palette = [];

    if (
      cf === ColorFormat.RAW ||
      cf === ColorFormat.RAW_ALPHA ||
      cf === ColorFormat.RAW_CHROMA
    ) {
      // Pass‑through (no colour reduction).  Copy the original RGBA bytes.
      this.out = Array.from(this.pixels);
      return;
    }

    // Generate palette for indexed formats
    if (this.isIndexedFormat(cf)) {
      this.generatePalette(cf);
      this.addPaletteToOutput();
    }

    for (let y = 0; y < this.height; y++) {
      this.resetRowErrors();
      for (let x = 0; x < this.width; x++) {
        this.processPixel(x, y);
      }
    }
  }

  /** Write a fully‑formed C file (…_map + `lv_img_dsc_t`) next to the image. */
  async writeC(filePath?: string) {
    if (!filePath) filePath = `${this.outputName}.c`;
    const content =
      this.getCHeader() +
      this.formatToCArray() +
      this.getCFooter(this.getDisplayCF());
    await fs.writeFile(filePath, content);
  }

  /** Write raw binary (LVGL header + pixel stream). */
  async writeBin(filePath?: string) {
    if (!filePath) filePath = `${this.outputName}.bin`;

    const lvCf = this.convertToLVGLcf(this.getDisplayCF());
    const header = lvCf + (this.width << 10) + (this.height << 21);
    const headerBuf = Buffer.alloc(4);
    headerBuf.writeUInt32LE(header, 0);

    const body = Buffer.from(this.out);
    await fs.writeFile(filePath, Buffer.concat([headerBuf, body]));
  }

  /* ------------------------------------------------------------------------ */
  /*                         Per‑pixel conversion logic                        */
  /* ------------------------------------------------------------------------ */

  private processPixel(x: number, y: number) {
    const idx = (y * this.width + x) << 2; // RGBA8888
    let r = this.pixels[idx] ?? 0;
    let g = this.pixels[idx + 1] ?? 0;
    let b = this.pixels[idx + 2] ?? 0;
    let a = this.pixels[idx + 3] ?? 0;

    // LVGL expects 8‑bit alpha → invert 7‑bit order used in PHP version.
    if (!this.withAlpha) a = 0xff;

    // Apply Floyd‑Steinberg dithering BEFORE quantisation
    if (this.dithering) {
      const rAct = this.clamp8(r + this.rNextErr + (this.rErrRow[x + 1] ?? 0));
      const gAct = this.clamp8(g + this.gNextErr + (this.gErrRow[x + 1] ?? 0));
      const bAct = this.clamp8(b + this.bNextErr + (this.bErrRow[x + 1] ?? 0));

      // Clear slot for next iteration
      this.rErrRow[x + 1] = 0;
      this.gErrRow[x + 1] = 0;
      this.bErrRow[x + 1] = 0;

      ({ r, g, b } = this.quantisePixel(rAct, gAct, bAct));

      // Compute quantisation error
      const rErr = rAct - r;
      const gErr = gAct - g;
      const bErr = bAct - b;

      // Distribute errors (Floyd‑Steinberg kernel)
      this.rNextErr = (7 * rErr) >> 4;
      this.gNextErr = (7 * gErr) >> 4;
      this.bNextErr = (7 * bErr) >> 4;

      this.rErrRow[x] = (this.rErrRow[x] ?? 0) + ((3 * rErr) >> 4);
      this.gErrRow[x] = (this.gErrRow[x] ?? 0) + ((3 * gErr) >> 4);
      this.bErrRow[x] = (this.bErrRow[x] ?? 0) + ((3 * bErr) >> 4);

      this.rErrRow[x + 1] = (this.rErrRow[x + 1] ?? 0) + ((5 * rErr) >> 4);
      this.gErrRow[x + 1] = (this.gErrRow[x + 1] ?? 0) + ((5 * gErr) >> 4);
      this.bErrRow[x + 1] = (this.bErrRow[x + 1] ?? 0) + ((5 * bErr) >> 4);

      this.rErrRow[x + 2] = (this.rErrRow[x + 2] ?? 0) + (rErr >> 4);
      this.gErrRow[x + 2] = (this.gErrRow[x + 2] ?? 0) + (gErr >> 4);
      this.bErrRow[x + 2] = (this.bErrRow[x + 2] ?? 0) + (bErr >> 4);
    } else {
      ({ r, g, b } = this.quantisePixel(r, g, b));
    }

    // Push to output according to format
    switch (this.cf) {
      case ColorFormat.TRUE_COLOR_332: {
        const c8 = (r & 0xe0) | ((g & 0xe0) >> 3) | (b >> 6);
        this.out.push(c8);
        if (this.withAlpha) this.out.push(a);
        break;
      }
      case ColorFormat.TRUE_COLOR_565:
      case ColorFormat.TRUE_COLOR_565_SWAP: {
        const c16 = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
        if (this.cf === ColorFormat.TRUE_COLOR_565) {
          this.out.push(c16 & 0xff, c16 >> 8);
        } else {
          this.out.push(c16 >> 8, c16 & 0xff);
        }
        if (this.withAlpha) this.out.push(a);
        break;
      }
      case ColorFormat.TRUE_COLOR_888: {
        this.out.push(b, g, r, a);
        break;
      }
      case ColorFormat.INDEXED_1_BIT: {
        // Find closest palette color
        const closestIndex = this.findClosestPaletteColor(r, g, b);

        // Pack bits: 8 pixels per byte, MSB first
        const bytesPerRow = Math.ceil(this.width / 8);
        const byteIndex =
          bytesPerRow * y +
          Math.floor(x / 8) +
          this.getPaletteSize(this.cf) * 4;
        const bitIndex = 7 - (x & 0x7);

        if (this.out[byteIndex] === undefined) this.out[byteIndex] = 0;
        this.out[byteIndex] |= (closestIndex & 0x1) << bitIndex;
        break;
      }
      default:
        throw new Error(`Format ${this.cf} not yet implemented in TS port.`);
    }
  }

  private quantisePixel(r: number, g: number, b: number) {
    switch (this.cf) {
      case ColorFormat.TRUE_COLOR_332:
        return {
          r: this.classify(r, 3),
          g: this.classify(g, 3),
          b: this.classify(b, 2),
        };
      case ColorFormat.TRUE_COLOR_565:
      case ColorFormat.TRUE_COLOR_565_SWAP:
        return {
          r: this.classify(r, 5),
          g: this.classify(g, 6),
          b: this.classify(b, 5),
        };
      case ColorFormat.TRUE_COLOR_888:
      default:
        return { r, g, b };
    }
  }

  private classify(value: number, bits: number) {
    const quantum = 1 << (8 - bits);
    return this.clamp8(Math.round(value / quantum) * quantum);
  }

  private clamp8(v: number) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  private resetRowErrors() {
    if (!this.dithering) return;
    this.rNextErr = this.gNextErr = this.bNextErr = 0;
  }

  /* ------------------------------------------------------------------------ */
  /*                         Palette generation and helpers                    */
  /* ------------------------------------------------------------------------ */

  private isIndexedFormat(cf: ColorFormat): boolean {
    return cf >= ColorFormat.INDEXED_1_BIT && cf <= ColorFormat.INDEXED_8_BIT;
  }

  private getPaletteSize(cf: ColorFormat): number {
    switch (cf) {
      case ColorFormat.INDEXED_1_BIT:
        return 2;
      case ColorFormat.INDEXED_2_BIT:
        return 4;
      case ColorFormat.INDEXED_4_BIT:
        return 16;
      case ColorFormat.INDEXED_8_BIT:
        return 256;
      default:
        return 0;
    }
  }

  private generatePalette(cf: ColorFormat): void {
    const paletteSize = this.getPaletteSize(cf);
    if (paletteSize === 0) return;

    // For 1-bit (2 colors), use a simple approach: find darkest and lightest
    if (cf === ColorFormat.INDEXED_1_BIT) {
      let minLuma = Infinity;
      let maxLuma = -Infinity;
      let darkest: PaletteColor = { r: 0, g: 0, b: 0 };
      let lightest: PaletteColor = { r: 255, g: 255, b: 255 };

      // Sample pixels to find extremes
      for (let i = 0; i < this.pixels.length; i += 4) {
        const r = this.pixels[i] ?? 0;
        const g = this.pixels[i + 1] ?? 0;
        const b = this.pixels[i + 2] ?? 0;

        // Calculate luminance (Y component of YUV)
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luma < minLuma) {
          minLuma = luma;
          darkest = { r, g, b };
        }
        if (luma > maxLuma) {
          maxLuma = luma;
          lightest = { r, g, b };
        }
      }

      this.palette = [darkest, lightest];
    } else {
      // For other indexed formats, implement k-means or other algorithms as needed
      throw new Error(`Palette generation for ${cf} not yet implemented`);
    }
  }

  private addPaletteToOutput(): void {
    // Add palette in BGRA format (matches PHP implementation)
    for (const color of this.palette) {
      this.out.push(color.b, color.g, color.r, 0xff);
    }
  }

  private findClosestPaletteColor(r: number, g: number, b: number): number {
    if (this.palette.length === 0) return 0;

    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < this.palette.length; i++) {
      const color = this.palette[i];
      if (!color) continue;

      // Use Euclidean distance in RGB space
      const distance = Math.sqrt(
        Math.pow(r - color.r, 2) +
          Math.pow(g - color.g, 2) +
          Math.pow(b - color.b, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  /* ------------------------------------------------------------------------ */
  /*                         C / LVGL helper generators                        */
  /* ------------------------------------------------------------------------ */

  private formatToCArray() {
    let out = "\n";
    let i = 0;
    const perLine = 12;

    const pushByte = (byte: number) => {
      out += `0x${byte.toString(16).padStart(2, "0")}, `;
      if (++i % perLine === 0) out += "\n";
    };

    for (const b of this.out) pushByte(b);
    return out;
  }

  private getCHeader() {
    const attr = `LV_ATTRIBUTE_IMG_${this.outputName.toUpperCase()}`;
    return `#if defined(LV_LVGL_H_INCLUDE_SIMPLE)\n#include \"lvgl.h\"\n#else\n#include \"../lvgl/lvgl.h\"\n#endif\n\n#ifndef LV_ATTRIBUTE_MEM_ALIGN\n#define LV_ATTRIBUTE_MEM_ALIGN\n#endif\n\n#ifndef ${attr}\n#define ${attr}\n#endif\n\nconst LV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST ${attr} uint8_t ${this.outputName}_map[] = {`;
  }

  private getCFooter(cf: LVGLcf) {
    return `\n};\n\nconst lv_img_dsc_t ${
      this.outputName
    } = {\n  .header.always_zero = 0,\n  .header.w = ${
      this.width
    },\n  .header.h = ${this.height},\n  .data_size = ${
      this.out.length
    },\n  .header.cf = ${this.lvglCfEnum(cf)},\n  .data = ${
      this.outputName
    }_map,\n};\n`;
  }

  private lvglCfEnum(cf: LVGLcf) {
    switch (cf) {
      case ColorFormat.TRUE_COLOR:
        return "LV_IMG_CF_TRUE_COLOR";
      case ColorFormat.TRUE_COLOR_ALPHA:
        return "LV_IMG_CF_TRUE_COLOR_ALPHA";
      case ColorFormat.TRUE_COLOR_CHROMA:
        return "LV_IMG_CF_TRUE_COLOR_CHROMA_KEYED";
      case ColorFormat.ALPHA_1_BIT:
        return "LV_IMG_CF_ALPHA_1BIT";
      case ColorFormat.ALPHA_2_BIT:
        return "LV_IMG_CF_ALPHA_2BIT";
      case ColorFormat.ALPHA_4_BIT:
        return "LV_IMG_CF_ALPHA_4BIT";
      case ColorFormat.ALPHA_8_BIT:
        return "LV_IMG_CF_ALPHA_8BIT";
      case ColorFormat.INDEXED_1_BIT:
        return "LV_IMG_CF_INDEXED_1BIT";
      case ColorFormat.INDEXED_2_BIT:
        return "LV_IMG_CF_INDEXED_2BIT";
      case ColorFormat.INDEXED_4_BIT:
        return "LV_IMG_CF_INDEXED_4BIT";
      case ColorFormat.INDEXED_8_BIT:
        return "LV_IMG_CF_INDEXED_8BIT";
      case ColorFormat.RAW:
        return "LV_IMG_CF_RAW";
      case ColorFormat.RAW_ALPHA:
        return "LV_IMG_CF_RAW_ALPHA";
      case ColorFormat.RAW_CHROMA:
        return "LV_IMG_CF_RAW_CHROMA_KEYED";
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                           Utility / enum helpers                          */
  /* ------------------------------------------------------------------------ */

  private getDisplayCF(): LVGLcf {
    switch (this.cf) {
      case ColorFormat.TRUE_COLOR_332:
      case ColorFormat.TRUE_COLOR_565:
      case ColorFormat.TRUE_COLOR_565_SWAP:
      case ColorFormat.TRUE_COLOR_888:
        return this.withAlpha
          ? ColorFormat.TRUE_COLOR_ALPHA
          : ColorFormat.TRUE_COLOR;
      default:
        return this.cf as LVGLcf;
    }
  }

  private convertToLVGLcf(cf: LVGLcf): number {
    // Matches the original PHP lookup table – keep in sync with LVGL headers.
    switch (cf) {
      case ColorFormat.TRUE_COLOR:
        return 4;
      case ColorFormat.TRUE_COLOR_ALPHA:
        return 5;
      case ColorFormat.TRUE_COLOR_CHROMA:
        return 6;
      case ColorFormat.INDEXED_1_BIT:
        return 7;
      case ColorFormat.INDEXED_2_BIT:
        return 8;
      case ColorFormat.INDEXED_4_BIT:
        return 9;
      case ColorFormat.INDEXED_8_BIT:
        return 10;
      case ColorFormat.ALPHA_1_BIT:
        return 11;
      case ColorFormat.ALPHA_2_BIT:
        return 12;
      case ColorFormat.ALPHA_4_BIT:
        return 13;
      case ColorFormat.ALPHA_8_BIT:
        return 14;
      case ColorFormat.RAW:
        return 0; // reserved – not used in LVGL header
      case ColorFormat.RAW_ALPHA:
        return 1;
      case ColorFormat.RAW_CHROMA:
        return 2;
    }
  }
}

export { ColorFormat };
