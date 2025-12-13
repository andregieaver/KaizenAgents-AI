import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  Users, 
  DollarSign, 
  Link as LinkIcon, 
  Copy, 
  CheckCircle, 
  Clock, 
  XCircle,
  TrendingUp,
  Loader2,
  Wallet,
  Share2,
  BarChart3,
  ArrowUpRight,
  Gift
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Affiliates = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState(null);
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [affiliateRes, statsRes, referralsRes, payoutsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/affiliates/my`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/affiliates/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/affiliates/referrals`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/affiliates/payouts`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/affiliates/settings`)
      ]);

      setAffiliate(affiliateRes.data);
      setStats(statsRes.data);
      setReferrals(referralsRes.data);
      setPayouts(payoutsRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      console.error('Error fetching affiliate data:', error);
      toast.error('Failed to load affiliate data');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleRequestPayout = async () => {
    setRequestingPayout(true);
    try {
      const amount = payoutAmount ? parseFloat(payoutAmount) : null;
      await axios.post(
        `${API}/affiliates/payouts/request`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Payout request submitted successfully!');
      setPayoutModalOpen(false);
      setPayoutAmount('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to request payout');
    } finally {
      setRequestingPayout(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'converted':
      case 'completed':
      case 'approved':
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Gift className="h-8 w-8" />
          Affiliate Program
        </h1>
        <p className="text-muted-foreground mt-2">
          Earn {settings?.default_commission_rate || 20}% commission for every customer you refer
        </p>
      </div>

      {/* Affiliate Link Card */}
      <Card className="border border-border bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Affiliate Link
          </CardTitle>
          <CardDescription>
            Share this link to earn commissions on referrals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                readOnly
                value={affiliate?.affiliate_link || ''}
                className="pr-24 font-mono text-sm bg-background"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                <Badge variant="secondary" className="text-xs">
                  Code: {affiliate?.affiliate_code}
                </Badge>
              </div>
            </div>
            <Button
              onClick={() => copyToClipboard(affiliate?.affiliate_link)}
              className={cn(copied && "bg-green-500 hover:bg-green-600")}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              {settings?.default_commission_rate || 20}% commission
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {settings?.cookie_duration_days || 30} day cookie
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_referrals || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.this_month_referrals || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successful_referrals || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.conversion_rate || 0}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.total_earnings?.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              ${stats?.this_month_earnings?.toFixed(2) || '0.00'} this month
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats?.pending_earnings?.toFixed(2) || '0.00'}
            </div>
            <Button
              variant="link"
              className="p-0 h-auto text-xs"
              onClick={() => setPayoutModalOpen(true)}
              disabled={!stats?.pending_earnings || stats.pending_earnings < (settings?.min_payout_amount || 50)}
            >
              Request Payout →
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Referrals and Payouts */}
      <Tabs defaultValue="referrals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="referrals" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Referrals
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Payouts
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Resources
          </TabsTrigger>
        </TabsList>

        {/* Referrals Tab */}
        <TabsContent value="referrals">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Your Referrals</CardTitle>
              <CardDescription>Track people who signed up using your link</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No referrals yet</p>
                        <p className="text-xs">Share your link to start earning</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    referrals.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell className="font-medium">
                          {referral.referred_email.replace(/(.{3}).*(@.*)/, '$1***$2')}
                        </TableCell>
                        <TableCell>{getStatusBadge(referral.status)}</TableCell>
                        <TableCell>{referral.plan_name || '-'}</TableCell>
                        <TableCell>
                          {referral.commission_amount > 0 ? (
                            <span className="text-green-600 font-medium">
                              ${referral.commission_amount.toFixed(2)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <Card className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>Track your withdrawal requests</CardDescription>
              </div>
              <Button
                onClick={() => setPayoutModalOpen(true)}
                disabled={!stats?.pending_earnings || stats.pending_earnings < (settings?.min_payout_amount || 50)}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Request Payout
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-lg font-semibold text-green-600">
                      ${stats?.pending_earnings?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="text-lg font-semibold">
                      ${stats?.paid_earnings?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Min. Payout</p>
                    <p className="text-lg font-semibold">
                      ${settings?.min_payout_amount || 50}
                    </p>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No payouts yet</p>
                        <p className="text-xs">Request a payout when you reach ${settings?.min_payout_amount || 50}</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">
                          ${payout.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="capitalize">{payout.payment_method.replace('_', ' ')}</TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(payout.requested_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payout.processed_at ? new Date(payout.processed_at).toLocaleDateString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Marketing Resources</CardTitle>
              <CardDescription>Materials to help you promote and earn more</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Quick Share Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        const text = `Check out this amazing AI support platform! ${affiliate?.affiliate_link}`;
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      Share on X (Twitter)
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(affiliate?.affiliate_link)}`, '_blank');
                      }}
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/>
                      </svg>
                      Share on LinkedIn
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        const text = `Check out this amazing AI support platform! ${affiliate?.affiliate_link}`;
                        window.open(`mailto:?subject=Check this out&body=${encodeURIComponent(text)}`, '_blank');
                      }}
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      Share via Email
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Program Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Commission Rate</span>
                      <span className="font-medium">{affiliate?.commission_rate || 20}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cookie Duration</span>
                      <span className="font-medium">{settings?.cookie_duration_days || 30} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Minimum Payout</span>
                      <span className="font-medium">${settings?.min_payout_amount || 50}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Method</span>
                      <span className="font-medium capitalize">{affiliate?.payment_method?.replace('_', ' ') || 'PayPal'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border bg-primary/5">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">Tips for Success</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Share your link on social media and in relevant communities
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Write blog posts or create videos about your experience
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Recommend to businesses that need customer support solutions
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Include your affiliate link in your email signature
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payout Request Modal */}
      <Dialog open={payoutModalOpen} onOpenChange={setPayoutModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Withdraw your affiliate earnings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-green-600">
                ${stats?.pending_earnings?.toFixed(2) || '0.00'}
              </p>
            </div>

            <div>
              <Label htmlFor="payout_amount">Amount to Withdraw</Label>
              <Input
                id="payout_amount"
                type="number"
                placeholder={`Min: $${settings?.min_payout_amount || 50}`}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to withdraw full balance
              </p>
            </div>

            <div className="p-3 bg-muted/30 rounded-lg text-sm">
              <p className="font-medium">Payment Details</p>
              <p className="text-muted-foreground">
                Method: <span className="capitalize">{affiliate?.payment_method?.replace('_', ' ')}</span>
              </p>
              <p className="text-muted-foreground">
                Email: {affiliate?.payment_email}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestPayout} disabled={requestingPayout}>
              {requestingPayout ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Request Payout'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Affiliates;
