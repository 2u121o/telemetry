#include "DataWriter.hpp"
extern "C" { extern char USERPath[4]; }

namespace telemetry
{


bool DataWriter::init(const char* file_name, const char* header)
{

	if (!file_name || !*file_name || !header) return false;

	  std::memset(user_path_, 0, sizeof(user_path_));
	  std::strncpy(user_path_, USERPath, sizeof(user_path_) - 1);


	fresult_ = f_mount(&fatfs_, user_path_, 1);
    while(fresult_!=FR_OK && current_num_init_++<=MAX_NUM_INIT)
    {
	    fresult_ = f_mount(&fatfs_, user_path_, 1);
    }

	char path[64] = {0};
	int n = snprintf(path, sizeof(path), "%s%s.TXT", user_path_, file_name);
	if (n < 0 || (size_t)n >= sizeof(path))
	{
	    f_mount(nullptr, user_path_, 1);
		return false;
	}


	  if(current_num_init_>=MAX_NUM_INIT && fresult_!=FR_OK)
	  {
		  return false;
	  }

	  fresult_ = f_open(&fil_, path, FA_WRITE | FA_CREATE_ALWAYS);
	  if (fresult_ != FR_OK)
	  {
		f_mount(NULL, user_path_, 1);
		 return false;
	  }

	  UINT bw;
	  size_t hlen = strlen(header);
	  fresult_ = f_write(&fil_, header, hlen, &bw);
	  if (fresult_ != FR_OK || bw != hlen) {
		  f_close(&fil_);
		  f_mount(NULL, user_path_, 1);
		  return false;
	  }

	  fresult_ = f_sync(&fil_);
	  if (fresult_ != FR_OK) {
		  f_close(&fil_);
		  f_mount(NULL, user_path_, 1);
		  return false;
	  }

	  lines_since_sync_ = 0;

	  return true;
}

bool DataWriter::writeBatch(const char* data)
{
	int n = snprintf(io_buf_, sizeof(io_buf_), "%s", data);
	if (n <= 0 || n >= (int)sizeof(io_buf_)) return false;

	size_t span = (n + 31) & ~((size_t)31);
	SCB_CleanDCache_by_Addr((uint32_t*)io_buf_, span);

	UINT bw;
	fresult_ = f_write(&fil_, io_buf_, n, &bw);
	if (fresult_ != FR_OK || bw != (UINT)n) return false;

	if (++lines_since_sync_ >= KSYNCSEVERY)
	{
		fresult_ = f_sync(&fil_);
		if (fresult_ != FR_OK) return false;
		lines_since_sync_ = 0;
	}
	return true;

}

void DataWriter::close()
{
	f_sync(&fil_);
	f_close(&fil_);
	f_mount(NULL, user_path_, 1);

}


}//telemetry
