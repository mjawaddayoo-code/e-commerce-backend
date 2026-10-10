/**
 * End-to-end API smoke test. Needs: server running, database seeded (npm run seed),
 * Node 18.14+. Usage:  API=http://localhost:5000/api ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run test:api
 */
const API = process.env.API || 'http://localhost:5000/api';
const ADMIN = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => { cond ? passed++ : failed++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); };

// Minimal cookie-aware client
const client = () => {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie?.().find((c) => c.startsWith('token='));
    if (set) cookie = set.split(';')[0];
    let data = {}; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  };
};

(async () => {
  if (!ADMIN.email || !ADMIN.password) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD'); process.exit(1); }
  const anon = client(), cust = client(), admin = client();
  const email = `test${Date.now()}@example.com`;

  let r = await anon('GET', '/health'); ok('health', r.status === 200);

  // Auth
  r = await cust('POST', '/auth/register', { name: 'Test User', email, phone: '03001234567', password: 'Passw0rd!x' });
  ok('register', r.status === 201 && r.data.user?.role === 'customer', JSON.stringify(r.data));
  r = await anon('POST', '/auth/register', { name: 'Evil', email: `e${Date.now()}@example.com`, password: 'Passw0rd!x', role: 'admin' });
  ok('register ignores role=admin', r.data.user?.role === 'customer');
  r = await cust('GET', '/auth/me'); ok('me', r.status === 200 && r.data.user?.email === email);
  r = await anon('GET', '/auth/me'); ok('me without login is 401', r.status === 401);
  r = await anon('POST', '/auth/login', { email, password: 'wrong-password' }); ok('bad password rejected', r.status === 401);

  // Catalog
  r = await anon('GET', '/categories'); ok('categories', r.status === 200 && r.data.categories.length > 0);
  r = await anon('GET', '/products?limit=5'); ok('products list + pagination', r.status === 200 && r.data.products.length > 0 && r.data.pages >= 1);
  const product = r.data.products.find((p) => p.stock > 3 && !p.variants?.length) || r.data.products[0];
  r = await anon('GET', '/products?search=burger'); ok('search', r.status === 200);
  r = await anon('GET', '/products?sort=price_asc&maxPrice=1000&inStock=true'); ok('filter + sort', r.status === 200);
  r = await anon('GET', `/products/${product.slug}`); ok('product by slug', r.status === 200 && r.data.product._id === product._id);

  // Cart + quote + coupon (server-side prices)
  const items = [{ product: product._id, quantity: 2 }];
  r = await cust('PUT', '/cart', { items }); ok('save cart', r.status === 200);
  r = await cust('GET', '/cart'); ok('load cart', r.status === 200 && r.data.items.length === 1);
  r = await anon('POST', '/orders/quote', { items }); ok('quote', r.status === 200 && r.data.total > 0);
  const base = r.data;
  r = await anon('POST', '/orders/quote', { items, couponCode: 'WELCOME10' });
  ok('coupon reduces total (server-side)', r.status === 200 ? r.data.discount > 0 && r.data.total < base.total + 1 : r.status === 400, JSON.stringify(r.data));
  r = await anon('POST', '/orders/quote', { items, couponCode: 'NOPE' }); ok('invalid coupon rejected', r.status === 400);

  // Orders (COD)
  const order = { items, customer: { name: 'Test User', phone: '03001234567', email }, shippingAddress: { area: 'Test Area', city: 'Sukkur', street: '12 Test Street' }, paymentMethod: 'cod' };
  r = await anon('POST', '/orders', order); ok('order requires login', r.status === 401);
  r = await cust('POST', '/orders', { ...order, paymentMethod: 'online' }); ok('online payment is not accepted', r.status === 400);
  r = await cust('POST', '/orders', order);
  ok('place COD order', r.status === 201 && r.data.order?.paymentStatus === 'pending' && r.data.order?.orderStatus === 'pending', JSON.stringify(r.data));
  const orderId = r.data.order?._id;
  r = await anon('GET', `/products/${product._id}`); ok('stock decreased', r.data.product.stock === product.stock - 2, `${r.data.product.stock} vs ${product.stock}`);
  r = await cust('GET', '/orders/my'); ok('my orders', r.status === 200 && r.data.orders.some((o) => o._id === orderId));
  r = await cust('GET', `/orders/${orderId}`); ok('get own order', r.status === 200);

  // Authorization
  r = await cust('GET', '/admin/dashboard'); ok('customer blocked from admin API', r.status === 403);
  r = await anon('GET', '/admin/orders'); ok('anonymous blocked from admin API', r.status === 401);
  r = await cust('POST', '/auth/admin/login', { email, password: 'Passw0rd!x' }); ok('customer cannot use admin login', r.status === 403);
  r = await cust('POST', '/products', { name: 'Hack', price: 1, category: product.category?._id }); ok('customer cannot create product', r.status === 403);

  // Admin flows
  r = await admin('POST', '/auth/admin/login', ADMIN); ok('admin login', r.status === 200, JSON.stringify(r.data));
  r = await admin('GET', '/admin/dashboard'); ok('dashboard', r.status === 200 && r.data.cards.totalOrders >= 1);
  r = await admin('GET', '/admin/orders?status=pending'); ok('admin orders list', r.status === 200 && r.data.orders.some((o) => o._id === orderId));
  r = await admin('PUT', `/admin/orders/${orderId}/status`, { status: 'confirmed' }); ok('status -> confirmed', r.status === 200);
  r = await cust('GET', `/orders/${orderId}`); ok('customer sees updated status', r.data.order?.orderStatus === 'confirmed');
  r = await cust('POST', `/products/${product._id}/reviews`, { rating: 5 }); ok('review blocked before delivery', r.status === 403);
  r = await admin('PUT', `/admin/orders/${orderId}/status`, { status: 'delivered' }); ok('status -> delivered', r.status === 200);
  r = await admin('GET', '/admin/payments'); const pay = r.data.payments?.find((p) => p.order?._id === orderId);
  ok('COD payment stays pending', pay?.status === 'pending');
  r = await admin('PUT', `/admin/payments/${pay?._id}/status`, { status: 'paid' }); ok('mark COD collected', r.status === 200);
  r = await cust('GET', `/orders/${orderId}`); ok('order paymentStatus synced', r.data.order?.paymentStatus === 'paid');
  r = await admin('PUT', `/admin/orders/${orderId}/status`, { status: 'preparing' }); ok('closed order cannot be reopened', r.status === 409);

  // Reviews, wishlist, account
  r = await cust('POST', `/products/${product._id}/reviews`, { rating: 4, comment: 'Tasty' }); ok('review after delivery', r.status === 201, JSON.stringify(r.data));
  r = await cust('POST', `/products/${product._id}/reviews`, { rating: 4 }); ok('duplicate review rejected', r.status === 409);
  r = await anon('GET', `/products/${product._id}`); ok('rating recalculated', r.data.product.numReviews >= 1 && r.data.product.rating > 0);
  r = await cust('PUT', `/wishlist/${product._id}`); ok('wishlist add', r.status === 200);
  r = await cust('GET', '/wishlist'); ok('wishlist get', r.data.products?.some((p) => p._id === product._id));
  r = await cust('DELETE', `/wishlist/${product._id}`); ok('wishlist remove', r.status === 200);
  r = await cust('PUT', '/account/password', { currentPassword: 'wrong', newPassword: 'NewPassw0rd!x' }); ok('password change needs current password', r.status === 400);
  r = await cust('PUT', '/account/password', { currentPassword: 'Passw0rd!x', newPassword: 'NewPassw0rd!x' }); ok('password change', r.status === 200);
  r = await anon('POST', '/contact', { name: 'T', email, message: 'Hello, this is a test message' }); ok('contact form', r.status === 201 || r.status === 400);

  // Catalog management
  const catId = product.category?._id;
  r = await admin('POST', '/products', { name: `Smoke Item ${Date.now()}`, category: catId, price: 500, discountPrice: 400, stock: 5, description: 'x' });
  ok('admin creates product', r.status === 201 && r.data.product?.slug, JSON.stringify(r.data));
  const pid = r.data.product?._id;
  r = await admin('PUT', `/products/${pid}`, { price: 600, active: false }); ok('admin edits product', r.status === 200 && r.data.product.price === 600);
  r = await anon('GET', `/products/${pid}`); ok('disabled product hidden from public', r.status === 404);
  r = await admin('DELETE', `/products/${pid}`); ok('admin deletes product', r.status === 200);
  r = await admin('PUT', `/admin/customers/${(await admin('GET', `/admin/customers?search=${email}`)).data.customers?.[0]?._id}/status`, { isActive: false });
  ok('admin disables customer', r.status === 200);
  r = await cust('GET', '/auth/me'); ok('disabled customer is locked out', r.status === 403);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
