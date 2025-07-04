/*
 *
 * Copyright (c) 2021 Darryl deHaan
 * SPDX-License-Identifier: MIT
 *
 */

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

#include "rgb_layer_status.h"
#include <zmk/events/layer_state_changed.h>
#include <zmk/event_manager.h>
#include <zmk/keymap.h>
#include <dt-bindings/zmk/rgb.h>
#include <zmk/behavior.h>

// RGB color definitions for each layer (HSV values)
// Hue: 0-360, Saturation: 0-100, Brightness: 0-100
static const struct
{
    uint16_t h;
    uint8_t s;
    uint8_t v;
} layer_colors[] = {
    {240, 100, 50}, // Layer 0 (QWERTY) - Blue
    {120, 100, 50}, // Layer 1 (NUMBER) - Green
    {0, 100, 50},   // Layer 2 (SYMBOL) - Red
    {60, 100, 50},  // Layer 3 (Fn) - Yellow
};

static int rgb_layer_listener(const zmk_event_t *eh)
{
    uint8_t index = zmk_keymap_highest_layer_active();

    if (index < ARRAY_SIZE(layer_colors))
    {
        LOG_DBG("Layer changed to %d, setting RGB color (H:%d S:%d V:%d)",
                index,
                layer_colors[index].h,
                layer_colors[index].s,
                layer_colors[index].v);

        // Use RGB_COLOR_HSB behavior to set color
        struct zmk_behavior_binding binding = {
            .behavior_dev = "rgb_ug",
            .param1 = RGB_COLOR_HSB,
            .param2 = RGB_COLOR_HSB(layer_colors[index].h, layer_colors[index].s, layer_colors[index].v),
        };

        int ret = zmk_behavior_invoke_binding(&binding, true);
        if (ret < 0)
        {
            LOG_ERR("Failed to invoke RGB behavior: %d", ret);
        }
    }

    return ZMK_EV_EVENT_BUBBLE;
}

ZMK_LISTENER(rgb_layer_status, rgb_layer_listener);
ZMK_SUBSCRIPTION(rgb_layer_status, zmk_layer_state_changed);

int zmk_widget_rgb_layer_status_init(struct zmk_widget_rgb_layer_status *widget)
{
    LOG_DBG("RGB layer status widget initialized");
    return 0;
}