#pragma once
#include <cstdint>
#include <cstdio>

namespace telemetry
{

class Sensor
{
public:
   
    explicit Sensor(uint32_t sample_interval_ms): sample_interval_ms_(sample_interval_ms) {}

    virtual ~Sensor() = default;

    virtual bool init() = 0;

    virtual bool read() = 0;

    virtual uint8_t columnCount() const = 0;

    virtual const char* const* columnNames() const = 0;

    virtual void fillValues(float* buf) const = 0;

    bool shouldSample(uint32_t now_ms) const
    {
        return (now_ms - last_sample_ms_) >= sample_interval_ms_;
    }

    void markSampled(uint32_t now_ms)
    {
        last_sample_ms_ = now_ms;
    }

    uint32_t sampleIntervalMs() const { return sample_interval_ms_; }

protected:
    uint32_t sample_interval_ms_;
    uint32_t last_sample_ms_ = 0;
};

} // namespace telemetry