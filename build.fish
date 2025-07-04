#!/usr/bin/env fish

# ZMK Build Script for Corneish Zen (Fish shell version)
# Follows ZMK documentation best practices

echo "Building ZMK firmware for Corneish Zen..."

# Check if we're in the right directory
if not test -d zmk/app
    echo "❌ Error: zmk/app directory not found. Make sure you're in your gayboard directory."
    exit 1
end

# Activate virtual environment if not already active
if not set -q VIRTUAL_ENV
    echo "Activating virtual environment..."
    source .venv/bin/activate.fish
end

# Set environment variables
set -gx ZEPHYR_TOOLCHAIN_VARIANT gnuarmemb
set -gx GNUARMEMB_TOOLCHAIN_PATH /Applications/ArmGNUToolchain/14.2.rel1/arm-none-eabi

# Get current directory for config path
set current_dir (pwd)
set CONFIG_PATH "$current_dir/config"
# Change to the app directory as recommended by ZMK docs
cd zmk/app

echo "Building left side..."
west build -d ../../build/left -b corneish_zen_v2_left --pristine -- -DZMK_CONFIG="$CONFIG_PATH"
if test $status -eq 0
    mkdir -p ../../firmware
    cp ../../build/left/zephyr/zmk.uf2 ../../firmware/corneish_zen_v2_left.uf2
    echo "✅ Left side built successfully: firmware/corneish_zen_v2_left.uf2"
else
    echo "❌ Left side build failed"
    cd ../..
    exit 1
end

echo "Building right side..."
west build -d ../../build/right -b corneish_zen_v2_right --pristine -- -DZMK_CONFIG="$CONFIG_PATH"
if test $status -eq 0
    cp ../../build/right/zephyr/zmk.uf2 ../../firmware/corneish_zen_v2_right.uf2
    echo "✅ Right side built successfully: firmware/corneish_zen_v2_right.uf2"
else
    echo "❌ Right side build failed"
    cd ../..
    exit 1
end

# Return to original directory
cd ../..

echo ""
echo "🎉 Both sides built successfully!"
echo "Firmware files are in the 'firmware' directory:"
ls -la firmware/
echo ""
echo "Build directories maintained for future incremental builds:"
echo "  build/left/  - Left side build cache"
echo "  build/right/ - Right side build cache"
echo ""
echo "To flash:"
echo "1. Put keyboard into bootloader mode (double-click reset)"
echo "2. Copy the appropriate .uf2 file to the USB drive that appears"
echo ""
echo "For future builds, you can build incrementally without --pristine:"
echo "  cd zmk/app && west build -d ../../build/left"
echo "  cd zmk/app && west build -d ../../build/right" 