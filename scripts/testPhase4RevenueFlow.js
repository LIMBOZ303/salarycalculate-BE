/**
 * Phase 4: Revenue flow tests
 * Prerequisites: server running, MongoDB, admin seeded
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TS = Date.now();

const REVENUE_DATE = '2026-05-29';

let failed = 0;

const createRandomEmail = (prefix) => `${prefix}_${TS}@gmail.com`;

const pickId = (obj) => {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  return obj._id || obj.id || null;
};

const sameId = (a, b) => String(a) === String(b);

const logPass = (msg) => console.log(`  PASS: ${msg}`);
const logFail = (msg, res) => {
  failed += 1;
  console.log(`  FAIL: ${msg}`);
  if (res) {
    console.log(`        status: ${res.status}`);
    console.log(`        body: ${JSON.stringify(res.body, null, 2)}`);
  }
};

const assert = (cond, msg, res) => (cond ? logPass(msg) : logFail(msg, res));

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const options = { method, headers };
  if (body && method !== 'GET') options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, body: json, ok: true };
  } catch (error) {
    const hint =
      error.cause?.code === 'ECONNREFUSED'
        ? `Server not reachable at ${BASE_URL}. Run: npm run dev`
        : error.message;
    return { status: 0, body: { success: false, message: hint }, ok: false };
  }
}

async function getTokenFromLogin(email, password) {
  const res = await request('POST', '/api/auth/login', { email, password });
  return res.body?.data?.token || null;
}

async function runTest(name, fn) {
  console.log(`\n[${name}]`);
  try {
    await fn();
  } catch (e) {
    logFail(`${name}: ${e.message}`);
    console.error(e);
  }
}

async function createAndActivateUser(adminToken, { email, role, branchId = null }) {
  await request('POST', '/api/auth/register', {
    fullName: `User ${email}`,
    phone: `09${String(TS + Math.floor(Math.random() * 10000)).slice(-8)}`,
    email,
    password: '123456',
  });

  const pending = await request('GET', '/api/admin/employees/pending', null, adminToken);
  const users = pending.body?.data?.users || [];
  const user = users.find((u) => u.email === email);
  const userId = pickId(user);

  const rolePayload = branchId ? { role, branchId } : { role };
  await request('PATCH', `/api/admin/users/${userId}/role`, rolePayload, adminToken);
  await request(
    'PATCH',
    `/api/admin/users/${userId}/status`,
    { status: 'active', reason: 'Phase 4 test' },
    adminToken
  );

  const token = await getTokenFromLogin(email, '123456');
  return { userId, token };
}

async function main() {
  if (typeof fetch === 'undefined') {
    console.error('Cần Node.js 18+ (fetch built-in)');
    process.exit(1);
  }

  console.log('=== Phase 4 Revenue Flow Tests ===');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Timestamp: ${TS}`);

  let ADMIN_TOKEN = null;
  let BRANCH_ID = null;
  let OTHER_BRANCH_ID = null;
  let REVENUE_ID = null;
  let MANAGER_TOKEN = null;
  let OWNER_TOKEN = null;
  let EMPLOYEE_TOKEN = null;

  await runTest('1. GET / health', async () => {
    const res = await request('GET', '/');
    assert(res.ok !== false, 'server reachable', res);
    assert(res.status === 200 && res.body?.success === true, 'health ok', res);
  });

  await runTest('2. Admin login', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@gmail.com',
      password: '123456',
    });
    assert(res.status === 200 && res.body?.data?.token, 'admin login', res);
    ADMIN_TOKEN = res.body?.data?.token || null;
  });

  if (!ADMIN_TOKEN) {
    console.error('Run: npm run seed');
    process.exit(1);
  }

  await runTest('3. Admin create branch test', async () => {
    const res = await request(
      'POST',
      '/api/branches',
      {
        name: `Revenue Branch ${TS}`,
        address: 'Revenue Test Address',
        phone: '0900000001',
        latitude: 10.762622,
        longitude: 106.660172,
        allowedRadiusMeters: 100,
      },
      ADMIN_TOKEN
    );
    assert([200, 201].includes(res.status), 'create branch status', res);
    const branch = res.body?.data?.branch || res.body?.data;
    BRANCH_ID = pickId(branch);
    assert(!!BRANCH_ID, 'branch id exists', res);
  });

  await runTest('3b. Admin create other branch', async () => {
    const res = await request(
      'POST',
      '/api/branches',
      {
        name: `Other Branch ${TS}`,
        address: 'Other Address',
        phone: '0900000002',
        latitude: 10.8,
        longitude: 106.7,
        allowedRadiusMeters: 100,
      },
      ADMIN_TOKEN
    );
    OTHER_BRANCH_ID = pickId(res.body?.data?.branch || res.body?.data);
    assert(!!OTHER_BRANCH_ID, 'other branch id exists', res);
  });

  if (!BRANCH_ID) {
    process.exit(1);
  }

  await runTest('4. Admin create revenue for branch', async () => {
    const res = await request(
      'POST',
      '/api/revenues',
      {
        branchId: BRANCH_ID,
        date: REVENUE_DATE,
        cashAmount: 1000000,
        transferAmount: 500000,
        otherAmount: 0,
        orderCount: 80,
        note: 'Doanh thu ngày test',
      },
      ADMIN_TOKEN
    );
    assert([200, 201].includes(res.status), 'create revenue status', res);
    assert(res.body?.success === true, 'create revenue success', res);
    const revenue = res.body?.data?.revenue;
    REVENUE_ID = pickId(revenue);
    assert(!!REVENUE_ID, 'revenue id exists', res);
    assert(revenue?.amount === 1500000, 'amount = cash + transfer + other', res);
  });

  await runTest('5. Admin GET revenues sees record', async () => {
    const res = await request('GET', '/api/revenues', null, ADMIN_TOKEN);
    assert(res.status === 200, 'list status 200', res);
    const revenues = res.body?.data?.revenues || [];
    const found = revenues.some((r) => sameId(pickId(r), REVENUE_ID));
    assert(found, 'admin sees created revenue', res);
  });

  await runTest('6. Admin GET monthly summary', async () => {
    const res = await request(
      'GET',
      '/api/revenues/summary/monthly?month=5&year=2026',
      null,
      ADMIN_TOKEN
    );
    assert(res.status === 200, 'monthly summary 200', res);
    assert(res.body?.data?.totalRevenue >= 1500000, 'totalRevenue >= 1500000', res);
    assert(Array.isArray(res.body?.data?.byBranch), 'byBranch is array', res);
    assert(Array.isArray(res.body?.data?.byDay), 'byDay is array', res);
  });

  await runTest('7. Admin confirm revenue', async () => {
    const res = await request(
      'POST',
      `/api/revenues/${REVENUE_ID}/confirm`,
      {},
      ADMIN_TOKEN
    );
    assert(res.status === 200, 'confirm status 200', res);
    assert(res.body?.data?.revenue?.status === 'confirmed', 'status confirmed', res);
  });

  await runTest('8. Admin can update confirmed revenue', async () => {
    const res = await request(
      'PUT',
      `/api/revenues/${REVENUE_ID}`,
      { note: 'Admin updated confirmed revenue', orderCount: 85 },
      ADMIN_TOKEN
    );
    assert(res.status === 200, 'admin update confirmed 200', res);
    assert(res.body?.success === true, 'admin update confirmed success', res);
    assert(res.body?.data?.revenue?.orderCount === 85, 'orderCount updated', res);
  });

  const managerEmail = createRandomEmail('mgr_rev');
  await runTest('9-11. Create branch_manager and assign branch', async () => {
    const { token } = await createAndActivateUser(ADMIN_TOKEN, {
      email: managerEmail,
      role: 'branch_manager',
      branchId: BRANCH_ID,
    });
    MANAGER_TOKEN = token;
    assert(!!MANAGER_TOKEN, 'manager token exists', { status: 200, body: {} });
  });

  await runTest('12. Branch manager create revenue for own branch', async () => {
    const res = await request(
      'POST',
      '/api/revenues',
      {
        date: '2026-05-30',
        cashAmount: 800000,
        transferAmount: 200000,
        orderCount: 50,
        note: 'Manager revenue',
      },
      MANAGER_TOKEN
    );
    assert([200, 201].includes(res.status), 'manager create own branch', res);
    assert(res.body?.success === true, 'manager create success', res);
  });

  await runTest('13. Branch manager cannot create revenue for other branch', async () => {
    const res = await request(
      'POST',
      '/api/revenues',
      {
        branchId: OTHER_BRANCH_ID,
        date: '2026-05-31',
        cashAmount: 100000,
        transferAmount: 0,
      },
      MANAGER_TOKEN
    );
    assert(res.status === 403, 'manager other branch 403', res);
    assert(res.body?.success === false, 'manager other branch fail', res);
  });

  await runTest('14. Branch manager GET revenues only own branch', async () => {
    const res = await request('GET', '/api/revenues', null, MANAGER_TOKEN);
    assert(res.status === 200, 'manager list 200', res);
    const revenues = res.body?.data?.revenues || [];
    const allOwn = revenues.every((r) =>
      sameId(pickId(r.branchId) || r.branchId, BRANCH_ID)
    );
    assert(revenues.length >= 1 && allOwn, 'manager only sees own branch', res);
  });

  await runTest('15. Branch manager cannot update confirmed revenue', async () => {
    const res = await request(
      'PUT',
      `/api/revenues/${REVENUE_ID}`,
      { note: 'Manager hack' },
      MANAGER_TOKEN
    );
    assert(res.status === 403, 'manager update confirmed 403', res);
    assert(res.body?.success === false, 'manager update confirmed fail', res);
  });

  const ownerEmail = createRandomEmail('owner_rev');
  await runTest('16. Owner GET revenues', async () => {
    const { token } = await createAndActivateUser(ADMIN_TOKEN, {
      email: ownerEmail,
      role: 'owner',
    });
    OWNER_TOKEN = token;

    const res = await request('GET', '/api/revenues', null, OWNER_TOKEN);
    assert(res.status === 200, 'owner GET 200', res);
    assert(res.body?.success === true, 'owner GET success', res);
  });

  await runTest('17. Owner POST revenue blocked (403)', async () => {
    const res = await request(
      'POST',
      '/api/revenues',
      {
        branchId: BRANCH_ID,
        date: '2026-06-01',
        cashAmount: 100000,
      },
      OWNER_TOKEN
    );
    assert(res.status === 403, 'owner POST 403', res);
    assert(res.body?.success === false, 'owner POST fail', res);
  });

  const employeeEmail = createRandomEmail('emp_rev');
  await runTest('18-19. Employee GET revenue blocked (403)', async () => {
    await request('POST', '/api/auth/register', {
      fullName: `Emp Rev ${TS}`,
      phone: `09${String(TS + 999).slice(-8)}`,
      email: employeeEmail,
      password: '123456',
    });

    const pending = await request('GET', '/api/admin/employees/pending', null, ADMIN_TOKEN);
    const empUser = (pending.body?.data?.users || []).find((u) => u.email === employeeEmail);
    const empUserId = pickId(empUser);

    await request(
      'POST',
      `/api/admin/employees/${empUserId}/approve`,
      {
        branchId: BRANCH_ID,
        position: 'Nhân viên test',
        hourlyRate: 27000,
        startDate: '2026-01-01',
      },
      ADMIN_TOKEN
    );

    EMPLOYEE_TOKEN = await getTokenFromLogin(employeeEmail, '123456');
    assert(!!EMPLOYEE_TOKEN, 'employee token', { status: 200, body: {} });

    const res = await request('GET', '/api/revenues', null, EMPLOYEE_TOKEN);
    assert(res.status === 403, 'employee GET 403', res);
    assert(res.body?.success === false, 'employee GET fail', res);
  });

  console.log('\n=== Summary ===');
  if (failed > 0) {
    console.log(`${failed} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('All Phase 4 Revenue tests passed');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
