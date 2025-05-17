import { showToast } from '../components/Toast';

interface ApiErrorMessages {
  [key: number]: string;
}

const DEFAULT_ERROR_MESSAGES: ApiErrorMessages = {
  401: 'Invalid or missing API token',
  404: 'API endpoint not found',
  405: 'Method not allowed. Please check the backend URL.',
  429: 'Too many requests',
};

export const getHeaders = (apiToken?: string): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }
  return headers;
};

export const validateBackendUrl = (backendUrl?: string): boolean => {
  if (!backendUrl) {
    showToast({
      title: 'Configuration Error',
      message: 'Backend URL is not set. Please configure it in the extension options.',
      type: 'error',
    });
    return false;
  }
  return true;
};

export const fetchApi = async <T>({
  url,
  method = 'GET',
  body,
  apiToken,
  defaultErrorMessage = 'Failed to process request',
}: {
  url: string;
  method?: string;
  body?: unknown;
  apiToken?: string;
  defaultErrorMessage?: string;
}): Promise<T | null> => {
  if (!validateBackendUrl(url)) {
    return null;
  }

  try {
    const response = await fetch(url, {
      method,
      headers: getHeaders(apiToken),
      body: body ? JSON.stringify(body) : undefined,
    });

    return await handleApiResponse<T>(response, defaultErrorMessage);
  } catch (error) {
    handleApiError(error);
    return null;
  }
};

export const handleApiResponse = async <T>(
  response: Response,
  defaultErrorMessage: string = 'Failed to process request',
): Promise<T> => {
  if (!response.ok) {
    const errorMessage =
      DEFAULT_ERROR_MESSAGES[response.status] || (await response.json()).error || defaultErrorMessage;
    showToast({ title: 'API Error', message: errorMessage, type: 'error' });
    throw new Error(`API request failed: ${errorMessage}`);
  }
  return response.json() as Promise<T>;
};

export const handleApiError = (error: unknown, defaultMessage: string = 'An error occurred') => {
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) {
      showToast({
        title: 'Connection Error',
        message: 'Could not connect to the backend server. Please check your connection and the backend URL.',
        type: 'error',
      });
    } else if (!error.message.includes('API request failed')) {
      // Don't show another toast if it's an API error (already shown by handleApiResponse)
      showToast({
        title: 'Error',
        message: error.message || defaultMessage,
        type: 'error',
      });
    }
  }
  throw error;
};
