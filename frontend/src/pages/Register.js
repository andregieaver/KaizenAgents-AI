import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { MessageSquare, ArrowLeft, Gift } from 'lucide-react';
import { toast } from 'sonner';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get referral code from URL
  const referralCode = searchParams.get('ref');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name, referralCode);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="register-page">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        
        {/* Referral Discount Banner */}
        {referralCode && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-green-600">
              <Gift className="h-5 w-5" />
              <span className="font-medium">You&apos;ve been referred!</span>
              <Badge variant="outline" className="border-green-500 text-green-600 ml-auto">
                20% OFF
              </Badge>
            </div>
            <p className="text-sm text-green-600/80 mt-1">
              Sign up now and get 20% off your first payment!
            </p>
          </div>
        )}
        
        <Card className="border border-border">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-sm bg-primary flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="font-heading text-2xl tracking-tight">Create an account</CardTitle>
            <CardDescription>Start building your AI support experience</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-11"
                  data-testid="register-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                  data-testid="register-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11"
                  data-testid="register-password-input"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 btn-hover" 
                disabled={loading}
                data-testid="register-submit-btn"
              >
                {loading ? 'Creating account...' : referralCode ? 'Create account & claim discount' : 'Create account'}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline" data-testid="login-link">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
