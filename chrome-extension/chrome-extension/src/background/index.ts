import 'webextension-polyfill';
import { optionsStorage } from '@extension/storage';

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// Define allowed origins that can send messages to our extension
const ALLOWED_ORIGINS = [
  'https://api.jidhr.com',
  'https://www.jidhr.com',
  'https://jidhr.com',
  'http://localhost:3000',
];

// Handle messages from external websites
chrome.runtime.onMessageExternal.addListener(async (request, sender, sendResponse) => {
  // Verify the sender's origin
  if (!sender.origin || !ALLOWED_ORIGINS.includes(sender.origin)) {
    console.error(`Unauthorized message from ${sender.origin || 'unknown origin'}`);
    sendResponse({ success: false, error: 'Unauthorized origin' });
    return;
  }

  if (request.type === 'PING') {
    sendResponse({ success: true });
    return;
  }

  if (request.type === 'SET_API_KEY') {
    try {
      // Update the API key in storage
      await optionsStorage.set(prev => ({
        ...prev,
        apiToken: request.apiKey,
      }));

      // Show success notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('jidhr_logo_transparant_34.png'),
        title: 'Jidhr.com successfully connected',
        message: 'Your API key has been set successfully. You can now use the extension.',
      });

      sendResponse({ success: true });
    } catch (error) {
      console.error('Error setting API key:', error);
      sendResponse({ success: false, error: 'Failed to set API key' });
    }
  }
});
