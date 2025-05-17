import '@src/Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { optionsStorage } from '@extension/storage';
import { useState } from 'react';

const Popup = () => {
  const options = useStorage(optionsStorage);
  const [backendUrl, setBackendUrl] = useState(options.backendUrl);
  const [apiToken, setApiToken] = useState(options.apiToken);

  const handleSave = async () => {
    await optionsStorage.set({
      backendUrl,
      apiToken,
    });
  };

  return (
    <div className="App bg-white text-gray-900 p-6 min-w-[350px] shadow-lg">
      <h1 className="text-xl font-bold text-gray-800">Jidhr.com - Vocab</h1>
      <p className="text-sm text-gray-600 mb-6">Track your Arabic vocabulary while browsing the web.</p>

      <div className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-600 mb-3">Quick Links</div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => chrome.tabs.create({ url: 'https://jidhr.com/vocab' })}
              className="w-full bg-[#73d13d] text-white px-4 py-3 rounded-lg hover:bg-[#65b834] text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow">
              <span>View My Vocabulary</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
            <button
              onClick={() => chrome.tabs.create({ url: 'https://jidhr.com/vocab#api-token' })}
              className="w-full bg-white border-2 border-[#73d13d] text-[#73d13d] px-4 py-3 rounded-lg hover:bg-[#f0fae8] text-sm font-medium flex items-center justify-center gap-2 transition-all">
              <span>Get API Token</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="text-sm font-medium text-gray-600 mb-3">Settings</div>
          <div>
            <label htmlFor="backendUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Backend URL
            </label>
            <input
              id="backendUrl"
              type="text"
              value={backendUrl}
              onChange={e => setBackendUrl(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#73d13d]/20 focus:border-[#73d13d] outline-none transition-all"
              placeholder="Enter backend URL"
            />
          </div>
          <div>
            <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700 mb-1">
              API Token
            </label>
            <input
              id="apiToken"
              type="password"
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#73d13d]/20 focus:border-[#73d13d] outline-none transition-all"
              placeholder="Enter API token"
            />
          </div>
          <button
            onClick={handleSave}
            className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-lg hover:bg-gray-700 text-sm font-medium transition-all shadow-sm hover:shadow">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <div> Loading ... </div>), <div> Error Occur </div>);
