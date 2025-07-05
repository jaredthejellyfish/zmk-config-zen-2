#!/usr/bin/env bun
import sharp from "sharp";
import { readdir, mkdir, readFile } from "node:fs/promises";
import { Converter, ColorFormat } from "./converter";

interface SizeConfig {
  prefix: string;
  width: number;
  height: number;
}

async function upscaleIcons() {
  try {
    // Read size configuration
    const sizeConfigData = await readFile("required_size.json", "utf-8");
    const sizeConfigs: SizeConfig[] = JSON.parse(sizeConfigData);

    // Create upscaled and lvgl directories if they don't exist
    await mkdir("upscaled", { recursive: true });
    await mkdir("lvgl", { recursive: true });

    // Get all PNG files in images directory (excluding temp files)
    const files = await readdir("./images");
    const pngFiles = files.filter(
      (file) => file.endsWith(".png") && !file.startsWith("temp_")
    );

    console.log(`Found ${pngFiles.length} PNG files to upscale`);

    // Process each PNG file
    for (const file of pngFiles) {
      console.log(`Processing ${file}...`);

      // Find matching size config based on filename prefix
      const matchingConfig = sizeConfigs.find((config) =>
        file.startsWith(config.prefix)
      );

      if (!matchingConfig) {
        console.warn(`⚠ No size config found for ${file}, skipping...`);
        continue;
      }

      const { width, height } = matchingConfig;

      await sharp(`./images/${file}`)
        .trim() // Remove transparent padding from source image
        .resize(width, height, {
          kernel: sharp.kernel.lanczos3, // High-quality resampling
          fit: "contain", // Maintain aspect ratio after trimming
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        })
        .png({
          quality: 100, // Maximum quality
          compressionLevel: 6, // Good balance of size/quality
        })
        .toFile(`upscaled/${file}`);

      console.log(
        `✓ ${file} upscaled to ${width}x${height} → upscaled/${file}`
      );

      // Convert to LVGL format
      console.log(`Converting ${file} to LVGL format...`);

      const baseName = file.replace(".png", "");
      const converter = await Converter.create(`upscaled/${file}`, {
        outputName: baseName,
        dithering: true, // Enable dithering for better quality
      });

      // Convert to indexed 1-bit format (same as batt_0.c)
      converter.convert(ColorFormat.INDEXED_1_BIT);

      // Write the C file to lvgl directory
      await converter.writeC(`lvgl/${baseName}.c`);

      console.log(`✓ ${file} converted to LVGL format → lvgl/${baseName}.c`);
    }

    console.log(
      "All icons successfully upscaled and converted to LVGL format!"
    );
  } catch (error) {
    console.error("Error upscaling icons:", error);
    return;
  }
}

upscaleIcons();
