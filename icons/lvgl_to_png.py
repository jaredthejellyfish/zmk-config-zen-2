#!/usr/bin/env python3
"""
LVGL C Bitmap to PNG Converter

Converts LVGL C bitmap files (like layers2.c) to PNG format.
Handles 1-bit indexed color bitmaps with color palettes.
"""

import re
import struct
from PIL import Image
import argparse
import os
import sys

def parse_lvgl_c_file(file_path):
    """Parse LVGL C bitmap file and extract bitmap data and metadata."""
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Extract color palette (first 8 bytes of bitmap data)
    color_pattern = r'/\*Color of index (\d+)\*/\s*\n\s*0x([0-9a-fA-F]{2}),\s*0x([0-9a-fA-F]{2}),\s*0x([0-9a-fA-F]{2}),\s*0x([0-9a-fA-F]{2}),'
    colors = {}
    
    for match in re.finditer(color_pattern, content):
        index = int(match.group(1))
        r = int(match.group(2), 16)
        g = int(match.group(3), 16)
        b = int(match.group(4), 16)
        a = int(match.group(5), 16)
        colors[index] = (r, g, b, a)
    
    # Extract bitmap data array
    bitmap_pattern = r'(\w+)_map\[\]\s*=\s*\{([^}]+)\}'
    bitmap_match = re.search(bitmap_pattern, content, re.DOTALL)
    
    if not bitmap_match:
        raise ValueError("Could not find bitmap data array")
    
    bitmap_name = bitmap_match.group(1)
    bitmap_data_str = bitmap_match.group(2)
    
    # Parse hex values from bitmap data
    hex_pattern = r'0x([0-9a-fA-F]{2})'
    hex_values = re.findall(hex_pattern, bitmap_data_str)
    
    # Convert to bytes, skipping color palette (first 8 bytes)
    bitmap_bytes = bytes(int(val, 16) for val in hex_values[8:])
    
    # Extract image metadata
    desc_pattern = rf'const lv_img_dsc_t {bitmap_name}\s*=\s*\{{([^}}]+)\}}'
    desc_match = re.search(desc_pattern, content, re.DOTALL)
    
    if not desc_match:
        raise ValueError("Could not find image descriptor")
    
    desc_content = desc_match.group(1)
    
    # Extract width and height
    width_match = re.search(r'\.w\s*=\s*(\d+)', desc_content)
    height_match = re.search(r'\.h\s*=\s*(\d+)', desc_content)
    
    if not width_match or not height_match:
        raise ValueError("Could not find image dimensions")
    
    width = int(width_match.group(1))
    height = int(height_match.group(1))
    
    # Extract color format
    cf_match = re.search(r'\.cf\s*=\s*(\w+)', desc_content)
    color_format = cf_match.group(1) if cf_match else "unknown"
    
    return {
        'name': bitmap_name,
        'width': width,
        'height': height,
        'color_format': color_format,
        'colors': colors,
        'bitmap_data': bitmap_bytes
    }

def convert_1bit_indexed_to_png(bitmap_info, output_path):
    """Convert 1-bit indexed bitmap to PNG."""
    
    width = bitmap_info['width']
    height = bitmap_info['height']
    colors = bitmap_info['colors']
    bitmap_data = bitmap_info['bitmap_data']
    
    # Create new image
    img = Image.new('RGBA', (width, height))
    pixels = img.load()
    
    # Calculate bytes per row (8 pixels per byte for 1-bit)
    bytes_per_row = (width + 7) // 8
    
    for y in range(height):
        for x in range(width):
            # Calculate byte and bit position
            byte_index = y * bytes_per_row + (x // 8)
            bit_index = 7 - (x % 8)  # MSB first
            
            if byte_index < len(bitmap_data):
                # Extract bit value
                byte_value = bitmap_data[byte_index]
                bit_value = (byte_value >> bit_index) & 1
                
                # Get color from palette
                color = colors.get(bit_value, (0, 0, 0, 255))  # Default to black
                pixels[x, y] = color
            else:
                # Out of bounds, use default color
                pixels[x, y] = colors.get(0, (0, 0, 0, 255))
    
    # Save as PNG
    img.save(output_path, 'PNG')
    print(f"✅ Converted {bitmap_info['name']} to {output_path}")
    print(f"   Size: {width}x{height} pixels")
    print(f"   Format: {bitmap_info['color_format']}")
    print(f"   Colors: {len(colors)} colors")

def main():
    parser = argparse.ArgumentParser(description='Convert LVGL C bitmap files to PNG')
    parser.add_argument('input_file', help='Path to LVGL C bitmap file')
    parser.add_argument('-o', '--output', help='Output PNG file path (default: auto-generated)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_file):
        print(f"❌ Error: Input file '{args.input_file}' not found")
        sys.exit(1)
    
    try:
        # Parse the C file
        print(f"Parsing {args.input_file}...")
        bitmap_info = parse_lvgl_c_file(args.input_file)
        
        # Generate output filename if not provided
        if args.output:
            output_path = args.output
        else:
            base_name = os.path.splitext(os.path.basename(args.input_file))[0]
            output_path = f"{base_name}.png"
        
        # Convert to PNG
        convert_1bit_indexed_to_png(bitmap_info, output_path)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 