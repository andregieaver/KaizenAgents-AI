import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Database,
  Cloud,
  HardDrive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StorageConfig = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState(null);

  const [formData, setFormData] = useState({
    storage_type: 'local',
    gcs_service_account_json: '',
    gcs_bucket_name: '',
    gcs_region: 'us-central1'
  });

  const fetchConfig = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/storage-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(response.data);
      setFormData({
        storage_type: response.data.storage_type || 'local',
        gcs_service_account_json: '',
        gcs_bucket_name: response.data.gcs_bucket_name || '',
        gcs_region: response.data.gcs_region || 'us-central1'
      });
    } catch (error) {
      toast.error('Failed to load storage configuration');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (formData.storage_type === 'gcs') {
      if (!formData.gcs_service_account_json || !formData.gcs_bucket_name) {
        toast.error('Please provide service account JSON and bucket name');
        return;
      }

      // Validate JSON
      try {
        JSON.parse(formData.gcs_service_account_json);
      } catch (e) {
        toast.error('Invalid JSON format for service account');
        return;
      }
    }

    setSaving(true);
    try {
      await axios.post(
        `${API}/admin/storage-config`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Storage configuration saved');
      fetchConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const response = await axios.post(
        `${API}/admin/storage-config/test-gcs`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Storage Configuration</h2>
        <p className="text-muted-foreground">
          Configure persistent file storage for avatars, logos, and documents
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Current Storage Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant={config?.storage_type === 'gcs' ? 'default' : 'secondary'}>
              {config?.storage_type?.toUpperCase() || 'LOCAL'}
            </Badge>
            {config?.storage_type === 'gcs' && config?.gcs_configured && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">
                  Bucket: {config.gcs_bucket_name} ({config.gcs_region})
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Provider</CardTitle>
          <CardDescription>
            Choose where to store uploaded files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Storage Type Selection */}
          <div className="space-y-3">
            <Label>Storage Type</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setFormData({ ...formData, storage_type: 'local' })}
                className={`p-4 border rounded-lg text-left transition ${
                  formData.storage_type === 'local'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <HardDrive className="h-5 w-5" />
                  <span className="font-semibold">Local Storage</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Store files locally (non-persistent)
                </p>
              </button>

              <button
                onClick={() => setFormData({ ...formData, storage_type: 'gcs' })}
                className={`p-4 border rounded-lg text-left transition ${
                  formData.storage_type === 'gcs'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Cloud className="h-5 w-5" />
                  <span className="font-semibold">Google Cloud Storage</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Persistent cloud storage (recommended)
                </p>
              </button>
            </div>
          </div>

          {/* GCS Configuration */}
          {formData.storage_type === 'gcs' && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-sm">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-600 mb-1">Setup Instructions:</p>
                  <ol className="list-decimal ml-4 text-blue-600/80 space-y-1">
                    <li>Go to <a href="https://console.cloud.google.com/storage" target="_blank" rel="noopener noreferrer" className="underline">GCS Console</a></li>
                    <li>Create a bucket or use existing one</li>
                    <li>Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="underline">Service Accounts</a></li>
                    <li>Create service account with &quot;Storage Object Admin&quot; role</li>
                    <li>Create JSON key and paste below</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gcs-bucket">Bucket Name *</Label>
                <Input
                  id="gcs-bucket"
                  placeholder="my-app-storage"
                  value={formData.gcs_bucket_name}
                  onChange={(e) => setFormData({ ...formData, gcs_bucket_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gcs-region">Region</Label>
                <select
                  id="gcs-region"
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={formData.gcs_region}
                  onChange={(e) => setFormData({ ...formData, gcs_region: e.target.value })}
                >
                  <option value="us-central1">US Central (Iowa)</option>
                  <option value="us-east1">US East (South Carolina)</option>
                  <option value="us-west1">US West (Oregon)</option>
                  <option value="europe-west1">Europe West (Belgium)</option>
                  <option value="asia-east1">Asia East (Taiwan)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gcs-json">Service Account JSON *</Label>
                <Textarea
                  id="gcs-json"
                  placeholder='{"type": "service_account", "project_id": "...", ...}'
                  rows={8}
                  value={formData.gcs_service_account_json}
                  onChange={(e) => setFormData({ ...formData, gcs_service_account_json: e.target.value })}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Paste the entire JSON key file contents
                </p>
              </div>

              {config?.gcs_configured && (
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={fetchConfig}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warning for Local Storage */}
      {formData.storage_type === 'local' && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-600 mb-1">Warning: Non-Persistent Storage</p>
                <p className="text-yellow-600/80">
                  Local storage is not persistent. All uploaded files (avatars, logos, documents) will be lost when the application restarts. For production use, configure cloud storage.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StorageConfig;
