import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ContentBlocks from '../components/ContentBlocks';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ComponentEditor = () => {
  const { componentType } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [component, setComponent] = useState(null);
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    fetchComponent();
  }, [componentType]);

  const fetchComponent = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/global-components/${componentType}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setComponent(response.data);
      setBlocks(response.data.blocks || []);
    } catch (error) {
      console.error('Error fetching component:', error);
      toast.error('Failed to load component');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/global-components/${componentType}`,
        { blocks },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      toast.success('Component saved successfully!');
      navigate('/dashboard/admin/components');
    } catch (error) {
      console.error('Error saving component:', error);
      toast.error('Failed to save component');
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard/admin/components')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{component?.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Edit {componentType} component
                </p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Component
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content Blocks Editor */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ContentBlocks blocks={blocks} onChange={setBlocks} />
      </div>
    </div>
  );
};

export default ComponentEditor;
