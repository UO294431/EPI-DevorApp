const getBaseUrl = (): string => {
  const customUrl = localStorage.getItem('CUSTOM_API_URL');
  if (customUrl) {
    return customUrl;
  }
  return import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
};

export const getApiUrl = (): string => {
  return getBaseUrl();
};
