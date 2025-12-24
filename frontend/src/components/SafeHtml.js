import DOMPurify from 'dompurify';

/**
 * SafeHtml - Renders HTML content safely using DOMPurify
 * Use this instead of dangerouslySetInnerHTML throughout the app
 */
const SafeHtml = ({ html, className = '', as: Component = 'div', ...props }) => {
  const sanitizedHtml = DOMPurify.sanitize(html, {
    // Allow common HTML tags
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'div', 'span', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr', 'sub', 'sup', 'small', 'mark', 'del', 'ins'
    ],
    // Allow safe attributes
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'id',
      'style', 'width', 'height', 'colspan', 'rowspan'
    ],
    // Force links to open in new tab with security
    ADD_ATTR: ['target', 'rel'],
    // Transform hooks
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });

  // Add rel="noopener noreferrer" to all links for security
  const secureHtml = sanitizedHtml.replace(
    /<a\s+([^>]*href=[^>]*)>/gi,
    '<a $1 target="_blank" rel="noopener noreferrer">'
  );

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: secureHtml }}
      {...props}
    />
  );
};

export default SafeHtml;
