import math
from datetime import datetime, timedelta

class HOSService:
    """
    Service to calculate truck routes and logs based on FMCSA HOS rules.
    """
    
    # Constants based on FMCSA rules (Property carrying, 70/8 rule)
    MAX_DRIVING_HRS = 11.0
    MAX_DUTY_WINDOW_HRS = 14.0
    REST_BREAK_THRESHOLD_HRS = 8.0
    REST_BREAK_DURATION_HRS = 0.5
    OFF_DUTY_REQUIRED_HRS = 10.0
    CYCLE_LIMIT_HRS = 70.0
    
    # Trip assumptions
    FUEL_INTERVAL_MILES = 1000.0
    FUEL_DURATION_HRS = 0.5 # Assume 30 mins for fueling
    WORK_STOP_DURATION_HRS = 1.0 # 1 hr for pickup/dropoff
    
    def __init__(self, current_cycle_used_hrs=0.0):
        self.current_cycle_used_hrs = current_cycle_used_hrs
        self.events = []
        self.route_coords = [] # List of (lon, lat) from OSRM
        
    def _get_coords_at_distance(self, target_miles):
        """
        Finds the (lon, lat) point along the route path at a specific mileage.
        """
        if not self.route_coords: return None
        
        # Simple distance-along-path calculation
        total_dist_mi = 0.0
        for i in range(len(self.route_coords) - 1):
            p1 = self.route_coords[i]
            p2 = self.route_coords[i+1]
            
            # approx deg to miles
            d = math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2) * 69.0
            if total_dist_mi + d >= target_miles:
                # Interpolate between p1 and p2
                ratio = (target_miles - total_dist_mi) / d if d > 0 else 0
                lon = p1[0] + (p2[0] - p1[0]) * ratio
                lat = p1[1] + (p2[1] - p1[1]) * ratio
                return (lon, lat)
            total_dist_mi += d
            
        return self.route_coords[-1]

    def calculate_trip(self, distance_miles, duration_hrs, route_coords=None, start_time=None):
        self.route_coords = route_coords or []
        if start_time is None:
            start_time = datetime.now().replace(minute=0, second=0, microsecond=0)
            
        current_time = start_time
        avg_speed = distance_miles / duration_hrs if duration_hrs > 0 else 55.0
        
        # Cycle starts with what's been used
        cycle_remaining = self.CYCLE_LIMIT_HRS - self.current_cycle_used_hrs

        # 1. Pickup (On Duty)
        pickup_start = current_time
        current_time += timedelta(hours=self.WORK_STOP_DURATION_HRS)
        self.add_event("On Duty (Not Driving)", pickup_start, current_time, "Pickup at Shipper", coords=self.route_coords[0] if self.route_coords else None)
        cycle_remaining -= self.WORK_STOP_DURATION_HRS
        
        # Initial State for Loop
        driving_remaining_in_day = self.MAX_DRIVING_HRS
        window_end_time = pickup_start + timedelta(hours=self.MAX_DUTY_WINDOW_HRS)
        cumulative_driving_since_break = 0.0
        cumulative_miles = 0.0
        total_driving_remaining = duration_hrs
        miles_since_fuel = 0.0
        
        while total_driving_remaining > 0:
            can_drive_hrs = total_driving_remaining
            
            # Limits
            can_drive_hrs = min(can_drive_hrs, driving_remaining_in_day) 
            hrs_to_window_end = (window_end_time - current_time).total_seconds() / 3600.0
            can_drive_hrs = min(can_drive_hrs, max(0.0, hrs_to_window_end)) 
            can_drive_hrs = min(can_drive_hrs, self.REST_BREAK_THRESHOLD_HRS - cumulative_driving_since_break) 
            can_drive_hrs = min(can_drive_hrs, (self.FUEL_INTERVAL_MILES - miles_since_fuel) / avg_speed) 
            can_drive_hrs = min(can_drive_hrs, cycle_remaining) 
            
            if can_drive_hrs > 0.05: 
                drive_start = current_time
                current_time += timedelta(hours=can_drive_hrs)
                miles_driven = can_drive_hrs * avg_speed
                cumulative_miles += miles_driven
                self.add_event("Driving", drive_start, current_time, "Driving", miles=miles_driven)
                
                total_driving_remaining -= can_drive_hrs
                driving_remaining_in_day -= can_drive_hrs
                cumulative_driving_since_break += can_drive_hrs
                cycle_remaining -= can_drive_hrs
                miles_since_fuel += miles_driven
                
                if total_driving_remaining <= 0:
                    break
            
            stop_coords = self._get_coords_at_distance(cumulative_miles)
            
            if cycle_remaining <= 0:
                restart_start = current_time
                current_time += timedelta(hours=34)
                self.add_event("Off Duty", restart_start, current_time, "34-hour Cycle Restart", coords=stop_coords)
                cycle_remaining = self.CYCLE_LIMIT_HRS
                driving_remaining_in_day = self.MAX_DRIVING_HRS
                window_end_time = current_time + timedelta(hours=self.MAX_DUTY_WINDOW_HRS)
                cumulative_driving_since_break = 0.0
                continue

            if cumulative_driving_since_break >= self.REST_BREAK_THRESHOLD_HRS:
                break_start = current_time
                current_time += timedelta(hours=self.REST_BREAK_DURATION_HRS)
                self.add_event("Off Duty", break_start, current_time, "30-minute Rest Break", coords=stop_coords)
                cumulative_driving_since_break = 0.0
                continue
                
            if miles_since_fuel >= self.FUEL_INTERVAL_MILES:
                fuel_start = current_time
                current_time += timedelta(hours=self.FUEL_DURATION_HRS)
                self.add_event("On Duty (Not Driving)", fuel_start, current_time, "Fueling", coords=stop_coords)
                cycle_remaining -= self.FUEL_DURATION_HRS
                miles_since_fuel = 0.0
                continue
                
            if driving_remaining_in_day <= 0 or current_time >= window_end_time:
                sleep_start = current_time
                current_time += timedelta(hours=self.OFF_DUTY_REQUIRED_HRS)
                self.add_event("Sleeper Berth", sleep_start, current_time, "Daily Sleep", coords=stop_coords)
                driving_remaining_in_day = self.MAX_DRIVING_HRS
                window_end_time = current_time + timedelta(hours=self.MAX_DUTY_WINDOW_HRS)
                cumulative_driving_since_break = 0.0
                continue
            
            if can_drive_hrs <= 0: 
                current_time += timedelta(minutes=15)
        
        # 3. Dropoff
        dropoff_start = current_time
        current_time += timedelta(hours=self.WORK_STOP_DURATION_HRS)
        self.add_event("On Duty (Not Driving)", dropoff_start, current_time, "Dropoff at Consignee", coords=self.route_coords[-1] if self.route_coords else None)
        cycle_remaining -= self.WORK_STOP_DURATION_HRS
        
        return self.events

    def add_event(self, status, start, end, description, miles=0.0, coords=None):
        self.events.append({
            "status": status,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "description": description,
            "miles": miles,
            "coords": coords
        })

    def partition_by_day(self, events):
        daily_logs = {}
        for event in events:
            start = datetime.fromisoformat(event["start"])
            end = datetime.fromisoformat(event["end"])
            total_duration_sec = (end - start).total_seconds()
            
            temp_start = start
            while temp_start < end:
                day_key = temp_start.strftime("%Y-%m-%d")
                if day_key not in daily_logs:
                    daily_logs[day_key] = {"events": [], "total_miles": 0.0, "stop_markers": []}
                    
                day_end = (temp_start + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                actual_end = min(end, day_end)
                
                event_duration_in_day = (actual_end - temp_start).total_seconds()
                apportioned_miles = (event_duration_in_day / total_duration_sec) * event["miles"] if total_duration_sec > 0 else 0
                
                daily_logs[day_key]["events"].append({
                    "status": event["status"],
                    "start": temp_start.isoformat(),
                    "end": actual_end.isoformat(),
                    "description": event["description"]
                })
                daily_logs[day_key]["total_miles"] += apportioned_miles
                
                if event.get("coords") and temp_start == start:
                    daily_logs[day_key]["stop_markers"].append({
                        "name": event["description"],
                        "coords": event["coords"]
                    })
                
                temp_start = actual_end
                
        return daily_logs
