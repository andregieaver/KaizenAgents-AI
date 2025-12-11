import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { MessageSquare, Zap, Shield, BarChart3, Moon, Sun, ArrowRight, Bot, Users, Code } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Landing = () => {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [platformName, setPlatformName] = useState('AI Support Hub');

  useEffect(() => {
    const fetchPlatformName = async () => {
      try {
        const response = await axios.get(`${API}/public/platform-info`);
        if (response.data?.platform_name) {
          setPlatformName(response.data.platform_name);
        }
      } catch (error) {
        console.debug('Could not fetch platform name, using default');
      }
    };
    fetchPlatformName();
  }, []);

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-lg">AI Support Hub</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9"
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {isAuthenticated ? (
                <Link to="/dashboard">
                  <Button className="btn-hover" data-testid="dashboard-link">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" data-testid="login-nav-btn">Sign in</Button>
                  </Link>
                  <Link to="/register">
                    <Button className="btn-hover" data-testid="register-nav-btn">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Bot className="h-4 w-4" />
                Powered by GPT-4o
              </div>
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none mb-6">
                AI-first customer support that <span className="text-primary">actually works</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Deploy intelligent support in minutes. Our AI handles 85% of inquiries instantly, while your team focuses on what matters.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/register">
                  <Button size="lg" className="h-12 px-6 btn-hover" data-testid="hero-cta-btn">
                    Start for free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/widget-demo">
                  <Button size="lg" variant="outline" className="h-12 px-6" data-testid="demo-btn">
                    See demo
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-muted/50 border border-border overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1737505599162-d9932323a889?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHRlY2hub2xvZ3klMjBjb25uZWN0aW9uJTIwbm9kZXN8ZW58MHx8fHwxNzY1Mzg3MTA2fDA&ixlib=rb-4.1.0&q=85" 
                  alt="AI Technology"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-4">Everything you need</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete support platform that grows with your business
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Bot className="h-5 w-5" />}
              title="AI-Powered Responses"
              description="GPT-4o powered responses that understand context and provide accurate answers 24/7."
            />
            <FeatureCard
              icon={<Users className="h-5 w-5" />}
              title="Human Handoff"
              description="Seamlessly escalate to human agents when AI can't help. Never lose a conversation."
            />
            <FeatureCard
              icon={<Code className="h-5 w-5" />}
              title="Easy Integration"
              description="Add our widget to any website with a single line of code. Works everywhere."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Instant Setup"
              description="Get started in minutes, not weeks. No complex configuration required."
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Secure & Private"
              description="Your data stays yours. Enterprise-grade security with full compliance."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Analytics Dashboard"
              description="Track performance, response times, and customer satisfaction in real-time."
            />
          </div>
        </div>
      </section>

      {/* Embed Section */}
      <section className="py-20 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                One line of code.
                <br />
                Infinite possibilities.
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Embed our chat widget on any website. Customize colors, position, and behavior to match your brand.
              </p>
              <div className="bg-card border border-border rounded-sm p-4 font-mono text-sm overflow-x-auto">
                <code className="text-foreground">
                  <span className="text-muted-foreground">&lt;</span>
                  <span className="text-primary">script</span>
                  <span className="text-muted-foreground"> </span>
                  <span className="text-signal-600">src</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-green-600">&quot;widget.js&quot;</span>
                  <span className="text-muted-foreground"> </span>
                  <span className="text-signal-600">data-tenant</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-green-600">&quot;your-id&quot;</span>
                  <span className="text-muted-foreground">&gt;&lt;/</span>
                  <span className="text-primary">script</span>
                  <span className="text-muted-foreground">&gt;</span>
                </code>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-80 h-96 bg-card border border-border rounded-2xl shadow-lg p-4 flex flex-col">
                <div className="flex items-center gap-2 pb-3 border-b border-border">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Support</p>
                    <p className="text-xs text-muted-foreground">Online</p>
                  </div>
                </div>
                <div className="flex-1 py-4 space-y-3">
                  <div className="bg-muted rounded-lg rounded-tl-none px-3 py-2 max-w-[80%]">
                    <p className="text-sm">Hi! How can I help you today?</p>
                  </div>
                  <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 max-w-[80%] ml-auto">
                    <p className="text-sm">I need help with my order</p>
                  </div>
                  <div className="bg-muted rounded-lg rounded-tl-none px-3 py-2 max-w-[80%]">
                    <p className="text-sm">Of course! Let me look that up for you...</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                    Type a message...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to transform your support?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join hundreds of businesses using AI Support Hub to deliver exceptional customer experiences.
          </p>
          <Link to="/register">
            <Button size="lg" className="h-12 px-8 btn-hover" data-testid="cta-btn">
              Get started free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center">
                <MessageSquare className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">AI Support Hub</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 AI Support Hub. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }) => (
  <div className="p-6 bg-card border border-border rounded-sm card-hover" data-testid="feature-card">
    <div className="h-10 w-10 rounded-sm bg-primary/10 flex items-center justify-center text-primary mb-4">
      {icon}
    </div>
    <h3 className="font-heading font-semibold text-lg mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
  </div>
);

export default Landing;
