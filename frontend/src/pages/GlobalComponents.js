import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Loader2, Edit, Eye, PanelTop, PanelBottom } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GlobalComponents = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState([]);

  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/global-components/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setComponents(response.data);
    } catch {
      toast.error('Failed to load global components');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'header':
        return <PanelTop className="h-5 w-5" />;
      case 'footer':
        return <PanelBottom className="h-5 w-5" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Global Components</h1>
        <p className="text-muted-foreground mt-2">
          Manage site-wide components like headers and footers that appear across all public pages
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {components.map((component) => (
          <Card key={component.component_type}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {getIcon(component.component_type)}
                  </div>
                  <div>
                    <CardTitle>{component.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {component.blocks?.length || 0} blocks configured
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate(`/dashboard/admin/components/edit/${component.component_type}`)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Component
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open('/', '_blank')}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GlobalComponents;
