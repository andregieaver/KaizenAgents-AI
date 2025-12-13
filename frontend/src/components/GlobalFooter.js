import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GlobalFooter = () => {
  const [platformName, setPlatformName] = useState('AI Support Hub');
  const [platformLogo, setPlatformLogo] = useState(null);
  const [footerBlocks, setFooterBlocks] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch platform info
        const platformResponse = await axios.get(`${API}/public/platform-info`);
        if (platformResponse.data?.platform_name) {
          setPlatformName(platformResponse.data.platform_name);
        }
        if (platformResponse.data?.platform_logo) {
          setPlatformLogo(platformResponse.data.platform_logo);
        }

        // Fetch footer component
        const footerResponse = await axios.get(`${API}/global-components/public/footer`);
        setFooterBlocks(footerResponse.data.blocks || []);
      } catch (error) {
        console.debug('Error fetching footer data:', error);
      }
    };
    fetchData();
  }, []);

  const getPlatformLogoSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('/api/')) {
      return `${process.env.REACT_APP_BACKEND_URL}${url}`;
    }
    return url;
  };

  // If footer has custom blocks, render them
  if (footerBlocks.length > 0) {
    return (
      <footer className="py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Render custom footer blocks */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
                {getPlatformLogoSrc(platformLogo) ? (
                  <img src={getPlatformLogoSrc(platformLogo)} alt={platformName} className="h-full w-full object-contain" />
                ) : (
                  <MessageSquare className="h-3 w-3 text-primary-foreground" />
                )}
              </div>
              <span className="text-sm text-muted-foreground">{platformName}</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {platformName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    );
  }

  // Default footer (fallback)
  return (
    <footer className="py-8 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
              {getPlatformLogoSrc(platformLogo) ? (
                <img src={getPlatformLogoSrc(platformLogo)} alt={platformName} className="h-full w-full object-contain" />
              ) : (
                <MessageSquare className="h-3 w-3 text-primary-foreground" />
              )}
            </div>
            <span className="text-sm text-muted-foreground">{platformName}</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {platformName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default GlobalFooter;
