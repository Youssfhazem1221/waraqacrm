import React, { useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function PostHogDashboard() {
  const [dashboardUrl, setDashboardUrl] = useState(() => localStorage.getItem('waraqa_posthog_url') || '');
  const [isEditing, setIsEditing] = useState(!dashboardUrl);
  const [tempUrl, setTempUrl] = useState(dashboardUrl);

  const handleSave = () => {
    localStorage.setItem('waraqa_posthog_url', tempUrl);
    setDashboardUrl(tempUrl);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full bg-cream p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-serif text-char font-bold flex items-center gap-2">
            Traffic & Analytics
          </h2>
          <p className="text-muted text-sm mt-1">
            View user behavior, page views, and session recordings via PostHog.
          </p>
        </div>
        {!isEditing && dashboardUrl && (
          <Button variant="secondary" onClick={() => setIsEditing(true)}>
            Edit Dashboard URL
          </Button>
        )}
      </div>

      {isEditing || !dashboardUrl ? (
        <div className="bg-white p-6 rounded-none border border-line shadow-sm max-w-2xl">
          <h3 className="font-serif font-bold text-lg mb-4 text-maroon flex items-center gap-2">
            <Info className="w-5 h-5" /> Connect PostHog Dashboard
          </h3>
          <p className="text-muted mb-4 text-sm leading-relaxed">
            To view your analytics directly in the CRM, you need to create a shared dashboard link in PostHog.
            Go to your PostHog project, open the Dashboard you want to see here, click <strong>Share</strong>, and turn on "Share publicly". Paste the embed URL below.
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="https://us.posthog.com/embedded/..."
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
              />
            </div>
            <Button variant="primary" onClick={handleSave}>
              Save Link
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white border border-line relative rounded-none overflow-hidden min-h-[600px] shadow-sm">
          <div className="absolute top-2 right-2 z-10 bg-white/80 p-1 rounded backdrop-blur">
             <a href={dashboardUrl} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-muted hover:text-maroon transition-colors font-medium">
               Open in PostHog <ExternalLink className="w-3 h-3" />
             </a>
          </div>
          <iframe
            src={dashboardUrl}
            className="w-full h-full border-0"
            title="PostHog Analytics Dashboard"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
