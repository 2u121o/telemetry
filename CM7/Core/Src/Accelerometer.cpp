#include "Accelerometer.hpp"

namespace telemetry
{

bool Accelerometer::init(I2C_HandleTypeDef* hi2c, const Config& config)
{
  hi2c_ = hi2c;
  config_ = config;

  HAL_StatusTypeDef ret_init = internalInit();
  while(ret_init!=HAL_OK && current_num_init_++<=MAX_NUM_INIT)
  {
	  ret_init = internalInit();
  }

  if(current_num_init_>=MAX_NUM_INIT && ret_init!=HAL_OK)
  {
	  return false;
  }

  return true;

}

HAL_StatusTypeDef Accelerometer::internalInit()
{
	  if (!hi2c_) return HAL_ERROR;

	  HAL_StatusTypeDef st;
	  uint8_t who = 0, ctrl3 = 0;


	  st = writeReg(config_.CTRL3_C, 0x01);
	  if (st != HAL_OK) return st;

	  do {
	    HAL_Delay(2);
	    st = readReg(config_.CTRL3_C, &ctrl3);
	    if (st != HAL_OK) return st;
	  } while (ctrl3 & 0x01);

	  st = writeReg(config_.CTRL3_C, config_.CTRL3_C_CFG);
	  if (st != HAL_OK) return st;


	  st = writeReg(config_.CTRL1_XL, config_.CTRL1_XL_CFG);
	  if (st != HAL_OK) return st;

	  st = writeReg(config_.CTRL2_G, config_.CTRL2_G_CFG);
	  if (st != HAL_OK) return st;

	  st = readReg(config_.WHO_AM_I, &who);
	  if (st != HAL_OK) return st;

	  return (who == config_.WHO_AM_I_EXPECT) ? HAL_OK : HAL_ERROR;
}

HAL_StatusTypeDef Accelerometer::readData(IMUValues *imu_values)
{
	  if (!hi2c_ || !imu_values) return HAL_ERROR;

	  uint8_t a_raw[6];
	  HAL_StatusTypeDef a_st = readBurst(config_.OUTX_L_A, a_raw, sizeof(a_raw));
	  if (a_st != HAL_OK) return a_st;

	  int16_t ax = static_cast<int16_t>((a_raw[1] << 8) | a_raw[0]);
	  int16_t ay = static_cast<int16_t>((a_raw[3] << 8) | a_raw[2]);
	  int16_t az = static_cast<int16_t>((a_raw[5] << 8) | a_raw[4]);

	  uint8_t g_raw[6];
	  HAL_StatusTypeDef g_st = readBurst(config_.OUTX_L_G , g_raw, sizeof(g_raw));
	  if (g_st != HAL_OK) return g_st;

	  int16_t wx = (int16_t)((g_raw[1] << 8) | g_raw[0]);
	  int16_t wy = (int16_t)((g_raw[3] << 8) | g_raw[2]);
	  int16_t wz = (int16_t)((g_raw[5] << 8) | g_raw[4]);


	  (*imu_values).ax = ax * SCALING;
	  (*imu_values).ay = ay * SCALING;
	  (*imu_values).az = az * SCALING;

	  (*imu_values).wx = wx * GYRO_SCALING_RAD_S;
	  (*imu_values).wy = wy * GYRO_SCALING_RAD_S;
	  (*imu_values).wz = wz * GYRO_SCALING_RAD_S;

	  return HAL_OK;
}

HAL_StatusTypeDef Accelerometer::writeReg(uint8_t reg, uint8_t val)
{
  return HAL_I2C_Mem_Write(hi2c_, config_.imu_addr, reg,
                           I2C_MEMADD_SIZE_8BIT, &val, 1, 100);
}

HAL_StatusTypeDef Accelerometer::readReg(uint8_t reg, uint8_t* val)
{
  return HAL_I2C_Mem_Read(hi2c_, config_.imu_addr, reg,
                          I2C_MEMADD_SIZE_8BIT, val, 1, 100);
}

HAL_StatusTypeDef Accelerometer::readBurst(uint8_t start_reg, uint8_t* buf, uint16_t len)
{
  return HAL_I2C_Mem_Read(hi2c_, config_.imu_addr, start_reg,
                          I2C_MEMADD_SIZE_8BIT, buf, len, 100);
}

}//telemetry
