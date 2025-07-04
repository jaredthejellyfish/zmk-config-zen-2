# ZMK Environment Setup for Fish Shell
# Source this file to set up your ZMK build environment:
# source setup_env.fish

echo "Setting up ZMK build environment..."

# Activate virtual environment
if not set -q VIRTUAL_ENV
    echo "Activating Python virtual environment..."
    source .venv/bin/activate.fish
end

# Set ZMK environment variables
set -gx ZEPHYR_TOOLCHAIN_VARIANT gnuarmemb
set -gx GNUARMEMB_TOOLCHAIN_PATH /Applications/ArmGNUToolchain/14.2.rel1/arm-none-eabi

echo "✅ Environment ready!"
echo "Python venv: $VIRTUAL_ENV"
echo "Toolchain: $ZEPHYR_TOOLCHAIN_VARIANT"
echo "ARM Path: $GNUARMEMB_TOOLCHAIN_PATH"
echo ""
echo "To build firmware:"
echo "  ./build.fish               # Build both sides"
echo "  west build -s zmk/app -b corneish_zen_v2_left -- -DZMK_CONFIG=\"(pwd)/config\""
echo "  west build -s zmk/app -b corneish_zen_v2_right --pristine -- -DZMK_CONFIG=\"(pwd)/config\"" 