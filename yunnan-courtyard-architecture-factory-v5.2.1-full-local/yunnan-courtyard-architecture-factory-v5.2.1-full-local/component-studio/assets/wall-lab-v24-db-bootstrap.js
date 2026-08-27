(() => {
  const EVENT_NAME = 'yunnan-component-studio-storage';
  const states = {};
  const schemas = {
    attachments: {
      name: 'YunnanComponentStudio',
      version: 2,
      stores: [
        {
          name: 'attachments',
          options: { keyPath: 'id' },
          indexes: [
            { name: 'moduleId', keyPath: 'moduleId', options: { unique: false } }
          ]
        }
      ]
    },
    previews: {
      name: 'YunnanWallStudioV2',
      version: 2,
      stores: [
        { name: 'previews', options: { keyPath: 'attachmentId' }, indexes: [] }
      ]
    }
  };

  function emit(schema, state, extra = {}) {
    const detail = {
      database: schema.name,
      schemaVersion: schema.version,
      state,
      ...extra
    };
    states[schema.name] = detail;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
    return detail;
  }

  function keyPathMatches(actual, expected) {
    if (Array.isArray(actual) || Array.isArray(expected)) {
      return Array.isArray(actual)
        && Array.isArray(expected)
        && actual.length === expected.length
        && actual.every((value, index) => value === expected[index]);
    }
    return actual === expected;
  }

  function storeMatches(store, definition) {
    return keyPathMatches(store.keyPath, definition.options.keyPath)
      && store.autoIncrement === Boolean(definition.options.autoIncrement);
  }

  function indexMatches(index, definition) {
    return keyPathMatches(index.keyPath, definition.keyPath)
      && index.unique === Boolean(definition.options.unique)
      && index.multiEntry === Boolean(definition.options.multiEntry);
  }

  function ensureSchema(request, schema) {
    const db = request.result;
    const transaction = request.transaction;
    if (!transaction) throw new Error(`${schema.name} 缺少升级事务`);
    for (const definition of schema.stores) {
      const store = db.objectStoreNames.contains(definition.name)
        ? transaction.objectStore(definition.name)
        : db.createObjectStore(definition.name, definition.options);
      if (!storeMatches(store, definition)) {
        throw new Error(`${schema.name}/${definition.name} 的主键结构不兼容，已保留原资料`);
      }
      for (const index of definition.indexes) {
        if (store.indexNames.contains(index.name) && !indexMatches(store.index(index.name), index)) {
          store.deleteIndex(index.name);
        }
        if (!store.indexNames.contains(index.name)) {
          store.createIndex(index.name, index.keyPath, index.options);
        }
      }
    }
  }

  function listNames(names) {
    const values = [];
    for (let index = 0; index < names.length; index += 1) {
      const value = typeof names.item === 'function' ? names.item(index) : names[index];
      if (value !== null && value !== undefined) values.push(value);
    }
    return values;
  }

  function inspectSchema(db, schema) {
    const stores = listNames(db.objectStoreNames);
    const missingStores = schema.stores
      .map((definition) => definition.name)
      .filter((name) => !db.objectStoreNames.contains(name));
    if (missingStores.length) {
      throw new Error(`${schema.name} 迁移未完成，缺少 ${missingStores.join('、')}`);
    }
    const indexes = {};
    for (const definition of schema.stores) {
      const transaction = db.transaction(definition.name, 'readonly');
      const store = transaction.objectStore(definition.name);
      if (!storeMatches(store, definition)) {
        throw new Error(`${schema.name}/${definition.name} 的主键结构不兼容，原资料未被修改`);
      }
      indexes[definition.name] = listNames(store.indexNames);
      const missingIndexes = definition.indexes
        .map((index) => index.name)
        .filter((name) => !store.indexNames.contains(name));
      if (missingIndexes.length) {
        throw new Error(`${schema.name}/${definition.name} 迁移未完成，缺少索引 ${missingIndexes.join('、')}`);
      }
      for (const index of definition.indexes) {
        if (!indexMatches(store.index(index.name), index)) {
          throw new Error(`${schema.name}/${definition.name}/${index.name} 的索引结构不兼容`);
        }
      }
    }
    return { version: db.version, stores, indexes };
  }

  function createManager(schema) {
    let connection = null;
    let pending = null;
    let generation = 0;

    function close(reason = 'pagehide') {
      generation += 1;
      if (connection) connection.close();
      connection = null;
      pending = null;
      emit(schema, 'closed', { reason });
    }

    function open() {
      if (connection) return Promise.resolve(connection);
      if (pending) return pending;
      const attempt = ++generation;
      let upgradeError = null;
      let current;
      current = new Promise((resolve, reject) => {
        const request = indexedDB.open(schema.name, schema.version);
        const clearPending = () => {
          if (pending === current) pending = null;
        };
        const abortError = () => new DOMException(`${schema.name} 打开请求已经取消`, 'AbortError');
        request.onupgradeneeded = () => {
          if (attempt !== generation) {
            request.transaction?.abort();
            return;
          }
          try {
            ensureSchema(request, schema);
          } catch (error) {
            upgradeError = error;
            request.transaction?.abort();
          }
        };
        request.onblocked = () => {
          if (attempt !== generation) return;
          emit(schema, 'blocked', {
            message: '资料库正在等待其他 HOUSE 页面关闭旧连接'
          });
        };
        request.onerror = () => {
          const error = upgradeError || request.error || new Error(`${schema.name} 打开失败`);
          clearPending();
          if (attempt !== generation && !upgradeError) {
            reject(abortError());
            return;
          }
          emit(schema, 'error', { name: error.name, message: error.message });
          reject(error);
        };
        request.onsuccess = () => {
          const db = request.result;
          if (attempt !== generation) {
            db.close();
            clearPending();
            reject(abortError());
            return;
          }
          let inspection;
          try {
            inspection = inspectSchema(db, schema);
          } catch (error) {
            db.close();
            clearPending();
            emit(schema, 'error', { name: error.name, message: error.message });
            reject(error);
            return;
          }
          connection = db;
          clearPending();
          db.onversionchange = (event) => {
            db.close();
            if (connection === db) connection = null;
            generation += 1;
            emit(schema, 'versionchange', {
              oldVersion: event.oldVersion,
              newVersion: event.newVersion,
              message: '资料库版本已经更新，请重新载入页面'
            });
          };
          emit(schema, 'ready', inspection);
          resolve(db);
        };
      });
      pending = current;
      return current;
    }

    return { open, close };
  }

  const attachmentManager = createManager(schemas.attachments);
  const previewManager = createManager(schemas.previews);
  const api = {
    version: '2.0.0',
    eventName: EVENT_NAME,
    states,
    schemas,
    openAttachments: attachmentManager.open,
    openPreviews: previewManager.open,
    closeAll(reason = 'manual') {
      attachmentManager.close(reason);
      previewManager.close(reason);
    }
  };

  window.__YUNNAN_COMPONENT_STUDIO_STORAGE__ = api;
  window.addEventListener('pagehide', () => api.closeAll('pagehide'));
})();
