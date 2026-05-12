from django.test import TestCase
from datetime import datetime, timedelta
from .hos_service import HOSService

class HOSLogicTest(TestCase):
    """
    Tests to ensure HOS simulation satisfies all assessment requirements.
    """

    def setUp(self):
        # Default start time for tests
        self.start_time = datetime(2026, 5, 12, 8, 0)

    def test_basic_trip_structure(self):
        """
        Verify that a simple trip includes pickup and dropoff of 1 hour each.
        """
        hos = HOSService(current_cycle_used_hrs=0)
        # Short 2 hour drive
        events = hos.calculate_trip(distance_miles=100, duration_hrs=2, start_time=self.start_time)
        
        # Events should be: Pickup (1h) -> Driving (2h) -> Dropoff (1h)
        self.assertEqual(events[0]["description"], "Pickup at Shipper")
        self.assertEqual(events[-1]["description"], "Dropoff at Consignee")
        
        # Verify pickup duration
        pickup = events[0]
        duration = (datetime.fromisoformat(pickup["end"]) - datetime.fromisoformat(pickup["start"])).total_seconds() / 3600
        self.assertEqual(duration, 1.0)

    def test_mandatory_30min_break(self):
        """
        Verify a 30-minute break is inserted after 8 hours of driving.
        """
        hos = HOSService(current_cycle_used_hrs=0)
        # 10 hour drive (should trigger break at 8h)
        events = hos.calculate_trip(distance_miles=550, duration_hrs=10, start_time=self.start_time)
        
        break_events = [e for e in events if e["description"] == "30-minute Rest Break"]
        self.assertTrue(len(break_events) >= 1)
        
        # Check duration of the break
        b = break_events[0]
        duration = (datetime.fromisoformat(b["end"]) - datetime.fromisoformat(b["start"])).total_seconds() / 3600
        self.assertEqual(duration, 0.5)

    def test_fueling_requirement(self):
        """
        Verify fueling happens at least once every 1,000 miles.
        """
        hos = HOSService(current_cycle_used_hrs=0)
        # 1200 mile trip (should trigger at least one fuel stop)
        events = hos.calculate_trip(distance_miles=1200, duration_hrs=22, start_time=self.start_time)
        
        fuel_events = [e for e in events if e["description"] == "Fueling"]
        self.assertTrue(len(fuel_events) >= 1)

    def test_11hr_driving_limit_and_sleep(self):
        """
        Verify that a 10-hour sleeper berth period is inserted after 11 hours of driving.
        """
        hos = HOSService(current_cycle_used_hrs=0)
        # 15 hour drive (should trigger 10h sleep after 11h)
        events = hos.calculate_trip(distance_miles=800, duration_hrs=15, start_time=self.start_time)
        
        sleep_events = [e for e in events if e["status"] == "Sleeper Berth"]
        self.assertTrue(len(sleep_events) >= 1)
        
        # Verify duration is 10 hours
        s = sleep_events[0]
        duration = (datetime.fromisoformat(s["end"]) - datetime.fromisoformat(s["start"])).total_seconds() / 3600
        self.assertEqual(duration, 10.0)

    def test_70hr_cycle_restart(self):
        """
        Verify that a 34-hour restart is triggered when the 70-hour cycle is exhausted.
        """
        # Start with 68 hours already used
        hos = HOSService(current_cycle_used_hrs=68.0)
        # Try to drive 10 hours
        events = hos.calculate_trip(distance_miles=550, duration_hrs=10, start_time=self.start_time)
        
        restart_events = [e for e in events if "34-hour Cycle Restart" in e["description"]]
        self.assertTrue(len(restart_events) >= 1)
        
        # Verify duration is 34 hours
        r = restart_events[0]
        duration = (datetime.fromisoformat(r["end"]) - datetime.fromisoformat(r["start"])).total_seconds() / 3600
        self.assertEqual(duration, 34.0)

    def test_multi_day_partitioning(self):
        """
        Verify that a long trip correctly partitions into multiple daily logs.
        """
        hos = HOSService(current_cycle_used_hrs=0)
        # 30 hour drive (will span at least 3 days with breaks and sleep)
        events = hos.calculate_trip(distance_miles=1600, duration_hrs=30, start_time=self.start_time)
        daily_logs = hos.partition_by_day(events)
        
        self.assertTrue(len(daily_logs.keys()) >= 3)
        # Check that the first day exists and contains events
        first_day_key = self.start_time.strftime("%Y-%m-%d")
        self.assertIn(first_day_key, daily_logs)
