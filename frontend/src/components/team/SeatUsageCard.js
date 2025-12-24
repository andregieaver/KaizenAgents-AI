/**
 * SeatUsageCard - Displays seat usage information
 */
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { Plus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const SeatUsageCard = ({ seatInfo, onPurchaseClick }) => {
  const totalSeats = seatInfo.limit;
  const usedSeats = seatInfo.current;
  const remainingSeats = Math.max(0, totalSeats - usedSeats);
  const baseSeats = seatInfo.limit - seatInfo.extraSeats;
  const canPurchaseSeats = seatInfo.planName !== 'free';

  return (
    <Card className="sm:min-w-[300px]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Seats</span>
          <span className="text-sm text-muted-foreground">
            {usedSeats} / {totalSeats} used
          </span>
        </div>
        <Progress value={seatInfo.percentage} className="h-2 mb-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {seatInfo.extraSeats > 0 
              ? `${baseSeats} base + ${seatInfo.extraSeats} purchased`
              : `${remainingSeats} available`
            }
          </span>
          {canPurchaseSeats ? (
            <button 
              onClick={onPurchaseClick}
              className="text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Buy seats
            </button>
          ) : (
            <Link 
              to="/dashboard/pricing" 
              className="text-primary hover:underline flex items-center gap-1"
            >
              Upgrade plan
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SeatUsageCard;
