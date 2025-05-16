import '@src/Options.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { optionsStorage } from '@extension/storage';
import { useState } from 'react';

const Options = () => {
  const options = useStorage(optionsStorage);
  const [inputValue, setInputValue] = useState(options.backendUrl);

  const handleSave = async () => {
    await optionsStorage.set({ backendUrl: inputValue });
  };

  return (
    <div className="App bg-slate-50 text-gray-900">
      <h1 className="text-2xl font-bold mb-4">Extension Options</h1>
      <div className="mb-4">
        <label htmlFor="backendUrl" className="block text-sm font-medium mb-2">
          Backend URL:
        </label>
        <input
          id="backendUrl"
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Enter backend URL"
        />
      </div>
      <button onClick={handleSave} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
        Save
      </button>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div> Loading ... </div>), <div> Error Occur </div>);
