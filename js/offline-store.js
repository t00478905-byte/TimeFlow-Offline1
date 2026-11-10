/* TimeFlow Offline Store: local-first storage + queued Supabase sync */
(function () {
  const getUserId = () => window.timeFlowUser && window.timeFlowUser.id;
  const prefix = () => 'timeflow:' + (getUserId() || 'guest') + ':';
  const queueKey = () => prefix() + 'sync-queue';
  const cacheKey = table => prefix() + table;
  const safeParse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; } };
  const read = key => safeParse(localStorage.getItem(key), []);
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const clone = value => JSON.parse(JSON.stringify(value));
  let syncing = false;

  function applyPending(table, rows) {
    const pending = read(queueKey()).filter(item => item.table === table);
    let result = clone(rows || []);
    for (const item of pending) {
      if (item.action === 'insert') {
        if (!result.some(row => String(row.id) === String(item.row.id))) result.push(item.row);
      } else if (item.action === 'update') {
        result = result.map(row => String(row.id) === String(item.id) ? { ...row, ...item.patch } : row);
      } else if (item.action === 'delete') {
        result = result.filter(row => String(row.id) !== String(item.id));
      }
    }
    return result;
  }

  async function list(table, orderColumn) {
    let cached = read(cacheKey(table));
    if (navigator.onLine && window.timeFlowSupabase && getUserId()) {
      try {
        let query = window.timeFlowSupabase.from(table).select('*').eq('user_id', getUserId());
        if (orderColumn) query = query.order(orderColumn, { ascending: table === 'events' });
        const { data, error } = await query;
        if (error) throw error;
        cached = applyPending(table, data || []);
        write(cacheKey(table), cached);
      } catch (error) {
        console.warn('TimeFlow: تعذر التحديث من الخادم، سيتم استخدام النسخة المحلية.', error);
        cached = applyPending(table, cached);
      }
    } else {
      cached = applyPending(table, cached);
    }
    return cached;
  }

  function emitStatus(extra = {}) {
    window.dispatchEvent(new CustomEvent('timeflow-sync-status', {
      detail: { pending: read(queueKey()).length, ...extra }
    }));
  }

  function enqueue(item) {
    const queue = read(queueKey());
    queue.push({ ...item, queuedAt: Date.now() });
    write(queueKey(), queue);
    emitStatus({ state: navigator.onLine ? 'waiting' : 'offline' });
  }

  async function insert(table, row) {
    const localRow = { ...row, id: row.id || (crypto.randomUUID ? crypto.randomUUID() : 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2)), _offline: true };
    const rows = read(cacheKey(table));
    rows.unshift(localRow);
    write(cacheKey(table), rows);
    enqueue({ table, action: 'insert', row: localRow });
    sync().catch(console.error);
    return localRow;
  }

  async function update(table, id, patch) {
    const rows = read(cacheKey(table));
    const updated = rows.map(row => String(row.id) === String(id) ? { ...row, ...patch, _offline: true } : row);
    write(cacheKey(table), updated);
    enqueue({ table, action: 'update', id, patch });
    sync().catch(console.error);
    return true;
  }

  async function remove(table, id) {
    write(cacheKey(table), read(cacheKey(table)).filter(row => String(row.id) !== String(id)));
    enqueue({ table, action: 'delete', id });
    sync().catch(console.error);
    return true;
  }

  async function sync() {
    if (syncing || !navigator.onLine || !getUserId() || !window.timeFlowSupabase) return;
    syncing = true;
    const initialPending = read(queueKey()).length;
    try {
      let queue = read(queueKey());
      while (queue.length && navigator.onLine) {
        const item = queue[0];
        let result;
        if (item.action === 'insert') {
          const row = { ...item.row }; delete row._offline;
          result = await window.timeFlowSupabase.from(item.table).upsert(row, { onConflict: 'id' });
        } else if (item.action === 'update') {
          result = await window.timeFlowSupabase.from(item.table).update(item.patch).eq('id', item.id).eq('user_id', getUserId());
        } else {
          result = await window.timeFlowSupabase.from(item.table).delete().eq('id', item.id).eq('user_id', getUserId());
        }
        if (result.error) throw result.error;
        queue.shift();
        write(queueKey(), queue);
        if (item.action === 'insert') {
          const rows = read(cacheKey(item.table)).map(row => String(row.id) === String(item.row.id) ? { ...row, _offline: false } : row);
          write(cacheKey(item.table), rows);
        }
      }
      const remaining = read(queueKey()).length;
      emitStatus({ state: remaining ? 'waiting' : 'synced', synced: initialPending > 0 && remaining === 0, lastSyncAt: remaining === 0 ? new Date().toISOString() : null });
    } catch (error) {
      console.warn('TimeFlow: ستتم إعادة المزامنة لاحقاً.', error);
      emitStatus({ state: 'error' });
    } finally { syncing = false; }
  }

  window.TimeFlowOffline = { list, insert, update, remove, sync, pendingCount: () => read(queueKey()).length };
  window.addEventListener('online', () => { emitStatus({ state: 'syncing' }); sync(); });
  window.addEventListener('load', () => setTimeout(sync, 1200));
})();
