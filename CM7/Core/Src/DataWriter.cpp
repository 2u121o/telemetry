#include "DataWriter.hpp"


namespace telemetry
{


bool DataWriter::init(const char* file_name, const char* header)
{
	char path[64];
	int n = snprintf(path, sizeof(path), "0:/%s.txt", file_name);
	if (n < 0 || (size_t)n >= sizeof(path))
	{
		return false;
	}


	 fresult_ = f_mount(&fatfs_, uesr_path_, 1);
	  while(fresult_!=FR_OK && current_num_init_++<=MAX_NUM_INIT)
	  {
		  fresult_ = f_mount(&fatfs_, uesr_path_, 1);
	  }

	  if(current_num_init_>=MAX_NUM_INIT && fresult_!=FR_OK)
	  {
		  return false;
	  }

	  fresult_ = f_open(&fil_, path, FA_WRITE | FA_CREATE_ALWAYS);
	  if (fresult_ != FR_OK)
	  {
		f_mount(NULL, uesr_path_, 1);
	  }

	  f_printf(&fil_, header);
	  f_sync(&fil_);

	  return true;
}

bool DataWriter::writeBatch(const char* data)
{
	f_printf(&fil_, "%s\r\n", data);
	fresult_ = f_sync(&fil_);
	if (fresult_ != FR_OK)
	{
		return false;
	}
	return true;

}

void DataWriter::close()
{
	f_sync(&fil_);
	f_close(&fil_);
	f_mount(NULL, uesr_path_, 1);
}


}//telemetry
