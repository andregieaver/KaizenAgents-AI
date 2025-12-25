import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Plus, Edit, Trash2, Menu as MenuIcon } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const MenusList = () => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/menus/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMenus(response.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (menuId) => {
    if (!window.confirm('Are you sure you want to delete this menu?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/menus/${menuId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMenus();
    } catch {
      alert('Failed to delete menu');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading menus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menus</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage navigation menus for your site
          </p>
        </div>
        <Link to="/dashboard/admin/menus/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Menu
          </Button>
        </Link>
      </div>

      {/* Menus Grid */}
      {menus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MenuIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No menus yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create your first navigation menu to use in headers, footers, and other components.
            </p>
            <Link to="/dashboard/admin/menus/create">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create First Menu
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {menus.map((menu) => (
            <Card key={menu.menu_id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MenuIcon className="h-5 w-5" />
                  {menu.name}
                </CardTitle>
                <CardDescription>
                  {menu.items?.length || 0} menu items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/dashboard/admin/menus/edit/${menu.menu_id}`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(menu.menu_id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MenusList;
