#ifdef __has_include
    #if __has_include("lvgl.h")
        #ifndef LV_LVGL_H_INCLUDE_SIMPLE
            #define LV_LVGL_H_INCLUDE_SIMPLE
        #endif
    #endif
#endif

#if defined(LV_LVGL_H_INCLUDE_SIMPLE)
    #include "lvgl.h"
#else
    #include "lvgl/lvgl.h"
#endif


#ifndef LV_ATTRIBUTE_MEM_ALIGN
#define LV_ATTRIBUTE_MEM_ALIGN
#endif

#ifndef LV_ATTRIBUTE_IMG_BATT_0
#define LV_ATTRIBUTE_IMG_BATT_0
#endif

const LV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST LV_ATTRIBUTE_IMG_BATT_0 uint8_t batt_0_map[] = {
  0x00, 0x00, 0x00, 0x09, 	/*Color of index 0*/
  0x00, 0x00, 0x00, 0xe8, 	/*Color of index 1*/

  0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 
  0x0f, 0xff, 0xff, 0xfc, 0x00, 
  0x0f, 0xff, 0xff, 0xfe, 0x00, 
  0x3f, 0xff, 0xff, 0xfe, 0x00, 
  0xff, 0xff, 0xff, 0xff, 0x00, 
  0xbc, 0x00, 0x00, 0x0f, 0x80, 
  0xf8, 0x00, 0x00, 0x07, 0x80, 
  0xf0, 0x00, 0x00, 0x07, 0x80, 
  0xf0, 0x00, 0x00, 0x03, 0x80, 
  0xf0, 0x00, 0x00, 0x07, 0x85, 
  0xf0, 0x00, 0x00, 0x03, 0x87, 
  0xf0, 0x00, 0x00, 0x07, 0x87, 
  0xf0, 0x00, 0x00, 0x03, 0x87, 
  0xf0, 0x00, 0x00, 0x07, 0x87, 
  0xf0, 0x00, 0x00, 0x03, 0x87, 
  0xf0, 0x00, 0x00, 0x07, 0x87, 
  0xf0, 0x00, 0x00, 0x03, 0x87, 
  0xf0, 0x00, 0x00, 0x07, 0x87, 
  0xf0, 0x00, 0x00, 0x03, 0x83, 
  0xf0, 0x00, 0x00, 0x07, 0x80, 
  0xf0, 0x00, 0x00, 0x03, 0x80, 
  0xf8, 0x00, 0x00, 0x07, 0x80, 
  0xf8, 0x00, 0x00, 0x07, 0x80, 
  0x7f, 0x7f, 0xff, 0xdf, 0x80, 
  0x3f, 0xff, 0xff, 0xff, 0x00, 
  0x1f, 0xff, 0xff, 0xfc, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 
};

const lv_img_dsc_t batt_0 = {
  .header.cf = LV_IMG_CF_INDEXED_1BIT,
  .header.always_zero = 0,
  .header.reserved = 0,
  .header.w = 40,
  .header.h = 31,
  .data_size = 163,
  .data = batt_0_map,
};
