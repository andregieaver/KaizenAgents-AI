import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet';
import { Button } from '../components/ui/button';
import { Home, Loader2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import GlobalHeader from '../components/GlobalHeader';
import GlobalFooter from '../components/GlobalFooter';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import {
  renderHeroBlock,
  renderFeaturesBlock,
  renderCTABlock,
  renderButtonBlock,
  renderAgentGridBlock,
  renderWaitlistBlock
} from '../components/PublicBlockRenderers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = window.location;
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPage();
  }, [slug, location.pathname]);

  const fetchPage = async () => {
    setLoading(true);
    setError(null);
    try {
      // Determine the slug to fetch:
      // If we have a slug param from /page/:slug, use that
      // Otherwise, extract from the pathname (e.g., /privacy)
      let pageSlug = slug;
      if (!pageSlug) {
        // Extract slug from pathname (remove leading slash)
        pageSlug = location.pathname.replace(/^\//, '').split('/')[0];
      }
      
      const response = await axios.get(`${API}/admin/pages/public/${pageSlug}`);
      setPage(response.data);
    } catch {
      setError(error.response?.status === 404 ? 'Page not found' : 'Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">404</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate('/')}>
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Generate robots meta tag
  const robotsContent = page?.seo?.robots 
    ? [
        page.seo.robots.index ? 'index' : 'noindex',
        page.seo.robots.follow ? 'follow' : 'nofollow',
        page.seo.robots.noarchive ? 'noarchive' : '',
        page.seo.robots.nosnippet ? 'nosnippet' : '',
        page.seo.robots.noimageindex ? 'noimageindex' : ''
      ].filter(Boolean).join(', ')
    : 'index, follow';

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{page?.seo?.title || page?.name}</title>
        {page?.seo?.description && (
          <meta name="description" content={page.seo.description} />
        )}
        {page?.seo?.keywords && (
          <meta name="keywords" content={page.seo.keywords} />
        )}
        {page?.seo?.canonical_url && (
          <link rel="canonical" href={page.seo.canonical_url} />
        )}
        <meta name="robots" content={robotsContent} />

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
        {page?.seo?.og?.url && (
          <meta property="og:url" content={page.seo.og.url} />
        )}
        <meta property="og:type" content="website" />

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
      </Helmet>

      {/* Global Header */}
      <GlobalHeader />

      {/* Page Content */}
      <div className="bg-background">

        {/* Main Content */}
        <main>
          {page?.blocks && page.blocks.length > 0 ? (
            <div className="space-y-0">
              {page.blocks
                .sort((a, b) => a.order - b.order)
                .map((block) => {
                  switch (block.type) {
                    case 'text':
                      return (
                        <div key={block.id} className="container mx-auto px-4 py-8">
                          <article
                            className="prose prose-slate dark:prose-invert max-w-4xl mx-auto"
                            dangerouslySetInnerHTML={{ __html: block.content?.html || '' }}
                          />
                        </div>
                      );
                    
                    case 'image':
                      return (
                        <div key={block.id} className="container mx-auto px-4 py-8">
                          <div className="max-w-4xl mx-auto space-y-2">
                            <img
                              src={block.content?.url}
                              alt={block.content?.alt || ''}
                              className="w-full rounded-lg shadow-md"
                            />
                            {block.content?.caption && (
                              <p className="text-sm text-muted-foreground text-center italic">
                                {block.content.caption}
                              </p>
                            )}
                          </div>
                        </div>
                      );

                    case 'video':
                      const getVideoEmbedUrl = (url) => {
                        if (!url) return null;
                        
                        // YouTube
                        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                        const youtubeMatch = url.match(youtubeRegex);
                        if (youtubeMatch) {
                          return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
                        }

                        // Vimeo
                        const vimeoRegex = /vimeo\.com\/(?:.*\/)?(\d+)/;
                        const vimeoMatch = url.match(vimeoRegex);
                        if (vimeoMatch) {
                          return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
                        }

                        return null;
                      };

                      const embedUrl = getVideoEmbedUrl(block.content?.url);
                      return embedUrl ? (
                        <div key={block.id} className="space-y-2">
                          <div className="relative rounded-lg overflow-hidden shadow-md aspect-video">
                            <iframe
                              src={embedUrl}
                              className="absolute inset-0 w-full h-full"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                          {block.content?.caption && (
                            <p className="text-sm text-muted-foreground text-center italic">
                              {block.content.caption}
                            </p>
                          )}
                        </div>
                      ) : null;

                    case 'code':
                      return block.content?.code ? (
                        <div key={block.id} className="space-y-2">
                          <div className="rounded-lg overflow-hidden shadow-md">
                            <SyntaxHighlighter
                              language={block.content.language || 'javascript'}
                              style={vscDarkPlus}
                              customStyle={{ margin: 0, fontSize: '14px' }}
                              showLineNumbers
                            >
                              {block.content.code}
                            </SyntaxHighlighter>
                          </div>
                          {block.content?.caption && (
                            <p className="text-sm text-muted-foreground text-center font-mono">
                              {block.content.caption}
                            </p>
                          )}
                        </div>
                      ) : null;

                    case 'hero':
                      return renderHeroBlock(block);

                    case 'features':
                      return renderFeaturesBlock(block);

                    case 'cta':
                      return renderCTABlock(block);

                    case 'button':
                      return renderButtonBlock(block);

                    case 'agent_grid':
                      return renderAgentGridBlock(block);

                    case 'waitlist':
                      return renderWaitlistBlock(block);

                    case 'pricing_widget':
                      const { renderPricingWidgetBlock } = require('../components/PublicBlockRenderers');
                      return renderPricingWidgetBlock(block);

                    case 'faq':
                      const faqItems = (block.content?.items || []).sort((a, b) => a.order - b.order);
                      return faqItems.length > 0 ? (
                        <div key={block.id} className="my-8">
                          <Accordion type="single" collapsible className="w-full">
                            {faqItems.map((item, index) => (
                              <AccordionItem key={item.id} value={`item-${index}`}>
                                <AccordionTrigger className="text-left font-semibold">
                                  {item.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground whitespace-pre-wrap">
                                  {item.answer}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>
                      ) : null;

                    case 'row':
                      const columns = block.content?.columns || [];
                      return columns.length > 0 ? (
                        <div
                          key={block.id}
                          className="w-full my-8 p-6 rounded-lg"
                          style={{
                            backgroundColor: block.content?.backgroundColor || 'transparent',
                            backgroundImage: block.content?.backgroundImage 
                              ? `url(${block.content.backgroundImage})` 
                              : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        >
                          <div
                            className="grid gap-4"
                            style={{
                              gridTemplateColumns: columns.map(col => 
                                `${col.width?.desktop || 100 / columns.length}%`
                              ).join(' '),
                              gap: block.content?.gap || '1rem'
                            }}
                          >
                            {columns.map((col) => (
                              <div key={col.id} className="space-y-6">
                                {(col.blocks || [])
                                  .sort((a, b) => a.order - b.order)
                                  .map((nestedBlock) => {
                                    // Render nested blocks (reuse same switch logic)
                                    switch (nestedBlock.type) {
                                      case 'text':
                                        return (
                                          <article
                                            key={nestedBlock.id}
                                            className="prose prose-slate dark:prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: nestedBlock.content?.html || '' }}
                                          />
                                        );
                                      case 'image':
                                        return (
                                          <div key={nestedBlock.id} className="space-y-2">
                                            <img
                                              src={nestedBlock.content?.url}
                                              alt={nestedBlock.content?.alt || ''}
                                              className="w-full rounded-lg shadow-md"
                                            />
                                            {nestedBlock.content?.caption && (
                                              <p className="text-sm text-muted-foreground text-center italic">
                                                {nestedBlock.content.caption}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      // Add other block types as needed
                                      default:
                                        return null;
                                    }
                                  })}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;

                    default:
                      return null;
                  }
                })}
            </div>
          ) : (
            <article 
              className="prose prose-slate dark:prose-invert max-w-4xl mx-auto"
              dangerouslySetInnerHTML={{ __html: page?.content || '<p>No content available</p>' }}
            />
          )}
        </main>
      </div>

      {/* Global Footer */}
      <GlobalFooter />
    </>
  );
};

export default CustomPage;
