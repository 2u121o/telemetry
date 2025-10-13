#pragma once

extern "C" {
#include "fatfs.h"
#include "usart.h"
#include <stdio.h>
#include <stdlib.h>
}



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

		char uesr_path_[4];

		 int current_num_init_ = 0;
	    static constexpr int MAX_NUM_INIT = 100;
};

}//telemetry
