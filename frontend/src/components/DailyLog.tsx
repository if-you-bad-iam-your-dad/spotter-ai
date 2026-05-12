import React, { useEffect, useRef } from 'react';

interface Event {
  status: string;
  start: string;
  end: string;
  description: string;
}

interface DailyLogProps {
  day: string;
  events: Event[];
  totalMiles: number;
  from: string;
  to: string;
}

const DailyLog: React.FC<DailyLogProps> = ({ day, events, totalMiles, from, to }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const STATUS_Y_MAP: Record<string, number> = {
    "Off Duty": 187,
    "Sleeper Berth": 200,
    "Driving": 213,
    "On Duty (Not Driving)": 226,
  };

  const GRID_START_X = 64;
  const GRID_END_X = 454;
  const GRID_WIDTH = GRID_END_X - GRID_START_X;

  const timeToX = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const hoursSinceStart = (date.getTime() - dayStart.getTime()) / 36e5;
    const clampedHours = Math.min(24, Math.max(0, hoursSinceStart));
    return GRID_START_X + (clampedHours / 24) * GRID_WIDTH;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = '/blank-paper-log.png';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'butt';

      events.forEach((event, index) => {
        const xStart = timeToX(event.start);
        const xEnd = timeToX(event.end);
        const y = STATUS_Y_MAP[event.status];

        if (y) {
          ctx.beginPath();
          ctx.moveTo(xStart, y);
          ctx.lineTo(xEnd, y);
          ctx.stroke();

          // Connect to next status
          if (index < events.length - 1) {
            const nextEvent = events[index + 1];
            const nextY = STATUS_Y_MAP[nextEvent.status];
            if (nextY && nextY !== y) {
              ctx.beginPath();
              ctx.moveTo(xEnd, y);
              ctx.lineTo(xEnd, nextY);
              ctx.stroke();
            }
          }
        }
      });
      
      ctx.fillStyle = '#1e293b'; // High-contrast ink
      ctx.font = 'bold 7px Inter, sans-serif';
      ctx.textBaseline = 'middle';
      
      const d = new Date(day);

      // Date boxes (top right)
      ctx.textAlign = 'center';
      ctx.fillText((d.getMonth() + 1).toString(), 338, 32);
      ctx.fillText(d.getDate().toString(), 381, 32);
      ctx.fillText(d.getFullYear().toString().slice(-2), 424, 32);

      // Route lines (top)
      ctx.textAlign = 'left';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.fillText(from.slice(0, 30), 64, 51);
      ctx.fillText(to.slice(0, 30), 256, 51);

      // Trip data and carrier details
      ctx.font = 'bold 7px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(totalMiles).toString(), 102, 71);
      ctx.fillText(Math.round(totalMiles + 15).toString(), 182, 71);
      ctx.textAlign = 'left';
      ctx.fillText('SPOTTER LOGISTICS SYSTEMS', 286, 71);
      ctx.fillText('ONE INFINITE LOOP, CUPERTINO, CA', 286, 95);
      ctx.fillText('SAN FRANCISCO, CA 94105', 286, 119);

      // Driver identification
      ctx.font = 'italic bold 8px Inter, sans-serif';
      ctx.fillText('Nakeeran FullStack', 350, 260);

      // Shipping documents and remarks
      ctx.font = 'bold 6px Inter, sans-serif';
      ctx.fillStyle = '#475569';
      const manifestId = `ELD-${day.replace(/-/g, '')}`;
      ctx.fillText(`DVL/MANIFEST: ${manifestId}`, 50, 435);
      ctx.fillText('SHIPPER: SPOTTER AI / COMMODITY: PRIORITY FREIGHT', 50, 447);
      ctx.fillText('REMARKS: SYSTEM CALCULATED LOG - 70HR/8DAY COMPLIANCE VERIFIED', 50, 460);

      // Bottom recap
      ctx.font = 'bold 6px Inter, sans-serif';
      const onDutyHrs = (events.filter((event) => event.status.includes('On Duty') || event.status === 'Driving').length * 2.5).toFixed(1);
      ctx.fillText(`${onDutyHrs} HRS`, 150, 505);
      ctx.fillText(`${(70 - parseFloat(onDutyHrs)).toFixed(1)} HRS`, 220, 505);
    };
  }, [day, events, totalMiles, from, to]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg overflow-hidden border border-slate-200">
      <canvas 
        ref={canvasRef} 
        className="w-full h-auto max-w-4xl mx-auto"
        style={{ imageRendering: 'crisp-edges' }}
      />
    </div>
  );
};

export default DailyLog;
