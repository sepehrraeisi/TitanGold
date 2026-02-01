// Timezone Selector Component for Profile Settings
import React from 'react';

// Common timezones (IANA format)
const COMMON_TIMEZONES = [
    // Asia
    { value: 'Asia/Tehran', label: 'Asia/Tehran (Iran)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (UAE)' },
    { value: 'Asia/Riyadh', label: 'Asia/Riyadh (Saudi Arabia)' },
    { value: 'Asia/Kuwait', label: 'Asia/Kuwait' },
    { value: 'Asia/Qatar', label: 'Asia/Qatar' },
    { value: 'Asia/Bahrain', label: 'Asia/Bahrain' },
    { value: 'Asia/Baghdad', label: 'Asia/Baghdad (Iraq)' },
    { value: 'Asia/Jerusalem', label: 'Asia/Jerusalem (Israel)' },
    { value: 'Asia/Beirut', label: 'Asia/Beirut (Lebanon)' },
    { value: 'Asia/Damascus', label: 'Asia/Damascus (Syria)' },
    { value: 'Asia/Amman', label: 'Asia/Amman (Jordan)' },
    { value: 'Asia/Istanbul', label: 'Asia/Istanbul (Turkey)' },
    { value: 'Asia/Karachi', label: 'Asia/Karachi (Pakistan)' },
    { value: 'Asia/Kabul', label: 'Asia/Kabul (Afghanistan)' },
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (India)' },
    { value: 'Asia/Dhaka', label: 'Asia/Dhaka (Bangladesh)' },
    { value: 'Asia/Bangkok', label: 'Asia/Bangkok (Thailand)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore' },
    { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (China)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (Japan)' },
    { value: 'Asia/Seoul', label: 'Asia/Seoul (South Korea)' },
    
    // Europe
    { value: 'Europe/London', label: 'Europe/London (UK)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (France)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (Germany)' },
    { value: 'Europe/Rome', label: 'Europe/Rome (Italy)' },
    { value: 'Europe/Madrid', label: 'Europe/Madrid (Spain)' },
    { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (Netherlands)' },
    { value: 'Europe/Brussels', label: 'Europe/Brussels (Belgium)' },
    { value: 'Europe/Zurich', label: 'Europe/Zurich (Switzerland)' },
    { value: 'Europe/Vienna', label: 'Europe/Vienna (Austria)' },
    { value: 'Europe/Stockholm', label: 'Europe/Stockholm (Sweden)' },
    { value: 'Europe/Oslo', label: 'Europe/Oslo (Norway)' },
    { value: 'Europe/Copenhagen', label: 'Europe/Copenhagen (Denmark)' },
    { value: 'Europe/Helsinki', label: 'Europe/Helsinki (Finland)' },
    { value: 'Europe/Warsaw', label: 'Europe/Warsaw (Poland)' },
    { value: 'Europe/Prague', label: 'Europe/Prague (Czech Republic)' },
    { value: 'Europe/Budapest', label: 'Europe/Budapest (Hungary)' },
    { value: 'Europe/Athens', label: 'Europe/Athens (Greece)' },
    { value: 'Europe/Moscow', label: 'Europe/Moscow (Russia)' },
    
    // Americas
    { value: 'America/New_York', label: 'America/New York (US Eastern)' },
    { value: 'America/Chicago', label: 'America/Chicago (US Central)' },
    { value: 'America/Denver', label: 'America/Denver (US Mountain)' },
    { value: 'America/Los_Angeles', label: 'America/Los Angeles (US Pacific)' },
    { value: 'America/Toronto', label: 'America/Toronto (Canada)' },
    { value: 'America/Mexico_City', label: 'America/Mexico City' },
    { value: 'America/Sao_Paulo', label: 'America/Sao Paulo (Brazil)' },
    { value: 'America/Buenos_Aires', label: 'America/Buenos Aires (Argentina)' },
    { value: 'America/Santiago', label: 'America/Santiago (Chile)' },
    
    // Australia & Pacific
    { value: 'Australia/Sydney', label: 'Australia/Sydney' },
    { value: 'Australia/Melbourne', label: 'Australia/Melbourne' },
    { value: 'Australia/Perth', label: 'Australia/Perth' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland (New Zealand)' },
    
    // Africa
    { value: 'Africa/Cairo', label: 'Africa/Cairo (Egypt)' },
    { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (South Africa)' },
    { value: 'Africa/Lagos', label: 'Africa/Lagos (Nigeria)' },
    { value: 'Africa/Nairobi', label: 'Africa/Nairobi (Kenya)' },
    
    // UTC
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

interface TimezoneSelectProps {
    label: string;
    id: string;
    value: string;
    onChange: (value: string) => void;
}

const TimezoneSelect: React.FC<TimezoneSelectProps> = ({ label, id, value, onChange }) => {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
                {label}
            </label>
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-200"
            >
                <option value="">Select Timezone...</option>
                {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                        {tz.label}
                    </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
                Current time: {new Date().toLocaleString('en-US', { timeZone: value || 'UTC' })}
            </p>
        </div>
    );
};

export default TimezoneSelect;
