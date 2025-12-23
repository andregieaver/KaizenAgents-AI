import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Building,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Loader2,
  UserPlus,
  Calendar,
  Filter
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

const API = process.env.REACT_APP_BACKEND_URL;

const CRM = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    notes: '',
    tags: []
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [customersRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/crm/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/crm/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setCustomers(customersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching CRM data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name) {
      toast.error('Customer name is required');
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API}/api/crm/customers`,
        newCustomer,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Customer added successfully');
      setShowAddModal(false);
      setNewCustomer({ name: '', email: '', phone: '', company: '', position: '', notes: '', tags: [] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(search.toLowerCase()) ||
    customer.email?.toLowerCase().includes(search.toLowerCase()) ||
    customer.company?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer relationships
          </p>
        </div>
        
        <Button onClick={() => setShowAddModal(true)} className="sm:w-auto">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="stats-grid gap-3 sm:gap-4 mb-6">
        <Card className="border-0 btn-neumorphic !bg-card">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="font-heading text-xl sm:text-2xl font-bold">{stats.total_customers || 0}</p>
            <p className="text-xs text-muted-foreground">Total Customers</p>
          </CardContent>
        </Card>
        <Card className="border-0 btn-neumorphic !bg-card">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="font-heading text-xl sm:text-2xl font-bold">{stats.active_customers || 0}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="border-0 btn-neumorphic !bg-card">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="font-heading text-xl sm:text-2xl font-bold">{stats.pending_followups || 0}</p>
            <p className="text-xs text-muted-foreground">Pending Follow-ups</p>
          </CardContent>
        </Card>
        <Card className="border-0 btn-neumorphic !bg-card">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="font-heading text-xl sm:text-2xl font-bold text-destructive">{stats.overdue_followups || 0}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customer List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-2">No customers yet</p>
              <Button onClick={() => setShowAddModal(true)} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add your first customer
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  to={`/dashboard/crm/${customer.id}`}
                  className="block"
                >
                  <div className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {customer.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{customer.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {customer.company && (
                              <span className="flex items-center gap-1 truncate">
                                <Building className="h-3 w-3" />
                                {customer.company}
                              </span>
                            )}
                            {customer.email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3" />
                                {customer.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge variant={customer.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {customer.status}
                        </Badge>
                        {customer.last_contact && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(customer.last_contact), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    {customer.tags?.length > 0 && (
                      <div className="flex gap-1 mt-2 ml-13">
                        {customer.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {customer.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{customer.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 234 567 8900"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Acme Inc"
                  value={newCustomer.company}
                  onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  placeholder="CEO"
                  value={newCustomer.position}
                  onChange={(e) => setNewCustomer({ ...newCustomer, position: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                rows={3}
                value={newCustomer.notes}
                onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRM;
