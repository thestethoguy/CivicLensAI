/**
 * CivicLens AI – Geolocation Hook
 * Silently captures the user's GPS coordinates via the browser Geolocation API.
 */

import { useState, useCallback } from 'react';

const DEFAULT_COORDS = { latitude: 28.6139, longitude: 77.2090 }; // Delhi, India fallback

/**
 * @returns {{
 *   coords: {latitude: number, longitude: number} | null,
 *   locationError: string | null,
 *   locationStatus: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable',
 *   requestLocation: () => void,
 * }}
 */
export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setLocationStatus('unavailable');
      setCoords(DEFAULT_COORDS);
      return;
    }

    setLocationStatus('requesting');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus('granted');
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        // Fallback to default coordinates so the analysis can still proceed
        setCoords(DEFAULT_COORDS);
        setLocationStatus('denied');
        setLocationError(
          error.code === 1
            ? 'Location access denied. Using approximate coordinates.'
            : 'Unable to retrieve your location. Using approximate coordinates.'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  }, []);

  return { coords, locationError, locationStatus, requestLocation };
}
