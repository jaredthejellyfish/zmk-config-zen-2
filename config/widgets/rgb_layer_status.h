/*
 *
 * Copyright (c) 2021 Darryl deHaan
 * SPDX-License-Identifier: MIT
 *
 */

#pragma once

#include <zephyr/kernel.h>

struct zmk_widget_rgb_layer_status {
    sys_snode_t node;
};

int zmk_widget_rgb_layer_status_init(struct zmk_widget_rgb_layer_status *widget); 