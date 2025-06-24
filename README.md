## Funkcje

- 🛩️ Śledzenie samolotów w czasie rzeczywistym
- 🗺️ Interaktywna mapa z możliwością przybliżania i przesuwania
- ✈️ Szczegółowe informacje o każdym locie
- 🏢 Informacje o liniach lotniczych i typach samolotów
- 📊 Filtrowanie lotów według różnych kryteriów
- 📱 Responsywny design działający na wszystkich urządzeniach
- 🔍 Integracja z wieloma źródłami danych o samolotach

## Technologie

- Next.js 14
- React
- TypeScript
- Leaflet
- Tailwind CSS
- OpenSky Network API

## Źródła danych o samolotach

Aplikacja integruje dane z następujących źródeł:

### 1. OpenSky Network API
- **Rejestracja samolotu** - pobierana z OpenSky metadata API
- **Podstawowe informacje** - model, producent, właściciel, operator
- **Pozycja lotu** - dane o pozycji w czasie rzeczywistym

### 2. Planespotters.net API
- **Zdjęcia samolotów** - zdjęcia konkretnych egzemplarzy
- **Dodatkowe informacje** - rok produkcji, typ silnika
- **Fallback dla modelu** - jeśli OpenSky nie ma danych

## Instalacja

1. Sklonuj repozytorium:
```bash
git clone https://github.com/twoje-konto/flight-miki.git
```

2. Zainstaluj zależności:
```bash
cd flight-miki
npm install
```

3. Skopiuj plik `.env.example` do `.env` i uzupełnij wymagane zmienne środowiskowe:

```bash
# OpenSky Network API (wymagane)
OPENSKY_USERNAME=your_username
OPENSKY_PASSWORD=your_password

# Supabase (autoryzacja)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Opcjonalne API
FLIGHTAWARE_API_KEY=your_flightaware_api_key
AERODATABOX_API_KEY=your_aerodatabox_api_key

# Base URL dla API (opcjonalne)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

4. Uruchom aplikację w trybie deweloperskim:
```bash
npm run dev
```

Aplikacja będzie dostępna pod adresem `http://localhost:3000`.

## API Endpoints

### `/api/aircraft-info`
Pobiera szczegółowe informacje o samolocie na podstawie ICAO24 lub rejestracji.

**Parametry:**
- `icao24` - kod ICAO24 samolotu
- `registration` - rejestracja samolotu

**Przykład:**
```bash
GET /api/aircraft-info?icao24=a12345
```

**Odpowiedź:**
```json
{
  "success": true,
  "data": {
    "registration": "SP-LRD",
    "model": "Boeing 737-800",
    "manufacturer": "Boeing",
    "owner": "LOT Polish Airlines",
    "operator": "LOT Polish Airlines",
    "yearBuilt": "2010",
    "engineType": "CFM56-7B26",
    "category": "A3",
    "photoUrl": "https://..."
  },
  "sources": {
    "opensky": true,
    "planespotters": true,
    "flightaware": false
  }
}
```

## Licencja

CC
