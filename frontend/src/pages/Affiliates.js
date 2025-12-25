import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { 
  Users, 
  Link as LinkIcon, 
  Copy, 
  CheckCircle, 
  Clock, 
  XCircle,
  TrendingUp,
  Loader2,
  CreditCard,
  Share2,
  BarChart3,
  Gift,
  Percent,
  Sparkles,
  ArrowRight,
  History
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Affiliates = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState(null);
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [creditHistory, setCreditHistory] = useState([]);
  const [settings, setSettings] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [affiliateRes, statsRes, referralsRes, historyRes, settingsRes] = await Promise.all([
        axios.get(`${API}/affiliates/my`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/affiliates/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/affiliates/referrals`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/affiliates/credit-history`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get(`${API}/affiliates/settings`)
      ]);

      setAffiliate(affiliateRes.data);
      setStats(statsRes.data);
      setReferrals(referralsRes.data);
      setCreditHistory(historyRes.data || []);
      setSettings(settingsRes.data);
    } catch {
      toast.error('Failed to load affiliate data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'converted':
      case 'completed':
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Converted
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="border-gray-500 text-gray-500">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
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

  const creditPercentage = stats?.store_credit || 0;
  const maxReferralsPerCycle = 5;
  const referralsThisCycle = stats?.this_cycle_successful || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Gift className="h-8 w-8" />
          Referral Program
        </h1>
        <p className="text-muted-foreground mt-2">
          Earn store credit by referring new customers. Both you and your referrals get rewarded!
        </p>
      </div>

      {/* How It Works Banner */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">How It Works</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
              <div>
                <p className="font-medium">Share Your Link</p>
                <p className="text-sm text-muted-foreground">Send your unique referral link to friends and colleagues</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
              <div>
                <p className="font-medium">They Get 20% Off</p>
                <p className="text-sm text-muted-foreground">Your referral saves 20% on their first payment</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
              <div>
                <p className="font-medium">You Earn 20% Credit</p>
                <p className="text-sm text-muted-foreground">Get 20% off your next renewal (up to 100% free!)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Affiliate Link Card */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share this link to earn store credit
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
        </CardContent>
      </Card>

      {/* Store Credit Card */}
      <Card className="border-2 border-green-500/20 bg-gradient-to-r from-green-500/5 to-emerald-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CreditCard className="h-5 w-5" />
            Your Store Credit
          </CardTitle>
          <CardDescription>
            Credit automatically applies to your next subscription renewal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-green-600">{creditPercentage}%</p>
              <p className="text-sm text-muted-foreground">off your next renewal</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Referrals this cycle</p>
              <p className="text-2xl font-bold">{referralsThisCycle} / {maxReferralsPerCycle}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Credit Progress</span>
              <span>{creditPercentage}% / 100% max</span>
            </div>
            <Progress value={creditPercentage} className="h-3" />
          </div>

          {creditPercentage >= 100 ? (
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <p className="text-green-600 font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Congratulations! Your next renewal is FREE!
              </p>
            </div>
          ) : creditPercentage > 0 ? (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Refer {Math.ceil((100 - creditPercentage) / 20)} more customer{Math.ceil((100 - creditPercentage) / 20) > 1 ? 's' : ''} to get your next renewal free!
              </p>
            </div>
          ) : (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Start referring to earn credit. Each successful referral = 20% off your renewal!
              </p>
            </div>
          )}
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
            <CardTitle className="text-sm font-medium">Total Credit Earned</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_credit_earned || 0}%</div>
            <p className="text-xs text-muted-foreground">
              lifetime earnings
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Used</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_credit_used || 0}%</div>
            <p className="text-xs text-muted-foreground">
              applied to renewals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Referrals and History */}
      <Tabs defaultValue="referrals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="referrals" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Referrals
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Credit History
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Share
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
                    <TableHead>Credit Earned</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No referrals yet</p>
                        <p className="text-xs">Share your link to start earning credit</p>
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
                          {referral.credit_earned > 0 ? (
                            <span className="text-green-600 font-medium">
                              +{referral.credit_earned}%
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

        {/* Credit History Tab */}
        <TabsContent value="history">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Credit History</CardTitle>
              <CardDescription>Track your store credit earnings and usage</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Balance After</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No credit history yet</p>
                        <p className="text-xs">Credit transactions will appear here</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    creditHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Badge variant={entry.type === 'earned' ? 'default' : 'secondary'}>
                            {entry.type === 'earned' ? '+ Earned' : '- Used'}
                          </Badge>
                        </TableCell>
                        <TableCell className={entry.type === 'earned' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                          {entry.type === 'earned' ? '+' : '-'}{entry.amount}%
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.description}
                        </TableCell>
                        <TableCell>{entry.balance_after}%</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Share/Resources Tab */}
        <TabsContent value="resources">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Share Your Link</CardTitle>
              <CardDescription>Quick ways to spread the word</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Quick Share</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        const text = `Get 20% off your first payment! Check out this amazing platform: ${affiliate?.affiliate_link}`;
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
                        const text = `Hey! I thought you might like this - you can get 20% off your first payment: ${affiliate?.affiliate_link}`;
                        window.open(`mailto:?subject=Check this out - 20% off!&body=${encodeURIComponent(text)}`, '_blank');
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
                      <span className="text-muted-foreground">Your Credit</span>
                      <span className="font-medium text-green-600">20% per referral</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Their Discount</span>
                      <span className="font-medium">20% off first payment</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Credit</span>
                      <span className="font-medium">100% (5 referrals)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credit Reset</span>
                      <span className="font-medium">After renewal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cookie Duration</span>
                      <span className="font-medium">{settings?.cookie_duration_days || 30} days</span>
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
                      Share with businesses that need customer support solutions
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Mention the 20% discount your friends will get
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Add your referral link to your email signature
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      5 referrals = 100% off your next renewal!
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Affiliates;
