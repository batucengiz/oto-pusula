const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class FakeNode {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.classList = { toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  click() { this.listeners.click?.(); }
}

test('eklenti manifesti site erişimi veya içerik betiği istemez', () => {
  const manifest = JSON.parse(fs.readFileSync(require.resolve('./manifest.json'), 'utf8'));
  assert.deepEqual(manifest.permissions, []);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.action.default_popup, 'popup.html');
});

test('panel boş açılır, örnek veri yüklenince metrikler ve tablolar çizilir', () => {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, new FakeNode(id));
    return nodes.get(id);
  };
  const views = ['overview', 'stock', 'comparables', 'method'].map(name => get(`${name}-view`));
  const nav = ['overview', 'stock', 'comparables', 'method'].map(name => {
    const item = new FakeNode(); item.dataset.view = name; return item;
  });
  const storage = new Map();
  const context = vm.createContext({
    Node: FakeNode,
    document: {
      getElementById: get,
      createElement: () => new FakeNode(),
      querySelectorAll: selector => selector === '.view' ? views : selector === '.nav-button' ? nav : []
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    confirm: () => true,
    window: { print() {} },
    setTimeout,
    console
  });
  vm.runInContext(fs.readFileSync(require.resolve('./core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('./dashboard.js'), 'utf8'), context);
  assert.equal(get('stat-units').textContent, '0');
  assert.equal(get('stock-body').children.length, 1);
  get('load-sample').click();
  assert.equal(get('stat-units').textContent, '3');
  assert.equal(get('stock-body').children.length, 3);
  assert.equal(get('comparable-body').children.length, 10);
  assert.ok(get('action-list').children.length > 0);
  assert.equal(JSON.parse(storage.get('otoPusula_v1')).stock.length, 3);
  nav[1].click();
  assert.equal(get('stock-view').hidden, false);
  assert.equal(get('overview-view').hidden, true);
});
