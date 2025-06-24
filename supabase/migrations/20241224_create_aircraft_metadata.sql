-- Create aircraft_metadata table
CREATE TABLE IF NOT EXISTS aircraft_metadata (
    id SERIAL PRIMARY KEY,
    icao24 VARCHAR(50),
    registration VARCHAR(50),
    manufacturer_icao VARCHAR(50),
    manufacturer_name VARCHAR(200),
    model VARCHAR(200),
    type_code VARCHAR(50),
    serial_number VARCHAR(100),
    line_number VARCHAR(100),
    icao_aircraft_type VARCHAR(50),
    operator VARCHAR(200),
    operator_callsign VARCHAR(100),
    operator_icao VARCHAR(50),
    operator_iata VARCHAR(50),
    owner VARCHAR(200),
    test_reg VARCHAR(50),
    registered VARCHAR(50),
    reg_until VARCHAR(50),
    status VARCHAR(100),
    built VARCHAR(50),
    first_flight_date VARCHAR(50),
    seat_configuration VARCHAR(100),
    engines TEXT,
    modes BOOLEAN DEFAULT false,
    adsb BOOLEAN DEFAULT false,
    acars BOOLEAN DEFAULT false,
    notes TEXT,
    category_description VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_aircraft_metadata_registration ON aircraft_metadata(registration);
CREATE INDEX IF NOT EXISTS idx_aircraft_metadata_icao24 ON aircraft_metadata(icao24);
CREATE INDEX IF NOT EXISTS idx_aircraft_metadata_model ON aircraft_metadata(model);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_aircraft_metadata_updated_at 
    BEFORE UPDATE ON aircraft_metadata 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 