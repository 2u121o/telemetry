#pragma once

extern "C" {
#include "fatfs.h"
#include "usart.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
}

#include "ff.h"
#include <cstdint>
#include <cstring>
#include <cstdio>


namespace telemetry
{

class DataWriter
{
	public:
	    bool init(const char* file_name, const char* header);
		bool writeBatch(const char* data);
		void close();
	private:

		FATFS fatfs_;
		FIL fil_;
		FRESULT fresult_;

		alignas(32) char io_buf_[512];

		char user_path_[4] = {0};

		 int current_num_init_ = 0;
	    static constexpr int MAX_NUM_INIT = 100;

	    int lines_since_sync_ = 0;
	    static constexpr  int KSYNCSEVERY = 20;
};

}//telemetry
