import { Card, CardContent } from '../ui/card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = "primary" }) => (
  <Card className="border border-border">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center",
          color === "primary" && "bg-primary/10 text-primary",
          color === "green" && "bg-green-500/10 text-green-500",
          color === "blue" && "bg-blue-500/10 text-blue-500",
          color === "amber" && "bg-amber-500/10 text-amber-500"
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1 mt-3 text-xs",
          trend >= 0 ? "text-green-500" : "text-red-500"
        )}>
          {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          <span>{Math.abs(trend)}% from previous period</span>
        </div>
      )}
    </CardContent>
  </Card>
);

export default StatCard;
