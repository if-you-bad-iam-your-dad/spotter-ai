import React, { useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { 
  Truck, 
  MapPin, 
  Navigation, 
  Clock, 
  Loader2, 
  Info, 
  ChevronRight, 
  Calendar,
  Fuel,
  Activity
} from 'lucide-react';
import DailyLog from './components/DailyLog';

// Fix for Leaflet marker icons in React
import L from 'leaflet';
import type { LatLngExpression, LatLngBoundsExpression } from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const API_BASE = (import.meta as any).env.VITE_API_URL || '';

const normalizeApiError = (err: any) => {
  const payload = err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message;

  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    return payload.message || payload.detail || JSON.stringify(payload);
  }

  return 'Check your internet connection or server status.';
};

// Component to handle map view fitting
function ChangeView({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  if (bounds) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
  return null;
}

function App() {
  const [inputs, setInputs] = useState({
    current_location: 'Los Angeles, CA',
    pickup_location: 'Phoenix, AZ',
    dropoff_location: 'Dallas, TX',
    current_cycle_used: '10'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.post(`${API_BASE}/api/trip/`, inputs);
      setResult(resp.data);
      setSelectedDayIndex(0);
    } catch (err: any) {
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const dailyLogEntries = result ? Object.entries(result.daily_logs) : [];
  const selectedDayEntry = dailyLogEntries[selectedDayIndex];

  const getBounds = () => {
    if (!result || !result.route_geometry) return null;
    const coords = result.route_geometry.coordinates.map((c: any) => [c[1], c[0]]);
    return coords as LatLngBoundsExpression;
  };

  return (
    <div className="h-screen bg-[#F1F5F9] flex overflow-hidden font-sans antialiased text-slate-900">
      
      {/* LEFT SIDEBAR: Control Panel */}
      <aside className="w-[400px] bg-[#0F172A] text-white flex flex-col shadow-2xl z-30 shrink-0">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter">SPOTTER <span className="text-blue-400">AI</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">HOS Logistics Pro</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
          <form onSubmit={handleCalculate} className="space-y-8">
            <div className="space-y-6">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Route Location Details</h2>
              
              <div className="space-y-4">
                <div className="group relative space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Current Location</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <div className="w-2 h-2 rounded-full bg-slate-500 group-focus-within:bg-blue-400 transition-colors" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="e.g. Houston, TX"
                      className="w-full pl-10 pr-4 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium placeholder:text-slate-700"
                      value={inputs.current_location}
                      onChange={e => setInputs({...inputs, current_location: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="group relative space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Pickup Location</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="e.g. Shipper address in Phoenix, AZ"
                      className="w-full pl-10 pr-4 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-medium placeholder:text-slate-700"
                      value={inputs.pickup_location}
                      onChange={e => setInputs({...inputs, pickup_location: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="group relative space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Dropoff Location</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <MapPin className="w-4 h-4 text-red-500" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="e.g. Receiver address in Dallas, TX"
                      className="w-full pl-10 pr-4 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl focus:border-red-500/50 focus:ring-4 focus:ring-red-500/10 outline-none transition-all text-sm font-medium placeholder:text-slate-700"
                      value={inputs.dropoff_location}
                      onChange={e => setInputs({...inputs, dropoff_location: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                  Current Cycle Hours <span className="text-blue-400">{inputs.current_cycle_used}h / 70h</span>
                </label>
                <input 
                  type="range" 
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  value={inputs.current_cycle_used}
                  onChange={e => setInputs({...inputs, current_cycle_used: e.target.value})}
                  min="0" max="70"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-3 group"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  GENERATE TRIP LOGS
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-semibold leading-relaxed">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-6 pt-6 border-t border-slate-800 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Analytics Dashboard</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800">
                  <Activity className="w-5 h-5 text-blue-400 mb-3" />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Distance</p>
                  <p className="text-xl font-black">{result.distance_miles.toLocaleString()} <span className="text-[10px] text-slate-500">MI</span></p>
                </div>
                <div className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800">
                  <Clock className="w-5 h-5 text-emerald-400 mb-3" />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Drive Time</p>
                  <p className="text-xl font-black">{result.duration_hrs.toFixed(1)} <span className="text-[10px] text-slate-500">HRS</span></p>
                </div>
              </div>
              <div className="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/60 leading-relaxed font-medium">
                  Compliance detected: Trip requires {Object.keys(result.daily_logs).length} daily logs with mandatory 10h resets and fueling.
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 text-center text-[10px] text-slate-600 font-bold tracking-widest border-t border-slate-800">
          © 2026 SPOTTER LOGISTICS SYSTEMS
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* TOP MAP SECTION */}
        <section className="h-[45%] w-full relative group shrink-0">
          <MapContainer 
            center={[37.0902, -95.7129]} 
            zoom={4} 
            zoomControl={false}
            style={{ height: '100%', width: '100%' }}
            className="z-10 grayscale hover:grayscale-0 transition-all duration-700"
          >
            <TileLayer 
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
              {...({ attribution: '&copy; CartoDB' } as any)} 
            />
            {result && (
              <>
                <ChangeView bounds={getBounds()!} />
                <Polyline 
                  positions={result.route_geometry.coordinates.map((c: any) => [c[1], c[0]]) as LatLngExpression[]} 
                  {...({ color: "#3B82F6", weight: 6, opacity: 0.8 } as any)} 
                />
                {result.stops.map((stop: any, idx: number) => (
                  <Marker key={idx} position={[stop.coords[1], stop.coords[0]] as LatLngExpression}>
                    <Popup>
                      <div className="font-bold text-slate-900">{stop.name}</div>
                    </Popup>
                  </Marker>
                ))}
              </>
            )}
          </MapContainer>
          
          <div className="absolute bottom-6 left-6 z-20 flex gap-3">
             <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200 shadow-xl flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center"><Navigation className="w-3 h-3 text-white" /></div>
                  <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center"><Fuel className="w-3 h-3 text-white" /></div>
                </div>
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider italic">Real-time Route Engine Active</span>
             </div>
          </div>
        </section>

        {/* LOGS SCROLLABLE SECTION */}
        <section className="flex-1 overflow-y-auto p-12 bg-[#F8FAFC]">
          {result ? (
            <div className="max-w-5xl mx-auto space-y-16 pb-20">
              <div className="flex items-end justify-between border-b-4 border-slate-900 pb-6">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">DRIVER DAILY LOGS</h2>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">ELD Compliance Verification</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Generated On</p>
                  <p className="text-lg font-black text-slate-900">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setSelectedDayIndex((current) => Math.max(0, current - 1))}
                  disabled={selectedDayIndex === 0}
                >
                  Previous Day
                </button>
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Day Viewer</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    Day {selectedDayIndex + 1} of {dailyLogEntries.length}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setSelectedDayIndex((current) => Math.min(dailyLogEntries.length - 1, current + 1))}
                  disabled={selectedDayIndex >= dailyLogEntries.length - 1}
                >
                  Next Day
                </button>
              </div>

              {selectedDayEntry && (() => {
                const [day, dayData] = selectedDayEntry as [string, any];
                return (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-12">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl italic shadow-xl">
                        {selectedDayIndex + 1}
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-slate-900 flex items-center gap-4 uppercase tracking-tighter">
                          {new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          <Calendar className="w-3 h-3" /> Day {selectedDayIndex + 1} of Route Plan
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                       <div className="xl:col-span-3">
                          <DailyLog 
                            day={day} 
                            events={dayData.events} 
                            totalMiles={dayData.total_miles}
                            from={inputs.pickup_location}
                            to={inputs.dropoff_location}
                          />
                       </div>
                       <div className="space-y-4">
                          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Day Timeline</h5>
                          <div className="space-y-3">
                            {dayData.events.map((e: any, i: number) => (
                              <div key={i} className="flex gap-3 items-start group">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors shrink-0" />
                                <div>
                                  <p className="text-[11px] font-black text-slate-800 uppercase leading-none">{new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  <p className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">{e.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                       </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center space-y-8 text-center max-w-lg mx-auto">
              <div className="relative">
                <div className="absolute -inset-8 bg-blue-500/10 rounded-full animate-pulse blur-2xl" />
                <div className="relative bg-white w-32 h-32 rounded-[2.5rem] shadow-2xl flex items-center justify-center border border-slate-100">
                  <Navigation className="w-12 h-12 text-blue-500 opacity-40" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">READY FOR DISPATCH</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Enter your current location and mission details in the control tower to generate your flight plan and HOS logs.
                </p>
              </div>
              <div className="flex gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <span>Secure Cloud API</span>
                <span>•</span>
                <span>FMCSA Compliant</span>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Global CSS for scrollbars */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        .leaflet-container { font-family: inherit; }
      `}} />
    </div>
  );
}

export default App;
