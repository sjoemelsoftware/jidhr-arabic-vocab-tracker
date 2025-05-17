import { createStorage, StorageEnum } from '../base/index.js';

type OptionsStorageData = {
  backendUrl: string;
  apiToken: string;
};

// Create storage with a default backend URL
export const optionsStorage = createStorage<OptionsStorageData>(
  'options-storage-key',
  {
    backendUrl: 'https://api.jidhr.com/vocabulary',
    apiToken: '',
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);
