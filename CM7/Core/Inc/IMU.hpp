#pragma once
#include "Sensor.hpp"
#include "Accelerometer.hpp"

namespace telemetry
{

class IMUSensor : public Sensor
{

public:
    IMUSensor(uint32_t interval_ms, I2C_HandleTypeDef* hi2c, const char* sensor_name, const Config& cfg = Config())
        : Sensor(interval_ms), hi2c_(hi2c), config_(cfg)
    {
        static const char* suffixes[] = {"ax", "ay", "az", "wx", "wy", "wz"};
        for (uint8_t i = 0; i < NUM_COLUMNS; ++i)
        {
            snprintf(name_bufs_[i], MAX_NAME_LEN, "%s_%s", sensor_name, suffixes[i]);
            name_ptrs_[i] = name_bufs_[i];
        }
    }

    bool init() override
    {
        return accelerometer_.init(hi2c_, config_);
    }

    bool read() override
    {
        return accelerometer_.readData(&values_) == HAL_OK;
    }

    uint8_t columnCount() const override { return 6; }


    const char* const* columnNames() const override { return name_ptrs_; }
    

    void fillValues(float* buf) const override
    {
        buf[0] = values_.ax;
        buf[1] = values_.ay;
        buf[2] = values_.az;
        buf[3] = values_.wx;
        buf[4] = values_.wy;
        buf[5] = values_.wz;
    }

private:

    static constexpr uint8_t NUM_COLUMNS = 6;
    static constexpr uint8_t MAX_NAME_LEN = 16;
    
    I2C_HandleTypeDef* hi2c_;
    Config config_;
    Accelerometer accelerometer_;
    IMUValues values_{};

    char name_bufs_[NUM_COLUMNS][MAX_NAME_LEN]; 
    const char* name_ptrs_[NUM_COLUMNS]; 
};

} // namespace telemetry