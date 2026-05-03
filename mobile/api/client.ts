import axios from 'axios';

import { API_BASE_URL } from '../constants/Config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  try {
    let token = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      token = window.localStorage.getItem('auth_token');
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      token = await AsyncStorage.getItem('auth_token');
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {}
  return config;
});

export default apiClient;
