import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .hos_service import HOSService

class TripCalculateView(APIView):
    """
    Endpoint to calculate trip route and HOS logs.
    """
    
    NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
    OSRM_URL = "http://router.project-osrm.org/route/v1/driving/"
    
    def post(self, request):
        current_loc = request.data.get("current_location")
        pickup_loc = request.data.get("pickup_location")
        dropoff_loc = request.data.get("dropoff_location")
        cycle_used = float(request.data.get("current_cycle_used", 0))
        
        try:
            # 1. Geocoding
            locations = [current_loc, pickup_loc, dropoff_loc]
            coords = []
            
            headers = {"User-Agent": "Spotter-ELD-Assessment/1.0"}
            
            for loc in locations:
                params = {"q": loc, "format": "json", "limit": 1}
                resp = requests.get(self.NOMINATIM_URL, params=params, headers=headers)
                data = resp.json()
                if not data:
                    return Response({"error": f"Location not found: {loc}"}, status=status.HTTP_400_BAD_REQUEST)
                coords.append((data[0]["lon"], data[0]["lat"]))
            
            # 2. Routing (Current -> Pickup -> Dropoff)
            coord_str = ";".join([f"{c[0]},{c[1]}" for c in coords])
            route_url = f"{self.OSRM_URL}{coord_str}?overview=full&geometries=geojson"
            
            route_resp = requests.get(route_url)
            route_data = route_resp.json()
            
            if route_data.get("code") != "Ok":
                return Response({"error": "Routing failed"}, status=status.HTTP_400_BAD_REQUEST)
            
            route = route_data["routes"][0]
            distance_miles = route["distance"] * 0.000621371
            duration_hrs = route["duration"] / 3600.0
            geometry = route["geometry"]
            
            # 3. HOS Calculation
            hos = HOSService(current_cycle_used_hrs=cycle_used)
            events = hos.calculate_trip(distance_miles, duration_hrs, route_coords=geometry["coordinates"])
            daily_logs = hos.partition_by_day(events)
            
            # Combine all stop markers for the map
            all_stop_markers = []
            for day_data in daily_logs.values():
                all_stop_markers.extend(day_data["stop_markers"])

            return Response({
                "distance_miles": round(distance_miles, 2),
                "duration_hrs": round(duration_hrs, 2),
                "route_geometry": geometry,
                "daily_logs": daily_logs,
                "stops": all_stop_markers # Use interpolated HOS stops
            })
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
