import React, { useEffect, useRef, useState } from 'react';

interface HtmlRendererProps {
  html: string;
  minHeight?: number;
}

export const HtmlRenderer: React.FC<HtmlRendererProps> = ({ html, minHeight = 300 }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Write the HTML content into the iframe with base styles
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_blank">
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            a {
              color: #1890ff;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    doc.close();

    const adjustHeight = () => {
      const newHeight = doc.body?.scrollHeight || minHeight;
      setHeight(newHeight);
    };

    // Adjust on initial load
    iframe.onload = adjustHeight;
    setTimeout(adjustHeight, 200);

    // Adjust when DOM changes
    const observer = new MutationObserver(adjustHeight);
    observer.observe(doc.body, { childList: true, subtree: true });

    // Adjust when images finish loading
    const images = doc.images;
    if (images.length > 0) {
      let loaded = 0;
      for (const img of images) {
        if (img.complete) {
          loaded++;
        } else {
          img.addEventListener('load', () => {
            loaded++;
            if (loaded === images.length) adjustHeight();
          });
          img.addEventListener('error', () => {
            loaded++;
            if (loaded === images.length) adjustHeight();
          });
        }
      }
      // fallback if all already loaded
      if (loaded === images.length) adjustHeight();
    }

    // Clean up
    return () => observer.disconnect();
  }, [html, minHeight]);

  return (
    <iframe
      ref={iframeRef}
      style={{
        width: '100%',
        border: 'none',
        height,
        transition: 'height 0.3s ease',
      }}
      sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
    />
  );
};
