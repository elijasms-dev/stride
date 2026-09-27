// Shared by the authenticated app and the deliberately public offline shell.
// Never put credentials, API responses, or authentication cookies in this store.
export function deviceJournal(change) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    if (!globalThis.indexedDB)
      return fail(new Error('Device storage is unavailable.'));
    const request = indexedDB.open('stride-journal-v1', 1);
    request.onupgradeneeded = () => {
      if (settled) {
        request.transaction?.abort();
        return;
      }
      request.result.createObjectStore('journal');
    };
    request.onerror = () =>
      fail(new Error('Device storage could not be opened.'));
    request.onblocked = () =>
      fail(new Error('Close other Stride tabs to update device storage.'));
    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      let tx;
      try {
        tx = db.transaction('journal', change ? 'readwrite' : 'readonly');
      } catch {
        db.close();
        fail(new Error('Device storage could not be opened.'));
        return;
      }
      const store = tx.objectStore('journal');
      let result;
      const read = store.get('active');
      read.onsuccess = () => {
        if (settled) return;
        try {
          result = change ? change(read.result ?? null) : (read.result ?? null);
          if (change) {
            if (result === null) store.delete('active');
            else store.put(result, 'active');
          }
        } catch (error) {
          tx.abort();
          fail(error);
        }
      };
      tx.oncomplete = () => {
        db.close();
        if (settled) return;
        settled = true;
        resolve(result);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        fail(
          new Error(
            'Device storage is full or unavailable. Your save is not stored on this device.',
          ),
        );
      };
    };
  });
}
