/**
 * DiscountCodeInput - Input for applying discount codes
 */
import { useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Tag, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DiscountCodeInput = ({
  planId,
  token,
  appliedDiscount,
  onDiscountApplied,
  onDiscountRemoved
}) => {
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) {
      toast.error('Please enter a discount code');
      return;
    }

    setApplying(true);
    try {
      const response = await axios.post(
        `${API}/discount-codes/validate`,
        { code: code.trim(), plan_id: planId },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (response.data.valid) {
        onDiscountApplied(response.data, planId);
        toast.success(`Discount applied: ${response.data.discount_value}${response.data.discount_type === 'percentage' ? '%' : '$'} off!`);
      } else {
        toast.error(response.data.message || 'Invalid discount code');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to validate discount code');
    } finally {
      setApplying(false);
    }
  };

  const handleRemove = () => {
    setCode('');
    onDiscountRemoved();
    toast.info('Discount code removed');
  };

  if (appliedDiscount) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
        <Check className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700 dark:text-green-300 flex-1">
          {appliedDiscount.code}: {appliedDiscount.discount_value}
          {appliedDiscount.discount_type === 'percentage' ? '%' : '$'} off
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Discount code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="pl-9"
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
      </div>
      <Button
        variant="outline"
        onClick={handleApply}
        disabled={applying || !code.trim()}
      >
        {applying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          'Apply'
        )}
      </Button>
    </div>
  );
};

export default DiscountCodeInput;
