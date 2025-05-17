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
    <div className="App bg-slate-50 text-gray-900 p-4">
      <h1 className="text-xl font-bold mb-4">Configuration</h1>
      <div className="space-y-4">
        <div>
          <label htmlFor="backendUrl" className="block text-sm font-medium mb-1">
            Backend URL:
          </label>
          <input
            id="backendUrl"
            type="text"
            value={backendUrl}
            onChange={e => setBackendUrl(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded"
            placeholder="Enter backend URL"
          />
        </div>
        <div>
          <label htmlFor="apiToken" className="block text-sm font-medium mb-1">
            API Token:
          </label>
          <input
            id="apiToken"
            type="password"
            value={apiToken}
            onChange={e => setApiToken(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded"
            placeholder="Enter API token"
          />
        </div>
        <button
          onClick={handleSave}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm">
          Save
        </button>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <div> Loading ... </div>), <div> Error Occur </div>);
