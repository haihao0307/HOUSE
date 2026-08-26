(() => {
  const originalOpen = indexedDB.open.bind(indexedDB);
  indexedDB.open = (name, version) => {
    const request = version === undefined ? originalOpen(name) : originalOpen(name, version);
    if (name === 'YunnanComponentStudio') {
      request.addEventListener('upgradeneeded', () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('attachments')) {
          const store = db.createObjectStore('attachments', { keyPath: 'id' });
          store.createIndex('moduleId', 'moduleId', { unique: false });
        }
      });
    }
    return request;
  };
})();
