const { createClient } = require('@supabase/supabase-js');

// Supabase connection data
const supabaseUrl = 'https://pyprvfpadvwsyewauwyf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cHJ2ZnBhZHZ3c3lld2F1d3lmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDYxMDk5OSwiZXhwIjoyMDY2MTg2OTk5fQ.JRNXcQqztbGGw8KyuN_Hb-toiySNvqWL_ND5O3PSKAA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function downloadAndImportCSV() {
  try {
    console.log('Starting aircraft data import...');
    
    // Download CSV from OpenSky
    console.log('Downloading CSV from OpenSky...');
    const response = await fetch('https://s3.opensky-network.org/data-samples/metadata/aircraftDatabase.csv');
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    console.log(`Processing ${lines.length} lines...`);
    
    // Clear existing data
    console.log('Clearing existing data...');
    const { error: deleteError } = await supabase
      .from('aircraft_metadata')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (deleteError) {
      console.error('Error clearing data:', deleteError);
      return;
    }
    
    // Process and insert data in batches
    const batchSize = 1000;
    const batches = [];
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Parse CSV line (simple parsing)
      const values = line.split('","').map(v => v.replace(/"/g, ''));
      
      if (values.length >= 20) {
        const [
          icao24, registration, manufacturerIcao, manufacturerName, model,
          typeCode, serialNumber, lineNumber, icaoAircraftType, operator,
          operatorCallsign, operatorIcao, operatorIata, owner, testReg,
          registered, regUntil, status, built, firstFlightDate,
          seatConfiguration, engines, modes, adsb, acars, notes, categoryDescription
        ] = values;
        
        // Only insert if we have registration or icao24
        if (registration && registration.trim() && registration !== '') {
          batches.push({
            icao24: icao24?.trim() || null,
            registration: registration?.trim() || null,
            manufacturer_icao: manufacturerIcao?.trim() || null,
            manufacturer_name: manufacturerName?.trim() || null,
            model: model?.trim() || null,
            type_code: typeCode?.trim() || null,
            serial_number: serialNumber?.trim() || null,
            line_number: lineNumber?.trim() || null,
            icao_aircraft_type: icaoAircraftType?.trim() || null,
            operator: operator?.trim() || null,
            operator_callsign: operatorCallsign?.trim() || null,
            operator_icao: operatorIcao?.trim() || null,
            operator_iata: operatorIata?.trim() || null,
            owner: owner?.trim() || null,
            test_reg: testReg?.trim() || null,
            registered: registered?.trim() || null,
            reg_until: regUntil ? new Date(regUntil) : null,
            status: status?.trim() || null,
            built: built?.trim() || null,
            first_flight_date: firstFlightDate ? new Date(firstFlightDate) : null,
            seat_configuration: seatConfiguration?.trim() || null,
            engines: engines?.trim() || null,
            modes: modes === 'true',
            adsb: adsb === 'true',
            acars: acars === 'true',
            notes: notes?.trim() || null,
            category_description: categoryDescription?.trim() || null
          });
        }
      }
      
      // Insert in batches
      if (batches.length >= batchSize) {
        await insertBatch(batches);
        batches.length = 0; // Clear array
      }
    }
    
    // Insert remaining records
    if (batches.length > 0) {
      await insertBatch(batches);
    }
    
    console.log('Import completed successfully!');
    
  } catch (error) {
    console.error('Error during import:', error);
  }
}

async function insertBatch(batch) {
  try {
    const { error } = await supabase
      .from('aircraft_metadata')
      .insert(batch);
    
    if (error) {
      console.error('Error inserting batch:', error);
    } else {
      console.log(`Inserted ${batch.length} records`);
    }
  } catch (error) {
    console.error('Error in insertBatch:', error);
  }
}

// Run the import
downloadAndImportCSV(); 