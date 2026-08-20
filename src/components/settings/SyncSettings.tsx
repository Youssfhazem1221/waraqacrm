import React, { useState } from 'react';
import { Settings, Link as LinkIcon, Lock, CheckCircle2, AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { getStoredApiUrl, setStoredApiUrl, getStoredToken, setStoredToken } from '@/lib/api';

interface SyncSettingsProps {
  onSettingsSaved: () => void;
}

export default function SyncSettings({ onSettingsSaved }: SyncSettingsProps) {
  const [apiUrl, setApiUrl] = useState(getStoredApiUrl());
  const [token, setToken] = useState(getStoredToken());
  const [isSaved, setIsSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredApiUrl(apiUrl);
    setStoredToken(token);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
    onSettingsSaved();
  };

  const handleTestConnection = async () => {
    if (!apiUrl) {
      setTestResult({ ok: false, msg: 'Please enter your Google Apps Script Web App URL first.' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`${apiUrl}?what=products`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          msg: `Connection successful! Fetched ${data.products?.length || 0} live products from your Google Sheet.`
        });
      } else {
        setTestResult({ ok: false, msg: data.error || 'Backend returned an error.' });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        msg: `Failed to connect to Apps Script: ${err instanceof Error ? err.message : String(err)}. Ensure you deployed as Web App with Access: Anyone.`
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Settings Card */}
      <div className="bg-white border border-[#E6D9C7] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#4C2224]">
            Backend &amp; Sheets Sync Configuration
          </span>
          <h2 className="font-serif text-2xl font-bold text-[#241C1B] mt-1">
            Google Sheets API Connection
          </h2>
          <p className="text-xs text-[#6B5D50] mt-1 leading-relaxed">
            Connect your Waraqa Google Sheets Apps Script Web App to enable live two-way catalog updates, instant order tracking, and stock syncing.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Google Apps Script Web App URL"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            hint="Generated from Apps Script editor ▸ Deploy ▸ New deployment ▸ Web app"
          />

          <Input
            label="Admin Secret Token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your secret token matching ADMIN_TOKEN in Apps Script"
            hint="Protects admin writes and private order data"
          />

          {isSaved && (
            <div className="p-3 bg-[#4A6B3A]/15 text-[#28451B] border border-[#4A6B3A]/30 rounded-xl text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} className="text-[#4A6B3A]" />
              <span>Settings saved successfully!</span>
            </div>
          )}

          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 font-medium border ${
                testResult.ok
                  ? 'bg-[#4A6B3A]/15 text-[#28451B] border-[#4A6B3A]/30'
                  : 'bg-[#A3492F]/15 text-[#6D2714] border-[#A3492F]/30'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 size={16} className="text-[#4A6B3A] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-[#A3492F] shrink-0 mt-0.5" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" variant="primary" size="md">
              <span>Save Settings</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleTestConnection}
              isLoading={testing}
            >
              <span>Test Live Connection</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Deployment Guide Info Box */}
      <div className="bg-[#FAF5EE] border border-[#E6D9C7] rounded-3xl p-6 sm:p-8 space-y-4">
        <h3 className="font-serif text-lg font-bold text-[#241C1B]">
          How to Deploy the Backend in 2 Minutes:
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-xs text-[#6B5D50] leading-relaxed">
          <li>Open your Google Sheet and navigate to <strong>Extensions ▸ Apps Script</strong>.</li>
          <li>Paste the code from <code className="bg-white px-1.5 py-0.5 rounded border border-[#E6D9C7] text-[#4C2224] font-mono">waraqa-apps-script.gs</code>.</li>
          <li>Click <strong>Deploy ▸ New deployment</strong>.</li>
          <li>Set <strong>Select type: Web app</strong>, <strong>Execute as: Me</strong>, and <strong>Who has access: Anyone</strong>.</li>
          <li>Copy the URL ending in <code className="bg-white px-1.5 py-0.5 rounded border border-[#E6D9C7] text-[#4C2224] font-mono">/exec</code> and paste it above.</li>
        </ol>
      </div>
    </div>
  );
}
