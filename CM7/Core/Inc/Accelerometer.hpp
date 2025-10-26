#pragma once

#include "i2c.h"

namespace telemetry
{


struct Config {

   uint8_t imu_addr         = (0x6B << 1);


   uint8_t WHO_AM_I         = 0x0F;
   uint8_t CTRL1_XL         = 0x10;
   uint8_t CTRL2_G          = 0x11;
   uint8_t CTRL3_C          = 0x12;
   uint8_t OUTX_L_A         = 0x28;
   uint8_t OUTX_L_G			= 0x22;

   uint8_t CTRL3_C_CFG      = 0x44;
   uint8_t CTRL1_XL_CFG     = 0x44;
   uint8_t CTRL2_G_CFG      = 0x4C;
   uint8_t WHO_AM_I_EXPECT  = 0x6B;
 };


struct IMUValues
{
	float ax;
	float ay;
	float az;

	float wx;
	float wy;
	float wz;
};

class Accelerometer
{
	public:


		bool init(I2C_HandleTypeDef* hi2c, const Config& config = Config());
		HAL_StatusTypeDef readData(IMUValues *imu_values);



	private:

		static constexpr float SENS_MG_PER_LSB_2G = 0.061f;
		static constexpr float MG_TO_MS2 = 9.80665e-3f;
		static constexpr float SCALING = SENS_MG_PER_LSB_2G * MG_TO_MS2;

		static constexpr float SENS_MDPS_PER_LSB_2000 = 70.0f;
		static constexpr float MDPS_TO_DPS     = 1e-3f;
		static constexpr float DEG_TO_RAD      = 3.14159265358979323846f / 180.0f;
		static constexpr float MDPS_TO_RAD_S   = MDPS_TO_DPS * DEG_TO_RAD;
		static constexpr float GYRO_SCALING_RAD_S = SENS_MDPS_PER_LSB_2000 * MDPS_TO_RAD_S;

		  I2C_HandleTypeDef* hi2c_;


		  Config config_;

		  int current_num_init_ = 0;
		  static constexpr int MAX_NUM_INIT = 100;


		  HAL_StatusTypeDef writeReg(uint8_t reg, uint8_t val);
		  HAL_StatusTypeDef readReg(uint8_t reg, uint8_t* val);
		  HAL_StatusTypeDef readBurst(uint8_t start_reg, uint8_t* buf, uint16_t len);

		  HAL_StatusTypeDef internalInit();

};

}// telemetry
