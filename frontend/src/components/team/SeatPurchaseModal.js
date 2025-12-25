/**
 * SeatPurchaseModal - Modal for purchasing additional seats
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ShoppingCart, Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SeatPurchaseModal = ({ 
  open, 
  onOpenChange, 
  seatInfo, 
  token,
  onSuccess 
}) => {
  const [quantity, setQuantity] = useState(1);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loading, setLoading] = useState(false);

  const pricePerSeat = billingCycle === 'monthly' 
    ? seatInfo.pricePerSeatMonthly 
    : seatInfo.pricePerSeatYearly;
  
  const totalPrice = quantity * pricePerSeat;
  const savings = billingCycle === 'yearly' 
    ? quantity * (seatInfo.pricePerSeatMonthly * 12 - seatInfo.pricePerSeatYearly) 
    : 0;

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/quotas/extra-seats/checkout`,
        { quantity, billing_cycle: billingCycle },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Subscribe to Additional Seats
          </DialogTitle>
          <DialogDescription>
            Add more team member seats to your subscription
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Number of Seats</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="1"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.min(100, quantity + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Billing Cycle</Label>
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">
                  Monthly - ${seatInfo.pricePerSeatMonthly}/seat/month
                </SelectItem>
                <SelectItem value="yearly">
                  <div className="flex items-center gap-2">
                    Yearly - ${seatInfo.pricePerSeatYearly}/seat/year
                    <Badge variant="secondary" className="text-xs">Save ~17%</Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex justify-between text-sm mb-2">
              <span>{quantity} seat(s) × ${pricePerSeat}/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            {savings > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Annual savings</span>
                <span>-${savings.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t mt-2 pt-2 flex justify-between font-medium">
              <span>Total</span>
              <span>${totalPrice.toFixed(2)}/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePurchase} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Subscribe'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SeatPurchaseModal;
