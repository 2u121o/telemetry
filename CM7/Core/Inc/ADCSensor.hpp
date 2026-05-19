#pragma once
#include "Sensor.hpp"
#include "adc3_init.hpp"

namespace telemetry
{

class ADCSensor : public Sensor
{
public:
    ADCSensor(uint32_t interval_ms, const char* name)
        : Sensor(interval_ms), name_(name) {}

    bool init() override
    {
        ADC3_PC2C_INP0_Init();
        return true;
    }

    bool read() override
    {
        last_voltage_ = ADC3_Read_V();
        return true;
    }

    uint8_t columnCount() const override { return 1; }

    const char* const* columnNames() const override
    {
        return &name_;
    }

    void fillValues(float* buf) const override
    {
        buf[0] = last_voltage_;
    }

private:
    const char* name_;
    float last_voltage_ = 0.0f;
};

} // namespace telemetry