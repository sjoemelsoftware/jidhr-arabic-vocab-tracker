import { createStorage, StorageEnum } from '../base/index.js';

type OptionsStorageData = {
  backendUrl: string;
};

// Create storage with a default backend URL
export const optionsStorage = createStorage<OptionsStorageData>(
  'options-storage-key',
  { backendUrl: 'http://localhost:8000' }, // Default value
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);
