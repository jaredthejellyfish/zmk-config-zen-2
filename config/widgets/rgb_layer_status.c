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
#include <zmk/rgb_underglow.h>

static sys_slist_t widgets = SYS_SLIST_STATIC_INIT(&widgets);

struct rgb_layer_status_state {
    uint8_t index;
};

// RGB color definitions for each layer (HSV values)
// Hue: 0-360, Saturation: 0-100, Brightness: 0-100
static const struct zmk_rgb_underglow_hsb layer_colors[] = {
    {.h = 240, .s = 100, .b = 50}, // Layer 0 (QWERTY) - Blue
    {.h = 120, .s = 100, .b = 50}, // Layer 1 (NUMBER) - Green  
    {.h = 0,   .s = 100, .b = 50}, // Layer 2 (SYMBOL) - Red
    {.h = 60,  .s = 100, .b = 50}, // Layer 3 (Fn) - Yellow
};

static void set_layer_rgb(struct rgb_layer_status_state state) {
    if (state.index < ARRAY_SIZE(layer_colors)) {
        LOG_DBG("Changing RGB to layer %d color (H:%d S:%d B:%d)", 
                state.index, 
                layer_colors[state.index].h,
                layer_colors[state.index].s, 
                layer_colors[state.index].b);
        
        zmk_rgb_underglow_set_hsb(layer_colors[state.index]);
    }
}

static void rgb_layer_status_update_cb(struct rgb_layer_status_state state) {
    set_layer_rgb(state);
}

static struct rgb_layer_status_state rgb_layer_status_get_state(const zmk_event_t *eh) {
    uint8_t index = zmk_keymap_highest_layer_active();
    return (struct rgb_layer_status_state){.index = index};
}

ZMK_DISPLAY_WIDGET_LISTENER(widget_rgb_layer_status, struct rgb_layer_status_state, rgb_layer_status_update_cb,
                            rgb_layer_status_get_state)

ZMK_SUBSCRIPTION(widget_rgb_layer_status, zmk_layer_state_changed);

int zmk_widget_rgb_layer_status_init(struct zmk_widget_rgb_layer_status *widget) {
    sys_slist_append(&widgets, &widget->node);
    
    widget_rgb_layer_status_init();
    return 0;
} 