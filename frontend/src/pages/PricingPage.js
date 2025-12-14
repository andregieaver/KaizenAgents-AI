import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { Helmet } from 'react-helmet';
import GlobalHeader from '../components/GlobalHeader';
import GlobalFooter from '../components/GlobalFooter';
import {
  renderHeroBlock,
  renderFeaturesBlock,
  renderCTABlock,
  renderButtonBlock,
  renderPricingWidgetBlock,
  renderImageBlock
} from '../components/PublicBlockRenderers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PricingPage = () => {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [platformName, setPlatformName] = useState('AI Support Hub');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch pricing page content
        const pageResponse = await axios.get(`${API}/admin/pages/public/pricing`);
        setPage(pageResponse.data);
        
        // Fetch platform info
        const platformResponse = await axios.get(`${API}/public/platform-info`);
        if (platformResponse.data?.platform_name) {
          setPlatformName(platformResponse.data.platform_name);
        }
      } catch (error) {
        console.debug('Error fetching pricing page data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Get blocks from the page
  const blocks = page?.blocks || [];

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{page?.seo?.title || `Pricing - ${platformName}`}</title>
        {page?.seo?.description && (
          <meta name="description" content={page.seo.description} />
        )}
        {page?.seo?.keywords && (
          <meta name="keywords" content={page.seo.keywords} />
        )}
        {page?.seo?.canonical_url && (
          <link rel="canonical" href={page.seo.canonical_url} />
        )}

        {/* Open Graph Tags */}
        {page?.seo?.og?.title && (
          <meta property="og:title" content={page.seo.og.title} />
        )}
        {page?.seo?.og?.description && (
          <meta property="og:description" content={page.seo.og.description} />
        )}
        {page?.seo?.og?.image && (
          <meta property="og:image" content={page.seo.og.image} />
        )}

        {/* Twitter Card Tags */}
        {page?.seo?.twitter?.card && (
          <meta name="twitter:card" content={page.seo.twitter.card} />
        )}
        {page?.seo?.twitter?.site && (
          <meta name="twitter:site" content={page.seo.twitter.site} />
        )}
        {page?.seo?.twitter?.creator && (
          <meta name="twitter:creator" content={page.seo.twitter.creator} />
        )}

        {/* Robots */}
        {page?.seo?.robots && (
          <meta 
            name="robots" 
            content={`${page.seo.robots.index ? 'index' : 'noindex'}, ${page.seo.robots.follow ? 'follow' : 'nofollow'}`} 
          />
        )}
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Global Header */}
        <GlobalHeader />

        {/* Main Content - Render Blocks */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {blocks.map((block) => {
            switch (block.type) {
              case 'hero':
                return renderHeroBlock(block);
              case 'features':
                return renderFeaturesBlock(block);
              case 'cta':
                return renderCTABlock(block);
              case 'button':
                return renderButtonBlock(block);
              case 'pricing_widget':
                return renderPricingWidgetBlock(block);
              case 'text':
                return (
                  <article
                    key={block.id}
                    className="prose prose-slate dark:prose-invert max-w-4xl mx-auto my-8"
                    dangerouslySetInnerHTML={{ __html: block.content?.html || '' }}
                  />
                );
              default:
                return null;
            }
          })}
        </div>

        {/* Global Footer */}
        <GlobalFooter />
      </div>
    </>
  );
};

export default PricingPage;
