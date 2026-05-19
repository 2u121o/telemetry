#pragma once
#include "Sensor.hpp"
#include "GPS.hpp"

namespace telemetry
{

class GPSSensor : public Sensor
{
public:
    explicit GPSSensor(uint32_t interval_ms, const char* prefix = "gps")
        : Sensor(interval_ms)
    {
        static const char* suffixes[] = {
            "lat", "lon", "alt_m", "speed_kmh",
            "course_deg", "hdop", "sats", "fix"
        };
        for (uint8_t i = 0; i < NUM_COLUMNS; ++i)
        {
            snprintf(name_bufs_[i], MAX_NAME_LEN, "%s_%s", prefix, suffixes[i]);
            name_ptrs_[i] = name_bufs_[i];
        }
    }

    bool init() override
    {
        return gps_.init();
    }

    bool read() override
    {
        gps_.readData(&data_);
        return true;
    }

    uint8_t columnCount() const override { return NUM_COLUMNS; }
    const char* const* columnNames() const override { return name_ptrs_; }

    void fillValues(float* buf) const override
    {
        buf[0] = static_cast<float>(data_.lat);
        buf[1] = static_cast<float>(data_.lon);
        buf[2] = static_cast<float>(data_.alt_m);
        buf[3] = static_cast<float>(data_.speed_kn * 1.852);  // nodi -> km/h
        buf[4] = static_cast<float>(data_.course_deg);
        buf[5] = static_cast<float>(data_.hdop);
        buf[6] = static_cast<float>(data_.sats);
        buf[7] = static_cast<float>(data_.fix);
    }

    GPS& gpsDriver() { return gps_; }

private:

    static constexpr uint8_t NUM_COLUMNS = 8;
    static constexpr uint8_t MAX_NAME_LEN = 20;

    GPS gps_;
    GPSData data_{};

    char name_bufs_[NUM_COLUMNS][MAX_NAME_LEN];
    const char* name_ptrs_[NUM_COLUMNS];
};

} // namespace telemetry